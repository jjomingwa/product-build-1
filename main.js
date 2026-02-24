// --- Game Configuration & Constants ---
const CONFIG = {
    paddleSpeed: 0.15,
    ballSpeed: 0.12,
    ballMaxSpeed: 0.28,
    boundaryX: 6,
    boundaryY: 5,
    paddleWidth: 2,
    paddleHeight: 0.3,
    paddleDepth: 0.5,
    brickWidth: 1.2,
    brickHeight: 0.5,
    brickDepth: 0.5,
    brickPadding: 0.1,
    colors: {
        paddle: 0x00ffff,
        ball: 0xffffff,
        boss: 0xff0000,
        bossProjectile: 0xffaa00,
        grid: 0x003344
    }
};

// --- Sound Manager (Enhanced with BGM) ---
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.bgmNode = null;
        this.bossBgmNode = null;
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Procedural "Mario-like" Happy BGM
    startBGM() {
        if (this.bgmNode) return;
        this.stopBossBGM();
        const tempo = 120;
        const noteDuration = 60 / tempo / 2;
        const melody = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // C E G C G E
        let i = 0;
        
        const playNext = () => {
            if (!this.bgmNode) return;
            this.playTone(melody[i % melody.length], 'triangle', noteDuration, 0.05);
            i++;
            this.bgmTimeout = setTimeout(playNext, noteDuration * 1000);
        };
        this.bgmNode = true;
        playNext();
    }

    // Intense Boss BGM
    startBossBGM() {
        if (this.bossBgmNode) return;
        this.stopBGM();
        const tempo = 160;
        const noteDuration = 60 / tempo / 2;
        const bassLine = [110, 116.54, 123.47, 110]; // A, Bb, B, A low
        let i = 0;

        const playNext = () => {
            if (!this.bossBgmNode) return;
            this.playTone(bassLine[i % bassLine.length], 'sawtooth', noteDuration * 2, 0.08);
            if (i % 2 === 0) this.playTone(440, 'square', 0.05, 0.03); // Sharp accent
            i++;
            this.bossBgmTimeout = setTimeout(playNext, noteDuration * 1000);
        };
        this.bossBgmNode = true;
        playNext();
    }

    stopBGM() { this.bgmNode = false; clearTimeout(this.bgmTimeout); }
    stopBossBGM() { this.bossBgmNode = false; clearTimeout(this.bossBgmTimeout); }

    hitPaddle() { this.playTone(440, 'square', 0.1); }
    hitBrick() { this.playTone(600, 'sine', 0.1); }
    breakBrick() { this.playTone(800, 'sawtooth', 0.15, 0.2); }
    bossHit() { this.playTone(100, 'sawtooth', 0.3, 0.3); }
    shoot() { this.playTone(1200, 'triangle', 0.1, 0.05); }
    powerup() { this.playTone(880, 'sine', 0.5, 0.1); this.playTone(1320, 'sine', 0.5, 0.1); }
}

// --- Background Grid ---
class SpaceGrid {
    constructor(scene) {
        const size = 20;
        const divisions = 20;
        this.grid = new THREE.GridHelper(size, divisions, CONFIG.colors.grid, CONFIG.colors.grid);
        this.grid.position.z = -2;
        this.grid.rotation.x = Math.PI / 2;
        scene.add(this.grid);
    }
    update(time) {
        this.grid.position.y = Math.sin(time * 0.001) * 0.2;
        this.grid.rotation.z += 0.001;
    }
}

// --- Particle & Effect System ---
class EffectSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.debris = [];
    }

    emitExplosion(position, color) {
        // Multi-frame destruction effect: Particles + Debris
        for (let i = 0; i < 20; i++) {
            const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const mat = new THREE.MeshBasicMaterial({ color: color });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(position);
            p.userData = {
                vel: new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5),
                life: 1.0,
                rotVel: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.2)
            };
            this.scene.add(p);
            this.particles.push(p);
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.add(p.userData.vel);
            p.rotation.x += p.userData.rotVel.x;
            p.userData.life -= 0.02;
            p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }
}

// --- Powerup Item ---
class Powerup {
    constructor(scene, position, type) {
        this.type = type; // 'grow'
        const geo = new THREE.OctahedronGeometry(0.2);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x555500 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);
        scene.add(this.mesh);
        this.active = true;
        this.scene = scene;
    }
    update() {
        this.mesh.position.y -= 0.05;
        this.mesh.rotation.y += 0.1;
        if (this.mesh.position.y < -6) this.destroy();
    }
    destroy() {
        this.active = false;
        this.scene.remove(this.mesh);
    }
}

// --- Game Elements ---
class Paddle {
    constructor(scene) {
        this.width = CONFIG.paddleWidth;
        this.geometry = new THREE.BoxGeometry(this.width, CONFIG.paddleHeight, CONFIG.paddleDepth);
        this.material = new THREE.MeshStandardMaterial({ color: CONFIG.colors.paddle, emissive: 0x0044aa });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.y = -3.5;
        scene.add(this.mesh);
        this.isGrown = false;
    }
    grow() {
        if (this.isGrown) return;
        this.isGrown = true;
        this.mesh.scale.x = 2;
        this.width = CONFIG.paddleWidth * 2;
        setTimeout(() => {
            this.mesh.scale.x = 1;
            this.width = CONFIG.paddleWidth;
            this.isGrown = false;
        }, 10000);
    }
    update(input) {
        if (input.left && this.mesh.position.x > -CONFIG.boundaryX + this.width/2) this.mesh.position.x -= CONFIG.paddleSpeed;
        if (input.right && this.mesh.position.x < CONFIG.boundaryX - this.width/2) this.mesh.position.x += CONFIG.paddleSpeed;
    }
}

class Ball {
    constructor(scene, isClone = false) {
        this.geometry = new THREE.SphereGeometry(0.15, 16, 16);
        this.material = new THREE.MeshStandardMaterial({ color: isClone ? 0x00ffff : 0xffffff });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        scene.add(this.mesh);
        this.active = !isClone;
        this.velocity = new THREE.Vector3(0,0,0);
        this.isClone = isClone;
        if (isClone) this.launch();
    }
    reset(paddle) {
        this.mesh.position.set(paddle.mesh.position.x, paddle.mesh.position.y + 0.5, 0);
        this.velocity.set(0, 0, 0);
        this.active = false;
    }
    launch() {
        this.velocity.set((Math.random()-0.5)*0.1, CONFIG.ballSpeed, 0);
        this.active = true;
    }
    update(paddle, bricks, boss, soundManager, effects) {
        if (!this.active) {
            this.mesh.position.x = paddle.mesh.position.x;
            this.mesh.position.y = paddle.mesh.position.y + 0.5;
            return;
        }
        this.mesh.position.add(this.velocity);
        if (Math.abs(this.mesh.position.x) > CONFIG.boundaryX) { this.velocity.x *= -1; soundManager.hitWall(); }
        if (this.mesh.position.y > CONFIG.boundaryY) { this.velocity.y *= -1; soundManager.hitWall(); }
        
        // Paddle Collision
        const box = new THREE.Box3().setFromObject(paddle.mesh);
        const sphere = new THREE.Sphere(this.mesh.position, 0.15);
        if (box.intersectsSphere(sphere)) {
            this.velocity.y = Math.abs(this.velocity.y);
            this.velocity.x = (this.mesh.position.x - paddle.mesh.position.x) * 0.2;
            soundManager.hitPaddle();
        }

        // Brick Collision
        for (let b of bricks) {
            if (b.active && new THREE.Box3().setFromObject(b.mesh).intersectsSphere(sphere)) {
                this.velocity.y *= -1;
                return b.hit();
            }
        }

        // Boss Collision
        if (boss && boss.active && new THREE.Box3().setFromObject(boss.mesh).intersectsSphere(sphere)) {
            this.velocity.y *= -1;
            boss.takeDamage(10);
            soundManager.bossHit();
            effects.emitExplosion(this.mesh.position, CONFIG.colors.boss);
        }
    }
}

class Brick {
    constructor(scene, x, y, type) {
        this.type = type; // normal, multi, item
        this.active = true;
        let color = 0x00ff00;
        if (type === 'multi') color = 0x0000ff; // Blue for multi-ball
        if (type === 'item') color = 0xffff00; // Gold for items
        
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(CONFIG.brickWidth, CONFIG.brickHeight, CONFIG.brickDepth),
            new THREE.MeshStandardMaterial({ color: color })
        );
        this.mesh.position.set(x, y, 0);
        scene.add(this.mesh);
    }
    hit() {
        this.active = false;
        this.mesh.visible = false;
        return { type: this.type, pos: this.mesh.position.clone() };
    }
}

class Boss {
    constructor(scene) {
        this.active = false; this.hp = 500;
        this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5), new THREE.MeshStandardMaterial({ color: 0xff0000, wireframe: true }));
        this.mesh.position.set(0, 3, 0);
        this.mesh.visible = false;
        scene.add(this.mesh);
        this.projectiles = [];
        this.scene = scene;
    }
    activate() { this.active = true; this.mesh.visible = true; }
    takeDamage(n) { 
        this.hp -= n; 
        document.getElementById('boss-health-bar').style.width = (this.hp/500)*100 + '%';
        if (this.hp <= 0) { this.active = false; this.mesh.visible = false; }
    }
    update(time, paddle, soundManager) {
        if (!this.active) return;
        this.mesh.position.x = Math.sin(time*0.002) * 3;
        if (Math.random() < 0.02) this.shoot();
        for (let i = this.projectiles.length-1; i>=0; i--) {
            let p = this.projectiles[i];
            p.position.y -= 0.1;
            if (new THREE.Box3().setFromObject(paddle.mesh).intersectsBox(new THREE.Box3().setFromObject(p))) {
                // Reflect
                p.userData.reflected = true;
            }
            if (p.userData.reflected) {
                p.position.y += 0.2;
                if (new THREE.Box3().setFromObject(this.mesh).intersectsBox(new THREE.Box3().setFromObject(p))) {
                    this.takeDamage(20);
                    this.scene.remove(p);
                    this.projectiles.splice(i, 1);
                }
            }
            if (p.position.y < -6) { this.scene.remove(p); this.projectiles.splice(i, 1); }
        }
    }
    shoot() {
        let p = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        p.position.copy(this.mesh.position);
        p.userData = { reflected: false };
        this.scene.add(p);
        this.projectiles.push(p);
    }
}

// --- Main Engine ---
class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100);
        this.camera.position.set(0, -5, 10); this.camera.lookAt(0,0,0);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const sun = new THREE.PointLight(0xffffff, 1); sun.position.set(0,0,10); this.scene.add(sun);

        this.sound = new SoundManager();
        this.grid = new SpaceGrid(this.scene);
        this.effects = new EffectSystem(this.scene);
        this.paddle = new Paddle(this.scene);
        this.balls = [new Ball(this.scene)];
        this.bricks = [];
        this.boss = new Boss(this.scene);
        this.items = [];
        this.keys = { left: false, right: false };

        window.addEventListener('keydown', e => { 
            if (e.key.includes('Arrow')) this.keys[e.key.toLowerCase().replace('arrow','')] = true;
            if (e.code === 'Space' && !this.balls[0].active) { this.balls[0].launch(); this.sound.startBGM(); }
        });
        window.addEventListener('keyup', e => { if (e.key.includes('Arrow')) this.keys[e.key.toLowerCase().replace('arrow','')] = false; });

        this.startLevel(1);
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    startLevel(lvl) {
        this.level = lvl;
        document.getElementById('level').innerText = lvl;
        this.bricks.forEach(b => this.scene.remove(b.mesh));
        this.bricks = [];
        
        if (lvl === 4) {
            this.boss.activate();
            this.sound.startBossBGM();
        } else {
            for (let r=0; r<4+lvl; r++) {
                for (let c=0; c<8; c++) {
                    let type = 'normal';
                    if (Math.random() < 0.15) type = 'multi';
                    if (Math.random() < 0.1) type = 'item';
                    this.bricks.push(new Brick(this.scene, -4.5 + c*1.3, 1 + r*0.6, type));
                }
            }
        }
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        this.grid.update(time);
        this.effects.update();
        this.paddle.update(this.keys);
        this.boss.update(time, this.paddle, this.sound);

        // Balls update
        for (let i = this.balls.length-1; i>=0; i--) {
            let res = this.balls[i].update(this.paddle, this.bricks, this.boss, this.sound, this.effects);
            if (res) {
                this.sound.breakBrick();
                this.effects.emitExplosion(res.pos, 0x00ff00);
                if (res.type === 'multi') {
                    this.balls.push(new Ball(this.scene, true), new Ball(this.scene, true));
                    this.balls[this.balls.length-1].mesh.position.copy(res.pos);
                    this.balls[this.balls.length-2].mesh.position.copy(res.pos);
                }
                if (res.type === 'item') {
                    this.items.push(new Powerup(this.scene, res.pos, 'grow'));
                }
            }
            if (this.balls[i].mesh.position.y < -6) {
                if (this.balls.length > 1) {
                    this.scene.remove(this.balls[i].mesh);
                    this.balls.splice(i, 1);
                } else {
                    this.balls[i].reset(this.paddle);
                }
            }
        }

        // Items update
        for (let i = this.items.length-1; i>=0; i--) {
            this.items[i].update();
            if (new THREE.Box3().setFromObject(this.paddle.mesh).intersectsBox(new THREE.Box3().setFromObject(this.items[i].mesh))) {
                this.paddle.grow();
                this.sound.powerup();
                this.items[i].destroy();
                this.items.splice(i, 1);
            }
        }

        if (this.bricks.length > 0 && this.bricks.every(b => !b.active)) {
            this.startLevel(this.level + 1);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();

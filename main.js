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

// --- Sound Manager (Jersey Club + New Age Pop) ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.bgmNode = null;
        this.bossBgmNode = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type, duration, vol = 0.1, decay = true) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        if (decay) gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playKick() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    startBGM() {
        this.init();
        if (this.bgmNode) return;
        this.stopBossBGM();
        this.bgmNode = true;
        const tempo = 140; 
        const beat = 60 / tempo;
        let step = 0;
        
        const chords = [
            [261.63, 329.63, 392.00], // C
            [196.00, 246.94, 293.66], // G
            [220.00, 261.63, 329.63], // Am
            [174.61, 220.00, 261.63]  // F
        ];

        const playLoop = () => {
            if (!this.bgmNode) return;
            const kickSteps = [1, 0, 0, 1, 0, 1, 0, 0];
            if (kickSteps[step % 8]) this.playKick();
            if (step % 16 === 0) {
                const chord = chords[Math.floor(step / 16) % chords.length];
                chord.forEach(f => this.playTone(f, 'sine', beat * 8, 0.03, false));
            }
            step++;
            this.bgmTimeout = setTimeout(playLoop, (beat / 2) * 1000);
        };
        playLoop();
    }

    startBossBGM() {
        this.init();
        if (this.bossBgmNode) return;
        this.stopBGM();
        this.bossBgmNode = true;
        const tempo = 155;
        const beat = 60 / tempo;
        let step = 0;

        const playLoop = () => {
            if (!this.bossBgmNode) return;
            this.playKick();
            if (step % 4 === 0) this.playTone(110, 'sawtooth', beat, 0.05);
            step++;
            this.bossBgmTimeout = setTimeout(playLoop, (beat / 2) * 1000);
        };
        playLoop();
    }

    stopBGM() { this.bgmNode = false; clearTimeout(this.bgmTimeout); }
    stopBossBGM() { this.bossBgmNode = false; clearTimeout(this.bossBgmTimeout); }

    hitPaddle() { this.playTone(440, 'triangle', 0.1, 0.05); }
    hitWall() { this.playTone(330, 'sine', 0.05, 0.02); }
    hitBrick() { this.playTone(600, 'sine', 0.1, 0.05); }
    breakBrick() { this.playTone(800, 'sawtooth', 0.15, 0.1); }
    bossHit() { this.playTone(100, 'sawtooth', 0.3, 0.2); }
    powerup() { this.playTone(880, 'sine', 0.5, 0.05); this.playTone(1320, 'sine', 0.5, 0.05); }
}

// --- Visual Systems ---
class Starfield {
    constructor(scene) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        for (let i = 0; i < 1500; i++) {
            vertices.push((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 20);
            const c = new THREE.Color();
            c.setHSL(Math.random(), 0.7, 0.7);
            colors.push(c.r, c.g, c.b);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.8 }));
        scene.add(this.stars);
    }
    update(time) {
        this.stars.rotation.y = time * 0.0001;
    }
}

class Boundary {
    constructor(scene) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2 });
        this.walls = [
            new THREE.Mesh(new THREE.BoxGeometry(0.1, 12, 0.1), mat),
            new THREE.Mesh(new THREE.BoxGeometry(0.1, 12, 0.1), mat),
            new THREE.Mesh(new THREE.BoxGeometry(13, 0.1, 0.1), mat)
        ];
        this.walls[0].position.set(-6.2, 0, 0);
        this.walls[1].position.set(6.2, 0, 0);
        this.walls[2].position.set(0, 5.2, 0);
        this.walls.forEach(w => scene.add(w));
    }
    update(time) {
        const intensity = 1.5 + Math.sin(time * 0.005) * 0.5;
        this.walls.forEach(w => w.material.emissiveIntensity = intensity);
    }
}

class SpaceGrid {
    constructor(scene) {
        this.grid = new THREE.GridHelper(30, 30, 0x00ffff, 0x003344);
        this.grid.position.z = -5;
        this.grid.rotation.x = Math.PI / 2;
        scene.add(this.grid);
    }
    update(time) {
        this.grid.material.color.setHSL((time * 0.0001) % 1.0, 0.8, 0.5);
        this.grid.position.y = Math.sin(time * 0.001) * 0.3;
    }
}

class EffectSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }
    emitExplosion(pos, color) {
        for (let i = 0; i < 15; i++) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color }));
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3), life: 1.0 };
            this.scene.add(p);
            this.particles.push(p);
        }
    }
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.add(p.userData.vel);
            p.userData.life -= 0.02;
            p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }
}

// --- Brick System ---
function createBrickTexture(colorHex, patternType) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const color = `#${new THREE.Color(colorHex).getHexString()}`;
    ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, 128, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(4, 4, 120, 56);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    if (patternType === 'hatch') {
        for(let i=-64; i<128; i+=12) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i+64, 64); ctx.stroke(); }
    } else if (patternType === 'dotted') {
        for(let x=10; x<128; x+=20) for(let y=10; y<64; y+=20) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill(); }
    } else if (patternType === 'lightning') {
        ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(100, 20); ctx.lineTo(40, 40); ctx.lineTo(110, 55); ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}

class Brick {
    constructor(scene, x, y, typeIndex, hp = 1) {
        this.active = true; this.scene = scene; this.hp = hp; this.typeIndex = typeIndex;
        const colors = [0x44ff44, 0x4488ff, 0xff4488, 0x44ffff, 0xffff44, 0xeeeeee, 0xff8844];
        const color = colors[typeIndex % colors.length];
        const patterns = ['plain', 'hatch', 'dotted', 'lightning'];
        const pattern = patterns[typeIndex % patterns.length];
        const shape = new THREE.Shape();
        const w = 1.2, h = 0.5, r = 0.12;
        shape.moveTo(-w/2+r, -h/2); shape.lineTo(w/2-r, -h/2); shape.quadraticCurveTo(w/2, -h/2, w/2, -h/2+r);
        shape.lineTo(w/2, h/2-r); shape.quadraticCurveTo(w/2, h/2, w/2-r, h/2);
        shape.lineTo(-w/2+r, h/2); shape.quadraticCurveTo(-w/2, h/2, -w/2, h/2-r);
        shape.lineTo(-w/2, -h/2+r); shape.quadraticCurveTo(-w/2, -h/2, -w/2+r, -h/2);
        this.geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
        this.material = new THREE.MeshStandardMaterial({ map: createBrickTexture(color, pattern), roughness: 0.3, metalness: 0.5 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(x, y, -0.25);
        scene.add(this.mesh);
    }
    hit() {
        this.hp--;
        if (this.hp <= 0) { this.active = false; this.mesh.visible = false; return { destroyed: true, type: this.getPowerupType(), pos: this.mesh.position.clone() }; }
        this.material.emissive.setHex(0x333333); setTimeout(() => { if (this.active) this.material.emissive.setHex(0x000000); }, 50);
        return { destroyed: false };
    }
    getPowerupType() { if (this.typeIndex === 3) return 'multi'; if (this.typeIndex === 4) return 'item'; return 'normal'; }
}

// --- Paddle & Ball ---
class Paddle {
    constructor(scene) {
        this.width = 2;
        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0044aa }));
        this.mesh.position.y = -3.5;
        scene.add(this.mesh);
        this.isGrown = false;
    }
    grow() {
        if (this.isGrown) return; this.isGrown = true; this.mesh.scale.x = 2; this.width = 4;
        setTimeout(() => { this.mesh.scale.x = 1; this.width = 2; this.isGrown = false; }, 10000);
    }
    update(input) {
        if (input.left && this.mesh.position.x > -5) this.mesh.position.x -= 0.15;
        if (input.right && this.mesh.position.x < 5) this.mesh.position.x += 0.15;
    }
}

class Ball {
    constructor(scene, isClone = false) {
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshStandardMaterial({ color: isClone ? 0x00ffff : 0xffffff }));
        scene.add(this.mesh);
        this.active = false; this.velocity = new THREE.Vector3(0,0,0);
        if (isClone) this.launch();
    }
    reset(paddle) { this.mesh.position.set(paddle.mesh.position.x, paddle.mesh.position.y + 0.5, 0); this.velocity.set(0, 0, 0); this.active = false; }
    launch() { this.velocity.set((Math.random()-0.5)*0.2, 0.12, 0); this.active = true; }
    update(paddle, bricks, boss, soundManager, effects) {
        if (!this.active) { this.mesh.position.x = paddle.mesh.position.x; this.mesh.position.y = paddle.mesh.position.y + 0.5; return; }
        this.mesh.position.add(this.velocity);
        if (Math.abs(this.mesh.position.x) > 6) { this.velocity.x *= -1; soundManager.hitWall(); }
        if (this.mesh.position.y > 5) { this.velocity.y *= -1; soundManager.hitWall(); }
        const box = new THREE.Box3().setFromObject(paddle.mesh);
        if (box.intersectsSphere(new THREE.Sphere(this.mesh.position, 0.15))) {
            this.velocity.y = Math.abs(this.velocity.y);
            this.velocity.x = (this.mesh.position.x - paddle.mesh.position.x) * 0.2;
            soundManager.hitPaddle();
        }
        for (let b of bricks) if (b.active && new THREE.Box3().setFromObject(b.mesh).intersectsSphere(new THREE.Sphere(this.mesh.position, 0.15))) {
            this.velocity.y *= -1; this.mesh.position.y += this.velocity.y > 0 ? 0.1 : -0.1;
            return b.hit();
        }
        if (boss && boss.active && new THREE.Box3().setFromObject(boss.mesh).intersectsSphere(new THREE.Sphere(this.mesh.position, 0.15))) {
            this.velocity.y *= -1; boss.takeDamage(10); soundManager.bossHit(); effects.emitExplosion(this.mesh.position, 0xff0000);
        }
    }
}

class Boss {
    constructor(scene) {
        this.active = false; this.hp = 500; this.scene = scene;
        this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5), new THREE.MeshStandardMaterial({ color: 0xff0000, wireframe: true }));
        this.mesh.position.set(0, 3, 0); this.mesh.visible = false;
        scene.add(this.mesh);
        this.projectiles = [];
    }
    activate() { this.active = true; this.mesh.visible = true; }
    takeDamage(n) { this.hp -= n; document.getElementById('boss-health-bar').style.width = (this.hp/500)*100 + '%'; if (this.hp <= 0) { this.active = false; this.mesh.visible = false; } }
    update(time, paddle, soundManager) {
        if (!this.active) return;
        this.mesh.position.x = Math.sin(time*0.002) * 3;
        if (Math.random() < 0.02) this.shoot();
        for (let i = this.projectiles.length-1; i>=0; i--) {
            let p = this.projectiles[i]; p.position.y -= 0.1;
            if (new THREE.Box3().setFromObject(paddle.mesh).intersectsBox(new THREE.Box3().setFromObject(p))) p.userData.reflected = true;
            if (p.userData.reflected) {
                p.position.y += 0.2;
                if (new THREE.Box3().setFromObject(this.mesh).intersectsBox(new THREE.Box3().setFromObject(p))) { this.takeDamage(20); this.scene.remove(p); this.projectiles.splice(i, 1); }
            }
            if (p.position.y < -6) { this.scene.remove(p); this.projectiles.splice(i, 1); }
        }
    }
    shoot() {
        let p = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        p.position.copy(this.mesh.position); p.userData = { reflected: false };
        this.scene.add(p); this.projectiles.push(p);
    }
}

// --- Game Engine ---
class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100);
        this.camera.position.set(0, -5, 10); this.camera.lookAt(0,0,0);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const sun = new THREE.PointLight(0xffffff, 1.5); sun.position.set(0,0,15); this.scene.add(sun);
        this.sound = new SoundManager(); this.starfield = new Starfield(this.scene); this.boundary = new Boundary(this.scene);
        this.grid = new SpaceGrid(this.scene); this.effects = new EffectSystem(this.scene);
        this.paddle = new Paddle(this.scene); this.balls = [new Ball(this.scene)];
        this.bricks = []; this.boss = new Boss(this.scene); this.items = [];
        this.keys = { left: false, right: false }; this.score = 0; this.lives = 3; this.state = 'playing';

        window.addEventListener('keydown', e => { 
            if (e.key === 'ArrowLeft') this.keys.left = true; if (e.key === 'ArrowRight') this.keys.right = true;
            if (e.code === 'Space' && !this.balls[0].active) { this.balls[0].launch(); this.sound.startBGM(); }
        });
        window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft') this.keys.left = false; if (e.key === 'ArrowRight') this.keys.right = false; });
        window.addEventListener('mousemove', e => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const targetX = (((e.clientX - rect.left) / rect.width) * 2 - 1) * 6;
            this.paddle.mesh.position.x = Math.max(-5, Math.min(5, targetX));
        });
        document.getElementById('restart-btn').onclick = () => this.restartGame();
        this.startLevel(1); this.animate = this.animate.bind(this); requestAnimationFrame(this.animate);
    }

    startLevel(lvl) {
        this.level = lvl; document.getElementById('level').innerText = lvl;
        this.bricks.forEach(b => this.scene.remove(b.mesh)); this.bricks = [];
        this.items.forEach(item => item.destroy()); this.items = [];
        if (this.balls.length > 1) { for (let i = 1; i < this.balls.length; i++) this.scene.remove(this.balls[i].mesh); this.balls = [this.balls[0]]; }
        this.balls[0].reset(this.paddle); this.boss.active = false; this.boss.mesh.visible = false;
        document.getElementById('boss-hud').style.display = 'none';
        if (lvl === 5) { this.boss.activate(); document.getElementById('boss-hud').style.display = 'block'; this.sound.startBossBGM(); }
        else {
            this.sound.startBGM(); const rows = 4 + (lvl - 1); const cols = 8;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const x = -4.5 + c * 1.3, y = 1 + r * 0.6; let typeIndex = 0, hp = 1;
                if (lvl === 1) typeIndex = c % 2;
                else if (lvl === 2) { typeIndex = (r + c) % 3; if ((r + c) % 2 === 0) continue; }
                else if (lvl === 3) { if (c >= 2 && c <= 5 && r >= 1 && r <= 3) { typeIndex = 2; hp = 2; } else typeIndex = 1; }
                else if (lvl === 4) { const dist = Math.abs(c - 3.5) + Math.abs(r - 2.5); if (dist > 3) continue; typeIndex = Math.floor(dist); if (dist < 1) hp = 3; }
                if (Math.random() < 0.08) typeIndex = 3; if (Math.random() < 0.05) typeIndex = 4;
                this.bricks.push(new Brick(this.scene, x, y, typeIndex, hp));
            }
        }
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        if (this.state === 'gameover') { this.renderer.render(this.scene, this.camera); return; }
        this.starfield.update(time); this.boundary.update(time); this.grid.update(time); this.effects.update();
        this.paddle.update(this.keys); this.boss.update(time, this.paddle, this.sound);
        for (let i = this.balls.length-1; i>=0; i--) {
            let res = this.balls[i].update(this.paddle, this.bricks, this.boss, this.sound, this.effects);
            if (res && res.destroyed) {
                this.sound.breakBrick(); this.effects.emitExplosion(res.pos, 0x00ff00); this.score += 100; document.getElementById('score').innerText = this.score;
                if (res.type === 'multi' && this.balls.length < 5) { this.balls.push(new Ball(this.scene, true), new Ball(this.scene, true)); this.balls[this.balls.length-1].mesh.position.copy(res.pos); this.balls[this.balls.length-2].mesh.position.copy(res.pos); }
                if (res.type === 'item') this.items.push(new Powerup(this.scene, res.pos, 'grow'));
            } else if (res) this.sound.hitBrick();
            if (this.balls[i].mesh.position.y < -6) {
                if (this.balls.length > 1) { this.scene.remove(this.balls[i].mesh); this.balls.splice(i, 1); }
                else { this.lives--; document.getElementById('lives').innerText = this.lives; if (this.lives <= 0) { this.state = 'gameover'; document.getElementById('message-title').innerText = "GAME OVER"; document.getElementById('message-sub').innerText = "SCORE: " + this.score; document.getElementById('restart-btn').style.display = 'inline-block'; document.getElementById('message-overlay').style.display = 'block'; } else this.balls[i].reset(this.paddle); }
            }
        }
        for (let i = this.items.length-1; i>=0; i--) {
            this.items[i].update();
            if (new THREE.Box3().setFromObject(this.paddle.mesh).intersectsBox(new THREE.Box3().setFromObject(this.items[i].mesh))) { this.paddle.grow(); this.sound.powerup(); this.items[i].destroy(); this.items.splice(i, 1); }
        }
        if (this.state === 'playing' && this.bricks.length > 0 && this.bricks.every(b => !b.active)) {
            if (this.level < 5) this.startLevel(this.level + 1);
            else { this.state = 'gameover'; document.getElementById('message-title').innerText = "VICTORY!"; document.getElementById('message-sub').innerText = "SCORE: " + this.score; document.getElementById('restart-btn').style.display = 'inline-block'; document.getElementById('message-overlay').style.display = 'block'; }
        }
        if (this.state === 'playing' && this.level === 5 && !this.boss.active) { this.state = 'gameover'; document.getElementById('message-title').innerText = "VICTORY!"; document.getElementById('message-sub').innerText = "SCORE: " + this.score; document.getElementById('restart-btn').style.display = 'inline-block'; document.getElementById('message-overlay').style.display = 'block'; }
        this.renderer.render(this.scene, this.camera);
    }

    restartGame() { this.score = 0; this.lives = 3; this.level = 1; document.getElementById('score').innerText = '0'; document.getElementById('lives').innerText = '3'; document.getElementById('level').innerText = '1'; document.getElementById('message-overlay').style.display = 'none'; document.getElementById('restart-btn').style.display = 'none'; this.bricks.forEach(b => this.scene.remove(b.mesh)); this.bricks = []; this.items.forEach(item => item.destroy()); this.items = []; this.balls.forEach(b => this.scene.remove(b.mesh)); this.balls = [new Ball(this.scene)]; this.boss.hp = 500; this.boss.active = false; this.boss.mesh.visible = false; this.state = 'playing'; this.startLevel(1); }
}

new Game();

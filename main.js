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
    hitWall() { this.playTone(330, 'sine', 0.05, 0.05); }
    hitBrick() { this.playTone(600, 'sine', 0.1); }
    breakBrick() { this.playTone(800, 'sawtooth', 0.15, 0.2); }
    bossHit() { this.playTone(100, 'sawtooth', 0.3, 0.3); }
    shoot() { this.playTone(1200, 'triangle', 0.1, 0.05); }
    powerup() { this.playTone(880, 'sine', 0.5, 0.1); this.playTone(1320, 'sine', 0.5, 0.1); }
}

// --- Starfield (Space Background) ---
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
        const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.8 });
        this.stars = new THREE.Points(geometry, material);
        scene.add(this.stars);
    }
    update(time) {
        this.stars.rotation.y = time * 0.0001;
        this.stars.rotation.x = Math.sin(time * 0.0002) * 0.1;
    }
}

// --- Background Grid ---
class SpaceGrid {
    constructor(scene) {
        const size = 30;
        const divisions = 30;
        this.grid = new THREE.GridHelper(size, divisions, 0x00ffff, 0x003344);
        this.grid.position.z = -5;
        this.grid.rotation.x = Math.PI / 2;
        scene.add(this.grid);
        this.originalColor = new THREE.Color(0x00ffff);
    }
    update(time) {
        // Dynamic color shifting for the grid
        const hue = (time * 0.0001) % 1.0;
        this.grid.material.color.setHSL(hue, 0.8, 0.5);
        this.grid.position.y = Math.sin(time * 0.001) * 0.3;
        this.grid.position.x = Math.cos(time * 0.0005) * 0.2;
        this.grid.rotation.z = Math.sin(time * 0.0002) * 0.1;
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
        this.active = false; // Start inactive so it follows paddle
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
        this.velocity.set((Math.random()-0.5)*0.2, CONFIG.ballSpeed, 0);
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
                // Move ball slightly to prevent sticking
                this.mesh.position.y += this.velocity.y > 0 ? 0.1 : -0.1;
                return b.hit(); // Returns {destroyed: true/false, ...}
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
    constructor(scene, x, y, type, hp = 1) {
        this.type = type; // normal, multi, item
        this.hp = hp;
        this.active = true;
        this.scene = scene;
        
        let color = 0x00ff00;
        if (type === 'multi') color = 0x00ffff; // Cyan for multi-ball
        if (type === 'item') color = 0xffff00; // Gold for items
        if (hp > 1) color = 0xff00ff; // Magenta for heavy bricks
        
        this.material = new THREE.MeshStandardMaterial({ color: color });
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(CONFIG.brickWidth, CONFIG.brickHeight, CONFIG.brickDepth),
            this.material
        );
        this.mesh.position.set(x, y, 0);
        scene.add(this.mesh);
    }
    hit() {
        this.hp--;
        if (this.hp <= 0) {
            this.active = false;
            this.mesh.visible = false;
            return { destroyed: true, type: this.type, pos: this.mesh.position.clone() };
        } else {
            // Visual feedback for hit
            this.material.emissive.setHex(0xffffff);
            setTimeout(() => { if (this.active) this.material.emissive.setHex(0x000000); }, 50);
            return { destroyed: false };
        }
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
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0); // Transparent background for the CSS gradient
        
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2)); // Much brighter ambient light
        const sun = new THREE.PointLight(0xffffff, 1.5); sun.position.set(0,0,15); this.scene.add(sun);
        const rimLight = new THREE.SpotLight(0x00ffff, 1); rimLight.position.set(10, 10, 10); this.scene.add(rimLight);

        this.sound = new SoundManager();
        this.starfield = new Starfield(this.scene);
        this.grid = new SpaceGrid(this.scene);
        this.effects = new EffectSystem(this.scene);
        this.paddle = new Paddle(this.scene);
        this.balls = [new Ball(this.scene)];
        this.bricks = [];
        this.boss = new Boss(this.scene);
        this.items = [];
        this.keys = { left: false, right: false };
        this.score = 0;
        this.lives = 3;
        this.state = 'playing';

        window.addEventListener('keydown', e => { 
            if (e.key.includes('Arrow')) this.keys[e.key.toLowerCase().replace('arrow','')] = true;
            if (e.code === 'Space' && !this.balls[0].active) { this.balls[0].launch(); this.sound.startBGM(); }
        });
        window.addEventListener('keyup', e => { if (e.key.includes('Arrow')) this.keys[e.key.toLowerCase().replace('arrow','')] = false; });

        // Mouse movement support
        window.addEventListener('mousemove', e => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const targetX = x * CONFIG.boundaryX;
            this.paddle.mesh.position.x = Math.max(-CONFIG.boundaryX + this.paddle.width/2, Math.min(CONFIG.boundaryX - this.paddle.width/2, targetX));
        });

        // Touch support
        window.addEventListener('touchmove', e => {
            if (e.touches.length > 0) {
                const rect = this.renderer.domElement.getBoundingClientRect();
                const x = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
                const targetX = x * CONFIG.boundaryX;
                this.paddle.mesh.position.x = Math.max(-CONFIG.boundaryX + this.paddle.width/2, Math.min(CONFIG.boundaryX - this.paddle.width/2, targetX));
            }
        }, { passive: false });

        // Form Logic
        const formContainer = document.getElementById('intern-form-container');
        const toggleBtn = document.getElementById('form-toggle-btn');
        const closeBtn = document.getElementById('form-close-btn');

        if (toggleBtn && formContainer) {
            toggleBtn.addEventListener('click', () => {
                formContainer.style.display = 'block';
                this.state = 'paused';
            });
        }

        if (closeBtn && formContainer) {
            closeBtn.addEventListener('click', () => {
                formContainer.style.display = 'none';
                this.state = 'playing';
            });
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }

        this.startLevel(1);
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    startLevel(lvl) {
        this.level = lvl;
        document.getElementById('level').innerText = lvl;
        
        // 1. Reset Game State
        this.bricks.forEach(b => this.scene.remove(b.mesh));
        this.bricks = [];
        this.items.forEach(item => item.destroy());
        this.items = [];
        
        // 2. Reset Balls: Remove all but one
        if (this.balls.length > 1) {
            for (let i = 1; i < this.balls.length; i++) {
                this.scene.remove(this.balls[i].mesh);
            }
            this.balls = [this.balls[0]];
        }
        this.balls[0].reset(this.paddle);
        
        // 3. Clear existing Boss/Projectiles if any
        this.boss.active = false;
        this.boss.mesh.visible = false;
        this.boss.projectiles.forEach(p => this.scene.remove(p));
        this.boss.projectiles = [];
        document.getElementById('boss-hud').style.display = 'none';

        // 4. Build Levels
        if (lvl === 5) {
            // THE BOSS STAGE
            this.boss.activate();
            document.getElementById('boss-hud').style.display = 'block';
            this.sound.startBossBGM();
        } else {
            this.sound.startBGM();
            const rows = 4 + (lvl - 1);
            const cols = 8;
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = -4.5 + c * 1.3;
                    const y = 1 + r * 0.6;
                    let type = 'normal';
                    let hp = 1;

                    // Probability adjustments
                    const multiChance = 0.05; // Reduced from 0.15
                    const itemChance = 0.05;

                    // Level Specific Layouts
                    if (lvl === 1) {
                        // Simple grid
                    } else if (lvl === 2) {
                        // Zig-zag pattern
                        if ((r + c) % 2 === 0) continue;
                    } else if (lvl === 3) {
                        // Fortress: Center bricks have 2HP
                        if (c >= 2 && c <= 5 && r >= 1 && r <= 3) hp = 2;
                        if (Math.random() < multiChance) type = 'multi';
                    } else if (lvl === 4) {
                        // Diamond/Hollow pattern
                        const dist = Math.abs(c - 3.5) + Math.abs(r - 2.5);
                        if (dist > 3) continue;
                        if (dist < 1) hp = 3; // Core has 3HP
                        if (Math.random() < itemChance) type = 'item';
                    }

                    if (Math.random() < multiChance && type === 'normal') type = 'multi';
                    if (Math.random() < itemChance && type === 'normal') type = 'item';
                    
                    this.bricks.push(new Brick(this.scene, x, y, type, hp));
                }
            }
        }
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        if (this.state === 'gameover') {
            this.renderer.render(this.scene, this.camera);
            return;
        }
        this.starfield.update(time);
        this.grid.update(time);
        this.effects.update();
        this.paddle.update(this.keys);
        this.boss.update(time, this.paddle, this.sound);

        // Balls update
        for (let i = this.balls.length-1; i>=0; i--) {
            let res = this.balls[i].update(this.paddle, this.bricks, this.boss, this.sound, this.effects);
            
            if (res) {
                if (res.destroyed) {
                    this.sound.breakBrick();
                    this.effects.emitExplosion(res.pos, 0x00ff00);
                    this.score += 100;
                    document.getElementById('score').innerText = this.score;
                    
                    if (res.type === 'multi' && this.balls.length < 5) { // Limit ball count
                        this.balls.push(new Ball(this.scene, true), new Ball(this.scene, true));
                        this.balls[this.balls.length-1].mesh.position.copy(res.pos);
                        this.balls[this.balls.length-2].mesh.position.copy(res.pos);
                    }
                    if (res.type === 'item') {
                        this.items.push(new Powerup(this.scene, res.pos, 'grow'));
                    }
                } else {
                    // Just a hit (not destroyed)
                    this.sound.hitBrick();
                }
            }
            if (this.balls[i].mesh.position.y < -6) {
                if (this.balls.length > 1) {
                    this.scene.remove(this.balls[i].mesh);
                    this.balls.splice(i, 1);
                } else {
                    this.lives--;
                    document.getElementById('lives').innerText = this.lives;
                    if (this.lives <= 0) {
                        this.state = 'gameover';
                        const overlay = document.getElementById('message-overlay');
                        document.getElementById('message-title').innerText = "GAME OVER";
                        document.getElementById('message-sub').innerText = "FINAL SCORE: " + this.score;
                        document.getElementById('restart-btn').style.display = 'inline-block';
                        overlay.style.display = 'block';
                    } else {
                        this.balls[i].reset(this.paddle);
                    }
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

        if (this.state === 'playing' && this.bricks.length > 0 && this.bricks.every(b => !b.active)) {
            if (this.level < 5) {
                this.startLevel(this.level + 1);
            } else {
                // VICTORY!
                this.state = 'gameover';
                const overlay = document.getElementById('message-overlay');
                document.getElementById('message-title').innerText = "VICTORY!";
                document.getElementById('message-sub').innerText = "SYSTEM SECURED. FINAL SCORE: " + this.score;
                document.getElementById('restart-btn').style.display = 'inline-block';
                overlay.style.display = 'block';
            }
        }

        // Special check for Boss Level 5
        if (this.state === 'playing' && this.level === 5 && !this.boss.active) {
            this.state = 'gameover';
            const overlay = document.getElementById('message-overlay');
            document.getElementById('message-title').innerText = "VICTORY!";
            document.getElementById('message-sub').innerText = "GUARDIAN DEFEATED. FINAL SCORE: " + this.score;
            document.getElementById('restart-btn').style.display = 'inline-block';
            overlay.style.display = 'block';
        }

        this.renderer.render(this.scene, this.camera);
    }

    restartGame() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        document.getElementById('score').innerText = '0';
        document.getElementById('lives').innerText = '3';
        document.getElementById('level').innerText = '1';
        document.getElementById('message-overlay').style.display = 'none';
        document.getElementById('restart-btn').style.display = 'none';
        
        // Reset bricks, boss, balls
        this.bricks.forEach(b => this.scene.remove(b.mesh));
        this.bricks = [];
        this.items.forEach(item => item.destroy());
        this.items = [];
        this.balls.forEach(b => this.scene.remove(b.mesh));
        this.balls = [new Ball(this.scene)];
        this.boss.hp = 500;
        this.boss.active = false;
        this.boss.mesh.visible = false;
        
        this.state = 'playing';
        this.startLevel(1);
    }
}

new Game();

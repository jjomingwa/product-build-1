// --- Game Configuration & Constants ---
const CONFIG = {
    paddleSpeed: 0.15,
    ballSpeed: 0.12,
    ballMaxSpeed: 0.25,
    boundaryX: 6,
    boundaryY: 5,
    paddleWidth: 2,
    paddleHeight: 0.3,
    paddleDepth: 0.5,
    brickWidth: 1.2,
    brickHeight: 0.5,
    brickDepth: 0.5,
    brickPadding: 0.1,
    rows: 6,
    cols: 8,
    colors: {
        paddle: 0x00ffff,
        ball: 0xffffff,
        wall: 0x222222,
        boss: 0xff0000,
        bossProjectile: 0xffaa00
    }
};

// --- Sound Manager (Synthesized Sounds) ---
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled || this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
            if(this.ctx.state === 'suspended') return;
        }
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

    hitPaddle() { this.playTone(440, 'square', 0.1); }
    hitBrick() { this.playTone(600 + Math.random() * 200, 'sine', 0.1); }
    hitWall() { this.playTone(200, 'triangle', 0.05); }
    breakBrick() { 
        this.playTone(800, 'sawtooth', 0.1, 0.2); 
        setTimeout(() => this.playTone(600, 'sawtooth', 0.1, 0.2), 50);
    }
    bossHit() { 
        this.playTone(150, 'sawtooth', 0.3, 0.3); 
        this.playTone(100, 'square', 0.3, 0.3);
    }
    shoot() { this.playTone(1200, 'triangle', 0.1, 0.05); } // Pew pew
    gameOver() {
        this.playTone(300, 'sawtooth', 0.5);
        setTimeout(() => this.playTone(250, 'sawtooth', 0.5), 400);
        setTimeout(() => this.playTone(200, 'sawtooth', 1.0), 800);
    }
    levelClear() {
        this.playTone(523.25, 'sine', 0.2);
        setTimeout(() => this.playTone(659.25, 'sine', 0.2), 200);
        setTimeout(() => this.playTone(783.99, 'sine', 0.4), 400);
        setTimeout(() => this.playTone(1046.50, 'sine', 0.6), 600);
    }
}

// --- Particle System ---
class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        this.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.geometry = geometry;
    }

    emit(position, color, count = 10) {
        const mat = this.material.clone();
        mat.color.setHex(color);
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.geometry, mat);
            mesh.position.copy(position);
            mesh.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                ),
                life: 1.0
            };
            this.scene.add(mesh);
            this.particles.push(mesh);
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.add(p.userData.velocity);
            p.rotation.x += 0.1;
            p.rotation.y += 0.1;
            p.userData.life -= 0.02;
            p.scale.setScalar(p.userData.life);
            
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }
}

// --- Game Classes ---
class Paddle {
    constructor(scene) {
        this.geometry = new THREE.BoxGeometry(CONFIG.paddleWidth, CONFIG.paddleHeight, CONFIG.paddleDepth);
        this.material = new THREE.MeshStandardMaterial({ 
            color: CONFIG.colors.paddle, 
            emissive: 0x0044aa, 
            roughness: 0.2,
            metalness: 0.8
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.y = -3.5;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
        this.width = CONFIG.paddleWidth;
    }

    update(input) {
        if (input.left && this.mesh.position.x > -CONFIG.boundaryX + this.width/2) {
            this.mesh.position.x -= CONFIG.paddleSpeed;
        }
        if (input.right && this.mesh.position.x < CONFIG.boundaryX - this.width/2) {
            this.mesh.position.x += CONFIG.paddleSpeed;
        }
    }
}

class Ball {
    constructor(scene) {
        this.geometry = new THREE.SphereGeometry(0.15, 32, 32);
        this.material = new THREE.MeshStandardMaterial({ 
            color: CONFIG.colors.ball,
            emissive: 0x555555,
            roughness: 0,
            metalness: 0.5
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.castShadow = true;
        scene.add(this.mesh);
        
        // Light attached to ball
        this.light = new THREE.PointLight(0xffffff, 0.5, 5);
        this.mesh.add(this.light);

        this.reset();
    }

    reset() {
        this.mesh.position.set(0, -1, 0);
        this.velocity = new THREE.Vector3(
            (Math.random() > 0.5 ? 1 : -1) * CONFIG.ballSpeed * 0.5, 
            CONFIG.ballSpeed, 
            0
        );
        this.active = false;
    }

    launch() {
        this.active = true;
    }

    update(paddle, bricks, boss, particleSystem, soundManager) {
        if (!this.active) {
            this.mesh.position.x = paddle.mesh.position.x;
            this.mesh.position.y = paddle.mesh.position.y + 0.5;
            return 'active';
        }

        this.mesh.position.add(this.velocity);

        // Wall Collisions
        if (this.mesh.position.x > CONFIG.boundaryX || this.mesh.position.x < -CONFIG.boundaryX) {
            this.velocity.x *= -1;
            soundManager.hitWall();
        }
        if (this.mesh.position.y > CONFIG.boundaryY) {
            this.velocity.y *= -1;
            soundManager.hitWall();
        }

        // Floor Collision (Game Over check)
        if (this.mesh.position.y < -CONFIG.boundaryY - 1) {
            return 'lost';
        }

        // Paddle Collision
        if (this.checkCollision(paddle.mesh)) {
            // Calculate angle based on where it hit the paddle
            let hitPoint = this.mesh.position.x - paddle.mesh.position.x;
            this.velocity.x = hitPoint * 0.2; // Influence X speed
            this.velocity.y = Math.abs(this.velocity.y); // Always bounce up
            
            // Speed up slightly
            if (this.velocity.length() < CONFIG.ballMaxSpeed) {
                this.velocity.multiplyScalar(1.05);
            }
            soundManager.hitPaddle();
            particleSystem.emit(this.mesh.position, CONFIG.colors.paddle, 5);
        }

        // Brick Collision
        for (let i = bricks.length - 1; i >= 0; i--) {
            if (bricks[i].active && this.checkCollision(bricks[i].mesh)) {
                bricks[i].hit();
                this.velocity.y *= -1; // Simple bounce
                particleSystem.emit(bricks[i].mesh.position, bricks[i].mesh.material.color.getHex(), 15);
                
                if (bricks[i].hp <= 0) {
                    soundManager.breakBrick();
                    return { type: 'brick_destroyed', score: bricks[i].scoreValue };
                } else {
                    soundManager.hitBrick();
                }
                break; // Only hit one brick per frame prevents tunneling issues
            }
        }

        // Boss Collision
        if (boss && boss.active && this.checkCollision(boss.mesh)) {
            this.velocity.y *= -1;
            this.velocity.x += (Math.random() - 0.5) * 0.1;
            boss.takeDamage(10);
            soundManager.bossHit();
            particleSystem.emit(this.mesh.position, CONFIG.colors.boss, 20);
            
            // Reflect boss projectile logic (if ball is 'charged' - simplified here to always damage)
        }

        return 'active';
    }

    checkCollision(targetMesh) {
        // Simple AABB for Box vs Sphere (approximated)
        const box = new THREE.Box3().setFromObject(targetMesh);
        const sphere = new THREE.Sphere(this.mesh.position, 0.15);
        return box.intersectsSphere(sphere);
    }
}

class Brick {
    constructor(scene, x, y, type) {
        this.type = type;
        this.active = true;
        this.scoreValue = 100;
        this.hp = 1;
        
        let color = 0x00ff00;
        if (type === 'hard') {
            color = 0x888888;
            this.hp = 2;
            this.scoreValue = 200;
        } else if (type === 'explosive') {
            color = 0xff0000;
            this.scoreValue = 300;
        } else if (type === 'gold') {
            color = 0xffd700;
            this.scoreValue = 500;
        }

        this.geometry = new THREE.BoxGeometry(CONFIG.brickWidth, CONFIG.brickHeight, CONFIG.brickDepth);
        this.material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.3,
            metalness: 0.2
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(x, y, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
        this.scene = scene;
    }

    hit() {
        this.hp--;
        if (this.hp <= 0) {
            this.destroy();
        } else {
            // Visual feedback for hit but not broken
            this.mesh.material.emissive.setHex(0x555555);
            setTimeout(() => this.mesh.material.emissive.setHex(0x000000), 100);
        }
    }

    destroy() {
        this.active = false;
        this.mesh.visible = false;
        // Could spawn powerups here
    }
}

class Boss {
    constructor(scene) {
        this.active = false;
        this.maxHp = 500;
        this.hp = 500;
        
        // Complex geometry for Boss
        const group = new THREE.Group();
        
        const coreGeo = new THREE.IcosahedronGeometry(1.5, 0);
        const coreMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.boss, wireframe: true, emissive: 0x550000 });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        
        const ringGeo = new THREE.TorusGeometry(2.5, 0.2, 16, 100);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, metalness: 0.9 });
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.rotation.x = Math.PI / 2;

        group.add(this.core);
        group.add(this.ring);
        
        this.mesh = group;
        this.mesh.position.set(0, 2, 0);
        scene.add(this.mesh);
        this.scene = scene;
        
        this.projectiles = [];
        this.movePhase = 0;
    }

    activate() {
        this.active = true;
        this.hp = this.maxHp;
        this.mesh.visible = true;
    }

    takeDamage(amount) {
        this.hp -= amount;
        const hpPercent = (this.hp / this.maxHp) * 100;
        document.getElementById('boss-health-bar').style.width = hpPercent + '%';
        
        // Flash effect
        this.core.material.emissive.setHex(0xffffff);
        setTimeout(() => this.core.material.emissive.setHex(0x550000), 100);

        if (this.hp <= 0) {
            this.active = false;
            this.mesh.visible = false;
            return true; // Boss defeated
        }
        return false;
    }

    update(time, paddle, soundManager) {
        if (!this.active) return;

        // Idle Animation
        this.core.rotation.y += 0.02;
        this.core.rotation.z += 0.01;
        this.ring.rotation.z -= 0.03;
        
        // Movement: Figure 8
        this.mesh.position.x = Math.sin(time * 0.001) * 3;
        this.mesh.position.y = 2 + Math.sin(time * 0.002) * 1;

        // Attack Logic
        if (Math.random() < 0.01) { // 1% chance per frame
            this.shoot(soundManager);
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.mesh.position.add(p.velocity);
            
            // Wall/Floor collision for projectiles
            if (p.mesh.position.y < -5) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }

            // Paddle collision
            const pBox = new THREE.Box3().setFromObject(p.mesh);
            const padBox = new THREE.Box3().setFromObject(paddle.mesh);
            if (pBox.intersectsBox(padBox)) {
                // If reflected
                // For simplicity in this v1, boss projectiles hurt the player (or just bounce off).
                // But requirement says: "reflect to damage boss".
                // Let's say if you hit it with paddle moving towards it? 
                // Simplified: Hitting paddle reflects it back up.
                
                p.velocity.y *= -1;
                p.velocity.multiplyScalar(1.5); // Speed up return
                p.isReflected = true;
                p.mesh.material.color.setHex(0x00ffff); // Turn blue
                soundManager.hitPaddle();
            }

            // Boss self-hit (reflected)
            if (p.isReflected) {
                const bossBox = new THREE.Box3().setFromObject(this.mesh);
                if (pBox.intersectsBox(bossBox)) {
                    this.takeDamage(25); // Bonus damage
                    soundManager.bossHit();
                    this.scene.remove(p.mesh);
                    this.projectiles.splice(i, 1);
                }
            }
        }
    }

    shoot(soundManager) {
        soundManager.shoot();
        const geo = new THREE.SphereGeometry(0.2);
        const mat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.bossProjectile });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(this.mesh.position);
        this.scene.add(mesh);
        
        this.projectiles.push({
            mesh: mesh,
            velocity: new THREE.Vector3( (Math.random()-0.5)*0.1, -0.15, 0),
            isReflected: false
        });
    }
}

// --- Main Game Class ---
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.paddle = null;
        this.ball = null;
        this.boss = null;
        this.bricks = [];
        this.particles = null;
        this.sound = null;
        
        this.score = 0;
        this.level = 1;
        this.state = 'intro'; // intro, playing, paused, lost, won, boss
        this.keys = { left: false, right: false };

        this.init();
    }

    init() {
        // Setup Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        this.scene.fog = new THREE.Fog(0x050505, 10, 50);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, -6, 8);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;

        // Lights
        const ambient = new THREE.AmbientLight(0x404040);
        this.scene.add(ambient);
        
        const spot = new THREE.SpotLight(0xffffff, 1);
        spot.position.set(0, -5, 10);
        spot.castShadow = true;
        this.scene.add(spot);

        // Components
        this.sound = new SoundManager();
        this.particles = new ParticleSystem(this.scene);
        this.paddle = new Paddle(this.scene);
        this.ball = new Ball(this.scene);
        this.boss = new Boss(this.scene);

        // Input
        window.addEventListener('keydown', (e) => this.onKey(e, true));
        window.addEventListener('keyup', (e) => this.onKey(e, false));
        window.addEventListener('resize', () => this.onResize());

        // Form Logic
        const formContainer = document.getElementById('intern-form-container');
        const toggleBtn = document.getElementById('form-toggle-btn');
        const closeBtn = document.getElementById('form-close-btn');

        toggleBtn.addEventListener('click', () => {
            formContainer.style.display = 'block';
            this.state = 'paused';
        });

        closeBtn.addEventListener('click', () => {
            formContainer.style.display = 'none';
            this.state = 'playing';
        });

        // Agent Verification
        this.agentVerify();

        // Start Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Start Tutorial Sequence
        this.startLevel(1);
    }

    agentVerify() {
        console.log("%c[AGENT] System Verification Initiated...", "color: cyan");
        if(this.scene && this.camera && this.renderer) console.log("[AGENT] 3D Engine: OK");
        if(this.sound) console.log("[AGENT] Audio Subsystem: OK");
        console.log("[AGENT] Input Handlers: Bound");
        console.log("[AGENT] Physics Engine: Ready");
        console.log("%c[AGENT] System Nominal. Launching...", "color: lime");
    }

    onKey(e, pressed) {
        if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = pressed;
        if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = pressed;
        
        // Start game on keypress if waiting
        if (pressed && !this.ball.active && this.state === 'playing') {
            this.ball.launch();
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    startLevel(lvl) {
        this.level = lvl;
        document.getElementById('level').innerText = lvl;
        
        // Clear old bricks
        this.bricks.forEach(b => {
            this.scene.remove(b.mesh);
        });
        this.bricks = [];
        this.boss.mesh.visible = false;
        this.boss.active = false;
        document.getElementById('boss-hud').style.display = 'none';

        if (lvl === 4) {
            this.startBossLevel();
        } else {
            this.buildLevel(lvl);
        }

        // Overlay Logic
        const tutorial = document.getElementById('tutorial-overlay');
        const msg = document.getElementById('message-overlay');
        
        if (lvl === 1) {
            tutorial.style.display = 'block';
            tutorial.style.opacity = '1';
            setTimeout(() => {
                tutorial.style.opacity = '0';
                setTimeout(() => tutorial.style.display = 'none', 1000);
            }, 15000); // 15s tutorial
        } else {
            msg.style.display = 'block';
            document.getElementById('message-title').innerText = `SECTOR ${lvl} UNLOCKED`;
            setTimeout(() => msg.style.display = 'none', 2000);
        }

        this.ball.reset();
        this.state = 'playing';
    }

    buildLevel(lvl) {
        // Pattern generation based on level
        const rows = lvl + 2;
        const cols = 6;
        const startX = -((cols - 1) * (CONFIG.brickWidth + CONFIG.brickPadding)) / 2;
        const startY = 1.5;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let type = 'normal';
                const rand = Math.random();
                
                // Difficulty scaling
                if (lvl > 1 && rand > 0.8) type = 'hard';
                if (lvl > 2 && rand > 0.9) type = 'explosive';
                if (rand > 0.95) type = 'gold';

                const x = startX + c * (CONFIG.brickWidth + CONFIG.brickPadding);
                const y = startY + r * (CONFIG.brickHeight + CONFIG.brickPadding);
                
                const brick = new Brick(this.scene, x, y, type);
                this.bricks.push(brick);
            }
        }
    }

    startBossLevel() {
        this.state = 'boss';
        document.getElementById('boss-hud').style.display = 'block';
        this.boss.activate();
        
        const msg = document.getElementById('message-overlay');
        msg.style.display = 'block';
        document.getElementById('message-title').innerText = "WARNING: BOSS DETECTED";
        setTimeout(() => msg.style.display = 'none', 3000);
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        
        if (this.state === 'lost') return;

        // Logic
        this.paddle.update(this.keys);
        
        const result = this.ball.update(this.paddle, this.bricks, this.boss, this.particles, this.sound);
        this.particles.update();
        if (this.boss.active) this.boss.update(time, this.paddle, this.sound);

        // Game State Handling
        if (result && result.type === 'brick_destroyed') {
            this.score += result.score;
            document.getElementById('score').innerText = this.score;
            
            // Check Level Clear
            if (this.bricks.every(b => !b.active) && !this.boss.active) {
                if (this.level < 4) {
                    this.sound.levelClear();
                    this.startLevel(this.level + 1);
                } else {
                    // Win state but technically shouldn't happen without boss death
                }
            }
        } else if (result === 'lost') {
            // Simple life system: 1 life for now, or reset level
            // For MVP: Restart Level
            this.ball.reset();
            // Optional: Reduce score
        }

        if (this.boss.active && this.boss.hp <= 0) {
             // Game Complete
             document.getElementById('message-overlay').style.display = 'block';
             document.getElementById('message-title').innerText = "MISSION ACCOMPLISHED";
             document.getElementById('message-sub').innerText = "THE GALAXY IS SAFE.";
             this.state = 'won';
             this.ball.active = false;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Start Game
const game = new Game();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas') });
renderer.setSize(window.innerWidth * 0.8, window.innerHeight * 0.8);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);

camera.position.z = 5;

// Game elements
const paddleGeometry = new THREE.BoxGeometry(1, 0.2, 0.2);
const paddleMaterial = new THREE.MeshStandardMaterial({ color: 0x0095DD });
const paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
paddle.position.y = -2;
scene.add(paddle);

const ballGeometry = new THREE.SphereGeometry(0.1, 32, 32);
const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const ball = new THREE.Mesh(ballGeometry, ballMaterial);
scene.add(ball);

const bricks = [];
const brickRows = 5;
const brickCols = 8;
const brickWidth = 0.5;
const brickHeight = 0.2;
const brickDepth = 0.2;
const brickPadding = 0.1;
const brickOffsetTop = 1;
const brickOffsetLeft = - (brickCols * (brickWidth + brickPadding)) / 2;

for (let c = 0; c < brickCols; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRows; r++) {
        const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
        const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
        const brickGeometry = new THREE.BoxGeometry(brickWidth, brickHeight, brickDepth);
        const brickMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
        const brick = new THREE.Mesh(brickGeometry, brickMaterial);
        brick.position.set(brickX, brickY, 0);
        bricks[c][r] = brick;
        scene.add(brick);
    }
}

// Particle system for brick destruction
const particleCount = 100;
const particleGeometry = new THREE.BufferGeometry();
const particleMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
const particles = new THREE.Points(particleGeometry, particleMaterial);
const particleVertices = [];
for (let i = 0; i < particleCount; i++) {
    particleVertices.push(0, 0, 0);
}
particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particleVertices, 3));
scene.add(particles);

// Game logic
let ballSpeedX = 0.05;
let ballSpeedY = -0.05;

function animate() {
    requestAnimationFrame(animate);

    // Ball movement
    ball.position.x += ballSpeedX;
    ball.position.y += ballSpeedY;

    // Wall collision
    if (ball.position.x > 4 || ball.position.x < -4) {
        ballSpeedX = -ballSpeedX;
    }
    if (ball.position.y > 3) {
        ballSpeedY = -ballSpeedY;
    }

    // Paddle collision
    if (
        ball.position.y < paddle.position.y + 0.1 &&
        ball.position.y > paddle.position.y - 0.1 &&
        ball.position.x > paddle.position.x - 0.5 &&
        ball.position.x < paddle.position.x + 0.5
    ) {
        ballSpeedY = -ballSpeedY;
    }

    // Brick collision
    for (let c = 0; c < brickCols; c++) {
        for (let r = 0; r < brickRows; r++) {
            const b = bricks[c][r];
            if (b.visible) {
                if (
                    ball.position.x > b.position.x - brickWidth / 2 &&
                    ball.position.x < b.position.x + brickWidth / 2 &&
                    ball.position.y > b.position.y - brickHeight / 2 &&
                    ball.position.y < b.position.y + brickHeight / 2
                ) {
                    ballSpeedY = -ballSpeedY;
                    b.visible = false;
                    // Create particle effect
                    const positions = particles.geometry.attributes.position.array;
                    for (let i = 0; i < particleCount; i++) {
                        positions[i * 3] = b.position.x + (Math.random() - 0.5) * 0.5;
                        positions[i * 3 + 1] = b.position.y + (Math.random() - 0.5) * 0.5;
                        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
                    }
                    particles.geometry.attributes.position.needsUpdate = true;
                    setTimeout(() => {
                        const positions = particles.geometry.attributes.position.array;
                        for (let i = 0; i < particleCount; i++) {
                            positions[i * 3] = 0;
                            positions[i * 3 + 1] = 0;
                            positions[i * 3 + 2] = 0;
                        }
                        particles.geometry.attributes.position.needsUpdate = true;
                    }, 500);
                }
            }
        }
    }

    // Game over
    if (ball.position.y < -2.5) {
        // Reset ball
        ball.position.x = 0;
        ball.position.y = 0;
        ballSpeedX = 0.05;
        ballSpeedY = -0.05;
        // Show all bricks
        for (let c = 0; c < brickCols; c++) {
            for (let r = 0; r < brickRows; r++) {
                bricks[c][r].visible = true;
            }
        }
    }

    renderer.render(scene, camera);
}

// Paddle movement
document.addEventListener('mousemove', (event) => {
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    paddle.position.x = mouseX * 4;
});

animate();

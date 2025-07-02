// Game state and configuration
const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SPEED: 3,
    RABBIT_SPEED: 1,
    ENEMY_SPEED: 2,
    INTERACTION_DISTANCE: 40,
    ENEMY_DETECTION_DISTANCE: 80,
    POWER_UP_DURATION: 5000,
    RABBIT_PATIENCE: 10000,
    RABBIT_ANGER_TIME: 5000
};

// Game state
let gameState = {
    screen: 'menu', // 'menu', 'instructions', 'game', 'pause', 'gameover'
    score: 0,
    lives: 3,
    level: 1,
    gameRunning: false,
    gamePaused: false
};

// Game objects
let player = null;
let rabbits = [];
let enemies = [];
let powerUps = [];
let particles = [];

// Canvas and context
let canvas = null;
let ctx = null;

// Assets
let assets = {
    loaded: false,
    images: {},
    loadCount: 0,
    totalAssets: 0
};

// Background image
let backgroundImage = null;

// Input handling
let inputState = {
    targetX: null,
    targetY: null,
    moving: false
};

// Initialize the game
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = GAME_CONFIG.CANVAS_WIDTH;
    canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
    
    // Make canvas responsive
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Load assets
    loadAssets();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start game loop
    gameLoop();
}

// FIXED: Proper canvas resizing
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate scale to fit canvas in container while maintaining aspect ratio
    const scaleX = containerWidth / GAME_CONFIG.CANVAS_WIDTH;
    const scaleY = containerHeight / GAME_CONFIG.CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size
    
    // Apply scale to canvas
    canvas.style.width = (GAME_CONFIG.CANVAS_WIDTH * scale) + 'px';
    canvas.style.height = (GAME_CONFIG.CANVAS_HEIGHT * scale) + 'px';
    
    // Store scale for coordinate conversion
    canvas.scale = scale;
}

// FIXED: Convert screen coordinates to game coordinates
function screenToGameCoords(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.scale || 1;
    
    const gameX = (screenX - rect.left) / scale;
    const gameY = (screenY - rect.top) / scale;
    
    return { x: gameX, y: gameY };
}

// Load game assets
function loadAssets() {
    const assetList = [
        'assets/characters/shumper_idle.png',
        'assets/characters/shumper_walking.png',
        'assets/characters/female_rabbit_happy.png',
        'assets/characters/female_rabbit_angry.png',
        'assets/characters/shepherd.png',
        'assets/characters/dog.png',
        'assets/backgrounds/meadow_bg.png',
        'assets/items/golden_carrot.png',
        'assets/items/clover.png',
        'assets/items/heart.png',
        'assets/ui/play_button.png',
        'assets/ui/pause_button.png'
    ];
    
    assets.totalAssets = assetList.length;
    
    assetList.forEach(src => {
        const img = new Image();
        img.onload = () => {
            assets.loadCount++;
            if (assets.loadCount === assets.totalAssets) {
                assets.loaded = true;
                // Set background image reference
                backgroundImage = assets.images['assets/backgrounds/meadow_bg.png'];
            }
        };
        img.onerror = () => {
            console.warn(`Failed to load asset: ${src}`);
            assets.loadCount++;
            if (assets.loadCount === assets.totalAssets) {
                assets.loaded = true;
            }
        };
        img.src = src;
        assets.images[src] = img;
    });
}

// Set up event listeners
function setupEventListeners() {
    // Canvas click/touch events
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
    
    // UI button events
    document.getElementById('playButton').addEventListener('click', startGame);
    document.getElementById('instructionsButton').addEventListener('click', showInstructions);
    document.getElementById('backButton').addEventListener('click', showMenu);
    document.getElementById('pauseButton').addEventListener('click', togglePause);
    document.getElementById('resumeButton').addEventListener('click', togglePause);
    document.getElementById('menuButton').addEventListener('click', showMenu);
    document.getElementById('restartButton').addEventListener('click', restartGame);
    document.getElementById('playAgainButton').addEventListener('click', restartGame);
    
    // Prevent context menu on canvas
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// Handle canvas click
function handleCanvasClick(e) {
    if (gameState.screen !== 'game' || gameState.gamePaused) return;
    
    const coords = screenToGameCoords(e.clientX, e.clientY);
    setPlayerTarget(coords.x, coords.y);
}

// Handle canvas touch
function handleCanvasTouch(e) {
    e.preventDefault();
    if (gameState.screen !== 'game' || gameState.gamePaused) return;
    
    const touch = e.touches[0];
    const coords = screenToGameCoords(touch.clientX, touch.clientY);
    setPlayerTarget(coords.x, coords.y);
}

// Set player movement target
function setPlayerTarget(x, y) {
    inputState.targetX = Math.max(32, Math.min(GAME_CONFIG.CANVAS_WIDTH - 32, x));
    inputState.targetY = Math.max(32, Math.min(GAME_CONFIG.CANVAS_HEIGHT - 32, y));
    inputState.moving = true;
}

// Screen management functions
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenName + 'Screen').classList.remove('hidden');
    gameState.screen = screenName;
}

function showMenu() {
    showScreen('menu');
    gameState.gameRunning = false;
    gameState.gamePaused = false;
}

function showInstructions() {
    showScreen('instructions');
}

function startGame() {
    showScreen('game');
    initializeLevel();
    gameState.gameRunning = true;
    gameState.gamePaused = false;
}

function togglePause() {
    if (gameState.screen !== 'game') return;
    
    gameState.gamePaused = !gameState.gamePaused;
    if (gameState.gamePaused) {
        showScreen('pause');
    } else {
        showScreen('game');
    }
}

function restartGame() {
    gameState.score = 0;
    gameState.lives = 3;
    gameState.level = 1;
    startGame();
}

function gameOver() {
    showScreen('gameover');
    document.getElementById('finalScore').textContent = gameState.score;
    gameState.gameRunning = false;
}

// Game object classes
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 48;
        this.height = 48;
        this.speed = GAME_CONFIG.PLAYER_SPEED;
        this.moving = false;
        this.powerUps = {
            speed: false,
            charm: false
        };
    }
    
    update() {
        if (inputState.moving) {
            const dx = inputState.targetX - this.x;
            const dy = inputState.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
                const moveX = (dx / distance) * this.speed;
                const moveY = (dy / distance) * this.speed;
                
                this.x += moveX;
                this.y += moveY;
                this.moving = true;
            } else {
                this.x = inputState.targetX;
                this.y = inputState.targetY;
                inputState.moving = false;
                this.moving = false;
            }
        }
        
        // Keep player in bounds
        this.x = Math.max(this.width/2, Math.min(GAME_CONFIG.CANVAS_WIDTH - this.width/2, this.x));
        this.y = Math.max(this.height/2, Math.min(GAME_CONFIG.CANVAS_HEIGHT - this.height/2, this.y));
    }
    
    draw() {
        if (!assets.loaded) return;
        
        const sprite = this.moving ? 
            assets.images['assets/characters/shumper_walking.png'] : 
            assets.images['assets/characters/shumper_idle.png'];
            
        if (sprite && sprite.complete) {
            // FIXED: Draw with proper transparency
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
            ctx.restore();
        }
    }
}

class Rabbit {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.happiness = 0; // 0 = content, 1 = lonely, 2 = frustrated, 3 = angry, 4 = happy
        this.timer = 0;
        this.speed = GAME_CONFIG.RABBIT_SPEED;
        this.targetX = x;
        this.targetY = y;
        this.moveTimer = 0;
    }
    
    update() {
        this.timer += 16; // Assuming 60fps
        
        // Update happiness based on time and player proximity
        const distToPlayer = Math.sqrt((this.x - player.x) ** 2 + (this.y - player.y) ** 2);
        
        if (distToPlayer < GAME_CONFIG.INTERACTION_DISTANCE) {
            this.happiness = Math.min(4, this.happiness + 0.1);
            if (this.happiness >= 4) {
                // Rabbit becomes happy and disappears
                this.remove = true;
                gameState.score += 100;
                createHeartParticles(this.x, this.y);
            }
        } else {
            // Gradually become more frustrated
            if (this.timer > GAME_CONFIG.RABBIT_PATIENCE) {
                this.happiness = Math.min(3, this.happiness + 0.01);
            }
        }
        
        // Move randomly when angry
        if (this.happiness >= 3) {
            this.moveTimer += 16;
            if (this.moveTimer > 1000) {
                this.targetX = Math.random() * (GAME_CONFIG.CANVAS_WIDTH - 100) + 50;
                this.targetY = Math.random() * (GAME_CONFIG.CANVAS_HEIGHT - 100) + 50;
                this.moveTimer = 0;
            }
            
            // Move towards target
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
                this.x += (dx / distance) * this.speed;
                this.y += (dy / distance) * this.speed;
            }
        }
    }
    
    draw() {
        if (!assets.loaded) return;
        
        const sprite = this.happiness >= 3 ? 
            assets.images['assets/characters/female_rabbit_angry.png'] : 
            assets.images['assets/characters/female_rabbit_happy.png'];
            
        if (sprite && sprite.complete) {
            // FIXED: Draw with proper transparency
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
            ctx.restore();
            
            // Draw emotion indicator
            this.drawEmotion();
        }
    }
    
    drawEmotion() {
        ctx.save();
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        
        let emoji = '';
        switch(Math.floor(this.happiness)) {
            case 0: emoji = '😊'; break;
            case 1: emoji = '😔'; break;
            case 2: emoji = '😤'; break;
            case 3: emoji = '😡'; break;
            case 4: emoji = '💕'; break;
        }
        
        ctx.fillText(emoji, this.x, this.y - this.height/2 - 10);
        ctx.restore();
    }
}

// Initialize level
function initializeLevel() {
    // Create player
    player = new Player(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT / 2);
    
    // Clear arrays
    rabbits = [];
    enemies = [];
    powerUps = [];
    particles = [];
    
    // Create rabbits based on level
    const rabbitCount = Math.min(3 + gameState.level, 8);
    for (let i = 0; i < rabbitCount; i++) {
        let x, y;
        do {
            x = Math.random() * (GAME_CONFIG.CANVAS_WIDTH - 100) + 50;
            y = Math.random() * (GAME_CONFIG.CANVAS_HEIGHT - 100) + 50;
        } while (Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2) < 100);
        
        rabbits.push(new Rabbit(x, y));
    }
    
    // Update UI
    updateUI();
}

// Create heart particles
function createHeartParticles(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            life: 60,
            maxLife: 60,
            type: 'heart'
        });
    }
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('lives').textContent = gameState.lives;
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('rabbitsLeft').textContent = rabbits.filter(r => !r.remove).length;
}

// FIXED: Main game loop with proper rendering
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    
    // FIXED: Draw background on canvas instead of CSS
    if (assets.loaded && backgroundImage && backgroundImage.complete) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Scale background to fit canvas
        ctx.drawImage(backgroundImage, 0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
        ctx.restore();
    } else {
        // Fallback background
        const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    }
    
    // Update and draw game objects if game is running
    if (gameState.gameRunning && !gameState.gamePaused) {
        // Update player
        if (player) {
            player.update();
        }
        
        // Update rabbits
        rabbits = rabbits.filter(rabbit => {
            rabbit.update();
            return !rabbit.remove;
        });
        
        // Update particles
        particles = particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // gravity
            particle.life--;
            return particle.life > 0;
        });
        
        // Check level completion
        if (rabbits.length === 0) {
            gameState.level++;
            gameState.score += 500;
            setTimeout(() => {
                initializeLevel();
            }, 1000);
        }
        
        // Update UI
        updateUI();
    }
    
    // Draw game objects
    if (gameState.screen === 'game') {
        // Draw rabbits
        rabbits.forEach(rabbit => rabbit.draw());
        
        // Draw player
        if (player) {
            player.draw();
        }
        
        // Draw particles
        particles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.life / particle.maxLife;
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('💖', particle.x, particle.y);
            ctx.restore();
        });
    }
    
    requestAnimationFrame(gameLoop);
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', initGame);


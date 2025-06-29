// Game state and configuration
const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SPEED: 3,
    ENEMY_SPEED: 1.5,
    INTERACTION_DISTANCE: 40,
    ENEMY_DETECTION_DISTANCE: 80,
    POWER_UP_DURATION: 5000,
    RABBIT_PATIENCE_TIME: 10000,
    LEVELS: [
        { rabbits: 3, enemies: 0, powerUps: 1 },
        { rabbits: 5, enemies: 1, powerUps: 2 },
        { rabbits: 7, enemies: 2, powerUps: 2 },
        { rabbits: 10, enemies: 2, powerUps: 3 },
        { rabbits: 12, enemies: 3, powerUps: 3 }
    ]
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.rabbitsLeft = 0;
        
        // Game objects
        this.player = null;
        this.rabbits = [];
        this.enemies = [];
        this.powerUps = [];
        this.particles = [];
        
        // Input handling
        this.touchPos = { x: 0, y: 0 };
        this.isMoving = false;
        
        // Assets
        this.assets = {};
        this.assetsLoaded = false;
        
        this.init();
    }
    
    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        await this.loadAssets();
        this.showScreen('mainMenu');
    }
    
    setupCanvas() {
        // Make canvas responsive
        const container = document.getElementById('gameContainer');
        const containerRect = container.getBoundingClientRect();
        
        const scale = Math.min(
            containerRect.width / GAME_CONFIG.CANVAS_WIDTH,
            containerRect.height / GAME_CONFIG.CANVAS_HEIGHT
        );
        
        this.canvas.style.width = (GAME_CONFIG.CANVAS_WIDTH * scale) + 'px';
        this.canvas.style.height = (GAME_CONFIG.CANVAS_HEIGHT * scale) + 'px';
        
        // Store scale for input conversion
        this.canvasScale = scale;
    }
    
    setupEventListeners() {
        // Menu buttons
        document.getElementById('playButton').addEventListener('click', () => this.startGame());
        document.getElementById('instructionsButton').addEventListener('click', () => this.showScreen('instructionsScreen'));
        document.getElementById('backButton').addEventListener('click', () => this.showScreen('mainMenu'));
        
        // Game UI buttons
        document.getElementById('pauseButton').addEventListener('click', () => this.pauseGame());
        document.getElementById('resumeButton').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartButton').addEventListener('click', () => this.restartLevel());
        document.getElementById('mainMenuButton').addEventListener('click', () => this.goToMainMenu());
        document.getElementById('playAgainButton').addEventListener('click', () => this.startGame());
        document.getElementById('menuButton').addEventListener('click', () => this.goToMainMenu());
        
        // Touch/mouse input for gameplay
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Prevent context menu and scrolling
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        
        // Window resize
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    async loadAssets() {
        const assetPaths = {
            shumper_idle: 'assets/characters/shumper_idle.png',
            shumper_walking: 'assets/characters/shumper_walking.png',
            female_rabbit_happy: 'assets/characters/female_rabbit_happy.png',
            female_rabbit_angry: 'assets/characters/female_rabbit_angry.png',
            shepherd: 'assets/characters/shepherd.png',
            dog: 'assets/characters/dog.png',
            golden_carrot: 'assets/items/golden_carrot.png',
            clover: 'assets/items/clover.png',
            heart: 'assets/items/heart.png',
            meadow_bg: 'assets/backgrounds/meadow_bg.png'
        };
        
        const loadPromises = Object.entries(assetPaths).map(([key, path]) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.assets[key] = img;
                    resolve();
                };
                img.onerror = reject;
                img.src = path;
            });
        });
        
        try {
            await Promise.all(loadPromises);
            this.assetsLoaded = true;
            console.log('All assets loaded successfully');
        } catch (error) {
            console.error('Failed to load assets:', error);
        }
    }
    
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show target screen
        document.getElementById(screenId).classList.remove('hidden');
    }
    
    startGame() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameState = 'playing';
        this.initLevel();
        this.showScreen('gameScreen');
        this.gameLoop();
    }
    
    initLevel() {
        const levelConfig = GAME_CONFIG.LEVELS[this.level - 1] || GAME_CONFIG.LEVELS[GAME_CONFIG.LEVELS.length - 1];
        
        // Clear arrays
        this.rabbits = [];
        this.enemies = [];
        this.powerUps = [];
        this.particles = [];
        
        // Create player
        this.player = {
            x: GAME_CONFIG.CANVAS_WIDTH / 2,
            y: GAME_CONFIG.CANVAS_HEIGHT / 2,
            targetX: GAME_CONFIG.CANVAS_WIDTH / 2,
            targetY: GAME_CONFIG.CANVAS_HEIGHT / 2,
            width: 64,
            height: 64,
            speed: GAME_CONFIG.PLAYER_SPEED,
            isMoving: false,
            powerUp: null,
            powerUpTimer: 0
        };
        
        // Create rabbits
        for (let i = 0; i < levelConfig.rabbits; i++) {
            this.createRabbit();
        }
        
        // Create enemies
        for (let i = 0; i < levelConfig.enemies; i++) {
            this.createEnemy(i === 0 ? 'shepherd' : 'dog');
        }
        
        // Create power-ups
        for (let i = 0; i < levelConfig.powerUps; i++) {
            this.createPowerUp();
        }
        
        this.rabbitsLeft = levelConfig.rabbits;
        this.updateUI();
    }
    
    createRabbit() {
        const rabbit = {
            x: Math.random() * (GAME_CONFIG.CANVAS_WIDTH - 100) + 50,
            y: Math.random() * (GAME_CONFIG.CANVAS_HEIGHT - 100) + 50,
            width: 48,
            height: 48,
            state: 'content', // content, lonely, frustrated, angry, happy
            stateTimer: 0,
            happiness: 0,
            maxHappiness: 100,
            patienceTimer: GAME_CONFIG.RABBIT_PATIENCE_TIME
        };
        this.rabbits.push(rabbit);
    }
    
    createEnemy(type) {
        const enemy = {
            x: Math.random() * (GAME_CONFIG.CANVAS_WIDTH - 100) + 50,
            y: Math.random() * (GAME_CONFIG.CANVAS_HEIGHT - 100) + 50,
            width: type === 'shepherd' ? 64 : 48,
            height: type === 'shepherd' ? 64 : 48,
            type: type,
            speed: GAME_CONFIG.ENEMY_SPEED * (type === 'dog' ? 1.2 : 0.8),
            direction: Math.random() * Math.PI * 2,
            detectionRadius: GAME_CONFIG.ENEMY_DETECTION_DISTANCE,
            patrolTimer: 0,
            chasing: false
        };
        this.enemies.push(enemy);
    }
    
    createPowerUp() {
        const types = ['golden_carrot', 'clover'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        const powerUp = {
            x: Math.random() * (GAME_CONFIG.CANVAS_WIDTH - 50) + 25,
            y: Math.random() * (GAME_CONFIG.CANVAS_HEIGHT - 50) + 25,
            width: 32,
            height: 32,
            type: type,
            collected: false
        };
        this.powerUps.push(powerUp);
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        if (this.gameState !== 'playing') return;
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.setPlayerTarget(
            (touch.clientX - rect.left) / this.canvasScale,
            (touch.clientY - rect.top) / this.canvasScale
        );
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (this.gameState !== 'playing') return;
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.setPlayerTarget(
            (touch.clientX - rect.left) / this.canvasScale,
            (touch.clientY - rect.top) / this.canvasScale
        );
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
    }
    
    handleMouseDown(e) {
        if (this.gameState !== 'playing') return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.setPlayerTarget(
            (e.clientX - rect.left) / this.canvasScale,
            (e.clientY - rect.top) / this.canvasScale
        );
    }
    
    handleMouseMove(e) {
        if (this.gameState !== 'playing' || !e.buttons) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.setPlayerTarget(
            (e.clientX - rect.left) / this.canvasScale,
            (e.clientY - rect.top) / this.canvasScale
        );
    }
    
    handleMouseUp(e) {
        // Mouse up handling if needed
    }
    
    setPlayerTarget(x, y) {
        this.player.targetX = Math.max(32, Math.min(GAME_CONFIG.CANVAS_WIDTH - 32, x));
        this.player.targetY = Math.max(32, Math.min(GAME_CONFIG.CANVAS_HEIGHT - 32, y));
        this.player.isMoving = true;
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        this.updatePlayer();
        this.updateRabbits();
        this.updateEnemies();
        this.updatePowerUps();
        this.updateParticles();
        this.checkCollisions();
        this.checkLevelComplete();
    }
    
    updatePlayer() {
        const dx = this.player.targetX - this.player.x;
        const dy = this.player.targetY - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            this.player.x += (dx / distance) * this.player.speed;
            this.player.y += (dy / distance) * this.player.speed;
            this.player.isMoving = true;
        } else {
            this.player.isMoving = false;
        }
        
        // Update power-up timer
        if (this.player.powerUpTimer > 0) {
            this.player.powerUpTimer -= 16; // Assuming 60 FPS
            if (this.player.powerUpTimer <= 0) {
                this.player.powerUp = null;
            }
        }
    }
    
    updateRabbits() {
        this.rabbits.forEach(rabbit => {
            // Check distance to player
            const dx = this.player.x - rabbit.x;
            const dy = this.player.y - rabbit.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < GAME_CONFIG.INTERACTION_DISTANCE && rabbit.state !== 'happy') {
                // Player is interacting with rabbit
                rabbit.happiness += 2;
                if (rabbit.happiness >= rabbit.maxHappiness) {
                    rabbit.state = 'happy';
                    this.score += 100;
                    this.rabbitsLeft--;
                    this.createParticle(rabbit.x, rabbit.y, 'heart');
                }
            } else {
                // Update rabbit patience
                rabbit.patienceTimer -= 16;
                if (rabbit.patienceTimer <= 0 && rabbit.state !== 'angry' && rabbit.state !== 'happy') {
                    rabbit.state = 'angry';
                }
            }
            
            // Update rabbit state timer
            rabbit.stateTimer += 16;
        });
    }
    
    updateEnemies() {
        this.enemies.forEach(enemy => {
            // Check if player is in detection range
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < enemy.detectionRadius) {
                // Chase player
                enemy.chasing = true;
                const moveX = (dx / distance) * enemy.speed;
                const moveY = (dy / distance) * enemy.speed;
                enemy.x += moveX;
                enemy.y += moveY;
            } else {
                // Patrol behavior
                enemy.chasing = false;
                enemy.patrolTimer += 16;
                
                if (enemy.patrolTimer > 2000) { // Change direction every 2 seconds
                    enemy.direction = Math.random() * Math.PI * 2;
                    enemy.patrolTimer = 0;
                }
                
                enemy.x += Math.cos(enemy.direction) * enemy.speed * 0.5;
                enemy.y += Math.sin(enemy.direction) * enemy.speed * 0.5;
                
                // Keep enemies on screen
                enemy.x = Math.max(32, Math.min(GAME_CONFIG.CANVAS_WIDTH - 32, enemy.x));
                enemy.y = Math.max(32, Math.min(GAME_CONFIG.CANVAS_HEIGHT - 32, enemy.y));
            }
        });
    }
    
    updatePowerUps() {
        this.powerUps.forEach(powerUp => {
            if (!powerUp.collected) {
                // Simple floating animation
                powerUp.y += Math.sin(Date.now() * 0.005) * 0.5;
            }
        });
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.life -= 16;
            particle.y -= particle.speed;
            particle.alpha = particle.life / particle.maxLife;
            return particle.life > 0;
        });
    }
    
    checkCollisions() {
        // Player vs Enemies
        this.enemies.forEach(enemy => {
            if (this.checkCollision(this.player, enemy)) {
                this.playerHit();
            }
        });
        
        // Player vs Power-ups
        this.powerUps.forEach(powerUp => {
            if (!powerUp.collected && this.checkCollision(this.player, powerUp)) {
                this.collectPowerUp(powerUp);
            }
        });
    }
    
    checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    playerHit() {
        if (this.player.powerUp === 'invincible') return;
        
        this.lives--;
        this.updateUI();
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // Reset player position
            this.player.x = GAME_CONFIG.CANVAS_WIDTH / 2;
            this.player.y = GAME_CONFIG.CANVAS_HEIGHT / 2;
            this.player.targetX = this.player.x;
            this.player.targetY = this.player.y;
        }
    }
    
    collectPowerUp(powerUp) {
        powerUp.collected = true;
        this.score += 50;
        
        switch (powerUp.type) {
            case 'golden_carrot':
                this.player.speed = GAME_CONFIG.PLAYER_SPEED * 1.5;
                this.player.powerUp = 'speed';
                this.player.powerUpTimer = GAME_CONFIG.POWER_UP_DURATION;
                break;
            case 'clover':
                this.player.powerUp = 'charm';
                this.player.powerUpTimer = GAME_CONFIG.POWER_UP_DURATION;
                break;
        }
        
        this.createParticle(powerUp.x, powerUp.y, 'sparkle');
        this.updateUI();
    }
    
    createParticle(x, y, type) {
        const particle = {
            x: x,
            y: y,
            type: type,
            life: 1000,
            maxLife: 1000,
            speed: 2,
            alpha: 1
        };
        this.particles.push(particle);
    }
    
    checkLevelComplete() {
        if (this.rabbitsLeft <= 0) {
            this.level++;
            this.score += 500; // Level completion bonus
            
            if (this.level > GAME_CONFIG.LEVELS.length) {
                this.gameWin();
            } else {
                this.initLevel();
            }
        }
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
        
        // Draw background
        if (this.assets.meadow_bg) {
            this.ctx.drawImage(this.assets.meadow_bg, 0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
        }
        
        // Draw power-ups
        this.powerUps.forEach(powerUp => {
            if (!powerUp.collected && this.assets[powerUp.type]) {
                this.ctx.drawImage(this.assets[powerUp.type], powerUp.x - powerUp.width/2, powerUp.y - powerUp.height/2, powerUp.width, powerUp.height);
            }
        });
        
        // Draw rabbits
        this.rabbits.forEach(rabbit => {
            if (rabbit.state !== 'happy') {
                const sprite = rabbit.state === 'angry' ? this.assets.female_rabbit_angry : this.assets.female_rabbit_happy;
                if (sprite) {
                    this.ctx.drawImage(sprite, rabbit.x - rabbit.width/2, rabbit.y - rabbit.height/2, rabbit.width, rabbit.height);
                }
                
                // Draw happiness indicator
                if (rabbit.happiness > 0 && rabbit.state !== 'angry') {
                    this.drawHealthBar(rabbit.x, rabbit.y - 30, rabbit.happiness, rabbit.maxHappiness, '#FF69B4');
                }
            }
        });
        
        // Draw enemies
        this.enemies.forEach(enemy => {
            const sprite = this.assets[enemy.type];
            if (sprite) {
                this.ctx.drawImage(sprite, enemy.x - enemy.width/2, enemy.y - enemy.height/2, enemy.width, enemy.height);
            }
        });
        
        // Draw player
        const playerSprite = this.player.isMoving ? this.assets.shumper_walking : this.assets.shumper_idle;
        if (playerSprite) {
            // Add power-up glow effect
            if (this.player.powerUp) {
                this.ctx.shadowColor = this.player.powerUp === 'speed' ? '#FFD700' : '#32CD32';
                this.ctx.shadowBlur = 10;
            }
            
            this.ctx.drawImage(playerSprite, this.player.x - this.player.width/2, this.player.y - this.player.height/2, this.player.width, this.player.height);
            
            this.ctx.shadowBlur = 0;
        }
        
        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.globalAlpha = particle.alpha;
            if (particle.type === 'heart' && this.assets.heart) {
                this.ctx.drawImage(this.assets.heart, particle.x - 12, particle.y - 12, 24, 24);
            } else if (particle.type === 'sparkle') {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
            }
            this.ctx.globalAlpha = 1;
        });
    }
    
    drawHealthBar(x, y, current, max, color) {
        const width = 40;
        const height = 6;
        const percentage = current / max;
        
        // Background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x - width/2, y, width, height);
        
        // Fill
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x - width/2, y, width * percentage, height);
    }
    
    updateUI() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('livesValue').textContent = this.lives;
        document.getElementById('levelValue').textContent = this.level;
        document.getElementById('rabbitsLeftValue').textContent = this.rabbitsLeft;
    }
    
    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.showScreen('pauseMenu');
        }
    }
    
    resumeGame() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.showScreen('gameScreen');
        }
    }
    
    restartLevel() {
        this.gameState = 'playing';
        this.initLevel();
        this.showScreen('gameScreen');
    }
    
    goToMainMenu() {
        this.gameState = 'menu';
        this.showScreen('mainMenu');
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('gameOverTitle').textContent = 'Game Over';
        document.getElementById('finalScore').textContent = this.score;
        this.showScreen('gameOverScreen');
    }
    
    gameWin() {
        this.gameState = 'gameOver';
        document.getElementById('gameOverTitle').textContent = 'Congratulations!';
        document.getElementById('finalScore').textContent = this.score;
        this.showScreen('gameOverScreen');
    }
    
    gameLoop() {
        if (this.gameState === 'playing') {
            this.update();
        }
        
        if (this.gameState === 'playing' || this.gameState === 'paused') {
            this.render();
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new Game();
});


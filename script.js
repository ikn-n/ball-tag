// Expose functions to global scope for HTML buttons
window.startGame = null;
window.resumeGame = null;
window.restartGame = null;
window.showMainMenu = null;

(function () {
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d", { alpha: true });

    const timeRemainingEl = document.getElementById("time-remaining");
    const ballCountEl = document.getElementById("ball-count");
    const statusText = document.getElementById("status-text");
    const difficultyLabel = document.getElementById("difficulty-label");
    const countdownOverlay = document.getElementById("countdown-overlay");

    // New UI Elements
    const hud = document.getElementById("hud");
    const gameContainer = document.getElementById("game-container");
    const mainMenu = document.getElementById("main-menu");
    const gameOverModal = document.getElementById("game-over-modal");
    const resumeContainer = document.getElementById("resume-container");
    const finalRoundsEl = document.getElementById("final-rounds");
    const finalDifficultyEl = document.getElementById("final-difficulty");
    const gameTitle = document.querySelector(".game-title");

    // Update Title
    gameTitle.textContent = "BALL TAG";
    document.title = "Ball Tag";

    // Tunable global settings
    const ROUND_TIME_SECONDS = 6;           // Duration of each round in seconds
    const NEW_PLAYER_EVERY_ROUNDS = 2;      // How many rounds before a new player ball is added (if not maxed)
    const PLAYER_SPEED_START = 7;           // Base speed of the player balls
    const PLAYER_SPEED_PER_ROUND = 0.3;    // Speed increase for player balls per round survived
    const PLAYER_SMOOTHING = 0.1;           // Movement smoothing factor (lower is more slippery/smooth)
    const BLACK_BALL_SPEED_START = 3;       // Base speed of the enemy black balls
    const BLACK_BALL_SPEED_INCREMENT = 0.2; // Speed increase for each additional black ball
    const PLAY_AREA_PADDING = 10;           // Padding from the canvas edges where balls cannot go
    const AUTOPILOT_DIR_CHANGE_MIN_MS = 800; // Minimum time before an autopilot ball changes direction
    const AUTOPILOT_DIR_CHANGE_MAX_MS = 1600;// Maximum time before an autopilot ball changes direction
    const AUTOPILOT_AVOID_WEIGHT = 1.2;     // How strongly autopilot balls avoid enemies
    const ACTIVE_AVOID_WEIGHT = 0.2;        // How strongly the active player ball is nudged away from enemies
    const SPEED_BOOST_AMOUNT = 1;           // Extra speed added when speed boost is active
    const POWERUP_DURATION_MS = 2000;       // Duration of powerups (Speed Boost, Invincibility) in milliseconds
    const POWERUP_SPAWN_ROUND = 2;          // Round number when powerups start spawning
    const POWERUP_RADIUS = 30;              // Radius of the powerup items
    const BALL_RADIUS = 8;                  // Radius of player and enemy balls
    const POWERUP_SPAWN_DELAY_MIN_MS = 600; // Minimum delay before a powerup spawns in a round
    const POWERUP_SPAWN_DELAY_MAX_MS = 2600;// Maximum delay before a powerup spawns in a round
    const BLACK_SPAWN_INSET = 50;           // Distance from corners/sides for black ball spawn zones
    const SPEED_RAMP_MAX_ROUND = 15;        // Round number where speed ramping stops (caps difficulty)
    const MAX_PLAYERS = 15;                 // Maximum number of player balls allowed
    const DIFFICULTIES = {
        easy: {
            label: "Easy",
            startBalls: 1,
            playerSpeedDelta: 0,
            enemySpeedDelta: 0,
        },
        medium: {
            label: "Medium",
            startBalls: 4,
            playerSpeedDelta: 0,
            enemySpeedDelta: 0,
        },
        hard: {
            label: "Hard",
            startBalls: 5,
            playerSpeedDelta: 0.2,
            enemySpeedDelta: 1.5, // Increased from 0.2
        },
    };

    // Game state
    let blackBalls = [];
    let powerups = [];
    let ballCount = 1;
    let timer = ROUND_TIME_SECONDS;
    let timerInterval = null;
    let isGameOver = false;
    let isPaused = false;
    let roundsSurvived = 0;
    let speedBoostUntil = 0;
    let speedBoostHolder = null;
    let invincibleUntil = 0;
    let powerupSpawnTimeout = null;
    let playerSpeedDelta = 0;
    let enemySpeedDelta = 0;
    let currentDifficulty = "easy";
    let isCountingDown = false;
    let audioCtx = null;
    let gameStarted = false;
    let countdownTimeout = null;

    const players = [];
    let activeIndex = 0;

    // Audio
    const musicController = window.chiptuneMusic || { start: () => { }, pause: () => { }, stop: () => { } };

    function playMusic() { musicController.start(); }
    function pauseMusic() { musicController.pause(); }
    function stopMusic() { musicController.stop(); }

    // Resize handling
    function resizeCanvas() {
        canvas.width = Math.min(window.innerWidth, 1440);
        canvas.height = Math.min(window.innerHeight, 960);
        // Clamp positions after resize
        players.forEach(p => clampEntity(p));
        blackBalls.forEach(b => clampEntity(b));
        powerups.forEach(p => clampEntity(p));
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // --- Core Helper Functions ---

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function clampEntity(entity) {
        const r = entity.radius || BALL_RADIUS;
        entity.x = clamp(entity.x, PLAY_AREA_PADDING, canvas.width - r * 2 - PLAY_AREA_PADDING);
        entity.y = clamp(entity.y, PLAY_AREA_PADDING, canvas.height - r * 2 - PLAY_AREA_PADDING);
    }

    function randBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    function randomUnitVector() {
        const angle = Math.random() * Math.PI * 2;
        return { x: Math.cos(angle), y: Math.sin(angle) };
    }

    // --- Player & Entity Management ---

    function createPlayer() {
        const player = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            inputX: 0,
            inputY: 0,
            isActive: false,
            autoDirX: 0,
            autoDirY: 0,
            autoDirChangeAt: 0,
            color: '#ff3030',
            glowColor: 'rgba(255, 48, 48, 0.6)'
        };
        setRandomAutoDir(player);
        return player;
    }

    function spawnExtraPlayer() {
        if (isGameOver || isPaused || !gameStarted || players.length >= MAX_PLAYERS) return;
        const reference = players[activeIndex] || players[0];
        const p = createPlayer();
        if (reference) {
            p.x = clamp(reference.x + 16, PLAY_AREA_PADDING, canvas.width - p.radius * 2 - PLAY_AREA_PADDING);
            p.y = clamp(reference.y + 16, PLAY_AREA_PADDING, canvas.height - p.radius * 2 - PLAY_AREA_PADDING);
        } else {
            p.x = (canvas.width / 2) - p.radius;
            p.y = (canvas.height / 2) - p.radius;
        }
        p.vx = 0;
        p.vy = 0;
        setRandomAutoDir(p);
        players.push(p);
        setActivePlayer(activeIndex);
    }

    function positionPlayersAtCenter() {
        const startX = (canvas.width / 2);
        const startY = (canvas.height / 2);
        players.forEach((p, idx) => {
            const offset = (idx - activeIndex) * 20;
            p.x = startX + offset - p.radius;
            p.y = startY + offset - p.radius;
            p.vx = 0;
            p.vy = 0;
            setRandomAutoDir(p);
        });
    }

    function setRandomAutoDir(player) {
        const dir = randomUnitVector();
        player.autoDirX = dir.x;
        player.autoDirY = dir.y;
        const span = AUTOPILOT_DIR_CHANGE_MAX_MS - AUTOPILOT_DIR_CHANGE_MIN_MS;
        player.autoDirChangeAt = Date.now() + AUTOPILOT_DIR_CHANGE_MIN_MS + Math.random() * span;
    }

    function randomSpawnPosition(width = 14, height = 14) {
        const x = Math.random() * (canvas.width - PLAY_AREA_PADDING * 2 - width) + PLAY_AREA_PADDING;
        const y = Math.random() * (canvas.height - PLAY_AREA_PADDING * 2 - height) + PLAY_AREA_PADDING;
        return { x, y };
    }

    // Spawns black balls at the start of a round.
    // Uses a pattern to spawn them in corners or sides to avoid immediate collision with the center.
    function spawnBlackBalls(count) {
        blackBalls = [];
        for (let i = 0; i < count; i++) {
            let pos;
            const r = BALL_RADIUS;
            // Spawn logic (corners/sides)
            if (i < 4) {
                // Corners: Spawn in the 4 corners of the play area
                const minX = PLAY_AREA_PADDING, maxX = canvas.width - PLAY_AREA_PADDING - r * 2;
                const minY = PLAY_AREA_PADDING, maxY = canvas.height - PLAY_AREA_PADDING - r * 2;
                const inset = BLACK_SPAWN_INSET;
                const corners = [
                    { x: randBetween(minX, Math.min(minX + inset, maxX)), y: randBetween(minY, Math.min(minY + inset, maxY)) },
                    { x: randBetween(Math.max(maxX - inset, minX), maxX), y: randBetween(minY, Math.min(minY + inset, maxY)) },
                    { x: randBetween(Math.max(maxX - inset, minX), maxX), y: randBetween(Math.max(maxY - inset, minY), maxY) },
                    { x: randBetween(minX, Math.min(minX + inset, maxX)), y: randBetween(Math.max(maxY - inset, minY), maxY) }
                ];
                pos = corners[i % 4];
            } else {
                // Sides: Spawn along the edges if we have more than 4 balls
                const minX = PLAY_AREA_PADDING, maxX = canvas.width - PLAY_AREA_PADDING - r * 2;
                const minY = PLAY_AREA_PADDING, maxY = canvas.height - PLAY_AREA_PADDING - r * 2;
                const inset = BLACK_SPAWN_INSET;
                const sides = [
                    { x: randBetween(Math.min(maxX - inset, minX + inset), Math.max(minX + inset, maxX - inset)), y: randBetween(minY, Math.min(minY + inset, maxY)) },
                    { x: randBetween(Math.max(maxX - inset, minX), maxX), y: randBetween(Math.min(maxY - inset, minY), Math.max(minY + inset, maxY - inset)) },
                    { x: randBetween(Math.min(maxX - inset, minX + inset), Math.max(minX + inset, maxX - inset)), y: randBetween(Math.max(maxY - inset, minY), maxY) },
                    { x: randBetween(minX, Math.min(minX + inset, maxX)), y: randBetween(Math.min(maxY - inset, minY + inset), Math.max(minY + inset, maxY - inset)) }
                ];
                pos = sides[(i - 4) % 4];
            }

            blackBalls.push({
                x: pos.x,
                y: pos.y,
                radius: BALL_RADIUS,
                color: '#0b101c',
                glowColor: 'rgba(0, 240, 255, 0.45)'
            });
        }
    }

    // Checks if two circular entities are colliding based on their radii.
    function checkCollision(c1, c2) {
        // Simple AABB for now since we use top-left coords, but let's do circle-circle
        // Convert top-left to center
        const c1x = c1.x + c1.radius;
        const c1y = c1.y + c1.radius;
        const c2x = c2.x + c2.radius;
        const c2y = c2.y + c2.radius;

        const dx = c1x - c2x;
        const dy = c1y - c2y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (c1.radius + c2.radius);
    }

    // --- Power-ups ---

    function clearPowerups() {
        powerups = [];
    }

    function clearPowerupTimer() {
        if (powerupSpawnTimeout) {
            clearTimeout(powerupSpawnTimeout);
            powerupSpawnTimeout = null;
        }
    }

    function spawnSinglePowerup() {
        clearPowerups();
        powerupSpawnTimeout = null;
        const isSpeed = Math.random() < 0.5;
        const pos = randomSpawnPosition(POWERUP_RADIUS * 2, POWERUP_RADIUS * 2);

        powerups.push({
            x: pos.x,
            y: pos.y,
            radius: POWERUP_RADIUS,
            type: isSpeed ? 'speed' : 'invincible',
            icon: isSpeed ? "⚡" : "🛡️",
            color: isSpeed ? '#1e90ff' : '#ffd700',
            pulsePhase: 0
        });
    }

    function spawnPowerupsForRound() {
        clearPowerups();
        clearPowerupTimer();
        const currentRound = roundsSurvived + 1;
        if (currentRound < POWERUP_SPAWN_ROUND) return;
        const delay = POWERUP_SPAWN_DELAY_MIN_MS + Math.random() * (POWERUP_SPAWN_DELAY_MAX_MS - POWERUP_SPAWN_DELAY_MIN_MS);
        powerupSpawnTimeout = setTimeout(spawnSinglePowerup, delay);
    }

    function applySpeedBoost(holderIdx) {
        speedBoostUntil = Date.now() + POWERUP_DURATION_MS;
        speedBoostHolder = holderIdx;
        clearPowerups();
        statusText.textContent = "Speed Boost!";
    }

    function applyInvincibility() {
        invincibleUntil = Date.now() + POWERUP_DURATION_MS;
        clearPowerups();
        statusText.textContent = "Invincible!";
    }

    function checkPowerupPickup() {
        players.forEach((p, idx) => {
            powerups.forEach(pow => {
                if (checkCollision(p, pow)) {
                    if (pow.type === 'speed') applySpeedBoost(idx);
                    else applyInvincibility();
                }
            });
        });
    }

    // --- Input Handling ---

    const keysPressed = new Set();

    // Initialize touch controls
    let touchControls = null;
    if (window.TouchControls) {
        touchControls = window.TouchControls;
        touchControls.init(canvas);
    }

    // Unified input handling for both keyboard and touch
    function updateActiveInput(player) {
        player.inputX = 0;
        player.inputY = 0;

        // Touch input takes priority over keyboard
        if (touchControls && touchControls.isTouchActive()) {
            const touchInput = touchControls.getTouchInput();
            player.inputX = touchInput.x;
            player.inputY = touchInput.y;
        } else {
            // Keyboard input
            if (keysPressed.has("ArrowLeft")) player.inputX -= 1;
            if (keysPressed.has("ArrowRight")) player.inputX += 1;
            if (keysPressed.has("ArrowUp")) player.inputY -= 1;
            if (keysPressed.has("ArrowDown")) player.inputY += 1;
        }

        // Normalize input vector
        if (player.inputX !== 0 || player.inputY !== 0) {
            const len = Math.hypot(player.inputX, player.inputY);
            player.inputX /= len;
            player.inputY /= len;
        }
    }

    document.addEventListener("keydown", (event) => {
        // Game Over / Restart Shortcuts
        if (isGameOver) {
            if (event.code === "Enter" || event.code === "Space") {
                event.preventDefault();
                restartGame();
            }
            return;
        }

        if (!gameStarted) return;

        if (event.code === "Escape") {
            togglePause();
            return;
        }

        if (isPaused) return;

        if (event.code === "Space") {
            event.preventDefault();
            spawnExtraPlayer();
            return;
        }
        if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) {
            keysPressed.add(event.key);
            const active = players[activeIndex];
            if (active) updateActiveInput(active);
        }
    });

    document.addEventListener("keyup", (event) => {
        if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) {
            keysPressed.delete(event.key);
            const active = players[activeIndex];
            if (active) updateActiveInput(active);
        }
    });

    // --- Game Logic ---

    function avoidanceInput(player) {
        if (blackBalls.length === 0) return { x: 0, y: 0 };
        let nearest = null;
        let nearestDist = Infinity;
        blackBalls.forEach(ball => {
            const dx = player.x - ball.x;
            const dy = player.y - ball.y;
            const d = Math.hypot(dx, dy);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = { dx, dy };
            }
        });
        if (!nearest || nearestDist === 0) return { x: 0, y: 0 };
        const len = Math.hypot(nearest.dx, nearest.dy);
        return { x: nearest.dx / len, y: nearest.dy / len };
    }

    // Updates a player's position, applying input, avoidance forces, and speed calculations.
    function updatePlayer(player, isActive, idx) {
        let desiredX = 0, desiredY = 0;
        const avoid = avoidanceInput(player); // Vector to avoid nearest black ball

        if (isActive) {
            // Active player controlled by keyboard or touch
            updateActiveInput(player);
            const magInput = Math.hypot(player.inputX, player.inputY);
            if (magInput > 0) {
                // Blend keyboard input with avoidance nudge
                desiredX = player.inputX + avoid.x * ACTIVE_AVOID_WEIGHT;
                desiredY = player.inputY + avoid.y * ACTIVE_AVOID_WEIGHT;
            }
        } else {
            // Autopilot players wander randomly and avoid enemies strongly
            if (Date.now() > player.autoDirChangeAt) setRandomAutoDir(player);
            desiredX = player.autoDirX + avoid.x * AUTOPILOT_AVOID_WEIGHT;
            desiredY = player.autoDirY + avoid.y * AUTOPILOT_AVOID_WEIGHT;
        }

        // Normalize desired direction
        const mag = Math.hypot(desiredX, desiredY);
        if (mag === 0) {
            if (!isActive) {
                const dir = randomUnitVector();
                desiredX = dir.x; desiredY = dir.y;
            }
        } else {
            desiredX /= mag; desiredY /= mag;
        }
        player.inputX = desiredX;
        player.inputY = desiredY;

        // Calculate speed based on difficulty, rounds survived, and powerups
        const hasSpeedBoost = isSpeedBoostActive() && speedBoostHolder === idx;
        const speedBoost = hasSpeedBoost ? SPEED_BOOST_AMOUNT : 0;
        const speedRampRounds = Math.min(roundsSurvived, SPEED_RAMP_MAX_ROUND - 1);
        const speed = PLAYER_SPEED_START + playerSpeedDelta + (isActive ? speedRampRounds * PLAYER_SPEED_PER_ROUND : 0) + speedBoost;

        // Apply smoothing to velocity for fluid movement
        player.vx += (player.inputX * speed - player.vx) * PLAYER_SMOOTHING;
        player.vy += (player.inputY * speed - player.vy) * PLAYER_SMOOTHING;

        // Update position and clamp to screen bounds
        player.x = clamp(player.x + player.vx, PLAY_AREA_PADDING, canvas.width - player.radius * 2 - PLAY_AREA_PADDING);
        player.y = clamp(player.y + player.vy, PLAY_AREA_PADDING, canvas.height - player.radius * 2 - PLAY_AREA_PADDING);
    }

    function setActivePlayer(index) {
        activeIndex = clamp(index, 0, players.length - 1);
        players.forEach((p, idx) => {
            p.isActive = (idx === activeIndex);
        });
    }

    function eliminatePlayer(idx) {
        if (idx < 0 || idx >= players.length) return;
        const wasActive = idx === activeIndex;
        players.splice(idx, 1);

        if (speedBoostHolder === idx) { speedBoostHolder = null; speedBoostUntil = 0; }
        else if (speedBoostHolder !== null && speedBoostHolder > idx) speedBoostHolder -= 1;

        if (players.length === 0) {
            handleLoss();
            return;
        }

        if (wasActive) {
            setActivePlayer(Math.min(idx, players.length - 1));
        } else if (idx < activeIndex) {
            activeIndex -= 1;
        }

        statusText.textContent = "Next Ball!";
    }

    function isSpeedBoostActive() { return Date.now() < speedBoostUntil; }
    function isInvincibleActive() { return Date.now() < invincibleUntil; }

    // Updates black ball positions. They chase the nearest player.
    function moveBlackBalls() {
        if (isGameOver || isPaused || players.length === 0) return;


        // Calculate player's current base speed (excluding powerups) to use as a cap
        const speedRampRounds = Math.min(roundsSurvived, SPEED_RAMP_MAX_ROUND - 1);
        const playerBaseSpeed = PLAYER_SPEED_START + playerSpeedDelta + (speedRampRounds * PLAYER_SPEED_PER_ROUND);

        blackBalls.forEach((ball, ballIndex) => {
            // Find nearest player to chase
            let targetPlayer = players[0];
            let bestDist = Infinity;
            players.forEach(p => {
                const d = Math.hypot(p.x - ball.x, p.y - ball.y);
                if (d < bestDist) { bestDist = d; targetPlayer = p; }
            });

            const dx = targetPlayer.x - ball.x;
            const dy = targetPlayer.y - ball.y;
            const dist = Math.hypot(dx, dy) || 1;

            // Flee if player is invincible, otherwise chase
            const chaseDirX = isInvincibleActive() ? -dx : dx;
            const chaseDirY = isInvincibleActive() ? -dy : dy;

            let ballSpeed = BLACK_BALL_SPEED_START + enemySpeedDelta + (ballIndex * BLACK_BALL_SPEED_INCREMENT);
            // Cap the speed so they are never faster than the player's base speed
            ballSpeed = Math.min(ballSpeed, playerBaseSpeed);

            ball.x = clamp(ball.x + (chaseDirX / dist) * ballSpeed, PLAY_AREA_PADDING, canvas.width - ball.radius * 2 - PLAY_AREA_PADDING);
            ball.y = clamp(ball.y + (chaseDirY / dist) * ballSpeed, PLAY_AREA_PADDING, canvas.height - ball.radius * 2 - PLAY_AREA_PADDING);

            if (!isInvincibleActive()) {
                for (let i = players.length - 1; i >= 0; i--) {
                    if (checkCollision(ball, players[i])) eliminatePlayer(i);
                }
            }
        });
    }


    // --- Rendering ---

    function drawGlow(x, y, radius, color, blur) {
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
    }

    function drawBall(ball, isPlayer) {
        const cx = ball.x + ball.radius;
        const cy = ball.y + ball.radius;

        // Glow
        let glowColor = ball.glowColor;
        let glowSize = 15;

        if (isPlayer) {
            if (ball.isActive) {
                // Pulsing effect for active player
                const pulse = Math.sin(Date.now() / 200) * 5 + 25;
                glowColor = 'rgba(255, 80, 80, 0.8)';
                glowSize = pulse;
            } else {
                glowColor = 'rgba(255, 162, 162, 0.2)';
                glowSize = 5;
            }

            if (isInvincibleActive()) {
                glowColor = '#ffd700';
                glowSize = 30;
            } else if (isSpeedBoostActive() && speedBoostHolder === players.indexOf(ball)) {
                glowColor = '#1e90ff';
                glowSize = 30;
            }
        }

        ctx.save();
        ctx.shadowBlur = glowSize;
        ctx.shadowColor = glowColor;

        // Gradient fill
        const grad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, ball.radius);
        if (isPlayer) {
            if (isInvincibleActive()) {
                grad.addColorStop(0, '#fff');
                grad.addColorStop(1, '#ffd700');
            } else if (isPlayer && isSpeedBoostActive() && speedBoostHolder === players.indexOf(ball)) {
                grad.addColorStop(0, '#fff');
                grad.addColorStop(1, '#1e90ff');
            } else {
                grad.addColorStop(0, '#ff9999');
                grad.addColorStop(1, ball.isActive ? '#ff0000' : 'rgba(255, 162, 162, 0.4)');
            }
        } else {
            // Black ball
            grad.addColorStop(0, '#2a3b55');
            grad.addColorStop(1, '#0b101c');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        if (isPlayer) {
            ctx.strokeStyle = ball.isActive ? '#fff' : 'rgba(255,255,255,0.4)';
            ctx.lineWidth = ball.isActive ? 2 : 1;
            if (!ball.isActive) {
                ctx.setLineDash([2, 2]);
            }
            ctx.stroke();

            // Extra ring for active player
            if (ball.isActive) {
                ctx.beginPath();
                ctx.arc(cx, cy, ball.radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    function drawPowerup(p) {
        const cx = p.x + p.radius;
        const cy = p.y + p.radius;

        // Pulse effect
        p.pulsePhase = (p.pulsePhase || 0) + 0.1;
        const scale = 1 + Math.sin(p.pulsePhase) * 0.1;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = p.color;
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.icon, 0, 2); // slight offset

        ctx.restore();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Powerups
        powerups.forEach(p => drawPowerup(p));

        // Draw Players
        players.forEach(p => drawBall(p, true));

        // Draw Black Balls
        blackBalls.forEach(b => drawBall(b, false));

        // Draw Touch Controls (if active)
        if (touchControls && !isGameOver && !isPaused && gameStarted && !isCountingDown) {
            touchControls.render(ctx);
        }
    }

    // Main Game Loop: Updates logic and renders the frame
    function gameLoop() {
        if (!isGameOver && !isPaused && gameStarted) {
            players.forEach((p, idx) => updatePlayer(p, idx === activeIndex, idx));
            checkPowerupPickup();
            moveBlackBalls();

            // Update Status Text if powerups expire
            if (!isSpeedBoostActive() && !isInvincibleActive() && statusText.textContent !== "Playing" && statusText.textContent !== "Next Ball!") {
                statusText.textContent = "Playing";
            }
        }

        render();
        requestAnimationFrame(gameLoop);
    }

    function startTimer() {
        clearInterval(timerInterval);
        timer = ROUND_TIME_SECONDS;
        timeRemainingEl.textContent = timer;
        timerInterval = setInterval(() => {
            if (isGameOver || isPaused || !gameStarted) return;
            timer -= 1;
            timeRemainingEl.textContent = timer;
            if (timer <= 0) nextRound();
        }, 1000);
    }

    function stopTimer() { clearInterval(timerInterval); }

    function playBeep(freq = 840, duration = 150) {
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);
            oscillator.connect(gain);
            gain.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration / 1000);
        } catch (_) { }
    }

    function stopCountdown() {
        isCountingDown = false;
        if (countdownTimeout) {
            clearTimeout(countdownTimeout);
            countdownTimeout = null;
        }
        countdownOverlay.style.display = "none";
    }

    function startCountdown() {
        stopCountdown(); // Ensure any previous countdown is cleared
        isCountingDown = true;
        stopTimer();

        let count = 3;
        countdownOverlay.style.display = "flex";
        countdownOverlay.textContent = count;
        playBeep();

        const tick = () => {
            count -= 1;
            if (count > 0) {
                countdownOverlay.textContent = count;
                playBeep();
                countdownTimeout = setTimeout(tick, 1000);
            } else {
                countdownOverlay.textContent = "GO!";
                playBeep(1080, 200);
                countdownTimeout = setTimeout(() => {
                    countdownOverlay.style.display = "none";
                    isCountingDown = false;
                    startRound();
                }, 600);
            }
        };
        countdownTimeout = setTimeout(tick, 1000);
    }

    // Starts a new round, resetting positions and spawning entities
    function startRound() {
        if (players.length === 0) players.push(createPlayer());

        isGameOver = false;
        gameStarted = true;
        statusText.textContent = "Playing";
        speedBoostUntil = 0;
        speedBoostHolder = null;
        invincibleUntil = 0;

        clearPowerups();
        clearPowerupTimer();
        keysPressed.clear();
        if (touchControls) touchControls.reset();
        stopTimer();

        positionPlayersAtCenter();
        players.forEach(p => setRandomAutoDir(p));
        spawnBlackBalls(ballCount);
        spawnPowerupsForRound();

        ballCountEl.textContent = ballCount;
        setActivePlayer(Math.min(activeIndex, players.length - 1));

        startTimer();
        playMusic();
    }

    function nextRound() {
        roundsSurvived += 1;
        ballCount += 1;
        startRound();
    }

    function resetPlayersToOne() {
        players.length = 0;
        players.push(createPlayer());
        setActivePlayer(0);
        roundsSurvived = 0;
        speedBoostHolder = null;
    }

    function handleLoss() {
        if (isGameOver) return;
        isGameOver = true;
        stopTimer();
        pauseMusic(); // Pause music on game over
        clearPowerupTimer();

        finalRoundsEl.textContent = roundsSurvived;
        finalDifficultyEl.textContent = DIFFICULTIES[currentDifficulty].label;

        setTimeout(() => {
            gameOverModal.classList.add("visible");
        }, 500);
    }

    // --- Global Functions for UI ---

    // Entry point to start the game from the menu
    window.startGame = function (difficulty) {
        // Remove focus from buttons so keyboard works immediately
        if (document.activeElement) document.activeElement.blur();

        // Robust State Reset
        isPaused = false;
        gameStarted = false; // Wait for countdown
        blackBalls = [];
        powerups = [];
        keysPressed.clear();
        if (touchControls) touchControls.reset();
        render(); // Clear screen

        const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
        currentDifficulty = difficulty;
        difficultyLabel.textContent = diff.label;
        playerSpeedDelta = diff.playerSpeedDelta;
        enemySpeedDelta = diff.enemySpeedDelta;
        ballCount = diff.startBalls;
        roundsSurvived = 0;

        mainMenu.classList.remove("visible");
        hud.classList.remove("hidden");
        gameContainer.classList.remove("hidden");

        resetPlayersToOne();
        stopCountdown(); // Safety clear
        startCountdown();
        // playMusic(); // Moved to startRound
    };

    window.resumeGame = function () {
        if (!gameStarted || isGameOver) return;
        isPaused = false;
        mainMenu.classList.remove("visible");
        startTimer(); // resume timer
        playMusic(); // Resume music
    };

    window.restartGame = function () {
        // Remove focus from buttons
        if (document.activeElement) document.activeElement.blur();

        keysPressed.clear(); // Clear any stuck keys
        if (touchControls) touchControls.reset();
        gameOverModal.classList.remove("visible");
        mainMenu.classList.remove("visible");
        window.startGame(currentDifficulty);
    };

    window.showMainMenu = function () {
        gameOverModal.classList.remove("visible");
        mainMenu.classList.add("visible");
        resumeContainer.classList.add("hidden");
        gameStarted = false;
        isPaused = false;
        hud.classList.add("hidden");

        // Reset game state visually
        blackBalls = [];
        clearPowerups();
        players.length = 0;
        render(); // Clear canvas
        stopCountdown();
        stopMusic(); // Stop music when returning to main menu
    };

    function togglePause() {
        if (!gameStarted || isGameOver || isCountingDown) return;
        isPaused = !isPaused;

        if (isPaused) {
            stopTimer();
            pauseMusic(); // Pause music
            mainMenu.classList.add("visible");
            resumeContainer.classList.remove("hidden");
        } else {
            window.resumeGame();
        }
    }

    // --- Autopilot for Verification ---
    window.enableAutopilot = function () {
        console.log("Autopilot ENABLED");
        setInterval(() => {
            if (isGameOver || isPaused || !gameStarted) return;
            const p = players[activeIndex];
            if (!p) return;

            const avoid = avoidanceInput(p);
            // Simulate keys based on avoid vector
            // Reset keys
            keysPressed.clear();

            if (avoid.x < -0.1) keysPressed.add("ArrowLeft");
            if (avoid.x > 0.1) keysPressed.add("ArrowRight");
            if (avoid.y < -0.1) keysPressed.add("ArrowUp");
            if (avoid.y > 0.1) keysPressed.add("ArrowDown");

        }, 100);
    };

    // --- Initialization ---

    // Hide game elements initially
    hud.classList.add("hidden");

    // Right click pause
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        togglePause();
    });

    // Start loop
    gameLoop();
})();

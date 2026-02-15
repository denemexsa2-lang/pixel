const TICK_RATE = 10; // Updates per second (Increased for faster sync)

class GameHandler {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.players = players.map(p => ({
            id: p.id,
            username: p.username,
            color: this.getRandomColor(),
            troops: 100,
            gold: 1000,
            territorySize: 100, // Starting pixels
            factories: [],
            spawnPoint: null // Wait for player to select
        }));

        this.gameState = {
            players: this.players,
            mapState: {}, // Pixel ownership map (simplified for now)
            attacks: [], // Active attacks
            phase: 'warmup', // 'warmup' | 'playing'
            startTime: Date.now() + 10000 // 10 seconds warmup
        };

        this.interval = null;
        this.lastUpdate = Date.now();
    }

    getRandomColor() {
        const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    start() {
        console.log(`Game started in room ${this.roomId}`);

        // Broadcast initial state
        this.io.to(this.roomId).emit('game_started', {
            players: this.players,
            mapId: 'world_map', // Mock map ID
            phase: this.gameState.phase,
            startTime: this.gameState.startTime
        });

        this.interval = setInterval(() => this.update(), 1000 / TICK_RATE);
    }

    update() {
        const now = Date.now();
        const dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;

        // Check Phase Transition
        if (this.gameState.phase === 'warmup') {
            if (now >= this.gameState.startTime) {
                this.gameState.phase = 'playing';
                console.log(`Room ${this.roomId} switched to PLAYING phase`);
            }
        }

        // 1. Update Economy (Troops & Gold)
        // ONLY IN PLAYING PHASE
        if (this.gameState.phase === 'playing') {
            this.players.forEach(player => {
                // Only update if player has spawned
                if (player.spawnPoint !== null) {
                    // Simple growth logic (mocking client logic for now)
                    if (now % 1000 < 50) { // Approx once per second
                        player.gold += 1; // Base income
                        if (player.troops < player.territorySize * 5) {
                            player.troops += Math.floor(player.territorySize * 0.05);
                        }
                    }
                }
            });
        }

        // 2. Process Attacks
        if (this.gameState.phase === 'playing') {
            this.gameState.attacks.forEach((attack, index) => {
                // Move attack towards target
                // ... movement logic ...

                // If reached target, resolve combat
                // ... combat logic ...
            });
        }

        // 3. Broadcast Update
        this.io.to(this.roomId).emit('game_update', {
            players: this.players,
            attacks: this.gameState.attacks,
            phase: this.gameState.phase,
            timeLeft: Math.max(0, Math.ceil((this.gameState.startTime - now) / 1000))
        });
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    handlePlayerAction(socketId, action, data) {
        const player = this.players.find(p => p.id === socketId);
        if (!player) return;

        switch (action) {
            case 'choose_spawn':
                if (player.spawnPoint === null) {
                    player.spawnPoint = data.index;
                    // Initialize territory around spawn (mock)
                    player.territorySize = 500;
                    console.log(`Player ${player.username} chose spawn ${data.index}`);

                    // Broadcast update immediately so others see the spawn
                    this.io.to(this.roomId).emit('game_update', {
                        players: this.players,
                        attacks: this.gameState.attacks
                    });
                }
                break;
            case 'attack':
                // Create new attack
                // this.gameState.attacks.push({ ... });
                break;
            case 'expand':
                // Update territory
                player.territorySize += data.amount;
                player.troops -= data.cost;

                // Broadcast expansion event to other players for simulation
                // Use this.io.to which sends to everyone (client filters self)
                this.io.to(this.roomId).emit('player_expanded', {
                    playerId: player.id,
                    amount: data.amount,
                    color: player.color // Send color for verification/visuals
                });
                break;
            case 'build_factory':
                // ... factory logic ...
                break;
            case 'upgrade_factory':
                // ... upgrade logic ...
                break;
            // case 'update_player_state':
            //     // Client reporting their own state (Optimistic Sync) - REMOVED
            //     if (data.territorySize) player.territorySize = data.territorySize;
            //     if (data.troops) player.troops = data.troops;
            //     if (data.gold) player.gold = data.gold;
            //     break;
        }
    }
}

module.exports = GameHandler;

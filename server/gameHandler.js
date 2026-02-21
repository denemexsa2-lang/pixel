const TICK_RATE = 10; // Updates per second (Increased for faster sync)

class GameHandler {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.availableColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];

        this.players = players.map((p, index) => ({
            id: p.id,
            username: p.username,
            color: this.availableColors[index % this.availableColors.length],
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
        this.timeSinceLastEconomyUpdate = 0;
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
            this.timeSinceLastEconomyUpdate += dt;

            if (this.timeSinceLastEconomyUpdate >= 1.0) {
                this.timeSinceLastEconomyUpdate -= 1.0;

                this.players.forEach(player => {
                    // Only update if player has spawned
                    if (player.spawnPoint !== null) {
                        // Gold Income
                        let income = 85;
                        player.factories.forEach(f => {
                            if (f.level === 1) income += 50;
                            else if (f.level === 2) income += 150;
                            else if (f.level === 3) income += 400;
                        });
                        player.gold += income;

                        // Troop Growth
                        const maxUnits = Math.max(100, player.territorySize * 5);
                        if (player.troops < maxUnits) {
                            const currentPercentage = player.troops / maxUnits;
                            let growthRate = 0;
                            if (currentPercentage <= 0.50) {
                                growthRate = 0.05;
                            } else {
                                growthRate = Math.max(0, 0.1 * (1 - currentPercentage));
                            }

                            let addedTroops = Math.floor(player.troops * growthRate);

                            // Simplified Bonus (approximate client's complex logic)
                            const bonus = Math.floor(player.territorySize / 15);
                            addedTroops += bonus;

                            player.troops = Math.min(maxUnits, player.troops + addedTroops);
                        }
                    }
                });
            }
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
                if (player.troops >= data.cost) {
                    player.territorySize += data.amount;
                    player.troops -= data.cost;

                    this.io.to(this.roomId).emit('player_expanded', {
                        playerId: player.id,
                        amount: data.amount,
                        color: player.color
                    });
                }
                break;
            case 'build_factory':
                const factoryCost = 200 + (player.factories.length * 100);
                if (player.gold >= factoryCost) {
                    player.gold -= factoryCost;
                    const newFactory = {
                        id: Date.now() + Math.random(),
                        x: data.x,
                        y: data.y,
                        level: 1
                    };
                    player.factories.push(newFactory);
                }
                break;
            case 'upgrade_factory':
                const factory = player.factories.find(f => f.id === data.factoryId);
                if (factory && factory.level < 3) {
                    const upgradeCost = factory.level === 1 ? 1000 : 2500;
                    if (player.gold >= upgradeCost) {
                        player.gold -= upgradeCost;
                        factory.level += 1;
                    }
                }
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

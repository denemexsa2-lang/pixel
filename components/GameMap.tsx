import React, { useEffect, useRef, useState, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import { Map as MapIcon, LogOut, CheckCircle2, Flag } from 'lucide-react';
import { packColor, blendColor, COLORS_32, Factory } from '../utils/gameUtils';

interface GameMapProps {
    onLeave: () => void;
    onStartGame?: (index: number) => void;
    isGameplay?: boolean;
    spawnPoint?: number | null;
    currentTroops?: number;
    onConsumeTroops?: (amount: number) => void;
    onCenterChange?: (x: number, y: number) => void;
    onProgress?: (progress: number) => void;
    onLoadComplete?: () => void;
    onTerritoryChange?: (size: number) => void;
    onExpansionUpdate?: (amount: number, cost: number) => void; // New prop for batching
    attackRatio?: number;
    onReservedTroopsChange?: (reserved: number) => void;
    onAttackingTroopsChange?: (attacking: number) => void;
    isPendingFactoryPlacement?: boolean;
    onFactoryPlaced?: () => void;
    onRightClick?: (index: number) => void;
    onSpawnSelect?: (index: number) => void;
    // Zoom and Pan props
    mapScale?: number;
    mapPosition?: { x: number; y: number };
    // Attack Logic
    pendingAttackTroops?: number;
    onRequestAttack?: () => void;
    onAttackReceived?: () => void;
    onMapLoad?: (totalPixels: number) => void;
    // Factory Logic
    factories?: Factory[];
    onFactoryClick?: (index: number) => void;
    onGridDimensionsChange?: (width: number, height: number) => void;
    players?: any[];
    phase?: 'warmup' | 'playing';
    timeLeft?: number;
}

export interface GameMapRef {
    simulateExpansion: (playerId: string, amount: number, color: string) => void;
}

export const GameMap = memo(forwardRef<GameMapRef, GameMapProps>(({
    onLeave,
    onStartGame,
    isGameplay = false,
    spawnPoint,
    currentTroops = 0,
    onConsumeTroops,
    onCenterChange,
    onProgress,
    onLoadComplete,
    onTerritoryChange,
    onExpansionUpdate,
    attackRatio = 20,
    onReservedTroopsChange,
    onAttackingTroopsChange,
    isPendingFactoryPlacement = false,
    onFactoryPlaced,
    onRightClick,
    onSpawnSelect,
    mapScale = 1,
    mapPosition = { x: 0, y: 0 },
    pendingAttackTroops = 0,
    onRequestAttack,
    onAttackReceived,
    onMapLoad,
    factories = [],
    onFactoryClick,
    onGridDimensionsChange,
    players = [],
    phase,
    timeLeft
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Factory Images
    const l1Ref = useRef<HTMLImageElement | null>(null);
    const l2Ref = useRef<HTMLImageElement | null>(null);
    const l3Ref = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const img1 = new Image();
        img1.src = '/l 1.png';
        l1Ref.current = img1;

        const img2 = new Image();
        img2.src = '/l 2.png';
        l2Ref.current = img2;

        const img3 = new Image();
        img3.src = '/l 3.png';
        l3Ref.current = img3;
    }, []);

    // --- CONFIGURATION ---
    // 4K Resolution for high detail
    // Reduced to 1920 for better performance on mobile/low-end devices
    const PIXEL_DENSITY = 1920;
    const EXPANSION_COST_PER_PIXEL = 2; // Territorial.io standard: 2 troops per pixel

    // --- STATE & REFS ---
    const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');
    const [statusMessage, setStatusMessage] = useState("GPU ARABELLEĞİ HAZIRLANIYOR...");
    const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });

    // Direct Memory Buffers
    const imageBufferRef = useRef<Uint32Array | null>(null);
    const originalBufferRef = useRef<Uint32Array | null>(null); // Store original map for blending
    const imageDataRef = useRef<ImageData | null>(null);
    const ownershipRef = useRef<Uint8Array | null>(null);

    // Clean State for Preview (Undo)
    const cleanOwnershipRef = useRef<Uint8Array | null>(null);
    const cleanBufferRef = useRef<Uint32Array | null>(null);

    // Rendering State (Dirty Flag Pattern)
    const dirtyRef = useRef(true); // Start dirty to force first render

    // Optimized Lists
    const activeBordersRef = useRef<number[]>([]);
    const borderSetRef = useRef<Set<number>>(new Set());
    const expansionQueueRef = useRef<number[]>([]); // New BFS Queue for sequential expansion

    // Interaction State
    const [hoveredPixelIndex, setHoveredPixelIndex] = useState<number | null>(null);
    const [selectedPixelIndex, setSelectedPixelIndex] = useState<number | null>(null);
    const [isExpanding, setIsExpanding] = useState(false);
    const [isGeneratingTerritory, setIsGeneratingTerritory] = useState(false);
    const ownedPixelsRef = useRef(0);
    const reservedTroopsRef = useRef(0);
    const isAutoExpandingRef = useRef(false);
    const attackingTroopsRef = useRef(0);
    // const factoryPositionsRef = useRef<number[]>([]);

    // Stable Refs for Props that change frequently but shouldn't trigger re-renders of heavy logic
    const currentTroopsRef = useRef(currentTroops);
    const attackRatioRef = useRef(attackRatio);

    // Update refs when props change
    useEffect(() => {
        currentTroopsRef.current = currentTroops;
    }, [currentTroops]);

    useEffect(() => {
        attackRatioRef.current = attackRatio;
    }, [attackRatio]);

    // --- ATTACK BATCH LOGIC ---
    useEffect(() => {
        if (pendingAttackTroops > 0) {
            attackingTroopsRef.current += pendingAttackTroops;
            if (onAttackingTroopsChange) onAttackingTroopsChange(attackingTroopsRef.current);
            if (onAttackReceived) onAttackReceived();
        }
    }, [pendingAttackTroops, onAttackReceived, onAttackingTroopsChange]);

    // Bot AI State
    interface Bot {
        id: number;
        playerId: string; // Server ID
        spawnIndex: number;
        troops: number;
        borders: number[]; // For random fallback (optional)
        borderSet: Set<number>;
        expansionQueue: number[]; // BFS Queue
        pendingExpansion: number; // Amount to expand
        innerColor: number;
        borderColor: number;
    }
    const botsRef = useRef<Bot[]>([]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        simulateExpansion: (playerId: string, amount: number, color: string) => {
            // console.log("simulateExpansion called for playerId:", playerId, "amount:", amount, "color:", color);
            const bot = botsRef.current.find(b => b.playerId === playerId);
            if (bot) {
                // console.log(`Simulating expansion for bot ${bot.id} (Player ${playerId}). Amount: ${amount}`);
                bot.pendingExpansion += amount;
                // Update color if needed (optional, but good for sync)
                if (color) {
                    // Parse Hex to RGB
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);

                    const newInner = packColor(r, g, b, 100); // Transparent Inner
                    const newBorder = packColor(r, g, b, 255); // Opaque Border

                    if (bot.innerColor !== newInner) {
                        bot.innerColor = newInner;
                        bot.borderColor = newBorder;
                    }
                }
            } else {
                console.warn(`Bot not found for player ${playerId}. Active bots:`, botsRef.current.map(b => b.playerId));
            }
        }
    }));

    // --- BOT INITIALIZATION (REMOTE PLAYERS) ---
    const initBots = useCallback(() => {
        if (!ownershipRef.current || !imageBufferRef.current) return;
        // console.log("Updating Remote Players (Bots)...", players.length);

        const ownership = ownershipRef.current;
        const buffer32 = imageBufferRef.current;
        const { width, height } = gridDimensions;

        // 1. Identify active player IDs from props
        const activePlayerIds = new Set(players.map(p => p.id));

        // 2. Remove bots that are no longer in the game
        botsRef.current = botsRef.current.filter(bot => {
            if (!activePlayerIds.has(bot.playerId)) {
                // Optional: Clear their territory? 
                // For now, leave it as "neutral" or "dead" territory.
                // Or clear it to 0?
                // Let's leave it.
                return false;
            }
            return true;
        });

        // 3. Add new bots or update existing
        let botIdCounter = 4; // Start from 4 (1=Land, 2=PlayerInner, 3=PlayerBorder)
        // We need to ensure unique IDs. 
        // If we keep bots, we need to know which internal IDs are used.
        // Actually, we can just assign a new ID for new bots.
        // But we need to make sure we don't reuse an ID that is currently on the map?
        // The map uses IDs.
        // If we remove a bot, its ID remains on map.
        // If we reuse that ID, the new bot will instantly own that territory.
        // So we should probably increment ID strictly.
        // Let's find the max ID used so far.
        const maxId = botsRef.current.reduce((max, b) => Math.max(max, b.id), 3);
        botIdCounter = maxId + 1;

        players.forEach((p) => {
            if (p.spawnPoint === null || p.spawnPoint === undefined) return;
            if (p.spawnPoint === spawnPoint) return; // Skip self

            // Check if bot already exists
            const existingBot = botsRef.current.find(b => b.playerId === p.id);
            if (existingBot) {
                // Update dynamic props if needed (e.g. troops, color)
                existingBot.troops = p.troops || existingBot.troops;
                // existingBot.innerColor = ...
                return;
            }

            // NEW BOT
            // Parse Hex Color correctly
            let r = 248, g = 113, b = 113; // Default Red
            if (p.color) {
                r = parseInt(p.color.slice(1, 3), 16);
                g = parseInt(p.color.slice(3, 5), 16);
                b = parseInt(p.color.slice(5, 7), 16);
            }

            const config = {
                innerColor: packColor(r, g, b, 100),
                borderColor: packColor(r, g, b, 255),
                ownerId: botIdCounter++
            };

            const bot: Bot = {
                id: config.ownerId,
                playerId: p.id,
                spawnIndex: p.spawnPoint,
                troops: p.troops || 100,
                borders: [],
                borderSet: new Set(),
                expansionQueue: [],
                pendingExpansion: 0,
                innerColor: config.innerColor,
                borderColor: config.borderColor,
            };

            // Initialize territory (small circle)
            const radius = 9.77;
            const cx = p.spawnPoint % width;
            const cy = Math.floor(p.spawnPoint / width);

            for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                    if (dx * dx + dy * dy <= radius * radius) {
                        const x = cx + dx;
                        const y = cy + dy;
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            const idx = y * width + x;
                            if (ownership[idx] === 1) { // Only overwrite land
                                ownership[idx] = config.ownerId;
                                buffer32[idx] = config.innerColor;
                            }
                        }
                    }
                }
            }

            // Mark borders
            for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                    if (dx * dx + dy * dy <= radius * radius) {
                        const x = cx + dx;
                        const y = cy + dy;
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            const idx = y * width + x;
                            if (ownership[idx] === config.ownerId) {
                                let isBorder = false;
                                const offsets = [1, -1, width, -width];
                                for (const off of offsets) {
                                    const n = idx + off;
                                    if (n < 0 || n >= ownership.length || ownership[n] !== config.ownerId) {
                                        isBorder = true;
                                        break;
                                    }
                                }
                                if (isBorder) {
                                    buffer32[idx] = config.borderColor;
                                    bot.borders.push(idx);
                                    bot.borderSet.add(idx);
                                    bot.expansionQueue.push(idx); // Add to BFS queue
                                }
                            }
                        }
                    }
                }
            }

            botsRef.current.push(bot);
            dirtyRef.current = true;
        });

        // console.log(`Active remote players: ${botsRef.current.length}`);

    }, [gridDimensions, players, spawnPoint]);

    // --- MAP RESTORATION (FOR PREVIEW) ---
    const restoreMap = useCallback(() => {
        if (!cleanOwnershipRef.current || !cleanBufferRef.current || !ownershipRef.current || !imageBufferRef.current) return;

        // Restore buffers from clean state
        ownershipRef.current.set(cleanOwnershipRef.current);
        imageBufferRef.current.set(cleanBufferRef.current);

        dirtyRef.current = true;
    }, []);

    // --- INITIALIZATION LOGIC ---
    const initializeTerritory = useCallback((spawnIdx: number | null) => {
        if (!ownershipRef.current || !imageBufferRef.current || !originalBufferRef.current) return;

        console.log("Initializing Territory System...");
        const width = gridDimensions.width;
        const height = gridDimensions.height;
        const ownership = ownershipRef.current;
        const buffer32 = imageBufferRef.current;
        const originalBuffer = originalBufferRef.current;

        // 1. Clear previous state
        activeBordersRef.current = [];
        borderSetRef.current = new Set();
        ownedPixelsRef.current = 0;
        botsRef.current = []; // Clear bots

        // 2. Determine Spawn Point (Robust Search)
        let startIdx = spawnIdx || Math.floor((height / 2) * width + width / 2);

        // If spawn point is not valid land, search for nearest land
        if (ownership[startIdx] !== 1) {
            console.warn("Spawn point invalid, searching for nearest land...");
            let found = false;
            const maxRadius = 100; // Search wide

            for (let r = 1; r <= maxRadius; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const cx = startIdx % width;
                        const cy = Math.floor(startIdx / width);
                        const x = cx + dx;
                        const y = cy + dy;
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            const idx = y * width + x;
                            if (ownership[idx] === 1) {
                                startIdx = idx;
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }

            if (!found) {
                console.error("CRITICAL: No land found! Forcing center.");
                startIdx = Math.floor((height / 2) * width + width / 2);
            }
        }

        console.log("Spawn Point Finalized:", startIdx);

        // 3. Create Initial Territory (300px Circle)
        const radius = 9.77; // ~300 pixels
        const cx = startIdx % width;
        const cy = Math.floor(startIdx / width);
        let pixelCount = 0;

        // Pass 1: Inner Pixels
        for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
            for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        const idx = y * width + x;
                        if (ownership[idx] === 1) {
                            ownership[idx] = 2; // Inner
                            // BLENDING: Mix player color with original map
                            buffer32[idx] = blendColor(originalBuffer[idx], COLORS_32.PLAYER_INNER);
                            pixelCount++;
                        }
                    }
                }
            }
        }

        // Pass 2: Borders
        for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
            for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        const idx = y * width + x;
                        if (ownership[idx] === 2) {
                            let isBorder = false;
                            const offsets = [1, -1, width, -width];
                            for (const off of offsets) {
                                const n = idx + off;
                                if (n < 0 || n >= ownership.length || ownership[n] !== 2) {
                                    isBorder = true;
                                    break;
                                }
                            }
                            if (isBorder) {
                                ownership[idx] = 3; // Border
                                buffer32[idx] = COLORS_32.PLAYER_BORDER; // Opaque border
                                if (!borderSetRef.current.has(idx)) {
                                    borderSetRef.current.add(idx);
                                    activeBordersRef.current.push(idx);
                                    expansionQueueRef.current.push(idx); // Add to BFS queue
                                }
                            }
                        }
                    }
                }
            }
        }

        ownedPixelsRef.current = pixelCount;
        if (onTerritoryChange) onTerritoryChange(pixelCount);

        // Force Render
        dirtyRef.current = true;
        setIsGeneratingTerritory(false);

        // Initialize Bots
        initBots();

    }, [gridDimensions, onTerritoryChange, initBots]);

    // --- EXPANSION LOGIC (BFS / SEQUENTIAL) ---
    const expandTerritory = useCallback(() => {
        if (!ownershipRef.current || !imageBufferRef.current || !originalBufferRef.current) return;

        // Use expansionQueueRef for BFS. If empty, fallback to activeBordersRef (shouldn't happen if logic is correct)
        // But activeBordersRef might contain borders that are "stuck" or old.
        // We want to process the *oldest* borders first to expand outwards.
        // Actually, activeBordersRef is already pushed in order. So we can just use it as a queue?
        // But activeBordersRef is used for random selection in the old code.
        // Let's use a dedicated queue or just treat activeBordersRef as a queue.
        // Issue: We need to remove from the FRONT of the queue for BFS. Array.shift() is slow.
        // Optimization: Use an index pointer or a linked list. For now, let's just use a separate queue and manage it carefully.
        // Or better: Just iterate activeBordersRef? No, that's random access.

        // Let's use expansionQueueRef.
        const queue = expansionQueueRef.current;
        if (queue.length === 0) {
            // If queue is empty but we have borders, refill it from borderSetRef (which is kept clean)
            if (borderSetRef.current.size > 0) {
                queue.push(...Array.from(borderSetRef.current));
            } else {
                return;
            }
        }

        const width = gridDimensions.width;
        const ownership = ownershipRef.current;
        const buffer32 = imageBufferRef.current;
        const originalBuffer = originalBufferRef.current;

        // Speed calculation
        const baseSpeed = 50;
        const maxSpeed = 800;
        const attackingTroops = attackingTroopsRef.current;
        const speedMultiplier = Math.min(attackingTroops / 100, 8);
        const calculatedSpeed = Math.floor(baseSpeed + (maxSpeed - baseSpeed) * (speedMultiplier / 8));
        const pixelsPerFrame = Math.floor(calculatedSpeed / 8.25);

        // Dynamic Cost Calculation
        const totalPixels = gridDimensions.width * gridDimensions.height;
        const mapPercentage = ownedPixelsRef.current / (totalPixels || 1);

        let costMultiplier = 1.0;
        if (mapPercentage > 0.05) {
            if (mapPercentage >= 0.30) {
                costMultiplier = 1.4; // Max 40% extra cost
            } else {
                const progress = (mapPercentage - 0.05) / 0.25;
                costMultiplier = 1.0 + (0.4 * progress);
            }
        }

        const currentPixelCost = EXPANSION_COST_PER_PIXEL * costMultiplier;

        let cost = 0;
        let pixelsClaimed = 0;
        const offsets = [1, -1, width, -width]; // Right, Left, Down, Up

        // We will process 'pixelsPerFrame' expansions
        let processedCount = 0;

        // Safety break to prevent infinite loops if queue is stuck
        let attempts = 0;
        const maxAttempts = pixelsPerFrame * 5;

        while (processedCount < pixelsPerFrame && queue.length > 0 && attempts < maxAttempts) {
            attempts++;

            if (attackingTroopsRef.current < currentPixelCost) break; // Out of troops

            // BFS: Take from the BEGINNING of the queue (Oldest border)
            // Performance Note: queue.shift() is O(N). For large queues, this is bad.
            // However, for this game scale, it might be acceptable. 
            // Better approach: Use a pointer or a proper Queue class. 
            // For now, let's use a simple optimization: 
            // If queue is huge, maybe just pick random? No, user wants sequential.
            // Let's rely on JS engine optimization for array.shift() or use a pointer if needed.
            // Actually, let's just use shift() for simplicity first. If slow, we optimize.

            const sourceIdx = queue[0]; // Peek

            // Check if this pixel is still a valid border of ours
            if (ownership[sourceIdx] !== 3) {
                queue.shift(); // Invalid, remove
                continue;
            }

            // Try to expand to neighbors
            let expanded = false;

            // Shuffle offsets - REMOVED FOR DETERMINISM
            // We must use a fixed order so all clients simulate the exact same expansion.
            // const offsets = [1, -1, width, -width]; (Defined above)

            for (const off of offsets) {
                const targetIdx = sourceIdx + off;

                // Check bounds and validity (Must be Land (1))
                if (targetIdx >= 0 && targetIdx < ownership.length && ownership[targetIdx] === 1) {
                    // CLAIM
                    ownership[targetIdx] = 3; // New Border
                    buffer32[targetIdx] = COLORS_32.PLAYER_BORDER;

                    if (!borderSetRef.current.has(targetIdx)) {
                        borderSetRef.current.add(targetIdx);
                        activeBordersRef.current.push(targetIdx);
                        queue.push(targetIdx); // Add to end of queue
                    }

                    cost += currentPixelCost;
                    pixelsClaimed++;
                    attackingTroopsRef.current -= currentPixelCost;
                    expanded = true;
                    processedCount++;

                    if (processedCount >= pixelsPerFrame || attackingTroopsRef.current < currentPixelCost) break;
                }
            }

            // If we expanded or not, we need to check if source is still a border
            // If it has NO land neighbors, it is no longer a border.
            let isStillBorder = false;
            for (const off of offsets) {
                const n = sourceIdx + off;
                if (n >= 0 && n < ownership.length && ownership[n] === 1) {
                    isStillBorder = true;
                    break;
                }
            }

            if (!isStillBorder) {
                // Convert to inner
                ownership[sourceIdx] = 2;
                buffer32[sourceIdx] = blendColor(originalBuffer[sourceIdx], COLORS_32.PLAYER_INNER);

                // Remove from activeBordersRef (Set and Array)
                if (borderSetRef.current.has(sourceIdx)) {
                    borderSetRef.current.delete(sourceIdx);
                    // Fast remove from array (swap with last) - order doesn't matter for activeBordersRef set tracking
                    // But wait, activeBordersRef is just a list of borders.
                    // We need to find it. indexOf is O(N).
                    // This is the slow part.
                    // Since we are using queue for expansion, maybe we don't need to maintain activeBordersRef perfectly synced every frame?
                    // activeBordersRef is mainly used for... random expansion (which we removed) and initialization.
                    // We can just lazily clean it or ignore it?
                    // Let's try to keep it clean but maybe not every frame if it's slow.
                    // Actually, we can just mark it as inner and leave it in activeBordersRef? 
                    // No, then it will be picked again if we used random. But we use queue now.
                    // So activeBordersRef is less critical for the expansion loop itself.
                    // However, we might need it for other things?
                    // Let's just remove it from the Set. The Array might grow stale, but that's okay if we don't use it for expansion.
                }

                // Remove from queue
                queue.shift();
                dirtyRef.current = true;
            } else {
                // It's still a border (has land neighbors), so keep it in queue?
                // If we keep it at the front, we will keep trying to expand from it.
                // If we failed to expand (e.g. neighbors blocked or just didn't pick them), we should move it to the back?
                // Or just leave it?
                // If we expanded, we might have filled one neighbor.
                // If we didn't expand (all neighbors taken or invalid), it should have been handled by !isStillBorder check.
                // If isStillBorder is true, it means there ARE land neighbors.
                // So we should try again later. Move to back of queue to give others a chance.
                queue.shift();
                queue.push(sourceIdx);
            }
        }

        if (cost > 0) {
            // Update stats
            ownedPixelsRef.current += pixelsClaimed;
            if (onTerritoryChange) onTerritoryChange(ownedPixelsRef.current);

            // Sync attacking troops with parent
            if (onAttackingTroopsChange) onAttackingTroopsChange(attackingTroopsRef.current);

            // BATCH UPDATE: Notify parent about the expansion
            if (onExpansionUpdate) {
                onExpansionUpdate(pixelsClaimed, cost);
            }
        }
    }, [gridDimensions, onTerritoryChange, onAttackingTroopsChange, onExpansionUpdate]);

    // --- GENERIC EXPANSION LOGIC (BFS) ---
    const expandTerritoryForEntity = useCallback((bot: Bot, amount: number) => {
        if (!ownershipRef.current || !imageBufferRef.current || !originalBufferRef.current) return 0;

        const queue = bot.expansionQueue;
        // Refill if empty but borders exist (Safety)
        if (queue.length === 0 && bot.borderSet.size > 0) {
            queue.push(...Array.from(bot.borderSet));
        }
        if (queue.length === 0) return 0;

        const width = gridDimensions.width;
        const ownership = ownershipRef.current;
        const buffer32 = imageBufferRef.current;
        const offsets = [1, -1, width, -width];

        let pixelsClaimed = 0;
        let attempts = 0;
        const maxAttempts = amount * 5; // Safety break

        while (pixelsClaimed < amount && queue.length > 0 && attempts < maxAttempts) {
            attempts++;
            const sourceIdx = queue[0];

            // Check validity
            if (ownership[sourceIdx] !== bot.id) {
                queue.shift();
                continue;
            }

            // Shuffle offsets - REMOVED FOR DETERMINISM
            // for (let i = offsets.length - 1; i > 0; i--) {
            //     const j = Math.floor(Math.random() * (i + 1));
            //     [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
            // }

            for (const off of offsets) {
                const targetIdx = sourceIdx + off;
                if (targetIdx >= 0 && targetIdx < ownership.length && ownership[targetIdx] === 1) {
                    // CLAIM
                    ownership[targetIdx] = bot.id;
                    buffer32[targetIdx] = bot.borderColor;

                    if (!bot.borderSet.has(targetIdx)) {
                        bot.borderSet.add(targetIdx);
                        queue.push(targetIdx);
                    }

                    pixelsClaimed++;
                    dirtyRef.current = true;
                    if (pixelsClaimed >= amount) break;
                }
            }

            // Check if still border
            let stillBorder = false;
            for (const off of offsets) {
                const n = sourceIdx + off;
                if (n >= 0 && n < ownership.length && ownership[n] === 1) {
                    stillBorder = true;
                    break;
                }
            }

            if (!stillBorder) {
                // Convert to inner
                buffer32[sourceIdx] = bot.innerColor;
                if (bot.borderSet.has(sourceIdx)) {
                    bot.borderSet.delete(sourceIdx);
                }
                queue.shift();
                dirtyRef.current = true;
            } else {
                // Rotate in queue
                queue.shift();
                queue.push(sourceIdx);
            }
        }
        return pixelsClaimed;
    }, [gridDimensions]);

    // --- MAIN GAME LOOP (RENDER + UPDATE) ---
    useEffect(() => {
        if (loadingState !== 'success' || !imageDataRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let animationFrameId: number;

        const gameLoop = () => {
            // 1. Update Logic

            // LOCAL PLAYER EXPANSION
            // CLEANUP: If we have troops but not enough to expand OR no borders to expand to, clear them.
            if (attackingTroopsRef.current > 0) {
                if (attackingTroopsRef.current < EXPANSION_COST_PER_PIXEL || borderSetRef.current.size === 0) {
                    attackingTroopsRef.current = 0;
                    if (onAttackingTroopsChange) onAttackingTroopsChange(0);
                }
            }

            // Only expand if we have attacking troops in the batch
            if (attackingTroopsRef.current >= EXPANSION_COST_PER_PIXEL) {
                expandTerritory();
            }

            // REMOTE PLAYERS (BOTS) SIMULATION
            if (isGameplay && botsRef.current.length > 0) {
                botsRef.current.forEach(bot => {
                    if (bot.pendingExpansion > 0) {
                        const amount = Math.min(bot.pendingExpansion, 20); // Limit per frame to avoid lag
                        const claimed = expandTerritoryForEntity(bot, amount);
                        bot.pendingExpansion -= claimed;

                        // If we couldn't expand (claimed < amount) but pending > 0, 
                        // it means we are stuck or done. Clear pending to avoid infinite loop.
                        if (claimed === 0 && bot.pendingExpansion > 0) {
                            // Maybe try again next frame? Or just clear?
                            // If queue is empty and refill failed, we are done.
                            if (bot.expansionQueue.length === 0) {
                                bot.pendingExpansion = 0;
                            }
                        }
                    }
                });
            }

            // 2. Render ONLY if dirty
            if (dirtyRef.current) {
                ctx.putImageData(imageDataRef.current!, 0, 0);
                dirtyRef.current = false; // Reset flag
            }

            // 3. Always draw overlays (factories, selection) as they might change independently
            // Factory Placement Validation (Draw Box on Canvas)
            if (isPendingFactoryPlacement && hoveredPixelIndex !== null) {
                const ownership = ownershipRef.current;
                const fx = (hoveredPixelIndex % gridDimensions.width);
                const fy = Math.floor(hoveredPixelIndex / gridDimensions.width);

                // Check if valid (Player Inner (2) or Border (3))
                const isValid = ownership && (ownership[hoveredPixelIndex] === 2 || ownership[hoveredPixelIndex] === 3);

                // Colors
                const strokeColor = isValid ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)';
                const fillColor = isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';

                ctx.lineWidth = 0.5;
                ctx.strokeStyle = strokeColor;
                ctx.fillStyle = fillColor;

                // Draw 3x3 Base Area
                ctx.fillRect(fx - 1, fy - 1, 3, 3);
                ctx.strokeRect(fx - 1, fy - 1, 3, 3);
            }

            // Seçim Dairesi (Mouse)
            if (!isGameplay && (selectedPixelIndex !== null || hoveredPixelIndex !== null)) {
                const idx = selectedPixelIndex !== null ? selectedPixelIndex : hoveredPixelIndex;
                if (idx !== null) {
                    const sx = (idx % gridDimensions.width);
                    const sy = Math.floor(idx / gridDimensions.width);

                    // Sadece Karada ise göster
                    if (ownershipRef.current && ownershipRef.current[idx] === 1) {
                        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }

            // Render other players' spawn points (flags) during selection
            if (!isGameplay && players.length > 0) {
                players.forEach(p => {
                    if (p.spawnPoint !== null && p.spawnPoint !== undefined) {
                        const sx = (p.spawnPoint % gridDimensions.width);
                        const sy = Math.floor(p.spawnPoint / gridDimensions.width);

                        // Draw Flag/Marker
                        ctx.fillStyle = p.color || '#ffffff';
                        ctx.beginPath();
                        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                        ctx.fill();

                        // Optional: Name tag
                        ctx.fillStyle = 'white';
                        ctx.font = '12px Arial';
                        ctx.fillText(p.username, sx + 8, sy + 4);
                    }
                });
            }

            animationFrameId = requestAnimationFrame(gameLoop);
        };

        // Initialize once
        if (activeBordersRef.current.length === 0 && isGameplay && spawnPoint !== null && spawnPoint !== undefined) {
            initializeTerritory(spawnPoint);
        }

        animationFrameId = requestAnimationFrame(gameLoop);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [loadingState, isGameplay, players, expandTerritory, expandTerritoryForEntity, hoveredPixelIndex, selectedPixelIndex, isPendingFactoryPlacement, gridDimensions]);

    // --- IMAGE BASED MAP GENERATION (DUAL LAYER) ---
    const generateMapFromImage = useCallback(async () => {
        setStatusMessage("HARİTA RESİMLERİ YÜKLENİYOR...");
        if (onProgress) onProgress(10);

        // İki harita yükle
        const oceanImg = new Image();
        const landImg = new Image();
        oceanImg.crossOrigin = "Anonymous";
        landImg.crossOrigin = "Anonymous";

        const OCEAN_MAP = "/deniz map.png";
        const LAND_MAP = "/normal map.png";

        try {
            oceanImg.src = `${OCEAN_MAP}?t=${Date.now()}`;
            landImg.src = `${LAND_MAP}?t=${Date.now()}`;
        } catch (e) {
            oceanImg.src = encodeURI(OCEAN_MAP);
            landImg.src = encodeURI(LAND_MAP);
        }

        // Her iki resmin de yüklenmesini bekle
        const loadImage = (img: HTMLImageElement): Promise<void> => {
            return new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error(`Failed to load ${img.src}`));
            });
        };

        try {
            await Promise.all([loadImage(oceanImg), loadImage(landImg)]);
            setStatusMessage("ARAZİ VERİSİ İŞLENİYOR...");
            if (onProgress) onProgress(50);

            // Aspect ratio'yu land map'ten al (ana harita)
            const aspectRatio = landImg.width / landImg.height;
            const width = PIXEL_DENSITY;
            const height = Math.floor(width / aspectRatio);

            setGridDimensions({ width, height });
            if (onGridDimensionsChange) onGridDimensionsChange(width, height);
            if (onMapLoad) onMapLoad(width * height);

            // Her iki resmi de aynı boyuta çiz
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

            if (!tempCtx) {
                setLoadingState('error');
                return;
            }

            // Ocean map'i çiz ve oku
            tempCtx.drawImage(oceanImg, 0, 0, width, height);
            const oceanData = tempCtx.getImageData(0, 0, width, height).data;

            // Canvas'ı temizle ve land map'i çiz
            tempCtx.clearRect(0, 0, width, height);
            tempCtx.drawImage(landImg, 0, 0, width, height);
            const landData = tempCtx.getImageData(0, 0, width, height).data;

            if (onProgress) onProgress(75);

            const totalPixels = width * height;

            // Oyun motoru için bufferları oluştur
            const targetImgData = new ImageData(width, height);
            const buffer = new Uint32Array(targetImgData.data.buffer); // This will be imageBufferRef.current
            const originalBuffer = new Uint32Array(totalPixels); // Backup for blending
            const ownership = new Uint8Array(totalPixels);

            // Helper to pack RGBA into a single Uint32 (ARGB format)
            const packColor = (r: number, g: number, b: number, a: number = 255) => {
                return (a << 24) | (b << 16) | (g << 8) | r;
            };

            // KATMANLI PİKSEL ANALİZİ
            let landCount = 0;

            for (let i = 0; i < totalPixels; i++) {
                // Land map pikseli
                const landR = landData[i * 4];
                const landG = landData[i * 4 + 1];
                const landB = landData[i * 4 + 2];
                const landA = landData[i * 4 + 3];

                // Ocean map pikseli
                const oceanR = oceanData[i * 4];
                const oceanG = oceanData[i * 4 + 1];
                const oceanB = oceanData[i * 4 + 2];
                const oceanA = oceanData[i * 4 + 3];

                // Karar: Land map şeffaf mı?
                if (landA < 50) { // Using a threshold for transparency
                    // DENİZ - Ocean map'i kullan
                    const color = packColor(oceanR, oceanG, oceanB, oceanA);
                    buffer[i] = color;
                    originalBuffer[i] = color;
                    ownership[i] = 0; // Ocean
                } else {
                    // KARA PARÇASI - Land map'i kullan
                    const color = packColor(landR, landG, landB, landA);
                    buffer[i] = color;
                    originalBuffer[i] = color;
                    ownership[i] = 1; // Neutral Land
                    landCount++;
                }
            }

            imageBufferRef.current = buffer;
            originalBufferRef.current = originalBuffer;
            imageDataRef.current = targetImgData;
            ownershipRef.current = ownership;

            // Store CLEAN state for preview undo
            cleanOwnershipRef.current = new Uint8Array(ownership);
            cleanBufferRef.current = new Uint32Array(buffer);

            if (onProgress) onProgress(100);
            setLoadingState('success');
            if (onLoadComplete) onLoadComplete();

        } catch (err) {
            console.error("Map generation failed:", err);
            setLoadingState('error');
            setStatusMessage("HATA: HARİTA YÜKLENEMEDİ");
            // Ensure loading screen doesn't hang
            if (onProgress) onProgress(100);
        }
    }, [onLoadComplete, onProgress]);

    useEffect(() => {
        generateMapFromImage();
    }, [generateMapFromImage]);

    // --- INTERACTION HANDLERS ---
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !gridDimensions.width) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        const idx = y * gridDimensions.width + x;

        // Fabrikalar artık DOM elementleri olarak kendi click handler'larına sahip
        // Bu yüzden burada kontrol etmiyoruz

        if (isGameplay) {
            // Gameplay Mode Interactions
            if (isPendingFactoryPlacement) {
                // Place Factory
                if (ownershipRef.current && (ownershipRef.current[idx] === 2 || ownershipRef.current[idx] === 3)) {
                    if (onFactoryPlaced) onFactoryPlaced(idx); // Pass index
                    dirtyRef.current = true;
                }
            } else {
                // Attack / Expand
                if (onRequestAttack) onRequestAttack();
            }
        } else {
            // Map Select Mode (PREVIEW)
            if (ownershipRef.current && ownershipRef.current[idx] === 1) {
                restoreMap();
                initializeTerritory(idx);
                setSelectedPixelIndex(idx);
                if (onSpawnSelect) onSpawnSelect(idx);
            }
        }
    }, [gridDimensions, isGameplay, isPendingFactoryPlacement, onFactoryPlaced, onSpawnSelect, restoreMap, initializeTerritory, onRequestAttack, factories, onFactoryClick]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        // Optional: You can also trigger attack on mouse down if preferred, 
        // but click is usually enough for single transfer.
        // Keeping it empty or removing if not needed, but adding to canvas prop below just in case.
    }, []);

    const handleCanvasMouseUp = useCallback(() => {
        setIsExpanding(false);
    }, []);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !gridDimensions.width) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        const idx = y * gridDimensions.width + x;

        setHoveredPixelIndex(idx);

        // Force redraw if we are drawing overlays (Factory Placement or Selection Mode)
        // This prevents "trails" by ensuring the map is cleared/redrawn before the new overlay
        if (isPendingFactoryPlacement || !isGameplay) {
            dirtyRef.current = true;
        }
    }, [gridDimensions, isGameplay, isPendingFactoryPlacement]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); // Prevent default browser menu
        if (!canvasRef.current || !gridDimensions.width) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        const idx = y * gridDimensions.width + x;

        if (onRightClick) onRightClick(idx);
    }, [gridDimensions, onRightClick]);

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-[#020617]">
            {loadingState === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="text-cyan-400 font-mono animate-pulse">{statusMessage}</div>
                </div>
            )}

            {loadingState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-red-500">
                    <LogOut size={48} className="mb-2" />
                    <div>Harita yüklenemedi. Lütfen sayfayı yenileyin.</div>
                </div>
            )}

            {/* Warmup Countdown Overlay */}
            {!isGameplay && phase === 'warmup' && timeLeft !== undefined && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-black/70 text-white px-8 py-4 rounded-xl backdrop-blur-md border border-white/10 flex flex-col items-center gap-2 z-50 pointer-events-none">
                    <div className="text-sm uppercase tracking-widest text-cyan-400">Game Starting In</div>
                    <div className="text-6xl font-black font-mono text-yellow-400 animate-pulse">
                        {timeLeft}
                    </div>
                    <div className="text-xs text-gray-400">Select your spawn point!</div>
                </div>
            )}

            {/* Waiting for Start Overlay (if spawn selected but waiting for timer) */}
            {!isGameplay && phase === 'warmup' && selectedPixelIndex !== null && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-green-500/90 text-black px-6 py-2 rounded-full font-bold animate-bounce z-50 pointer-events-none">
                    Spawn Point Selected! Waiting for game...
                </div>
            )}

            <canvas
                ref={canvasRef}
                width={gridDimensions.width}
                height={gridDimensions.height}
                className="max-w-full max-h-full shadow-2xl"
                style={{
                    imageRendering: 'pixelated',
                    cursor: isPendingFactoryPlacement ? 'crosshair' : 'pointer',
                    aspectRatio: gridDimensions.width && gridDimensions.height ? `${gridDimensions.width}/${gridDimensions.height}` : 'auto'
                }}
                onClick={handleCanvasClick}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onMouseMove={handleCanvasMouseMove}
                onContextMenu={handleContextMenu}
            />
        </div>
    );
}));

GameMap.displayName = 'GameMap';

GameMap.displayName = 'GameMap';

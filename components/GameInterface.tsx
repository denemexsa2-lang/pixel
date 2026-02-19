import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameMap, GameMapRef } from './GameMap';
import { Users, Coins, Sword, Shield, Factory as FactoryIcon, LogOut, Zap, TrendingUp, Activity, Map as MapIcon } from 'lucide-react';
import { Factory } from '../utils/gameUtils';
import { useMultiplayer } from '../context/MultiplayerContext';

interface GameInterfaceProps {
  onLeave: () => void;
  spawnPoint: number | null;
}

export const GameInterface: React.FC<GameInterfaceProps> = ({ onLeave, spawnPoint }) => {
  const { gameState, sendGameAction, username, socket } = useMultiplayer();

  // Game State
  const [troops, setTroops] = useState(100);
  const [gold, setGold] = useState(1000);
  const [attackRatio, setAttackRatio] = useState(20);
  const [territorySize, setTerritorySize] = useState(0);

  // Factory State
  const [factories, setFactories] = useState<Factory[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);

  const [reservedTroops, setReservedTroops] = useState(0);
  const [attackingTroops, setAttackingTroops] = useState(0);
  const [isPendingFactoryPlacement, setIsPendingFactoryPlacement] = useState(false);
  const [gameTime, setGameTime] = useState(0);

  // Batching Ref
  const pendingExpansionRef = useRef({ amount: 0, cost: 0 });

  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false); // To distinguish click vs drag

  const [totalMapPixels, setTotalMapPixels] = useState(1);
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });

  // Refs for stable access inside interval
  const territorySizeRef = useRef(territorySize);
  const totalMapPixelsRef = useRef(1); // Default to 1 to avoid division by zero
  const factoriesRef = useRef<Factory[]>([]); // Ref for factories to use in economy
  const gameMapRef = useRef<GameMapRef>(null); // Ref to GameMap for simulation

  const factoryCost = 200 + (factories.length * 100);

  // Sync with Server State if available
  useEffect(() => {
    if (gameState) {
      // Find our player in the game state
      const myPlayer = gameState.players.find(p => p.username === username);
      if (myPlayer) {
        // In a real implementation, we would sync authoritative state here
        // For now, we just log it to verify connection
        // console.log("Server State:", myPlayer);
      }
    }
  }, [gameState, username]);

  // Listen for Remote Expansion Events
  useEffect(() => {
    if (!socket) return;

    const handleExpansion = (data: { playerId: string, amount: number, color: string }) => {
      // Ignore our own events (we handle them locally)
      // We need to know our own ID. useMultiplayer gives us 'username', but we need 'id'.
      // gameState.players has the mapping.
      const myPlayer = gameState?.players.find(p => p.username === username);
      if (myPlayer && myPlayer.id === data.playerId) return;

      if (gameMapRef.current) {
        gameMapRef.current.simulateExpansion(data.playerId, data.amount, data.color);
      }
    };

    socket.on('player_expanded', handleExpansion);

    return () => {
      socket.off('player_expanded', handleExpansion);
    };
  }, [socket]);

  useEffect(() => {
    territorySizeRef.current = territorySize;
  }, [territorySize]);

  useEffect(() => {
    totalMapPixelsRef.current = totalMapPixels;
  }, [totalMapPixels]);

  useEffect(() => {
    factoriesRef.current = factories;
  }, [factories]);

  const handleMapLoad = useCallback((totalPixels: number) => {
    setTotalMapPixels(totalPixels);
    // Canvas boyutlarını al
    const canvas = document.querySelector('canvas');
    if (canvas) {
      setGridDimensions({ width: canvas.width, height: canvas.height });

      // Haritayı ekrana sığdır (Fit to Screen)
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const scaleX = screenWidth / canvas.width;
      const scaleY = screenHeight / canvas.height;
      const initialScale = Math.min(scaleX, scaleY, 1); // En azından sığsın, ama büyütmesin

      setScale(initialScale);

      // Ortala
      const newX = (screenWidth - canvas.width * initialScale) / 2;
      const newY = (screenHeight - canvas.height * initialScale) / 2;
      setPosition({ x: newX, y: newY });
    }
  }, []);

  const [bonusProgress, setBonusProgress] = useState(0);
  const [lastBonusAmount, setLastBonusAmount] = useState(0);

  // Economy & Army Progression Logic
  useEffect(() => {
    let localTime = 0;

    const interval = setInterval(() => {
      localTime++;
      setGameTime(prev => prev + 1);

      // Update Bonus Progress based on localTime
      // Cycle: 1->20, 2->40, 3->60, 4->80, 0(5)->100
      const cycleStep = localTime % 5;
      const newProgress = cycleStep === 0 ? 100 : cycleStep * 20;
      setBonusProgress(newProgress);

      setTroops(prevTroops => {
        const currentTerritorySize = territorySizeRef.current;
        const totalPixels = totalMapPixelsRef.current;

        // 1. Calculate Capacity
        const UNIT_CAPACITY_PER_PIXEL = 5;
        const maxUnits = Math.max(100, currentTerritorySize * UNIT_CAPACITY_PER_PIXEL);

        // 2. Calculate Current Percentage
        const currentPercentage = prevTroops / maxUnits;

        let growthRate = 0;

        // 3. Apply Growth Rules
        if (currentPercentage <= 0.50) {
          // 5% constant growth
          growthRate = 0.05;
        } else {
          // Linear drop from 5% to 0%
          growthRate = Math.max(0, 0.1 * (1 - currentPercentage));
        }

        let addedTroops = Math.floor(prevTroops * growthRate);

        // 5. Apply 5-Second Bonus
        if (localTime % 5 === 0) {
          // Base bonus: 1 troop per 3 pixels
          const baseBonus = Math.floor(currentTerritorySize / 3);

          // Map Control Logic: "Gradually lose 50% of bonus until 25% map control"
          const mapPercentage = currentTerritorySize / totalPixels;

          const lossFactor = Math.min(1, mapPercentage / 0.25);
          const multiplier = 1 - (lossFactor * 0.5);

          const finalBonus = Math.floor(baseBonus * multiplier);

          addedTroops += finalBonus;
          setLastBonusAmount(finalBonus);
          // Progress is handled above (set to 100)
        }

        // 4. Apply Hard Cap
        return Math.min(maxUnits, prevTroops + addedTroops);
      });

      // Gold logic: Base + Factory Income
      setGold(prev => {
        let income = 85; // Base income
        // Add factory income based on levels
        factoriesRef.current.forEach(f => {
          if (f.level === 1) income += 50;
          else if (f.level === 2) income += 150;
          else if (f.level === 3) income += 400;
        });
        return Math.floor(prev + income);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array to prevent restarting logic on state changes

  // --- SINGLE-REQUEST EXPANSION SYSTEM ---
  // No batch needed - expansion is sent once when user clicks

  const handleConsumeTroops = useCallback((amount: number) => {
    setTroops(prev => Math.max(0, prev - amount));
  }, []);

  const handleBuyFactory = () => {
    if (gold >= factoryCost) {
      setGold(prev => prev - factoryCost);
      setIsPendingFactoryPlacement(true);
    } else {
      window.alert(`Yetersiz Altın!(Gereken: ${factoryCost})`);
    }
  };

  const handleFactoryPlaced = useCallback((index: number) => {
    // gridDimensions kullan, yoksa canvas'tan al
    let gridWidth = gridDimensions.width;

    if (gridWidth === 0) {
      // Fallback: Canvas'tan direkt oku
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      gridWidth = canvas.width;
    }

    const x = index % gridWidth;
    const y = Math.floor(index / gridWidth);

    const newFactory: Factory = {
      id: Date.now(),
      index: index,
      x: x,  // Canvas X koordinatı
      y: y,  // Canvas Y koordinatı
      level: 1
    };
    setFactories(prev => [...prev, newFactory]);
    setIsPendingFactoryPlacement(false);

    // Notify Server
    sendGameAction('build_factory', { x, y, level: 1 });

  }, [gridDimensions, sendGameAction]);

  const handleFactoryClick = useCallback((index: number) => {
    const factory = factories.find(f => f.index === index);
    if (factory) {
      setSelectedFactory(factory);
    }
  }, [factories]);

  // Fabrika pozisyonlarını al (artık Factory objesinde x ve y var)
  const getFactoryScreenPosition = useCallback((factory: Factory) => {
    // Eğer x ve y varsa direkt kullan
    if (factory.x !== undefined && factory.y !== undefined) {
      return { x: factory.x, y: factory.y };
    }

    // Fallback: Eski fabrikalar için index'ten hesapla
    if (gridDimensions.width === 0) return null;

    const x = factory.index % gridDimensions.width;
    const y = Math.floor(factory.index / gridDimensions.width);

    return { x, y };
  }, [gridDimensions]);

  const handleUpgradeFactory = () => {
    if (!selectedFactory) return;

    const nextLevel = selectedFactory.level + 1;
    if (nextLevel > 3) return;

    // Upgrade Costs: L1->L2: 1000, L2->L3: 2500
    const cost = nextLevel === 2 ? 1000 : 2500;

    if (gold >= cost) {
      setGold(prev => prev - cost);
      setFactories(prev => prev.map(f =>
        f.id === selectedFactory.id ? { ...f, level: nextLevel } : f
      ));
      setSelectedFactory(prev => prev ? { ...prev, level: nextLevel } : null);

      // Notify Server
      sendGameAction('upgrade_factory', { factoryId: selectedFactory.id, level: nextLevel });
    } else {
      alert(`Yetersiz Altın!(Gereken: ${cost})`);
    }
  };

  const [pendingAttackTroops, setPendingAttackTroops] = useState(0);

  const handleRequestAttack = useCallback(() => {
    // "saldırı başladığında artık mevcut birliklerden hicbirşeykilde savaş birliklerine aktarım yapılamasın"
    // If there are already attacking troops, do not allow adding more.
    if (attackingTroops > 0) return;

    setTroops(prev => {
      const amount = Math.floor(prev * (attackRatio / 100));
      if (amount <= 0) return prev;

      setPendingAttackTroops(amount);

      // Notify Server
      sendGameAction('attack', { amount });

      return prev - amount;
    });
  }, [attackRatio, attackingTroops, sendGameAction]);

  const handleAttackReceived = useCallback(() => {
    setPendingAttackTroops(0);
  }, []);

  const handleRightClick = useCallback((index: number) => {
    if (isPendingFactoryPlacement) {
      setIsPendingFactoryPlacement(false);
    }
  }, [isPendingFactoryPlacement]);

  // ZOOM & PAN HANDLERS
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ZOOM_MULTIPLIER = 1.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const nextScale = direction === 1 ? scale * ZOOM_MULTIPLIER : scale / ZOOM_MULTIPLIER;
    const newScale = Math.min(Math.max(0.8, nextScale), 20);

    // Calculate new position to keep the point under cursor stable
    // World coordinates of the cursor: (x - position.x) / scale
    const worldX = (x - position.x) / scale;
    const worldY = (y - position.y) / scale;

    // New position: x - worldX * newScale
    const newPos = {
      x: x - worldX * newScale,
      y: y - worldY * newScale
    };

    setScale(newScale);
    setPosition(newPos);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) { // Left or Middle click
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      // Threshold to consider it a drag
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasDraggedRef.current = true;
      }

      if (hasDraggedRef.current) {
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    // Note: hasDraggedRef remains true until the click event fires and consumes it
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.stopPropagation(); // Prevent the click from reaching the map if we dragged
      hasDraggedRef.current = false;
    }
  };

  const fmt = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : Math.floor(n).toString();

  // Helper for UI calculation
  const maxUnits = Math.max(100, territorySize * 5);
  const currentPercentage = troops / maxUnits;
  const isOverCapacity = currentPercentage > 0.50;

  // Calculate current income for display
  let uiGrowthRate = 0;
  if (currentPercentage <= 0.50) {
    uiGrowthRate = 0.05;
  } else {
    uiGrowthRate = Math.max(0, 0.1 * (1 - currentPercentage));
  }

  // Calculate Bonus for UI
  const baseBonus = Math.floor(territorySize / 3);
  const mapPercentage = territorySize / totalMapPixelsRef.current;
  const lossFactor = Math.min(1, mapPercentage / 0.25);
  const multiplier = 1 - (lossFactor * 0.5);
  const projectedBonus = Math.floor((baseBonus * multiplier) / 5); // Per second average

  let projectedIncome = Math.floor(troops * uiGrowthRate) + projectedBonus;

  // If at capacity, income is 0
  if (troops >= maxUnits) {
    projectedIncome = 0;
  }

  // Calculate potential attack amount for UI
  const potentialAttackAmount = Math.floor(troops * (attackRatio / 100));

  // Determine Bonus Bar Color
  let bonusBarColor = "bg-red-500";
  if (bonusProgress > 80) {
    bonusBarColor = "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]";
  } else if (bonusProgress > 40) {
    bonusBarColor = "bg-emerald-500";
  }

  return (
    <div
      className="relative w-full h-screen bg-slate-950 overflow-hidden select-none text-white font-mono"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClickCapture={handleClickCapture}
    >

      {/* TRANSFORMED GAME MAP CONTAINER */}
      <div
        className="origin-top-left transition-transform duration-75 ease-out relative"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          width: gridDimensions.width > 0 ? `${gridDimensions.width}px` : '100%',
          height: gridDimensions.height > 0 ? `${gridDimensions.height}px` : '100%'
        }}
      >
        <GameMap
          onLeave={onLeave}
          isGameplay={true}
          spawnPoint={spawnPoint}
          currentTroops={troops}
          onConsumeTroops={handleConsumeTroops}
          onTerritoryChange={setTerritorySize}
          attackRatio={attackRatio}
          onReservedTroopsChange={setReservedTroops}
          onAttackingTroopsChange={setAttackingTroops}
          isPendingFactoryPlacement={isPendingFactoryPlacement}
          onFactoryPlaced={handleFactoryPlaced}
          onRightClick={handleRightClick}
          // Attack Logic
          pendingAttackTroops={pendingAttackTroops}
          onRequestAttack={handleRequestAttack}
          onAttackReceived={handleAttackReceived}
          onMapLoad={handleMapLoad}
          // Factory Logic
          factories={factories}
          onFactoryClick={handleFactoryClick}
          onGridDimensionsChange={(w, h) => setGridDimensions({ width: w, height: h })}
          onExpansionUpdate={handleExpansionUpdate}
          players={gameState?.players || []}
          ref={gameMapRef}
        />

        {/* FABRİKA OVERLAY - Canvas dönüşümünden bağımsız */}
        {factories.map(factory => {
          const pos = getFactoryScreenPosition(factory);
          if (!pos) return null;

          const imageSrc = factory.level === 1 ? '/l 1.png' : factory.level === 2 ? '/l 2.png' : '/l 3.png';

          return (
            <div
              key={factory.id}
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: 'translate(-50%, -50%)',
                width: '32px',
                height: '32px',
                zIndex: 1000,
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleFactoryClick(factory.index);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
            >
              <img
                src={imageSrc}
                alt={`Factory Level ${factory.level}`}
                className="w-full h-full object-contain pointer-events-none"
                style={{
                  imageRendering: 'auto',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Factory Placement Hint */}
      {isPendingFactoryPlacement && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black px-6 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(234,179,8,0.5)] animate-pulse z-50 pointer-events-none">
          FABRİKA YERLEŞTİRME MODU (İptal için Sağ Tık)
        </div>
      )}

      {/* FACTORY UPGRADE PANEL */}
      {selectedFactory && (
        <div
          className="fixed z-[60] pointer-events-none"
          style={{
            left: `${(getFactoryScreenPosition(selectedFactory)?.x ?? 0) * scale + position.x + 40}px`,
            top: `${(getFactoryScreenPosition(selectedFactory)?.y ?? 0) * scale + position.y - 60}px`,
          }}
        >
          <div
            className="bg-slate-900/95 border-2 border-yellow-500/50 rounded-lg shadow-2xl p-3 w-48 pointer-events-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <FactoryIcon size={14} className="text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">Lvl {selectedFactory.level}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedFactory(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <LogOut size={12} />
              </button>
            </div>

            <div className="text-[10px] text-emerald-400 font-bold mb-2">
              +{selectedFactory.level === 1 ? 50 : selectedFactory.level === 2 ? 150 : 400} Altın/sn
            </div>

            {selectedFactory.level < 3 ? (
              <>
                <div className="text-[9px] text-slate-400 mb-1">
                  Sonraki: +{selectedFactory.level === 1 ? 150 : 400} Altın/sn
                </div>
                <button
                  onClick={handleUpgradeFactory}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold py-1.5 rounded transition-all flex items-center justify-center gap-1"
                >
                  <Zap size={10} />
                  Yükselt ({selectedFactory.level === 1 ? '1000' : '2500'}G)
                </button>
              </>
            ) : (
              <div className="text-center text-purple-400 font-bold text-[9px] py-1">
                MAKSİMUM
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- FLOATING UI ELEMENTS --- */}

      {/* MULTIPLAYER STATUS OVERLAY */}
      {gameState && (
        <div className="absolute top-20 right-4 bg-slate-900/80 p-2 rounded border border-cyan-500/30 z-50">
          <div className="text-xs font-bold text-cyan-400 mb-1">ONLINE PLAYERS</div>
          {gameState.players.map(p => (
            <div key={p.id} className="text-[10px] text-white flex justify-between gap-4">
              <span>{p.username}</span>
              <span className="text-slate-400">{p.troops || 0} Trp</span>
            </div>
          ))}
        </div>
      )}

      {/* 1. TOP LEFT: EXIT BUTTON */}
      <button
        onClick={onLeave}
        className="absolute top-4 left-4 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 p-2 rounded-lg transition-all z-50"
        title="Oyundan Çık"
      >
        <LogOut size={20} />
      </button>

      {/* 2. TOP RIGHT: RESOURCES PANEL */}
      <div className="absolute top-4 right-4 w-64 bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-700/50 space-y-2 z-50 shadow-2xl">
        {/* Troops */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Users size={14} />
            <div className="flex flex-col">
              <span className="text-xs font-bold">Birlikler</span>
              {/* Bonus Progress Bar */}
              <div className="w-16 h-1.5 bg-slate-700 rounded-full mt-0.5 relative overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${bonusBarColor}`}
                  style={{ width: `${bonusProgress}%` }}
                />
                {lastBonusAmount > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white drop-shadow-md">
                    +{fmt(lastBonusAmount)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-bold leading-none ${isOverCapacity ? 'text-red-500' : 'text-white'}`}>{fmt(troops)}</div>
            <div className={`text-[10px] ${isOverCapacity ? 'text-red-500' : 'text-emerald-400'}`}>
              +{fmt(projectedIncome)}/sn
            </div>
          </div>
        </div>

        {/* Gold */}
        <div className="flex justify-between items-center border-t border-slate-700/50 pt-2">
          <div className="flex items-center gap-2 text-slate-400">
            <Coins size={14} />
            <span className="text-xs font-bold">Hazine</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-yellow-400 leading-none">{fmt(gold)}</div>
            <div className="text-[10px] text-yellow-600">+85/sn</div>
          </div>
        </div>

        {/* Factories */}
        <div className="flex justify-between items-center border-t border-slate-700/50 pt-2">
          <div className="flex items-center gap-2 text-slate-400">
            <FactoryIcon size={14} />
            <span className="text-xs font-bold">Fabrikalar</span>
          </div>
          <div className="text-sm font-bold text-white">{factories.length}</div>
        </div>

        {/* Territory */}
        <div className="flex justify-between items-center border-t border-slate-700/50 pt-2">
          <div className="flex items-center gap-2 text-slate-400">
            <MapIcon size={14} />
            <span className="text-xs font-bold">Toprak</span>
          </div>
          <div className="text-sm font-bold text-cyan-400">{fmt(territorySize)} px²</div>
        </div>
      </div>

      {/* 3. LEFT CENTER: ATTACK SLIDER (MOVED & RESIZED) */}
      <div
        className="absolute top-1/2 left-4 -translate-y-1/2 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/50 z-50 shadow-xl w-8 flex flex-col items-center gap-4"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[9px] font-bold text-cyan-400">{attackRatio}%</div>

        <div className="h-32 w-1 bg-slate-700 rounded-full relative">
          <input
            type="range"
            min="0"
            max="100"
            value={attackRatio}
            onChange={(e) => setAttackRatio(parseInt(e.target.value))}
            className="absolute top-0 left-0 w-32 h-1 -rotate-90 origin-top-left translate-y-32 translate-x-0 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500"
          />
        </div>

        <div className="flex flex-col gap-1 w-full items-center">
          {/* Potential Attack Amount */}
          <div className="text-center" title="Saldırılacak Miktar">
            <Sword size={10} className="mx-auto text-cyan-400 mb-0.5" />
            <div className="text-[8px] font-mono text-white">{fmt(potentialAttackAmount)}</div>
          </div>

          {/* Active Attacking Troops (if any) */}
          {attackingTroops > 0 && (
            <div className="text-center border-t border-slate-700 pt-1 animate-pulse" title="Saldıran Birlikler">
              <Activity size={10} className="mx-auto text-red-500 mb-0.5" />
              <div className="text-[8px] font-mono text-red-500">{fmt(attackingTroops)}</div>
            </div>
          )}
        </div>
      </div>

      {/* 4. BOTTOM CENTER: FACTORY BUTTON */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={handleBuyFactory}
          disabled={gold < factoryCost}
          className={`
            flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 transition-all duration-200 shadow-xl
            ${gold >= factoryCost
              ? 'bg-slate-900/90 border-yellow-500 text-yellow-400 hover:bg-slate-800 hover:scale-105 hover:shadow-yellow-500/20'
              : 'bg-slate-900/90 border-slate-700 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <FactoryIcon size={28} className="mb-1" />
          <span className="text-[10px] font-bold">FABRİKA</span>
          <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1">
            {fmt(factoryCost)}G
          </span>
        </button>
      </div>

    </div>
  );
};
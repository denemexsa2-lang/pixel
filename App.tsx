import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play } from 'lucide-react';
import { Header } from './components/Header';
import { GameCard } from './components/GameCard';
import { MenuButton } from './components/ui/MenuButton';
import { Footer } from './components/Footer';
import { GameMode } from './types';
import { Modal } from './components/ui/Modal';
import { LoadingScreen } from './components/LoadingScreen';
import { GameMap } from './components/GameMap';
import { GameInterface } from './components/GameInterface';
import { MultiplayerProvider, useMultiplayer } from './context/MultiplayerContext';
import { LobbyView } from './components/LobbyView';

// Background Component for the "Tactical Map" feel
const TacticalBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-[#020617]">
    {/* Base World Map Image - Dark & Desaturated - REMOVED for custom map focus */}
    <div
      className="absolute inset-0 opacity-30"
      style={{
        background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)',
      }}
    />

    {/* Grid Overlay */}
    <div
      className="absolute inset-0 opacity-10 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px), 
          linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px'
      }}
    />

    {/* Vignette & Tint */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/80 via-transparent to-[#020617]/90 pointer-events-none" />
    <div className="absolute inset-0 bg-cyan-900/10 mix-blend-overlay pointer-events-none" />

    {/* Pulsating Red Dots (Battle Zones) */}
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="absolute w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_#ef4444] animate-pulse"
        style={{
          top: `${20 + Math.random() * 60}%`,
          left: `${10 + Math.random() * 80}%`,
          animationDelay: `${Math.random() * 2}s`,
          opacity: 0.6
        }}
      >
        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
      </div>
    ))}
  </div>
);

type ModalType = 'instructions' | 'settings' | 'single' | null;
type ViewType = 'menu' | 'loading' | 'map_select' | 'playing' | 'lobby';

const AppContent: React.FC = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [view, setView] = useState<ViewType>('menu');
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [spawnPoint, setSpawnPoint] = useState<number | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [selectedSpawnIndex, setSelectedSpawnIndex] = useState<number | null>(null);

  const { gameState, availableRooms, joinRoom, sendGameAction, username } = useMultiplayer();

  const myPlayer = gameState?.players.find(p => p.username === username);
  const localStateRef = useRef({ territorySize: 0, troops: 0, gold: 0 });

  // Find Best Room for "Join Next Game"
  // Logic: Most players, but not full, status waiting
  const bestRoom = React.useMemo(() => {
    const candidates = availableRooms.filter(r => r.status === 'waiting' && r.players.length < r.maxPlayers);
    if (candidates.length === 0) return null;
    // Sort by player count desc
    return candidates.sort((a, b) => b.players.length - a.players.length)[0];
  }, [availableRooms]);

  const nextGameData: GameMode = bestRoom ? {
    id: bestRoom.id,
    name: bestRoom.name,
    type: 'Multiplayer',
    map: bestRoom.map,
    players: bestRoom.players.length,
    maxPlayers: bestRoom.maxPlayers,
    timeLeft: bestRoom.countdown || 0, // Use countdown if active
    imageUrl: '/normal map.png'
  } : {
    id: 'create',
    name: "Yeni Oyun Oluştur",
    type: 'Multiplayer',
    map: 'Random Map',
    players: 0,
    maxPlayers: 50,
    timeLeft: 0,
    imageUrl: '/normal map.png'
  };

  useEffect(() => {
    if (gameState) {
      const myPlayer = gameState.players.find(p => p.username === username);

      // Only go to playing view if we have a spawn point AND the game phase is 'playing'
      if (myPlayer && myPlayer.spawnPoint !== null && myPlayer.spawnPoint !== undefined && gameState.phase === 'playing') {
        // Only update if spawn point actually changed
        setSpawnPoint(prev => {
          if (prev !== myPlayer.spawnPoint) {
            console.log('Setting spawnPoint to:', myPlayer.spawnPoint);
            return myPlayer.spawnPoint;
          }
          return prev;
        });
        setView('playing');
      } else {
        // Otherwise stay in map_select (warmup or selection)
        setView('map_select');
      }
    }
  }, [gameState, username]);

  // Sync Local State to Server
  // Sync Local State to Server - REMOVED (Using Deterministic Sync)
  // useEffect(() => {
  //   if (view === 'playing' && gameState?.phase === 'playing') {
  //     const interval = setInterval(() => {
  //       sendGameAction('update_player_state', {
  //         territorySize: localStateRef.current.territorySize,
  //         // troops: localStateRef.current.troops // If we tracked troops locally
  //       });
  //     }, 500);
  //     return () => clearInterval(interval);
  //   }
  // }, [view, gameState?.phase, sendGameAction]);

  // Button Handlers
  const handleJoinNextGame = () => {
    if (bestRoom) {
      joinRoom(bestRoom.id);
      setView('lobby');
    } else {
      // If no room, go to lobby to create one
      setView('lobby');
    }
  };

  const handleLoadingComplete = () => {
    setIsMapLoading(false);
  };

  const handleSpawnSelect = (index: number) => {
    setSelectedSpawnIndex(index);
  };

  const handleStartGame = () => {
    if (selectedSpawnIndex !== null) {
      if (gameState) {
        // Multiplayer Flow: Send selection to server
        sendGameAction('choose_spawn', { index: selectedSpawnIndex });
        // We wait for server update to switch view in useEffect
      } else {
        // Single Player Flow
        setSpawnPoint(selectedSpawnIndex);
        setView('playing');
      }
    }
  };

  const handleSinglePlayer = () => {
    setActiveModal(null); // close if open
    setView('loading');
  };

  const handleMultiplayer = () => {
    setView('lobby');
  };

  const handleInstructions = () => {
    setActiveModal('instructions');
  };

  const handleSettings = () => {
    setActiveModal('settings');
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'tr' ? 'en' : 'tr');
  };

  // Modal Content Generators
  const renderModalContent = () => {
    switch (activeModal) {
      case 'single':
        return null;
      case 'instructions':
        return (
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-slate-800/50 p-3 rounded border-l-4 border-cyan-500">
              <h3 className="font-bold text-white">1. Bölgeleri Ele Geçir</h3>
              <p className="text-sm text-slate-400">Birliklerini hareket ettirerek tarafsız bölgeleri ve düşman üslerini ele geçir.</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded border-l-4 border-red-500">
              <h3 className="font-bold text-white">2. Ordu Oluştur</h3>
              <p className="text-sm text-slate-400">Zamanla birimlerin artar. Stratejik noktalarda savunma yap.</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded border-l-4 border-yellow-500">
              <h3 className="font-bold text-white">3. Hakimiyet Kur</h3>
              <p className="text-sm text-slate-400">Haritadaki tüm düşmanları yok et ve son kalan kişi ol!</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Müzik Sesi</span>
              <input type="range" className="accent-cyan-500 w-32" />
            </div>
            <div className="flex justify-between items-center">
              <span>Efekt Sesi</span>
              <input type="range" className="accent-cyan-500 w-32" />
            </div>
            <div className="flex justify-between items-center">
              <span>Grafik Kalitesi</span>
              <select className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm">
                <option>Yüksek</option>
                <option>Orta</option>
                <option>Düşük</option>
              </select>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'single': return 'Tek Oyuncu';
      case 'instructions': return 'Nasıl Oynanır?';
      case 'settings': return 'Ayarlar';
      default: return '';
    }
  };

  const getModalAction = () => {
    switch (activeModal) {
      case 'single': return 'Başlat';
      case 'settings': return 'Kaydet';
      default: return undefined;
    }
  };

  const handleModalAction = () => {
    if (activeModal === 'single') {
      setIsMapLoading(true);
      setLoadingProgress(0);
      setView('map_select');
    }
    if (activeModal === 'settings') {
      alert("Ayarlar kaydedildi!");
      setActiveModal(null);
    }
  };

  if (view === 'lobby') {
    return <LobbyView onBack={() => setView('menu')} />;
  }

  if (view === 'map_select') {
    return (
      <>
        {isMapLoading && (
          <LoadingScreen
            progress={loadingProgress}
            onComplete={handleLoadingComplete}
          />
        )}
        <GameMap
          onLeave={() => setView('menu')}
          onStartGame={() => { }}
          isGameplay={view === 'playing'}
          spawnPoint={spawnPoint}
          currentTroops={myPlayer?.troops}
          onConsumeTroops={(amount) => {
            // Optimistic update or wait for server?
            // For now, just send action
          }}
          onTerritoryChange={(size) => {
            localStateRef.current.territorySize = size;
          }}
          onSpawnSelect={(index) => {
            console.log('Selected Spawn:', index);
            sendGameAction('choose_spawn', { index });
          }}
          players={gameState?.players || []}
          phase={gameState?.phase}
          timeLeft={gameState?.timeLeft}
        />

        {/* Start Game Button Overlay */}
        {!isMapLoading && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={handleStartGame}
              disabled={selectedSpawnIndex === null}
              className={`
                flex items-center gap-3 px-8 py-4 rounded-full font-bold text-xl tracking-widest transition-all duration-300
                ${selectedSpawnIndex !== null
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-105'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}
              `}
            >
              <Play size={24} fill={selectedSpawnIndex !== null ? "black" : "none"} />
              BAŞLA
            </button>
            {selectedSpawnIndex === null && (
              <div className="text-center mt-2 text-cyan-400/70 text-sm animate-pulse">
                Başlamak için haritada bir yer seçin
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  if (view === 'playing') {
    return <GameInterface onLeave={() => setView('menu')} spawnPoint={spawnPoint} />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#020617] font-['Rajdhani'] select-none text-slate-200">
      <TacticalBackground />

      {/* Main Content Container */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-4 pb-16">

        <div className="w-full max-w-full md:max-w-[580px] flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Header Section */}
          <Header />

          {/* Main Game Card */}
          <GameCard
            game={nextGameData}
            onClick={handleJoinNextGame}
          />

          {/* Action Buttons Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <MenuButton
              className="py-4 text-xl bg-cyan-900/40 hover:bg-cyan-800/60 border-cyan-500/30"
              onClick={handleMultiplayer}
            >
              MULTIPLAYER
            </MenuButton>
            <MenuButton
              className="py-4 text-xl"
              onClick={() => alert("Coming soon!")}
            >
              CLANS
            </MenuButton>
          </div>

          {/* Single Player Button */}
          <MenuButton onClick={handleSinglePlayer}>
            Tek Oyuncu
          </MenuButton>

          {/* Instructions Button */}
          <MenuButton onClick={handleInstructions}>
            Talimatlar
          </MenuButton>

          {/* Language Selector */}
          <MenuButton
            variant="primary"
            className="mt-2 border-cyan-900/50 hover:border-cyan-500/50 bg-[#0f172a]/60"
            onClick={toggleLanguage}
          >
            <span className="mr-3 text-2xl leading-none">{language === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
            <span className="text-slate-300">{language === 'tr' ? 'Türkçe (Turkish)' : 'English (İngilizce)'}</span>
          </MenuButton>
        </div>
      </div>

      {/* Settings Icon (Bottom Right) */}
      <button
        onClick={handleSettings}
        className="absolute top-4 right-4 md:bottom-12 md:right-8 z-30 p-3.5 text-cyan-500 hover:text-white hover:rotate-90 transition-all duration-500 bg-slate-900/80 rounded-full border-2 border-cyan-500/20 hover:border-cyan-400 shadow-lg hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] backdrop-blur-sm group"
      >
        <Settings size={32} strokeWidth={2} className="group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
      </button>

      {/* Footer */}
      <Footer />

      {/* Dynamic Modal */}
      <Modal
        isOpen={!!activeModal}
        onClose={() => setActiveModal(null)}
        title={getModalTitle()}
        actionLabel={getModalAction()}
        onAction={handleModalAction}
      >
        {renderModalContent()}
      </Modal>

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.5);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <MultiplayerProvider>
      <AppContent />
    </MultiplayerProvider>
  );
};

export default App;
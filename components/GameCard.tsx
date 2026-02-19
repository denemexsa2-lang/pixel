import React, { useEffect, useState } from 'react';
import { GameMode } from '../types';
import { Loader2 } from 'lucide-react';

interface GameCardProps {
  game: GameMode;
  onClick?: () => void;
  isLoading?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onClick, isLoading = false }) => {
  const [timeLeft, setTimeLeft] = useState(game.timeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 45));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      onClick={!isLoading ? onClick : undefined}
      className={`w-full h-[200px] relative group cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-300 bg-[#020617]
        ${isLoading ? 'border-cyan-400/80 scale-[0.98]' : 'border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_30px_rgba(8,145,178,0.15)] hover:shadow-[0_0_40px_rgba(6,182,212,0.25)]'}
      `}
    >
      {/* Background Image */}
      <div className="absolute inset-0 bg-slate-900">
        <img 
          src={game.imageUrl} 
          alt={game.map} 
          className={`w-full h-full object-cover transition-all duration-500 
            ${isLoading ? 'opacity-20 grayscale scale-100' : 'opacity-50 group-hover:opacity-70 scale-105 group-hover:scale-110 grayscale-[30%] group-hover:grayscale-0'}
          `}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/60 to-transparent" />
      </div>

      {/* Loading State Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-2" />
          <span className="text-cyan-400 font-['Russo_One'] text-xl tracking-widest animate-pulse">OYUNA KATILILIYOR...</span>
        </div>
      )}

      {/* Content */}
      <div className={`absolute inset-0 p-5 flex flex-col justify-between z-10 transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex justify-end">
          <h2 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-['Rajdhani'] tracking-wide group-hover:text-cyan-300 transition-colors">
            Sonraki Oyuna Katıl
          </h2>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* Game Mode Tags */}
          <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-300 drop-shadow-md tracking-wide uppercase">
            <span className="bg-slate-950/60 px-2 py-1 rounded border border-slate-700 backdrop-blur-sm">
              {game.type}
            </span>
            <span className="bg-slate-950/60 px-2 py-1 rounded border border-slate-700 backdrop-blur-sm">
              {game.name}
            </span>
            <span className="text-cyan-400 text-shadow-sm">
              {game.map}
            </span>
          </div>

          {/* Stats Row */}
          <div className="flex items-end gap-6 font-['Rajdhani']">
            <div className="text-slate-200 font-bold text-2xl drop-shadow-lg flex items-baseline gap-1">
              <span className="text-white">{game.players}</span>
              <span className="text-slate-400 text-lg">/</span>
              <span className="text-slate-400 text-lg">{game.maxPlayers}</span>
            </div>
            <div className={`font-bold text-4xl drop-shadow-lg w-16 text-right transition-colors duration-300 ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>
              {timeLeft}s
            </div>
          </div>
        </div>
      </div>
      
      {/* Shine effect */}
      {!isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.2s_infinite]" />
      )}
    </div>
  );
};
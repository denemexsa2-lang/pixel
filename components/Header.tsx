import React, { useState } from 'react';
import { X, Megaphone } from 'lucide-react';

export const Header: React.FC = () => {
  const [username, setUsername] = useState("merhaba");

  return (
    <div className="flex flex-col items-center gap-8 mb-8 w-full max-w-[600px] mx-auto z-10 relative">
      {/* Logo */}
      <div className="relative group cursor-default">
        <h1 className="font-['Russo_One'] text-7xl md:text-8xl text-white tracking-wide relative select-none z-10 transition-transform duration-300 group-hover:scale-105"
            style={{ 
              textShadow: '0 4px 0 #000, 0 0 20px rgba(6, 182, 212, 0.5)',
              WebkitTextStroke: '2.5px black'
            }}>
          FrontWars
        </h1>
        {/* Glow behind logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-24 bg-cyan-500/20 blur-[60px] -z-10 rounded-full" />
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-1.5 w-full max-w-md bg-[#0f172a]/90 p-1.5 rounded-md border border-slate-700 shadow-2xl">
        {/* Close Button */}
        <button className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/50 rounded text-slate-400 hover:text-red-500 transition-all duration-200 group">
          <X size={18} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
        </button>

        {/* Avatar Placeholder */}
        <div className="w-10 h-10 bg-violet-700 rounded border border-violet-500 shadow-inner flex-shrink-0 hover:brightness-110 cursor-pointer transition-all"></div>

        {/* Username Input */}
        <div className="flex-1 h-10 bg-slate-900/50 border border-slate-700 rounded flex items-center px-3 focus-within:border-cyan-500/50 focus-within:bg-slate-900 transition-colors">
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-white font-bold text-lg placeholder-slate-600 font-['Rajdhani']"
            placeholder="Kullanıcı adı"
          />
        </div>

        {/* Speaker/News Icon */}
        <button className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded text-slate-400 hover:text-white transition-all duration-200">
          <Megaphone size={20} />
        </button>
      </div>
    </div>
  );
};
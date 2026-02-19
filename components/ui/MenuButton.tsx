import React from 'react';
import { MenuButtonProps } from '../../types';

export const MenuButton: React.FC<MenuButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary',
  fullWidth = true,
  icon,
  ...props 
}) => {
  const baseStyles = "relative group font-bold text-lg tracking-wider py-3 px-6 transition-all duration-200 border-2 rounded flex items-center justify-center gap-3 overflow-hidden uppercase font-['Rajdhani']";
  
  const variants = {
    primary: "bg-[#0f172a]/80 border-cyan-600/50 text-cyan-50 hover:bg-cyan-900/30 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] active:scale-[0.99]",
    danger: "bg-[#0f172a]/80 border-red-600/50 text-red-50 hover:bg-red-900/30 hover:border-red-400 hover:shadow-[0_0_15px_rgba(248,113,113,0.3)] active:scale-[0.99]",
    secondary: "bg-slate-800/60 border-slate-600/50 text-slate-300 hover:bg-slate-700/60 hover:border-slate-400 active:scale-[0.99]",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {/* Scanline effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
      
      {icon && <span className="relative z-10">{icon}</span>}
      <span className="relative z-10 drop-shadow-md">{children}</span>
    </button>
  );
};
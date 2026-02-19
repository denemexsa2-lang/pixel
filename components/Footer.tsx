import React from 'react';

export const Footer: React.FC = () => {
  return (
    <div className="absolute bottom-0 w-full bg-slate-900/90 backdrop-blur-md border-t border-slate-800 p-3 flex justify-between items-center text-slate-400 text-sm font-medium px-6 z-20">
      <div className="flex gap-4">
        <a href="#" className="hover:text-white transition-colors">Hakkında</a>
        <a href="#" className="hover:text-white transition-colors">Reddit</a>
        <a href="#" className="hover:text-white transition-colors">Discord'a Katıl!</a>
      </div>
      
      <div className="flex gap-4">
        <span>2025 FrontWars</span>
        <a href="#" className="hover:text-white transition-colors">Gizlilik Politikası</a>
        <a href="#" className="hover:text-white transition-colors">Hizmet Şartları</a>
      </div>
    </div>
  );
};
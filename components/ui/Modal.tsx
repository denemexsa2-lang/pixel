import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, actionLabel, onAction }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border-2 border-cyan-600/50 p-6 rounded-lg max-w-md w-full relative shadow-[0_0_50px_rgba(6,182,212,0.2)] mx-4 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Title */}
        <h2 className="text-2xl font-bold text-cyan-400 mb-4 font-['Russo_One'] tracking-wide border-b border-slate-800 pb-2">
          {title}
        </h2>

        {/* Content */}
        <div className="text-slate-300 font-['Rajdhani'] font-medium text-lg mb-6">
          {children}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded border border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors font-bold font-['Rajdhani']"
          >
            Kapat
          </button>
          {actionLabel && onAction && (
            <button 
              onClick={() => { onAction(); onClose(); }}
              className="px-4 py-2 rounded bg-cyan-600/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] font-bold font-['Rajdhani']"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
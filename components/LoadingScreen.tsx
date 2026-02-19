import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps & { progress: number }> = ({ onComplete, progress }) => {
  // const [progress, setProgress] = useState(0); // Controlled externally now
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = [
    "Oyun motoru başlatılıyor...",
    "Harita verileri yükleniyor...",
    "Savaş alanı hazırlanıyor...",
    "Neredeyse hazır..."
  ];

  useEffect(() => {
    // Determine which step text to show active based on progress chunks
    const step = Math.min(steps.length - 1, Math.floor(progress / (100 / steps.length)));
    setCurrentStepIndex(step);

    if (progress >= 100) {
      setTimeout(onComplete, 500);
    }
  }, [progress, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col items-center justify-center font-['Rajdhani'] overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(100%) brightness(40%)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617] opacity-90" />
        <div className="absolute inset-0 bg-cyan-900/20 mix-blend-overlay" />

        {/* Grid Overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(34, 211, 238, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl px-4">
        {/* Title */}
        <h1 className="font-['Russo_One'] text-6xl md:text-8xl text-cyan-400 tracking-widest mb-2 relative select-none animate-in fade-in slide-in-from-top-4 duration-1000"
          style={{ textShadow: '0 0 40px rgba(34, 211, 238, 0.6)' }}>
          FRONTWARS
        </h1>

        <p className="text-slate-400 text-xl tracking-[0.2em] uppercase mb-16 animate-pulse">
          Yükleniyor
        </p>

        {/* Progress Bar Container */}
        <div className="w-full max-w-lg h-3 bg-slate-800/50 rounded-full mb-6 overflow-hidden border border-slate-700/50 backdrop-blur-sm relative">
          {/* Animated Fill */}
          <div
            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all duration-100 ease-linear rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
          </div>
        </div>

        {/* Percentage */}
        <div className="text-5xl font-bold text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] mb-12 font-['Rajdhani']">
          {progress}%
        </div>

        {/* Steps List */}
        <div className="flex flex-col gap-4 items-start min-w-[300px]">
          {steps.map((step, index) => {
            // Steps handling logic:
            // Active step is bright. Completed steps are dimmed but visible. Future steps are invisible or very dim.
            // Based on screenshot, it looks like a list where current/past are shown.

            const isCompleted = index < currentStepIndex;
            const isActive = index === currentStepIndex;
            const isPending = index > currentStepIndex;

            return (
              <div
                key={index}
                className={`flex items-center gap-4 transition-all duration-500 ${isPending ? 'opacity-30 blur-[1px]' : 'opacity-100'}`}
              >
                <div className={`w-4 h-4 rounded-full transition-colors duration-300 ${isActive ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse' : isCompleted ? 'bg-cyan-700' : 'bg-slate-700'}`} />
                <span className={`text-lg font-bold tracking-wide transition-colors duration-300 ${isActive ? 'text-white' : isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
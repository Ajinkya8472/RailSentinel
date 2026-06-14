// src/components/landing/LandingNavbar.jsx
import React, { memo } from 'react';
import { ShieldCheck } from 'lucide-react';

const LandingNavbar = memo(() => {
  return (
    <nav className="fixed top-0 left-0 w-full h-16 z-50 bg-[#05080A]/40 backdrop-blur-md border-b border-slate-900/40 px-6 flex items-center justify-between select-none transition-all duration-300">
      
      {/* 🚀 LOGO & BRAND MATRIX */}
      <div className="flex items-center gap-3 cursor-pointer group">
        <img 
          src="/Logo.png" 
          alt="RailSentinel Master System Icon" 
          // 💡 INJECTED ANIMATION CLASS: animate-heartbeat
          className="h-12 w-12 rounded-xl object-contain bg-slate-950/80 border border-slate-800 p-1 flex-shrink-0 shadow-lg shadow-emerald-500/5 transition-all group-hover:border-emerald-500/40 animate-heartbeat"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="flex flex-col">
          <span className="text-xs font-black text-slate-100 uppercase tracking-widest font-sans leading-none">
            RAILSENTINEL
          </span>
          <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-1">
            INDUSTRIAL RAILWAY INTELLIGENCE
          </span>
        </div>
      </div>

      {/* RIGHT SIDE: LIVE STATUS TELEMETRY */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 h-7.5 rounded-lg border bg-slate-950/60 border-slate-900 text-[9px] font-mono font-black uppercase tracking-widest text-slate-400">
          <ShieldCheck size={11} className="text-emerald-400 animate-pulse" />
          <span>Core // Stable Network</span>
        </div>
        
        <button
          type="button"
          onClick={() => window.location.href = '/dashboard'}
          className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-[10px] font-mono font-black uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-md shadow-orange-500/10 cursor-pointer border border-orange-400"
        >
          Launch Terminal
        </button>
      </div>

      {/* 🧬 INJECTED HEARTBEAT CSS STYLES */}
      <style>{`
        @keyframes logoHeartbeat {
          0% { transform: scale(1); }
          14% { transform: scale(1.1); }
          28% { transform: scale(1); }
          42% { transform: scale(1.1); }
          70% { transform: scale(1); }
        }
        .animate-heartbeat {
          /* Repeats the double-pulse sequence continuously every 2.5 seconds */
          animation: logoHeartbeat 2.5s ease-in-out infinite;
        }
      `}</style>

    </nav>
  );
});

LandingNavbar.displayName = 'LandingNavbar';
export default LandingNavbar;
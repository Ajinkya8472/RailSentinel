// src/components/common/Topbar.jsx
import React, { memo, useMemo } from 'react';
import { 
  Bell, Terminal, ShieldCheck, Menu, MessageSquareCode 
} from 'lucide-react';
import useIncidentStore from '../../store/incidentStore'; 

function Topbar({
  brand = "RailSentinel",
  currentContextLabel = "Command Center",
  systemState = "ready",
  selectedRisk,
  searchValue,
  defaultSearchValue = '',
  onSearchChange,
  onSearchSubmit,
  onOpenNotifications,
  onOpenCommandPalette,
  onOpenAssistant,
  onNavigateHome,
  onToggleSidebar
}) {
  const isSyncing = systemState === 'loading';
  const riskLabel = selectedRisk?.label ?? "STABLE NETWORK";

  // ── ⚡ FIXED STATE SELECTOR BINDING ──────────────────────────────────────
  // Instead of selecting the getter function, we pull the direct state arrays 
  // or use the baseline store primitive to force Zustand to emit updates.
  const incidents = useIncidentStore((s) => s.incidents || []);
  const visibleIncidents = useIncidentStore((s) => 
    typeof s.getVisibleIncidents === 'function' ? s.getVisibleIncidents() : []
  );

  // Compute count from the active dataset slice
const notificationCount = useMemo(() => {
  const targetSource = visibleIncidents.length > 0 ? visibleIncidents : incidents;
  return targetSource.filter(n => {
    const currentStatus = String(n?.status || 'open').toLowerCase();
    // ⚡ This condition is absolute:
    return currentStatus === 'open' || currentStatus === 'active';
  }).length;
}, [incidents, visibleIncidents]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleInputChange = (e) => {
    if (typeof onSearchChange === 'function') {
      onSearchChange(e.target.value, e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && typeof onSearchSubmit === 'function') {
      onSearchSubmit(e.target.value, e);
    }
  };

  return (
    <header className="w-full h-14 bg-slate-950 border-b border-slate-900 px-4 flex items-center justify-between gap-4 flex-shrink-0 select-none z-40 relative">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ai-matrix-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-cyber-laser {
          animation: ai-matrix-spin 3s linear infinite;
        }
        .hud-grid-bg {
          background-image: radial-gradient(rgba(16, 185, 129, 0.15) 1px, transparent 0);
          background-size: 4px 4px;
        }
      `}} />

      {/* LEFT ZONE: PROJECT BRANDING & CONTEXT PATH */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
        <button 
          type="button" 
          onClick={onToggleSidebar}
          className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all duration-150 transform active:scale-95 active:translate-y-[1px] active:shadow-inner shadow-sm cursor-pointer lg:hidden group"
          aria-label="Toggle navigation map sidebar"
        >
          <Menu size={14} className="transition-transform duration-200 group-hover:rotate-90" />
        </button>

        <div onClick={onNavigateHome} className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
          <div className="relative overflow-hidden rounded-lg border border-slate-800 p-0.5 bg-slate-950 shadow-md transition-all duration-300 group-hover:border-emerald-500/40 group-active:scale-95 group-active:translate-y-[1px]">
            <img 
              src="/Logo.png" 
              alt="RailSentinel Logo" 
              className={`h-10 w-10 rounded-md object-contain transition-transform duration-500 group-hover:scale-105 ${isSyncing ? "animate-pulse opacity-70" : ""}`}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          <div className="flex flex-col min-w-0 transition-transform duration-200 group-active:translate-x-[0.5px]">
            <span className="font-mono text-[11px] font-black tracking-widest text-slate-200 uppercase leading-none transition-colors duration-200 group-hover:text-white">
              {brand}
            </span>
            <span className="font-mono text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 truncate max-w-[120px]" title={currentContextLabel}>
              SYS_CORE // {currentContextLabel}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center relative w-80 ml-4 flex-shrink-0 group">
          <Terminal size={11} className="absolute left-3 text-slate-600 font-bold transition-colors duration-200 group-focus-within:text-emerald-500" />
          <input
            type="text"
            value={searchValue ?? defaultSearchValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="EXECUTE COMMAND OR FILTER MATRIX..."
            className="w-full h-8 bg-slate-900/60 border border-slate-800/80 rounded-lg pl-8 pr-3 text-[10px] font-mono font-bold uppercase text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-700 focus:bg-slate-900 focus:text-white transition-all duration-200 tracking-wide shadow-inner focus:ring-1 focus:ring-slate-800"
          />
        </div>
      </div>

      {/* RIGHT ZONE: UTILITY TRIGGERS */}
      <div className="flex items-center gap-4 flex-shrink-0 font-mono">
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/20 border border-slate-900 h-8 px-2.5 rounded-lg text-[9px] font-black tracking-wider shadow-inner hover:border-slate-800 transition-colors duration-200 group">
          <ShieldCheck size={11} className="text-emerald-400 animate-pulse" />
          <span className="text-slate-500 uppercase">CORE:</span>
          <span className="text-emerald-400 uppercase tracking-tight">{riskLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-slate-900 pl-4">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="h-8 px-2.5 bg-slate-900/60 hover:bg-slate-900/90 hover:border-slate-700 border border-slate-850 rounded-lg flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-slate-400 hover:text-slate-200 transition-all duration-150 shadow-sm active:translate-y-[1px] active:scale-[0.98] active:shadow-inner cursor-pointer group"
          >
            <Bell size={11} className={`transition-all duration-200 ${notificationCount > 0 ? "text-amber-400 font-bold" : "text-slate-500"}`} />
            <span className="transition-transform duration-200 group-hover:translate-x-[1px]">Alerts</span>
            <span className={`rounded px-1 text-[9px] font-black min-w-[14px] text-center transition-all duration-200 ${
              notificationCount > 0 
                ? 'bg-amber-500 text-slate-950 scale-105 shadow-md' 
                : 'bg-slate-950 text-slate-500 border border-slate-900'
            }`}>
              {notificationCount}
            </span>
          </button>
          
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden lg:inline-flex h-8 px-2.5 bg-slate-900/60 hover:bg-slate-900/90 hover:border-slate-700 border border-slate-850 rounded-lg items-center gap-1.5 transition-all duration-150 shadow-sm active:translate-y-[1px] active:scale-[0.98] active:shadow-inner cursor-pointer group text-slate-200 hover:text-white"
          >
            <Terminal size={11} className="text-slate-400 transition-colors duration-200 group-hover:text-slate-200" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider transition-transform duration-200 group-hover:translate-x-[1px]">Console</span>
          </button>

          <button
            type="button"
            onClick={onOpenAssistant}
            className="relative h-8 px-3 rounded-lg overflow-hidden flex items-center justify-center transition-all duration-150 shadow-[0_0_15px_rgba(16,185,129,0.05)] active:translate-y-[1px] active:scale-[0.98] cursor-pointer group font-mono text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-200"
          >
            <span className="absolute inset-[-300%] bg-[conic-gradient(from_0deg,#022c22_25%,#00f5ff_45%,#022c22_65%,#10b981_95%)] animate-cyber-laser" />
            <span className="absolute inset-[-300%] bg-[conic-gradient(from_0deg,#022c22_25%,#00f5ff_45%,#022c22_65%,#10b981_95%)] animate-cyber-laser opacity-50 blur-sm" />
            <span className="absolute inset-[1px] bg-slate-950 rounded-[7px] group-hover:bg-slate-900/95 transition-colors duration-200" />
            <span className="absolute inset-[1px] rounded-[7px] hud-grid-bg opacity-30 group-hover:opacity-50 pointer-events-none" />

            <span className="relative z-10 flex items-center gap-2">
              <MessageSquareCode size={11} className="text-emerald-400 animate-pulse" />
              <span className="transition-transform duration-200 group-hover:translate-x-[1px] relative">
                AI Assist
                <span className="absolute -top-1.5 -right-1.5 text-[6px] text-emerald-500/40 font-normal">+</span>
              </span>
            </span>
          </button>
        </div>
      </div>

    </header>
  );
}

export default memo(Topbar);
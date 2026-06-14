// src/components/common/Sidebar.jsx
import React, { memo, useId, useMemo } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Map as MapIcon,
  Users,
  Cpu,
  Bell,
  Calendar,
  Zap,
  Home,
  MessageSquare,
  Settings,
  HelpCircle,
  Train,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';

const ICON_MAP = {
  'layout-dashboard': LayoutDashboard,
  'dashboard': LayoutDashboard,
  'alert-triangle': AlertTriangle,
  'incidents': AlertTriangle,
  'train': Train,
  'trains': Train,
  'map': MapIcon,
  'network map': MapIcon,
  'users': Users,
  'crowd intelligence': Users,
  'cpu': Cpu,
  'predictive intelligence': Cpu,
  'bell': Bell,
  'notifications': Bell,
  'calendar': Calendar,
  'smart schedule': Calendar,
  'zap': Zap,
  'energy optimization': Zap,
  'home': Home,
  'message-square': MessageSquare,
  'ai assistant': MessageSquare,
  'settings': Settings,
  'help-circle': HelpCircle,
  'help': HelpCircle,
};

function SidebarItem({ item, active, collapsed, onNavigate, labelId }) {
  const IconComponent = typeof item.icon === 'string' 
    ? ICON_MAP[item.icon] 
    : ICON_MAP[String(item.id || item.label).toLowerCase()];

  return (
    <li className="w-full list-none px-2">
      <button
        type="button"
        onClick={onNavigate}
        disabled={Boolean(item.disabled)}
        className={`w-full h-10 flex items-center gap-3 px-3 rounded-xl transition-all duration-150 font-sans text-xs font-medium border text-left group relative ${
          active
            ? 'bg-orange-500 text-slate-950 border-orange-400 font-bold shadow-lg shadow-orange-500/10'
            : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
        } ${item.disabled ? 'opacity-30 !cursor-not-allowed' : 'cursor-pointer'}`}
        aria-current={active ? 'page' : undefined}
        aria-labelledby={labelId}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-md bg-white" />
        )}

        <div className={`flex-shrink-0 flex items-center justify-center transition-colors ${
          active ? 'text-slate-950' : 'text-slate-400 group-hover:text-slate-200'
        }`}>
          {IconComponent ? <IconComponent size={15} strokeWidth={active ? 2.5 : 1.8} /> : <AlertTriangle size={15} />}
        </div>
        
        {!collapsed && <span className="truncate tracking-wide flex-1">{item.label}</span>}
        
        {item.badge && !collapsed && (
          <span className={`ml-auto h-4.5 min-w-4.5 px-1.5 rounded-md text-[9px] font-mono font-black flex items-center justify-center ${
            active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-950/60 text-slate-400 border border-slate-800'
          }`}>
            {item.badge}
          </span>
        )}
      </button>
    </li>
  );
}

function Sidebar({
  brand = 'RailSentinel',
  brandSubtitle = 'INDUSTRIAL RAILWAY INTELLIGENCE',
  navigationItems = [],
  utilityItems = [],
  activeItemId,
  selectedRisk,
  systemState = 'ready',
  isCollapsed = false,
  isOpen = true,
  onNavigate,
  onToggleCollapse,
  onOpenSearch,
  onOpenNotifications,
  onOpenCommandPalette,
  onOpenAssistant,
  onOpenSettings, // 💡 PROPS ADDED: Hooks up settings visibility state
  onOpenHelp,
  onRetry,
  className,
  ...rest
}) {
  const navLabelId = useId();
  const utilitiesLabelId = useId();
  const riskLabelId = useId();

  const visibleNavigationItems = useMemo(() => Array.isArray(navigationItems) ? navigationItems : [], [navigationItems]);
  const visibleUtilityItems = useMemo(() => Array.isArray(utilityItems) ? utilityItems : [], [utilityItems]);

  const shellState = systemState || 'ready';
  const hasItems = visibleNavigationItems.length > 0;
  const showLoading = shellState === 'loading';
  const showError = shellState === 'error';
  const showEmpty = !showLoading && !showError && !hasItems;

  const currentRisk = selectedRisk?.level || 'STABLE';
  const riskSeverity = String(selectedRisk?.tone || 'low').toLowerCase();

const handleItemClick = (item, event) => {
    if (item.disabled) {
      event.preventDefault();
      return;
    }

    // Convert everything to lowercase to isolate names safely
    const targetKey = String(item.id || item.label).toLowerCase().trim();
    console.log(`[Sidebar Router Debug] Selection Intercept Target: "${targetKey}"`);

    // 💡 THE ULTIMATE PRIORITY OVERRIDE FIX: 
    // Run our custom overlay triggers FIRST before checking generic click hooks!
    if (targetKey.includes('setting')) { 
      if (typeof onOpenSettings === 'function') {
        onOpenSettings(event);
        return; // Success, exit out safely!
      }
    } 
    else if (targetKey.includes('help') || targetKey.includes('sop') || targetKey.includes('doc')) { 
      if (typeof onOpenHelp === 'function') {
        onOpenHelp(event);
        return; // Success, exit out safely!
      }
    }
    else if (targetKey.includes('console') || targetKey.includes('palette') || targetKey.includes('cmd')) {
      if (typeof onOpenCommandPalette === 'function') {
        onOpenCommandPalette(event);
        return;
      }
    }
    else if (targetKey.includes('chat') || targetKey.includes('assistant')) {
      if (typeof onOpenAssistant === 'function') {
        onOpenAssistant(event);
        return;
      }
    } 
    else if (targetKey.includes('search')) {
      if (typeof onOpenSearch === 'function') {
        onOpenSearch(event);
        return;
      }
    }

    // 💡 Generic Fallback: If it's not a modal utility, run custom callbacks or navigate normally
    if (typeof item.onClick === 'function') {
      item.onClick(event, item);
      return;
    }

    if (typeof onNavigate === 'function') {
      onNavigate(item, event);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      className={`h-screen bg-slate-950 border-r border-slate-900 flex flex-col justify-between select-none transition-all duration-200 flex-shrink-0 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      } ${className || ''}`}
      aria-label="RailSentinel application sidebar"
      aria-busy={showLoading || undefined}
      data-state={shellState}
      {...rest}
    >
      {/* BRAND & COMMAND HEADER */}
      <div className="flex flex-col flex-shrink-0 pt-5 px-4 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-4">
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span id={navLabelId} className="text-sm font-black text-slate-100 uppercase tracking-wider font-sans leading-none">
                {brand}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-1.5 truncate">
                {brandSubtitle}
              </span>
            </div>
          )}
          
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`h-7 w-7 rounded-lg bg-slate-900 border border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer ${
              isCollapsed ? 'mx-auto' : ''
            }`}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* RISK INFRASTRUCTURE STATUS CARD */}
        {!isCollapsed && (
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900/80 flex flex-col gap-1.5" id={riskLabelId}>
            <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500">
              <Activity size={10} className="text-slate-400" />
              <span>GLOBAL POSTURE RISK</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 animate-pulse ${
                riskSeverity === 'critical' || riskSeverity === 'error' ? 'bg-red-500' : riskSeverity === 'warning' || riskSeverity === 'high' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wide truncate">
                {currentRisk}
              </span>
            </div>
            <p className="text-[10px] font-light text-slate-500 leading-normal font-sans">
              {selectedRisk?.description || 'Network posture is within expected bounds.'}
            </p>
          </div>
        )}
      </div>

      {/* CORE ROUTE NAVIGATION SYSTEM */}
      <div className="flex-1 my-4 overflow-y-auto min-h-0 space-y-4">
        <div className="space-y-1">
          {!isCollapsed && (
            <h5 className="px-5 text-[9px] font-mono font-black uppercase tracking-widest text-slate-500 mb-2.5">
              Navigation
            </h5>
          )}

          {showLoading && (
            <div className="px-5 py-2 text-[10px] font-mono text-slate-500 animate-pulse">Syncing nodes...</div>
          )}

          {!showLoading && !showError && hasItems && (
            <ul className="space-y-1 p-0 m-0 flex flex-col items-center w-full">
              {visibleNavigationItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  active={item.id != null && item.id === activeItemId}
                  collapsed={isCollapsed}
                  onItemSelect={handleItemClick}
                  onNavigate={(e) => handleItemClick(item, e)}
                  labelId={`${navLabelId}-${item.id}`}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* UTILITY RAIL FOOTER LAYER */}
      <div className="border-t border-slate-900 pb-5 pt-4 space-y-4 flex-shrink-0">
        <div className="space-y-1">
          {!isCollapsed && (
            <h5 id={utilitiesLabelId} className="px-5 text-[9px] font-mono font-black uppercase tracking-widest text-slate-500 mb-2.5">
              Utilities
            </h5>
          )}
          
          <ul className="space-y-1 p-0 m-0 flex flex-col items-center w-full">
            {visibleUtilityItems.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                active={item.id != null && item.id === activeItemId}
                collapsed={isCollapsed}
                onItemSelect={handleItemClick}
                onNavigate={(e) => handleItemClick(item, e)}
                labelId={`${utilitiesLabelId}-${item.id}`}
              />
            ))}
          </ul>
        </div>
        
        {!isCollapsed && (
          <div className="flex items-center justify-between px-5 text-[9px] font-mono text-slate-500 uppercase tracking-wider font-bold">
            <span>NETWORK STREAM</span>
            <span className="text-emerald-500 font-bold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

export default memo(Sidebar);
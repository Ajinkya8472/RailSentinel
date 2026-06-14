// src/layouts/AppShell.jsx
import React, { memo, useCallback, useId, useMemo, useState } from 'react';
import { Loader2, Inbox, ShieldAlert, RefreshCw, X, Volume2, Sliders, BookOpen, Terminal } from 'lucide-react';

import Sidebar from '../components/common/Sidebar.jsx';
import Topbar from '../components/common/Topbar.jsx';
import NotificationCenter from '../components/common/NotificationCenter.jsx';

function AppShell({
  children,
  systemState = 'ready',
  activeContextLabel = 'Command Center',
  breadcrumbs = [],
  navigationItems = [],
  utilityItems = [],
  activeItemId,
  selectedRisk,
  notificationSummary,
  notifications = [],
  selectedNotificationId,
  searchValue,
  defaultSearchValue = '',
  onSearchChange,
  onSearchSubmit,
  onOpenSearch,
  onOpenNotifications,
  onOpenCommandPalette,
  onOpenAssistant,
  onNavigateHome,
  onNavigate,
  onToggleSidebar,
  onRetry,
  onSelectNotification,
  onAcknowledgeNotification,
  onEscalateNotification,
  onSuppressNotification,
  onRetryDelivery,
  onOpenLinkedEntity,
  onNotificationCenterClose,
  className,
  onOpenSettings = null,
  onOpenHelp = null,
  ...rest
}) {
  const shellId = useId();
  const mainId = useId();
  
  // 💡 STATE MANAGERS: Tracking drawers, console, settings, and help modules
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false); 
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const state = systemState || 'ready';
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isEmpty = state === 'empty';

  const visibleNotifications = useMemo(() => (Array.isArray(notifications) ? notifications : []), [notifications]);

  const handleToggleSidebar = useCallback((event) => {
    setSidebarCollapsed((value) => !value);
    if (typeof onToggleSidebar === 'function') {
      onToggleSidebar(event);
    }
  }, [onToggleSidebar]);

  const openNotificationCenter = useCallback((event) => {
    setNotificationCenterOpen(true);
    if (typeof onOpenNotifications === 'function') {
      onOpenNotifications(event);
    }
  }, [onOpenNotifications]);

  const closeNotificationCenter = useCallback(() => {
    setNotificationCenterOpen(false);
    if (typeof onNotificationCenterClose === 'function') {
      onNotificationCenterClose();
    }
  }, [onNotificationCenterClose]);

  const openCommandPalette = useCallback((event) => {
    setCommandPaletteOpen(true);
    if (typeof onOpenCommandPalette === 'function') {
      onOpenCommandPalette(event);
    }
  }, [onOpenCommandPalette]);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  const handleOpenSettings = useCallback((event) => {
    setSettingsOpen(true);
    if (typeof onOpenSettings === 'function') {
      onOpenSettings(event);
    }
  }, [onOpenSettings]);

  const handleOpenHelp = useCallback((event) => {
    setHelpOpen(true);
    if (typeof onOpenHelp === 'function') {
      onOpenHelp(event);
    }
  }, [onOpenHelp]);

  const handleSearchRequest = useCallback((value, event) => {
    if (typeof onSearchChange === 'function') {
      onSearchChange(value, event);
    }
  }, [onSearchChange]);

  const handleSearchSubmit = useCallback((value, event) => {
    if (typeof onSearchSubmit === 'function') {
      onSearchSubmit(value, event);
    }
  }, [onSearchSubmit]);

  return (
    <div
      id={shellId}
      className={`w-full h-screen flex bg-slate-50 font-sans overflow-hidden ${className || ''}`}
      data-state={state}
      aria-label="RailSentinel application shell"
      {...rest}
    >
      {/* PERSISTENT SIDEBAR NAVIGATION MODULE */}
      <Sidebar
        brand="RailSentinel"
        brandSubtitle="INDUSTRIAL RAILWAY INTELLIGENCE"
        navigationItems={navigationItems}
        utilityItems={utilityItems}
        activeItemId={activeItemId}
        selectedRisk={selectedRisk}
        systemState={state}
        isCollapsed={sidebarCollapsed}
        isOpen={true}
        onNavigate={onNavigate}
        onToggleCollapse={handleToggleSidebar}
        onOpenSearch={onOpenSearch}
        onOpenNotifications={openNotificationCenter}
        onOpenCommandPalette={openCommandPalette} 
        onOpenAssistant={onOpenAssistant}
        onOpenSettings={handleOpenSettings}
        onOpenHelp={handleOpenHelp}
        onRetry={onRetry}
      />

      {/* CORE CONTROL FRAMEWORK STRUCTURE */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <Topbar
          brand="RailSentinel"
          currentContextLabel={activeContextLabel}
          breadcrumbs={breadcrumbs}
          systemState={state}
          selectedRisk={selectedRisk}
          notificationSummary={notificationSummary}
          searchValue={searchValue}
          defaultSearchValue={defaultSearchValue}
          onSearchChange={handleSearchRequest}
          onSearchSubmit={handleSearchSubmit}
          onOpenNotifications={openNotificationCenter}
          onOpenCommandPalette={openCommandPalette} 
          onOpenAssistant={onOpenAssistant}
          onNavigateHome={onNavigateHome}
          onToggleSidebar={handleToggleSidebar}
          onRetry={onRetry}
        />

        {/* WORKSPACE VIEWPORT SCROLL LAYER */}
        <main id={mainId} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 relative" aria-busy={isLoading || undefined}>
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-slate-50/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-emerald-500">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 font-mono uppercase tracking-wider">Synchronizing Matrix</h4>
            </div>
          )}

          {isEmpty && !isLoading && (
            <div className="w-full py-24 border border-dashed border-slate-200 rounded-2xl bg-white/60 flex flex-col items-center justify-center text-center p-6 gap-3 shadow-inner">
              <Inbox size={24} className="text-slate-400" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight font-mono">No Active Workspace</h3>
              <p className="text-[11px] text-slate-400 font-light max-w-xs leading-normal">
                Initialize monitoring operations by choosing a module from the sidebar navigation.
              </p>
            </div>
          )}

          {isError && !isLoading && (
            <div className="w-full py-24 border border-red-100 rounded-2xl bg-red-50/30 flex flex-col items-center justify-center text-center p-6 gap-3 shadow-sm">
              <ShieldAlert size={24} className="text-red-500 animate-pulse" />
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-tight font-mono">Handshake Failure</h3>
              <p className="text-[11px] text-red-600/80 font-light max-w-xs leading-normal">
                The command-center frame link was interrupted. Click below to reconnect.
              </p>
              {typeof onRetry === 'function' && (
                <button 
                  type="button" 
                  className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-mono text-[9px] uppercase font-bold tracking-wider transition-all shadow-sm flex items-center gap-1 border border-red-600 cursor-pointer" 
                  onClick={onRetry}
                >
                  <RefreshCw size={10} /> Force Reconnect
                </button>
              )}
            </div>
          )}

          {!isLoading && !isError && !isEmpty && (
            <div className="w-full h-full">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* OVERLAY PANEL CONTEXT FLYOUT */}
      {notificationCenterOpen && (
        <div className="fixed right-0 top-0 w-[420px] h-full z-50 shadow-2xl animate-in slide-in-from-right duration-200">
          <NotificationCenter
            notifications={visibleNotifications}
            systemState={state}
            selectedNotificationId={selectedNotificationId}
            onSelectNotification={onSelectNotification}
            onAcknowledgeNotification={onAcknowledgeNotification}
            onEscalateNotification={onEscalateNotification}
            onSuppressNotification={onSuppressNotification}
            onRetryDelivery={onRetryDelivery}
            onOpenLinkedEntity={onOpenLinkedEntity}
            onClose={closeNotificationCenter}
            onRetry={onRetry}
          />
        </div>
      )}

      {/* COMMAND PALETTE CONSOLE OVERLAY PANEL */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] transition-all animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={closeCommandPalette} />
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-xl p-4 shadow-2xl font-mono text-xs text-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-slate-500">
              <span className="font-bold text-[9px] text-slate-700 tracking-wider">SYSTEM TELEMETRY CONSOLE // COMMAND PALETTE</span>
              <button type="button" className="text-slate-400 hover:text-slate-600 cursor-pointer uppercase text-[9px] font-bold" onClick={closeCommandPalette}>[ESC] Close</button>
            </div>
            <input type="text" autoFocus placeholder="Type system override token command..." className="w-full h-9 bg-slate-50 border border-slate-200 rounded px-3 text-slate-900 font-mono text-xs outline-none focus:border-emerald-500/50 transition-all shadow-inner" />
            <div className="text-[10px] text-slate-400 space-y-1 pt-1">
              <div>• Use <span className="text-slate-600 font-bold">/goto [module]</span> to navigate dashboard layout vectors.</div>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ SETTINGS POPUP MODAL OVERLAY */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center transition-all animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setSettingsOpen(false)} />
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 shadow-2xl text-slate-800 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-700">
                <Sliders size={14} className="text-slate-500" />
                <span>WORKSPACE CONFIGURATION</span>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>
            <div className="space-y-3 font-mono text-[11px]">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-150">
                <div className="flex items-center gap-2"><Volume2 size={14} className="text-slate-500" /> <span>Master Audio Alerts Channel</span></div>
                <input type="checkbox" defaultChecked className="accent-emerald-500" />
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-150">
                {/* 💡 Icon swap: Changed the broken RefreshTriangle to a valid RefreshCw icon */}
                <div className="flex items-center gap-2"><RefreshCw size={14} className="text-slate-500" /> <span>Stream Polling Frequency</span></div>
                <select className="bg-white border border-slate-200 rounded p-0.5 text-[10px]">
                  <option>1s (Real-time)</option>
                  <option>5s (Optimized)</option>
                  <option>10s (Eco-Mode)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📖 HELP PROCEDURES MANUAL OVERLAY MODAL */}
      {helpOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center transition-all animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setHelpOpen(false)} />
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl p-5 shadow-2xl text-slate-800 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-700">
                <BookOpen size={14} className="text-slate-500" />
                <span>OPERATIONAL MANUAL & SOPS</span>
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <h5 className="text-xs font-bold text-slate-800 font-mono mb-1">🚨 P1 CRITICAL ACCIDENT HANDLING</h5>
                <p className="text-[11px] text-slate-500 leading-normal">In case of any telemetry grid disconnect, immediately isolate track circuitry zones and issue an alert suppression override via the command console line.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <h5 className="text-xs font-bold text-slate-800 font-mono mb-1 flex items-center gap-1"><Terminal size={12} /> CONSOLE SHORTCUTS</h5>
                <div className="font-mono text-[10px] text-slate-500 space-y-0.5 mt-1">
                  <div>• <span className="text-slate-700 font-bold">/ack-all</span> : Claims all current live track alerts.</div>
                  <div>• <span className="text-slate-700 font-bold">/status</span> : Pulls up diagnostic node performance profiles.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AppShell);
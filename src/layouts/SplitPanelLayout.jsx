// src/layouts/SplitPanelLayout.jsx
import React, { memo, useId, useMemo } from 'react';
import { Loader2, Inbox, ShieldAlert, RefreshCw } from 'lucide-react';

function StateMessage({ tone, title, description, actionLabel, onAction }) {
  const toneClasses = {
    loading: 'bg-white border-slate-200 text-slate-800',
    empty: 'bg-white border-slate-200 text-slate-500',
    error: 'bg-red-50/50 border-red-100 text-red-700',
  };

  return (
    <section
      className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full bg-white/80 backdrop-blur-md shadow-sm ${toneClasses[tone] || toneClasses.empty}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {tone === 'loading' && <Loader2 size={16} className="animate-spin text-emerald-500" />}
          {tone === 'empty' && <Inbox size={16} className="text-slate-400" />}
          {tone === 'error' && <ShieldAlert size={16} className="text-red-500 animate-pulse" />}
        </div>
        <div>
          <h4 className="font-mono text-xs font-black uppercase tracking-wider mb-0.5">{title}</h4>
          {description && <p className="text-[11px] font-light text-slate-400 leading-normal">{description}</p>}
        </div>
      </div>
      {actionLabel && (
        <button
          type="button"
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1 cursor-pointer"
          onClick={onAction}
        >
          <RefreshCw size={10} /> {actionLabel}
        </button>
      )}
    </section>
  );
}

function SplitPanelLayout({
  left,
  right,
  header,
  footer,
  title = 'Split Panel Workspace',
  loading = false,
  empty = false,
  error = false,
  success = false,
  onRetry,
  className,
  children,
  ...rest
}) {
  const titleId = useId();
  const leftId = useId();
  const rightId = useId();
  
  const state = loading ? 'loading' : error ? 'error' : empty ? 'empty' : success ? 'success' : 'ready';
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isEmpty = state === 'empty';

  const panels = useMemo(
    () => ({
      left: left ?? null,
      right: right ?? null,
      header: header ?? null,
      footer: footer ?? null,
      fallback: children ?? null,
    }),
    [children, footer, header, left, right]
  );

  return (
    <section
      className={`w-full h-full flex flex-col gap-4 text-slate-900 overflow-hidden ${className || ''}`}
      aria-labelledby={titleId}
      aria-busy={isLoading || undefined}
      data-state={state}
      {...rest}
    >
      {/* WORKSPACE MAIN HEADER PANEL */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-3 flex-shrink-0">
        <div className="space-y-0.5">
          <h1 id={titleId} className="text-lg font-black font-sans tracking-tight text-slate-900 uppercase">
            {title}
          </h1>
          <p className="text-[11px] font-light text-slate-400 max-w-2xl leading-normal">
            Dual-panel operational workspace optimized for comparative investigation, data cross-referencing, and real-time triage.
          </p>
        </div>
        {panels.header && <div className="flex-shrink-0">{panels.header}</div>}
      </header>

      {/* OVERLAY NOTIFICATION STATUS CONTROLLERS CONTAINER */}
      <div className="flex flex-col gap-4 flex-shrink-0 relative">
        {isLoading && (
          <StateMessage
            tone="loading"
            title="Synchronizing Workspace Core…"
            description="Aligning comparative data matrices and side-by-side transaction registers..."
          />
        )}
        {isEmpty && !isLoading && (
          <StateMessage
            tone="empty"
            title="Symmetrical Datasets Missing"
            description="No valid parameters available inside the requested search queries to populate comparison fields."
          />
        )}
        {isError && !isLoading && (
          <StateMessage
            tone="error"
            title="Triage Frame Broken"
            description="The workspace lost link access to one or more dependent information data tracks."
            actionLabel={typeof onRetry === 'function' ? 'Retry Handshake' : null}
            onAction={onRetry}
          />
        )}
      </div>

      {/* CORE DUAL-PANEL FLEX GRID WORKSPACE SURFACE */}
      {!isLoading && !isError && !isEmpty && (
        <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch flex-1 min-h-0 overflow-hidden">
          
          {/* LEFT INVESTIGATION PANE (SCROLLABLE) */}
          <section 
            className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm min-w-0 overflow-y-auto pr-2 flex flex-col" 
            aria-label="Left investigation panel" 
            aria-labelledby={leftId}
          >
            <div id={leftId} className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50 pb-2.5 mb-4 flex-shrink-0">
              Primary Audit Focus / Track Alpha
            </div>
            <div className="w-full flex-1">
              {panels.left ?? panels.fallback}
            </div>
          </section>

          {/* RIGHT INVESTIGATION PANE (SCROLLABLE) */}
          <section 
            className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm min-w-0 overflow-y-auto pr-2 flex flex-col" 
            aria-label="Right investigation panel" 
            aria-labelledby={rightId}
          >
            <div id={rightId} className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50 pb-2.5 mb-4 flex-shrink-0">
              Cross-Reference Profile / Track Beta
            </div>
            <div className="w-full flex-1">
              {panels.right}
            </div>
          </section>
          
        </div>
      )}

      {/* REGIONAL RUNTIME AUDIT FOOTER */}
      {panels.footer && (
        <footer className="border-t border-slate-200/60 pt-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex justify-between items-center flex-shrink-0">
          {panels.footer}
        </footer>
      )}
    </section>
  );
}

export default memo(SplitPanelLayout);
export { SplitPanelLayout };
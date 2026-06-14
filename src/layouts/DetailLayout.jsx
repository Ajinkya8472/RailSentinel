// src/layouts/DetailLayout.jsx
import React, { memo, useId, useMemo } from 'react';
import { Loader2, Inbox, ShieldAlert, RefreshCw } from 'lucide-react';

function StatusMessage({ tone, title, description, actionLabel, onAction }) {
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

function DetailLayout({
  header,
  summary,
  body,
  rail,
  footer,
  title = 'Detail View',
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
  const bodyId = useId();
  const railId = useId();
  
  const state = loading ? 'loading' : error ? 'error' : empty ? 'empty' : success ? 'success' : 'ready';
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isEmpty = state === 'empty';

  const regions = useMemo(
    () => ({
      header: header ?? null,
      summary: summary ?? null,
      body: body ?? children ?? null,
      rail: rail ?? null,
      footer: footer ?? null,
    }),
    [body, children, footer, header, rail, summary]
  );

  return (
    <section
      className={`w-full h-full flex flex-col gap-4 text-slate-900 overflow-hidden ${className || ''}`}
      aria-labelledby={titleId}
      aria-busy={isLoading || undefined}
      data-state={state}
      {...rest}
    >
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-3 flex-shrink-0">
        <div className="space-y-0.5">
          <h1 id={titleId} className="text-lg font-black font-sans tracking-tight text-slate-900 uppercase">
            {title}
          </h1>
          <p className="text-[11px] font-light text-slate-400 max-w-2xl leading-normal">
            Deep-review layout for single-entity operations, telemetry data, and audit context.
          </p>
        </div>
        {regions.header && <div className="flex-shrink-0">{regions.header}</div>}
      </header>

      {/* SUMMARY STATS BAR PANEL */}
      {regions.summary && (
        <section className="w-full bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex-shrink-0" aria-label="Entity summary">
          {regions.summary}
        </section>
      )}

      {/* STATUS CARDS HUB CONTAINER */}
      <div className="flex flex-col gap-4 flex-shrink-0 relative">
        {isLoading && (
          <StatusMessage
            tone="loading"
            title="Synchronizing Incident Workspace…"
            description="Compiling telemetry parameters and historical audit data into the deep-review view layer."
          />
        )}
        {isEmpty && !isLoading && (
          <StatusMessage
            tone="empty"
            title="Profile Logs Unassigned"
            description="The selected target address context does not expose any parameter properties."
          />
        )}
        {isError && !isLoading && (
          <StatusMessage
            tone="error"
            title="Handshake Failure"
            description="The selected entity profile context could not load securely from the databus."
            actionLabel={typeof onRetry === 'function' ? 'Retry Link' : null}
            onAction={onRetry}
          />
        )}
      </div>

      {/* ASYMMETRIC GRID INTERACTION LAYER */}
      {!isLoading && !isError && !isEmpty && (
        <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch flex-1 min-h-0 overflow-hidden">
          
          {/* PRIMARY DETAILED METRICS COLUMN (SCROLLABLE) */}
          <section 
            className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm min-w-0 overflow-y-auto pr-2 flex flex-col" 
            aria-label="Primary detail content" 
            aria-labelledby={bodyId}
          >
            <div id={bodyId} className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50 pb-2.5 mb-4 flex-shrink-0">
              Detailed Telemetry Diagnostics
            </div>
            <div className="w-full flex-1">
              {regions.body}
            </div>
          </section>

          {/* SECONDARY SIDE ACTION TRACK RAIL COLUMN (SCROLLABLE) */}
          <aside 
            className="w-full lg:w-80 xl:w-96 shrink-0 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm overflow-y-auto pl-1 flex flex-col min-h-0" 
            aria-label="Supporting detail rail" 
            aria-labelledby={railId}
          >
            <div id={railId} className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50 pb-2.5 mb-4 flex-shrink-0">
              Cross-Reference Operational Context
            </div>
            <div className="w-full flex-1">
              {regions.rail}
            </div>
          </aside>
          
        </div>
      )}

      {/* REGIONAL RUNTIME AUDIT FOOTER */}
      {regions.footer && (
        <footer className="border-t border-slate-200/60 pt-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex justify-between items-center flex-shrink-0">
          {regions.footer}
        </footer>
      )}
    </section>
  );
}

export default memo(DetailLayout);
export { DetailLayout };
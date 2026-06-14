// src/layouts/DashboardLayout.jsx
import React, { memo, useId, useMemo } from 'react';
import { Loader2, Inbox, ShieldAlert, RefreshCw } from 'lucide-react';

function StatusPanel({ tone, title, description, actionLabel, onAction }) {
  const toneClasses = {
    loading: 'bg-white border-slate-200 text-slate-800',
    empty: 'bg-white border-slate-200 text-slate-500',
    error: 'bg-red-50/50 border-red-100 text-red-700',
  };

  return (
    <section
      className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full shadow-sm bg-white/80 backdrop-blur-md ${toneClasses[tone] || toneClasses.empty}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="flex items-start gap-3.5">
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

function DashboardLayout({
  header,
  kpiStrip,
  primary,
  secondary,
  footer,
  title = 'RailSentinel Dashboard',
  subtitle = 'High-density operational overview for mission-critical RailSentinel workflows.',
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
  const isLoading = Boolean(loading);
  const isError = Boolean(error);
  const isEmpty = Boolean(empty);

  const regions = useMemo(
    () => ({
      header: header ?? null,
      kpiStrip: kpiStrip ?? null,
      primary: primary ?? children ?? null,
      secondary: secondary ?? null,
      footer: footer ?? null,
    }),
    [children, footer, header, kpiStrip, primary, secondary]
  );

  return (
    <section
      className={`w-full h-full flex flex-col gap-4 text-slate-900 overflow-hidden ${className || ''}`}
      aria-labelledby={titleId}
      aria-busy={isLoading || undefined}
      data-state={isLoading ? 'loading' : isEmpty ? 'empty' : isError ? 'error' : 'success'}
      {...rest}
    >
      {/* HEADER HUD BANNER SCALE */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-3 flex-shrink-0">
        <div className="space-y-0.5">
          <h1 id={titleId} className="text-lg font-black font-sans tracking-tight text-slate-900 uppercase">
            {title}
          </h1>
          <p className="text-[11px] font-light text-slate-400 max-w-2xl leading-normal">
            {subtitle}
          </p>
        </div>
        {regions.header && <div className="flex-shrink-0">{regions.header}</div>}
      </header>

      {/* FIXED TELEMETRY KPI MODULE STRIP */}
      {regions.kpiStrip && (
        <section aria-label="Dashboard Metrics Strip" className="w-full flex-shrink-0">
          {regions.kpiStrip}
        </section>
      )}

      {/* CONDITIONALLY RENDERED PANEL HUB */}
      <div className="flex flex-col gap-4 flex-1 w-full min-h-0 relative">
        {isLoading && (
          <StatusPanel
            tone="loading"
            title="Synchronizing Node Databus…"
            description="Live operational records are feeding into the overview surface matrix layer."
          />
        )}

        {isEmpty && !isLoading && (
          <StatusPanel
            tone="empty"
            title="Zero Records Returned"
            description="There are no active or matching telemetry entries logged within the current framework scope."
          />
        )}

        {isError && !isLoading && (
          <StatusPanel
            tone="error"
            title="Handshake Link Interrupted"
            description="The dashboard surface lost connection to the upstream message context bus stream."
            actionLabel={typeof onRetry === 'function' ? 'Reconnect Hub' : null}
            onAction={onRetry}
          />
        )}

        {/* ASYMMETRIC GRID PLATFORM SPLIT */}
        {!isLoading && !isError && !isEmpty && (
          <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch flex-1 min-h-0 overflow-hidden">
            
            {/* PRIMARY SCROLLABLE VIEW CONTENT COL */}
            <section className="flex-1 min-w-0 overflow-y-auto pr-1" aria-label="Primary Workspace Frame">
              {regions.primary}
            </section>

            {/* SIDEBAR TRIAGE RAIL COL */}
            {regions.secondary && (
              <aside className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col min-h-0 overflow-y-auto pl-0.5" aria-label="Supporting Rail Diagnostics">
                {regions.secondary}
              </aside>
            )}
          </div>
        )}
      </div>

      {/* SYSTEM CONSOLE RUNTIME FOOTER */}
      {regions.footer && (
        <footer className="border-t border-slate-200/60 pt-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex justify-between items-center flex-shrink-0">
          {regions.footer}
        </footer>
      )}
    </section>
  );
}

export default memo(DashboardLayout);
export { DashboardLayout, StatusPanel };
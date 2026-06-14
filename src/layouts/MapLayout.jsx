// src/layouts/MapLayout.jsx
import React, { memo, useId, useMemo } from 'react';
import { Loader2, Inbox, ShieldAlert, RefreshCw } from 'lucide-react';

function StateBanner({ tone, title, description, actionLabel, onAction }) {
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

function MapLayout({
  header,
  controls,
  legend,
  map,
  detail,
  footer,
  title = 'Live Operations Map',
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
  const mapId = useId();
  const detailId = useId();
  
  const state = loading ? 'loading' : error ? 'error' : empty ? 'empty' : success ? 'success' : 'ready';
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isEmpty = state === 'empty';

  const regions = useMemo(
    () => ({
      header: header ?? null,
      controls: controls ?? null,
      legend: legend ?? null,
      map: map ?? children ?? null,
      detail: detail ?? null,
      footer: footer ?? null,
    }),
    [children, controls, detail, footer, header, legend, map]
  );

  return (
    <section
      className={`w-full h-full flex flex-col gap-4 text-slate-900 overflow-hidden ${className || ''}`}
      aria-labelledby={titleId}
      aria-busy={isLoading || undefined}
      data-state={state}
      {...rest}
    >
      {/* GEOSPATIAL COMMAND SCREEN HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-3 flex-shrink-0">
        <div className="space-y-0.5">
          <h1 id={titleId} className="text-lg font-black font-sans tracking-tight text-slate-900 uppercase">
            {title}
          </h1>
          <p className="text-[11px] font-light text-slate-400 max-w-2xl leading-normal">
            Spatial operations layout for network telemetry monitoring, layer filtering, and cross-module tracking.
          </p>
        </div>
        {regions.header && <div className="flex-shrink-0">{regions.header}</div>}
      </header>

      {/* TOOLBAR FILTER CONTROLS GRID */}
      {(regions.controls || regions.legend) && (
        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200/80 p-3 rounded-xl shadow-sm font-mono text-xs text-slate-500 flex-shrink-0" aria-label="Map controls and legend">
          <div className="flex flex-wrap items-center gap-2">{regions.controls}</div>
          <div className="flex items-center gap-4 sm:justify-end">{regions.legend}</div>
        </div>
      )}

      {/* SYSTEM ASYNC STATE NOTIFICATIONS */}
      <div className="flex flex-col gap-4 flex-shrink-0 relative">
        {isLoading && (
          <StateBanner
            tone="loading"
            title="Initializing Map Layers…"
            description="Compiling vector paths and geographical asset nodes into the canvas layer..."
          />
        )}
        {isEmpty && !isLoading && (
          <StateBanner
            tone="empty"
            title="Coordinates Missing"
            description="No matching spatial data points located inside the current data registry scope."
          />
        )}
        {isError && !isLoading && (
          <StateBanner
            tone="error"
            title="GIS Handshake Interrupted"
            description="The map interface lost connectivity to the upstream spatial coordination stream."
            actionLabel={typeof onRetry === 'function' ? 'Retry Handshake' : null}
            onAction={onRetry}
          />
        )}
      </div>

      {/* CORE SPATIAL PLATFORM MAP SPLIT CONTAINER */}
      {!isLoading && !isError && !isEmpty && (
        <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch flex-1 min-h-0 overflow-hidden">
          
          {/* PRIMARY GRAPHIC MAP ENGINE MATRIX CANVAS */}
          <section 
            className="flex-1 rounded-2xl overflow-hidden min-w-0 flex flex-col relative border border-slate-200 bg-slate-100 shadow-sm" 
            aria-label="Map canvas" 
            aria-labelledby={mapId}
          >
            <div id={mapId} className="hidden font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Network GIS Canvas
            </div>
            <div className="w-full h-full flex-1 relative">
              {regions.map}
            </div>
          </section>

          {/* SIDE DATA LOGS INTERACTION RAIL COLUMN */}
          {regions.detail && (
            <aside 
              className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col min-h-0 overflow-y-auto pl-0.5" 
              aria-label="Spatial detail rail" 
              aria-labelledby={detailId}
            >
              <div id={detailId} className="hidden font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Regional Focus Profile
              </div>
              <div className="w-full flex-1">
                {regions.detail}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* LAYOUT RUNTIME AUDIT FOOTER */}
      {regions.footer && (
        <footer className="border-t border-slate-200/60 pt-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex justify-between items-center flex-shrink-0">
          {regions.footer}
        </footer>
      )}
    </section>
  );
}

export default memo(MapLayout);
export { MapLayout };
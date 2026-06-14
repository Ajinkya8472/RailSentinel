import React, { memo, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * TrainMapPanel — simple map-style panel for Module-2 Train Operations.
 * Renders train positions as markers (from `lat`/`lon` or `location` fields)
 * for a single train or a visible set of trains. Reads all presentation
 * state from `useTrainStore` selectors only. No store mutations are performed.
 *
 * Dependencies:
 * - React
 * - `src/store/trainStore` (Zustand selectors only)
 * - `src/layouts/DashboardLayout.jsx`, `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId` (string|number|null) — id to look up from store (preferred)
 * - `train` (object|null) — optional train object override
 * - `layout` ('dashboard'|'split'|null) — optional wrapper layout
 * - `title` (string|null) — optional layout title
 * - `staleThreshold` (number) — ms to consider data stale (default 60000)
 * - `showMarkers` (boolean) — show individual markers for visible trains (default true)
 * - `onSelect` (fn) — optional callback when a marker is clicked (train)
 * - `compact` (boolean) — compact visual mode (default false)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getVisibleTrains`, `getTrainById`, `getSelectedTrain`
 */

function getPosition(train) {
  if (!train) return null;
  if (train.location && typeof train.location === 'object' && train.location.lat != null && train.location.lon != null) return { lat: Number(train.location.lat), lon: Number(train.location.lon) };
  if (train.lat != null && train.lon != null) return { lat: Number(train.lat), lon: Number(train.lon) };
  if (train.position && typeof train.position === 'object' && train.position.latitude != null && train.position.longitude != null) return { lat: Number(train.position.latitude), lon: Number(train.position.longitude) };
  return null;
}

function Marker({ x, y, label, onClick }) {
  return (
    <g className="train-map-marker" transform={`translate(${x}, ${y})`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <circle r="6" fill="#0077cc" stroke="#fff" strokeWidth="1.5" />
      <text x="10" y="4" fontSize="12" fill="#222">{label}</text>
    </g>
  );
}

export default memo(function TrainMapPanel({ trainId = null, train: trainProp = null, layout = null, title = null, staleThreshold = 60000, showMarkers = true, onSelect = null, compact = false }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);
  const getVisibleTrains = useTrainStore((s) => (typeof s.getVisibleTrains === 'function' ? s.getVisibleTrains : null));

  const trainFromStore = useTrainStore((s) => (trainId ? s.getTrainById(trainId) : s.getSelectedTrain()));
  const train = trainProp ?? trainFromStore;

  const visibleTrains = useMemo(() => {
    try { return getVisibleTrains ? getVisibleTrains() : []; } catch (e) { return []; }
  }, [getVisibleTrains]);

  const markers = useMemo(() => {
    if (!showMarkers) return [];
    if (train) {
      const p = getPosition(train);
      return p ? [{ id: train.id ?? train.number, label: train.number ?? train.id, lat: p.lat, lon: p.lon, train }] : [];
    }
    return (visibleTrains || []).map(t => {
      const p = getPosition(t);
      if (!p) return null;
      return { id: t.id ?? t.number, label: t.number ?? t.id, lat: p.lat, lon: p.lon, train: t };
    }).filter(Boolean);
  }, [train, visibleTrains, showMarkers]);

  // Simple viewport math: map lat/lon to svg coords using bounding box from markers
  const viewport = useMemo(() => {
    if (!markers || markers.length === 0) return { width: 600, height: 300, transform: null, points: [] };
    const lats = markers.map(m => m.lat);
    const lons = markers.map(m => m.lon);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons); const maxLon = Math.max(...lons);
    const padding = 0.02 * Math.max(Math.abs(maxLat - minLat || 1), Math.abs(maxLon - minLon || 1));
    const w = 600; const h = 300;
    const latRange = (maxLat - minLat) || 1; const lonRange = (maxLon - minLon) || 1;
    const points = markers.map(m => ({ x: 40 + ((m.lon - minLon) / lonRange) * (w - 80), y: 20 + ((maxLat - m.lat) / latRange) * (h - 60), id: m.id, train: m.train, label: m.label }));
    return { width: w, height: h, points };
  }, [markers]);

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : (train && train.lastUpdatedAt ? Date.parse(train.lastUpdatedAt) : null);
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleSelect = useCallback((t) => { if (typeof onSelect === 'function') onSelect(t); }, [onSelect]);

  const content = (
    <div className={`train-map-panel ${compact ? 'train-map-panel--compact' : ''} ${isStale ? 'train-map-panel--stale' : ''} ${error ? 'train-map-panel--error' : ''}`} aria-live="polite">
      <div className="train-map-panel__status">
        {loading && <span className="train-pill">Loading</span>}
        {refreshing && <span className="train-pill">Refreshing</span>}
        {syncing && <span className="train-pill train-pill--live">Live</span>}
        {isStale && <span className="train-pill train-pill--stale">Stale</span>}
        {error && <span className="train-pill train-pill--error">Error</span>}
      </div>

      <div className="train-map-panel__map">
        <svg width={viewport.width} height={viewport.height} viewBox={`0 0 ${viewport.width} ${viewport.height}`}>
          <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="#f5f7fa" stroke="#e1e6eb" />
          {viewport.points && viewport.points.map(p => (
            <Marker key={p.id} x={p.x} y={p.y} label={p.label} onClick={() => handleSelect(p.train)} />
          ))}
        </svg>
      </div>
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Map')}
        header={null}
        left={content}
        right={null}
        loading={loading}
        empty={!markers || markers.length === 0}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Map')}
        kpiStrip={(
          <div className="train-map-panel__kpi">
            <span className="train-kpi">Markers: {markers.length}</span>
            <span className="train-kpi">Last: {train?.lastUpdatedAt ?? lastUpdatedAt ?? '—'}</span>
          </div>
        )}
        loading={loading}
        empty={!markers || markers.length === 0}
        error={Boolean(error)}
      >
        {content}
      </DashboardLayout>
    );
  }

  return content;
});

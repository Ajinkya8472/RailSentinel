import React, { memo, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * Small status badge used across Module-2 Train Operations to show a train's
 * current status (on-time, delayed, cancelled, approaching, departed).
 * Designed to be embeddable in lists, headers, KPI strips, and panels. All
 * presentation data is read from `useTrainStore` selectors only (no mutations).
 *
 * Dependencies:
 * - React
 * - `src/store/trainStore` (Zustand selectors only)
 * - `src/layouts/DashboardLayout.jsx`, `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId` (string|number|null): id to look up from store (preferred)
 * - `train` (object|null): optional train object override
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout
 * - `title` (string|null): optional title shown by layout wrappers
 * - `staleThreshold` (number): ms to consider data stale (default 60000)
 * - `showIcon` (boolean): render status icon (default true)
 * - `onClick` (fn): optional click handler (no store writes)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getTrainById`, `getSelectedTrain`
 */

function formatWhen(iso) {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString();
  } catch (e) {
    return '';
  }
}

function statusClass(status) {
  if (!status) return 'unknown';
  return String(status).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function Icon({ status }) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  if (s.includes('delay') || s.includes('delayed')) return <span className="train-status-badge__icon">⏱️</span>;
  if (s.includes('cancel')) return <span className="train-status-badge__icon">❌</span>;
  if (s.includes('approach') || s.includes('arriv')) return <span className="train-status-badge__icon">🚆</span>;
  if (s.includes('depart') || s.includes('left')) return <span className="train-status-badge__icon">🏁</span>;
  return <span className="train-status-badge__icon">ℹ️</span>;
}

export default memo(function TrainStatusBadge({ trainId = null, train: trainProp = null, layout = null, title = null, staleThreshold = 60000, showIcon = true, onClick = null }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);

  const trainFromStore = useTrainStore((s) => (trainId ? s.getTrainById(trainId) : s.getSelectedTrain()));
  const train = trainProp ?? trainFromStore;

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : (train && train.lastUpdatedAt ? Date.parse(train.lastUpdatedAt) : null);
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const status = train?.status ?? (train && train.state) ?? null;
  const platform = train?.platform ?? null;

  const label = useMemo(() => {
    if (!train) return 'N/A';
    if (status) return String(status);
    if (train.cancelled) return 'Cancelled';
    if (train.delay != null && Number(train.delay) > 0) return `Delayed ${train.delay}m`;
    return 'Unknown';
  }, [train, status]);

  const handleClick = useCallback((e) => { if (typeof onClick === 'function') onClick(train, e); }, [onClick, train]);

  const badge = (
    <div className={`train-status-badge train-status-badge--${statusClass(status)} ${isStale ? 'train-status-badge--stale' : ''} ${error ? 'train-status-badge--error' : ''}`} role={onClick ? 'button' : 'status'} tabIndex={onClick ? 0 : -1} onClick={handleClick} onKeyDown={(e) => { if (onClick && e.key === 'Enter') handleClick(e); }} aria-live="polite">
      <div className="train-status-badge__main">
        {showIcon ? <Icon status={status} /> : null}
        <span className="train-status-badge__label">{label}</span>
      </div>
      <div className="train-status-badge__meta">
        {platform ? <span className="train-status-badge__platform">Plat {platform}</span> : null}
        {isStale ? <span className="train-status-badge__pill">Stale</span> : null}
        {loading ? <span className="train-status-badge__pill">Loading</span> : null}
        {refreshing ? <span className="train-status-badge__pill">Refreshing</span> : null}
        {syncing ? <span className="train-status-badge__pill train-status-badge__pill--live">Live</span> : null}
        {error ? <span className="train-status-badge__pill train-status-badge__pill--error">Error</span> : null}
      </div>
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Status')}
        header={null}
        left={badge}
        right={null}
        loading={loading}
        empty={!train}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Status')}
        kpiStrip={badge}
        loading={loading}
        empty={!train}
        error={Boolean(error)}
      />
    );
  }

  return badge;
});

import React, { memo, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * Compact train card for Module-2 Train Operations. Presents a concise
 * snapshot of a train (number, route, status, platform, ETA) suitable for
 * KPI strips, tile lists, or as a header in detail panels. Reads all live
 * presentation state from the canonical `useTrainStore` selectors only.
 *
 * Dependencies:
 * - React
 * - `src/store/trainStore` (Zustand hook) selectors only
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx` for optional wrapping
 *
 * Props:
 * - `trainId` (string|number|null): id of the train to render (preferred)
 * - `train` (object|null): optional train object to render instead of store lookup
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout (default: null)
 * - `title` (string|null): optional title when wrapped in a layout
 * - `staleThreshold` (number): ms to consider data stale (default: 60000)
 * - `onOpen` (fn): optional callback when the card is activated
 * - `compact` (boolean): compact visual mode (default: true)
 *
 * State (exposed):
 * - Derived from `useTrainStore` selectors: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getTrainById`, `getSelectedTrain`
 */

function formatWhen(iso) {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch (e) {
    return '';
  }
}

function Badge({ status }) {
  if (!status) return null;
  return <span className={`train-card__status train-card__status--${String(status).toLowerCase()}`}>{String(status)}</span>;
}

function Body({ train, compact }) {
  if (!train) {
    return <div className="train-card__empty">No train selected.</div>;
  }

  return (
    <div className={`train-card__body ${compact ? 'train-card__body--compact' : ''}`}>
      <div className="train-card__head">
        <div className="train-card__number">{train.number ?? train.id}</div>
        <div className="train-card__route">{train.origin ?? ''} → {train.destination ?? ''}</div>
      </div>
      <div className="train-card__meta">
        <Badge status={train.status} />
        <span className="train-card__platform">{train.platform ? `Plat ${train.platform}` : null}</span>
        <span className="train-card__eta">{formatWhen(train.eta ?? train.etd ?? train.lastUpdatedAt)}</span>
      </div>
      {train.notes ? <div className="train-card__notes">{train.notes}</div> : null}
    </div>
  );
}

export default memo(function TrainCard({ trainId = null, train: trainProp = null, layout = null, title = null, staleThreshold = 60000, onOpen = null, compact = true }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);

  const trainFromStore = useTrainStore((s) => (trainId ? s.getTrainById(trainId) : s.getSelectedTrain()));
  const train = trainProp ?? trainFromStore;

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleOpen = useCallback(() => {
    if (!train) return;
    if (typeof onOpen === 'function') onOpen(train);
  }, [train, onOpen]);

  const card = (
    <div className={`train-card ${isStale ? 'train-card--stale' : ''} ${error ? 'train-card--error' : ''}`} role={onOpen ? 'button' : 'group'} tabIndex={onOpen ? 0 : -1} onClick={handleOpen} onKeyDown={(e) => { if (onOpen && e.key === 'Enter') handleOpen(); }} aria-live="polite">
      <div className="train-card__status-row">
        {loading ? <span className="train-card__pill">Loading</span> : null}
        {refreshing ? <span className="train-card__pill">Refreshing</span> : null}
        {syncing ? <span className="train-card__pill">Live</span> : null}
        {isStale ? <span className="train-card__pill">Stale</span> : null}
        {error ? <span className="train-card__pill train-card__pill--error">Error</span> : null}
      </div>
      <Body train={train} compact={compact} />
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train')}
        header={null}
        left={card}
        right={null}
        loading={loading}
        empty={!train}
        error={Boolean(error)}
        success={!loading && !error && Boolean(train)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train')}
        kpiStrip={card}
        loading={loading}
        empty={!train}
        error={Boolean(error)}
        success={!loading && !error && Boolean(train)}
      />
    );
  }

  return card;
});

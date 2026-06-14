import React, { memo, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * Full train detail panel for Module-2 Train Operations. Displays a focused
 * view of a train's attributes (number, route, status, platform, ETA/ETD),
 * metadata and notes. This component reads all presentation state from the
 * canonical `useTrainStore` selectors only and intentionally does not
 * dispatch store actions.
 *
 * Dependencies:
 * - React
 * - `src/store/trainStore` (Zustand selectors only)
 * - `src/layouts/DashboardLayout.jsx`, `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId` (string|number|null): id of the train to render (preferred)
 * - `train` (object|null): optional train object to render instead of store lookup
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout
 * - `title` (string|null): optional layout title
 * - `staleThreshold` (number): ms to consider data stale (default: 60000)
 * - `onClose` (fn): optional close callback for panel wrappers
 * - `compact` (boolean): compact visual mode (default: false)
 *
 * State (derived from store selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getTrainById`, `getSelectedTrain`
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

function StatusRow({ train, loading, refreshing, syncing, error, isStale }) {
  return (
    <div className="train-detail__status-row">
      {loading && <span className="train-pill">Loading</span>}
      {refreshing && <span className="train-pill">Refreshing</span>}
      {syncing && <span className="train-pill train-pill--live">Live</span>}
      {isStale && <span className="train-pill train-pill--stale">Stale</span>}
      {error && <span className="train-pill train-pill--error">Error</span>}
      {train && train.status && <span className={`train-status train-status--${String(train.status).toLowerCase()}`}>{train.status}</span>}
    </div>
  );
}

function DetailBody({ train, compact }) {
  if (!train) return <div className="train-detail__empty">No train data available.</div>;

  return (
    <div className={`train-detail__body ${compact ? 'train-detail__body--compact' : ''}`}>
      <div className="train-detail__header">
        <div className="train-detail__title">{train.number ?? train.id}</div>
        <div className="train-detail__sub">{train.origin ?? ''} → {train.destination ?? ''}</div>
      </div>

      <div className="train-detail__meta">
        <div className="train-detail__meta-item"><strong>Platform:</strong> {train.platform ?? '—'}</div>
        <div className="train-detail__meta-item"><strong>ETA/ETD:</strong> {formatWhen(train.eta ?? train.etd ?? train.lastUpdatedAt) || '—'}</div>
        <div className="train-detail__meta-item"><strong>Last update:</strong> {formatWhen(train.lastUpdatedAt) || '—'}</div>
      </div>

      {train.notes ? <div className="train-detail__notes"><strong>Notes:</strong> {train.notes}</div> : null}

      {train.audit && train.audit.length ? (
        <section className="train-detail__audit">
          <h4>Audit Trail</h4>
          <ul>
            {train.audit.map((a) => (
              <li key={a.id ?? `${a.ts}-${a.actor}`}>{formatWhen(a.ts)} — {a.message ?? a.event}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default memo(function TrainDetailPanel({ trainId = null, train: trainProp = null, layout = null, title = null, staleThreshold = 60000, onClose = null, compact = false }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);

  const trainFromStore = useTrainStore((s) => (trainId ? s.getTrainById(trainId) : s.getSelectedTrain()));
  const train = useMemo(() => (trainProp ?? trainFromStore), [trainProp, trainFromStore]);

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : (train && train.lastUpdatedAt ? Date.parse(train.lastUpdatedAt) : null);
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleClose = useCallback(() => { if (typeof onClose === 'function') onClose(); }, [onClose]);

  const content = (
    <div className={`train-detail ${isStale ? 'train-detail--stale' : ''} ${error ? 'train-detail--error' : ''}`}>
      <StatusRow train={train} loading={loading} refreshing={refreshing} syncing={syncing} error={error} isStale={isStale} />
      <DetailBody train={train} compact={compact} />
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Detail')}
        header={null}
        left={content}
        right={null}
        loading={loading}
        empty={!train}
        error={Boolean(error)}
        onClose={handleClose}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Detail')}
        kpiStrip={(
          <div className="train-detail__kpis">
            <span className="train-kpi">Platform: {train?.platform ?? '—'}</span>
            <span className="train-kpi">Status: {train?.status ?? '—'}</span>
            <span className="train-kpi">ETA: {formatWhen(train?.eta ?? train?.etd ?? train?.lastUpdatedAt) || '—'}</span>
          </div>
        )}
        loading={loading}
        empty={!train}
        error={Boolean(error)}
        onClose={handleClose}
      >
        {content}
      </DashboardLayout>
    );
  }

  return content;
});

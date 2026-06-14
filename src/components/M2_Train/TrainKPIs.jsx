import React, { memo, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * KPI strip for Module-2 Train Operations. Displays small, focused metrics
 * for a single train (status, platform, ETA, delay, last update). Reads
 * all presentation state from `useTrainStore` selectors only and does not
 * perform any store mutations.
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
 * - `staleThreshold` (number): ms to consider data stale (default 60000)
 * - `compact` (boolean): compact visual mode (default true)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getTrainById`, `getSelectedTrain`, `getTrainSummary`
 */

function formatWhen(iso) {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString();
  } catch (e) {
    return '—';
  }
}

function KPI({ label, value }) {
  return (
    <div className="train-kpi">
      <div className="train-kpi__value">{value ?? '—'}</div>
      <div className="train-kpi__label">{label}</div>
    </div>
  );
}

export default memo(function TrainKPIs({ trainId = null, train: trainProp = null, layout = null, title = null, staleThreshold = 60000, compact = true }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);

  const trainFromStore = useTrainStore((s) => (trainId ? s.getTrainById(trainId) : s.getSelectedTrain()));
  const summaryFromStore = useTrainStore((s) => (typeof s.getTrainSummary === 'function' ? s.getTrainSummary(trainId ?? (trainFromStore && (trainFromStore.id ?? trainFromStore))) : null));

  const train = useMemo(() => (trainProp ?? trainFromStore), [trainProp, trainFromStore]);
  const summary = useMemo(() => (summaryFromStore || (train && train.summary) || null), [summaryFromStore, train]);

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : (train && train.lastUpdatedAt ? Date.parse(train.lastUpdatedAt) : null);
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const kpis = useMemo(() => {
    const items = [];
    items.push({ label: 'Status', value: train?.status ?? summary?.status ?? '—' });
    items.push({ label: 'Platform', value: train?.platform ?? summary?.platform ?? '—' });
    items.push({ label: 'ETA', value: formatWhen(train?.eta ?? summary?.eta ?? train?.etd ?? summary?.etd ?? train?.lastUpdatedAt) });
    items.push({ label: 'Delay', value: summary?.delay != null ? `${summary.delay}m` : (train?.delay != null ? `${train.delay}m` : '—') });
    items.push({ label: 'Last', value: formatWhen(lastUpdatedAt ?? train?.lastUpdatedAt) });
    return items;
  }, [train, summary, lastUpdatedAt]);

  const content = (
    <div className={`train-kpis ${compact ? 'train-kpis--compact' : ''} ${isStale ? 'train-kpis--stale' : ''} ${error ? 'train-kpis--error' : ''}`} aria-live="polite">
      <div className="train-kpis__status-row">
        {loading && <span className="train-pill">Loading</span>}
        {refreshing && <span className="train-pill">Refreshing</span>}
        {syncing && <span className="train-pill train-pill--live">Live</span>}
        {isStale && <span className="train-pill train-pill--stale">Stale</span>}
        {error && <span className="train-pill train-pill--error">Error</span>}
      </div>
      <div className="train-kpis__list">
        {kpis.map((k) => <KPI key={k.label} label={k.label} value={k.value} />)}
      </div>
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train KPIs')}
        header={null}
        left={content}
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
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train KPIs')}
        kpiStrip={content}
        loading={loading}
        empty={!train}
        error={Boolean(error)}
      />
    );
  }

  return content;
});

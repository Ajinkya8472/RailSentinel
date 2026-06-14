import React, { memo, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * `TrainBoard` is the Module-2 train operations overview component. It
 * displays a list of trains and a detail panel, intended for use within the
 * operational dashboard or split investigation workspace. The component
 * consumes live presentation state from the canonical `useTrainStore` only
 * and surfaces loading, empty, stale, error, and live-update states.
 *
 * Dependencies:
 * - React
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx`
 * - `src/store/trainStore` (Zustand hook) — selectors and simple actions
 *
 * Props:
 * - `layout` ('dashboard'|'split'): layout variant to render (default 'dashboard')
 * - `title` (string): optional title override
 * - `staleThreshold` (number): ms to consider data stale (default: 60000)
 * - `onSelect` (fn): optional callback when a train is selected
 * - `header` (node): optional header slot content for the layouts
 * - `kpi` (node): optional KPI strip for `DashboardLayout`
 * - `compact` (boolean): compact row rendering (default: false)
 *
 * State (exposed):
 * - Derived from `useTrainStore`: `trains`, `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `selectedTrain`
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

function TrainRow({ train, compact, isSelected, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick && onClick(); }}
      className={['train-row', compact ? 'train-row--compact' : null, isSelected ? 'train-row--selected' : null].filter(Boolean).join(' ')}
      aria-pressed={isSelected}
    >
      <div className="train-row__meta">
        <div className="train-row__id">{train.number ?? train.id}</div>
        <div className="train-row__route">{train.origin ?? ''} → {train.destination ?? ''}</div>
      </div>
      <div className="train-row__attrs">
        <div className="train-row__status">{train.status ?? 'unknown'}</div>
        <div className="train-row__platform">{train.platform ?? ''}</div>
        <div className="train-row__when">{formatWhen(train.lastUpdatedAt ?? train.eta ?? train.etd)}</div>
      </div>
    </div>
  );
}

function TrainDetail({ train }) {
  if (!train) {
    return (
      <div className="train-detail__empty">Select a train to view details.</div>
    );
  }

  return (
    <article className="train-detail" aria-live="polite">
      <h2 className="train-detail__title">{train.number ? `Train ${train.number}` : train.id}</h2>
      <div className="train-detail__meta">
        <span className="train-detail__status">Status: {train.status ?? 'unknown'}</span>
        <span className="train-detail__platform">Platform: {train.platform ?? '—'}</span>
        <span className="train-detail__when">ETA: {formatWhen(train.eta ?? train.etd)}</span>
      </div>
      <div className="train-detail__body">
        <p>{train.notes ?? train.description ?? 'No additional information.'}</p>
      </div>
    </article>
  );
}

function TrainList({ trains, compact, selectedId, onSelect }) {
  if (!Array.isArray(trains) || trains.length === 0) {
    return <div className="train-list__empty">No trains match the current filters.</div>;
  }

  return (
    <div className="train-list" role="list">
      {trains.map((t) => (
        <div role="listitem" key={t.id}>
          <TrainRow train={t} compact={compact} isSelected={selectedId === t.id} onClick={() => onSelect && onSelect(t)} />
        </div>
      ))}
    </div>
  );
}

function TrainBoard({ layout = 'dashboard', title, staleThreshold = 60000, onSelect, header = null, kpi = null, compact = false }) {
  const trains = useTrainStore((s) => s.getVisibleTrains());
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);
  const selected = useTrainStore((s) => s.getSelectedTrain());
  const selectTrain = useTrainStore((s) => s.selectTrain);

  const summary = useTrainStore((s) => s.getTrainSummary());

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleSelect = useCallback((train) => {
    if (!train) return;
    try {
      selectTrain(train.id);
    } catch (e) {
      // ignore
    }
    if (typeof onSelect === 'function') onSelect(train);
  }, [onSelect, selectTrain]);

  const headerSlot = (
    <div className="train-board__header-slot">
      {header}
      <div className="train-board__status">
        {loading ? <span className="train-board__pill">Loading</span> : null}
        {refreshing ? <span className="train-board__pill">Refreshing</span> : null}
        {syncing ? <span className="train-board__pill">Live</span> : null}
        {isStale ? <span className="train-board__pill">Stale</span> : null}
        {error ? <span className="train-board__pill train-board__pill--error">Error</span> : null}
      </div>
    </div>
  );

  const primary = (
    <div className="train-board__main">
      <div className="train-board__summary">
        <div className="train-board__summary-count">{summary?.total ?? trains.length} trains</div>
        <div className="train-board__summary-last">Last update: {formatWhen(lastUpdatedAt)}</div>
      </div>

      <TrainList trains={trains} compact={compact} selectedId={selected?.id ?? null} onSelect={handleSelect} />
    </div>
  );

  const secondary = (
    <div className="train-board__panel">
      <TrainDetail train={selected} />
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? 'Trains'}
        header={headerSlot}
        left={primary}
        right={secondary}
        loading={loading}
        empty={Array.isArray(trains) && trains.length === 0}
        error={Boolean(error)}
        success={!loading && !error && !(Array.isArray(trains) && trains.length === 0)}
      />
    );
  }

  return (
    <DashboardLayout
      title={title ?? 'Trains'}
      header={headerSlot}
      kpiStrip={kpi}
      primary={primary}
      secondary={secondary}
      loading={loading}
      empty={Array.isArray(trains) && trains.length === 0}
      error={Boolean(error)}
      success={!loading && !error && !(Array.isArray(trains) && trains.length === 0)}
    />
  );
}

export default memo(TrainBoard);

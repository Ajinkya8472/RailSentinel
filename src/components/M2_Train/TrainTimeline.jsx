import React, { memo, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * Render a chronological timeline of events for a single train. Designed for
 * Module-2 Train Operations, the component displays event entries (status
 * changes, location updates, ETA/ETD changes) sourced from the canonical
 * `useTrainStore` selectors only. It supports being used standalone or
 * wrapped by `DashboardLayout` or `SplitPanelLayout` and exposes loading,
 * empty, stale, error, and live-update indicators for the surrounding layout.
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
 * - `maxEvents` (number): maximum events to show (default: 50)
 * - `compact` (boolean): compact visual mode (default: false)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getTrainById`, `getSelectedTrain`
 */

function formatWhen(ts) {
  try {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch (e) {
    return '';
  }
}

function EventList({ events = [], compact = false, maxEvents = 50 }) {
  if (!events || events.length === 0) return <div className="train-timeline__empty">No events</div>;
  const slice = events.slice(0, maxEvents);
  return (
    <ol className={`train-timeline__list ${compact ? 'train-timeline__list--compact' : ''}`}>
      {slice.map((ev, idx) => (
        <li key={ev.id ?? `${ev.ts}-${idx}`} className="train-timeline__item">
          <div className="train-timeline__ts">{formatWhen(ev.ts ?? ev.t ?? ev.time)}</div>
          <div className="train-timeline__content">
            <div className="train-timeline__event">{ev.event ?? ev.message ?? ev.type}</div>
            {ev.meta ? <div className="train-timeline__meta">{JSON.stringify(ev.meta)}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default memo(function TrainTimeline({ trainId = null, train: trainProp = null, layout = null, title = null, staleThreshold = 60000, maxEvents = 50, compact = false }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);

  const trainFromStore = useTrainStore((s) => (trainId ? s.getTrainById(trainId) : s.getSelectedTrain()));
  const train = useMemo(() => (trainProp ?? trainFromStore), [trainProp, trainFromStore]);

  // Gather timeline events from train model fields commonly used in Train domain
  const events = useMemo(() => {
    if (!train) return [];
    const out = [];
    if (Array.isArray(train.events)) out.push(...train.events);
    if (Array.isArray(train.audit)) out.push(...train.audit.map((a) => ({ id: a.id, ts: a.ts || a.time, event: a.message || a.event, meta: a }))); // normalize
    if (train.history && Array.isArray(train.history)) out.push(...train.history);
    // Some stores include `timeline` as canonical
    if (Array.isArray(train.timeline)) out.push(...train.timeline);
    // Sort descending (newest first)
    out.sort((a, b) => (new Date(b.ts || b.t || b.time).getTime() - new Date(a.ts || a.t || a.time).getTime()));
    return out;
  }, [train]);

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : (train && train.lastUpdatedAt ? Date.parse(train.lastUpdatedAt) : null);
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const content = (
    <div className={`train-timeline ${isStale ? 'train-timeline--stale' : ''} ${error ? 'train-timeline--error' : ''}`} aria-live="polite">
      <div className="train-timeline__header">
        {loading && <span className="train-pill">Loading</span>}
        {refreshing && <span className="train-pill">Refreshing</span>}
        {syncing && <span className="train-pill train-pill--live">Live</span>}
        {isStale && <span className="train-pill train-pill--stale">Stale</span>}
        {error && <span className="train-pill train-pill--error">Error</span>}
        <div className="train-timeline__title">{title ?? (train ? `Timeline — ${train.number ?? train.id}` : 'Train Timeline')}</div>
      </div>

      <EventList events={events} compact={compact} maxEvents={maxEvents} />
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Timeline')}
        header={null}
        left={content}
        right={null}
        loading={loading}
        empty={!train || events.length === 0}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (train ? `Train ${train.number ?? train.id}` : 'Train Timeline')}
        kpiStrip={(
          <div className="train-timeline__kpi-strip">
            <span className="train-kpi">Events: {events.length}</span>
            <span className="train-kpi">Status: {train?.status ?? '—'}</span>
            <span className="train-kpi">Last: {formatWhen(lastUpdatedAt ?? train?.lastUpdatedAt) || '—'}</span>
          </div>
        )}
        loading={loading}
        empty={!train || events.length === 0}
        error={Boolean(error)}
      >
        {content}
      </DashboardLayout>
    );
  }

  return content;
});

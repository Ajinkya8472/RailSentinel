import React, { memo, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * Render an incident timeline for Module-1 workflows. The component reads the
 * canonical incident model from `useIncidentStore` (by id or selected) and
 * displays ordered timeline events with presentation states for loading,
 * empty, stale, error and live updates. It can be used as a standalone
 * region or wrapped by `DashboardLayout` / `SplitPanelLayout`.
 *
 * Dependencies:
 * - React
 * - `src/store/incidentStore` selectors only
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `incidentId` (string|number|null): explicit incident id to render (optional)
 * - `incident` (object|null): incident model to render instead of store lookup (optional)
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout (default: null)
 * - `title` (string): optional layout title
 * - `staleThreshold` (number): milliseconds to consider list stale (default: 60000)
 * - `onEventClick` (fn): callback when a timeline event is activated
 * - `limit` (number|null): maximum events to show (default: null = all)
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

function TimelineItem({ ev, onClick }) {
  return (
    <li className="incident-timeline__item" role="article">
      <div className="incident-timeline__ts">{formatWhen(ev.ts ?? ev.timestamp ?? ev.at)}</div>
      <div className="incident-timeline__payload">
        <div className="incident-timeline__title">{ev.title ?? ev.event ?? ev.type ?? 'Event'}</div>
        {ev.message || ev.note ? <div className="incident-timeline__message">{ev.message ?? ev.note}</div> : null}
        <div className="incident-timeline__meta">
          {ev.actor ? <span className="incident-timeline__actor">{ev.actor}</span> : null}
          {ev.source ? <span className="incident-timeline__source">{ev.source}</span> : null}
        </div>
      </div>
      {onClick ? (
        <button type="button" className="incident-timeline__action" onClick={() => onClick(ev)} aria-label="Open event details">Open</button>
      ) : null}
    </li>
  );
}

function IncidentTimelineList({ events = [], limit = null, onEventClick = null }) {
  if (!Array.isArray(events) || events.length === 0) {
    return <div className="incident-timeline__empty">No timeline events.</div>;
  }

  const shown = limit && Number.isFinite(Number(limit)) ? events.slice(0, Number(limit)) : events;

  return (
    <ol className="incident-timeline__list" aria-live="polite">
      {shown.map((ev, idx) => (
        <TimelineItem key={ev.id ?? ev.ts ?? idx} ev={ev} onClick={onEventClick} />
      ))}
    </ol>
  );
}

export default memo(function IncidentTimeline({ incidentId = null, incident: incidentProp = null, layout = null, title = null, staleThreshold = 60000, onEventClick = null, limit = null }) {
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const syncing = useIncidentStore((s) => s.syncing);
  const error = useIncidentStore((s) => s.error);
  const lastUpdatedAt = useIncidentStore((s) => s.lastUpdatedAt);

  const incidentFromStore = useIncidentStore((s) => (incidentId ? s.getIncidentById(incidentId) : s.getSelectedIncident()));
  const incident = incidentProp ?? incidentFromStore;

  const events = useMemo(() => {
    if (!incident) return [];
    const raw = Array.isArray(incident.timeline) ? incident.timeline : Array.isArray(incident.events) ? incident.events : incident.activity ?? [];
    // Normalize to objects and sort newest-first by timestamp-like keys
    const normalized = raw
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({ ...x }))
      .sort((a, b) => String(b.ts ?? b.timestamp ?? b.at ?? '').localeCompare(String(a.ts ?? a.timestamp ?? a.at ?? '')));
    return normalized;
  }, [incident]);

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleEventClick = useCallback((ev) => {
    if (typeof onEventClick === 'function') onEventClick(ev);
  }, [onEventClick]);

  const statusProps = {
    loading: Boolean(loading),
    empty: !incident || events.length === 0,
    error: Boolean(error),
    success: !loading && !error && Boolean(incident) && events.length > 0,
  };

  const body = <IncidentTimelineList events={events} limit={limit} onEventClick={handleEventClick} />;

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (incident ? `${incident.title} — Timeline` : 'Timeline')}
        header={null}
        left={null}
        right={body}
        loading={statusProps.loading}
        empty={statusProps.empty}
        error={statusProps.error}
        success={statusProps.success}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (incident ? `${incident.title} — Timeline` : 'Timeline')}
        header={null}
        primary={body}
        loading={statusProps.loading}
        empty={statusProps.empty}
        error={statusProps.error}
        success={statusProps.success}
      />
    );
  }

  return (
    <section className={[ 'incident-timeline', isStale ? 'incident-timeline--stale' : null, error ? 'incident-timeline--error' : null ].filter(Boolean).join(' ')}>
      <header className="incident-timeline__header">
        <h3 className="incident-timeline__title">{title ?? 'Timeline'}</h3>
        <div className="incident-timeline__status">
          {loading ? <span className="incident-timeline__pill">Loading</span> : null}
          {refreshing ? <span className="incident-timeline__pill">Refreshing</span> : null}
          {syncing ? <span className="incident-timeline__pill">Live</span> : null}
          {isStale ? <span className="incident-timeline__pill">Stale</span> : null}
          {error ? <span className="incident-timeline__pill incident-timeline__pill--error">Error</span> : null}
        </div>
      </header>

      {body}
    </section>
  );
});

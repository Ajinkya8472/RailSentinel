import React, { memo, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * Compact incident card component for Module-1 incident management. Presents a
 * concise incident summary suitable for dashboard KPI strips, tile views, or a
 * minimal investigation card. Reads all presentation state from the canonical
 * `useIncidentStore` and exposes consistent loading, empty, stale, error, and
 * live-update visuals. Can optionally wrap itself inside `DashboardLayout`
 * or `SplitPanelLayout` to be used directly as a layout region.
 *
 * Dependencies:
 * - React
 * - `src/store/incidentStore` (Zustand hook) for all selectors/actions
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx` for optional wrapping
 *
 * Props:
 * - `incidentId` (string|number): id of the incident to render (preferred)
 * - `incident` (object): optional incident object to render instead of store lookup
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout (default: null)
 * - `title` (string): optional title when wrapped in a layout
 * - `staleThreshold` (number): ms to consider data stale (default: 60000)
 * - `onOpen` (fn): called when the card is activated/selected
 * - `compact` (boolean): render compact visual (default: true)
 *
 * State (exposed):
 * - Derived from `useIncidentStore`: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, and selectors to read the target incident or summary
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

function CardBody({ incident, compact }) {
  if (!incident) {
    return (
      <div className="incident-card__empty">No incident selected.</div>
    );
  }

  return (
    <div className={['incident-card__body', compact ? 'incident-card__body--compact' : null].filter(Boolean).join(' ')}>
      <div className="incident-card__header">
        <div className="incident-card__title">{incident.title ?? 'Untitled'}</div>
        <div className="incident-card__severity">{incident.severity ?? 'n/a'}</div>
      </div>

      <div className="incident-card__meta">
        <span className="incident-card__status">{incident.status ?? 'unknown'}</span>
        <span className="incident-card__when">{formatWhen(incident.lastUpdatedAt ?? incident.createdAt)}</span>
      </div>

      <div className="incident-card__desc">{incident.description ?? ''}</div>
    </div>
  );
}

function IncidentCard({ incidentId = null, incident: incidentProp = null, layout = null, title = null, staleThreshold = 60000, onOpen = null, compact = true }) {
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const syncing = useIncidentStore((s) => s.syncing);
  const error = useIncidentStore((s) => s.error);
  const lastUpdatedAt = useIncidentStore((s) => s.lastUpdatedAt);
  const selectIncident = useIncidentStore((s) => s.selectIncident);

  const incidentFromStore = useIncidentStore((s) => (incidentId ? s.getIncidentById(incidentId) : null));

  const incident = incidentProp ?? incidentFromStore;

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleOpen = useCallback(() => {
    if (!incident) return;
    try {
      selectIncident(incident.id);
    } catch (e) {
      // ignore
    }
    if (typeof onOpen === 'function') onOpen(incident);
  }, [incident, onOpen, selectIncident]);

  const card = useMemo(() => (
    <div className={['incident-card', isStale ? 'incident-card--stale' : null, error ? 'incident-card--error' : null].filter(Boolean).join(' ')} role="group" aria-live="polite">
      <div className="incident-card__status-bar">
        {loading ? <span className="incident-card__pill">Loading</span> : null}
        {refreshing ? <span className="incident-card__pill">Refreshing</span> : null}
        {syncing ? <span className="incident-card__pill">Live</span> : null}
        {isStale ? <span className="incident-card__pill">Stale</span> : null}
        {error ? <span className="incident-card__pill incident-card__pill--error">Error</span> : null}
      </div>

      <button type="button" className="incident-card__content" onClick={handleOpen} onKeyDown={(e) => { if (e.key === 'Enter') handleOpen(); }}>
        <CardBody incident={incident} compact={compact} />
      </button>
    </div>
  ), [incident, compact, loading, refreshing, syncing, isStale, error, handleOpen]);

  const empty = !incident;

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (incident ? incident.title : 'Incident')}
        left={card}
        right={null}
        loading={loading}
        empty={empty}
        error={Boolean(error)}
        success={!loading && !error && !empty}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (incident ? incident.title : 'Incident')}
        primary={card}
        loading={loading}
        empty={empty}
        error={Boolean(error)}
        success={!loading && !error && !empty}
      />
    );
  }

  return card;
}

export default memo(IncidentCard);

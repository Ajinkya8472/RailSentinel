import React, { memo, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * IncidentBoard is the Module-1 incident management overview component. It
 * renders a compact incident list and an optional detail panel, compatible
 * with `DashboardLayout` and `SplitPanelLayout`. The component reads all live
 * presentation state from the canonical `useIncidentStore` selectors and
 * reflects loading, empty, stale, error, and live-update states.
 *
 * Dependencies:
 * - React
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx`
 * - `src/store/incidentStore` (Zustand hook) — selectors + simple actions
 *
 * Props:
 * - `layout` ('dashboard'|'split'): layout variant to render (default: 'dashboard')
 * - `title` (string): optional layout title override
 * - `staleThreshold` (number): ms to consider data stale (default: 60000)
 * - `onSelect` (fn): optional callback when an incident is selected
 * - `header` (node): optional header slot content for the layouts
 * - `kpi` (node): optional KPI strip for `DashboardLayout`
 * - `compact` (boolean): render compact rows (default: false)
 *
 * State (exposed):
 * - Presentation derived from `useIncidentStore`: `incidents`, `loading`, `refreshing`, `error`, `syncing`, `lastUpdatedAt`, `selectedIncident`
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

function IncidentRow({ incident, compact, isSelected, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick && onClick(); }}
      className={['incident-row', compact ? 'incident-row--compact' : null, isSelected ? 'incident-row--selected' : null].filter(Boolean).join(' ')}
      aria-pressed={isSelected}
    >
      <div className="incident-row__meta">
        <div className="incident-row__title">{incident.title ?? 'Untitled incident'}</div>
        <div className="incident-row__subtitle">{incident.locationName ?? incident.type ?? ''}</div>
      </div>
      <div className="incident-row__attrs">
        <div className="incident-row__severity">{incident.severity ?? 'n/a'}</div>
        <div className="incident-row__status">{incident.status ?? 'unknown'}</div>
        <div className="incident-row__when">{formatWhen(incident.lastUpdatedAt ?? incident.createdAt)}</div>
      </div>
    </div>
  );
}

function IncidentDetail({ incident }) {
  if (!incident) {
    return (
      <div className="incident-detail__empty">
        Select an incident to view details.
      </div>
    );
  }

  return (
    <article className="incident-detail" aria-live="polite">
      <h2 className="incident-detail__title">{incident.title}</h2>
      <div className="incident-detail__meta">
        <span className="incident-detail__severity">Severity: {incident.severity ?? 'n/a'}</span>
        <span className="incident-detail__status">Status: {incident.status ?? 'unknown'}</span>
        <span className="incident-detail__when">Updated: {formatWhen(incident.lastUpdatedAt ?? incident.createdAt)}</span>
      </div>
      <div className="incident-detail__body">
        <p>{incident.description ?? 'No description provided.'}</p>
      </div>
    </article>
  );
}

function IncidentList({ incidents, compact, selectedId, onSelect }) {
  if (!Array.isArray(incidents) || incidents.length === 0) {
    return <div className="incident-list__empty">No incidents match the current filters.</div>;
  }

  return (
    <div className="incident-list" role="list">
      {incidents.map((inc) => (
        <div role="listitem" key={inc.id}>
          <IncidentRow
            incident={inc}
            compact={compact}
            isSelected={selectedId === inc.id}
            onClick={() => onSelect && onSelect(inc)}
          />
        </div>
      ))}
    </div>
  );
}

function IncidentBoard({ layout = 'dashboard', title, staleThreshold = 60000, onSelect, header = null, kpi = null, compact = false }) {
  const incidents = useIncidentStore((s) => s.getVisibleIncidents());
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const syncing = useIncidentStore((s) => s.syncing);
  const error = useIncidentStore((s) => s.error);
  const lastUpdatedAt = useIncidentStore((s) => s.lastUpdatedAt);
  const selected = useIncidentStore((s) => s.getSelectedIncident());
  const selectIncident = useIncidentStore((s) => s.selectIncident);

  const summary = useIncidentStore((s) => s.getIncidentSummary());

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleSelect = useCallback((incident) => {
    if (!incident) return;
    try {
      selectIncident(incident.id);
    } catch (e) {
      // ignore store action errors
    }
    if (typeof onSelect === 'function') onSelect(incident);
  }, [onSelect, selectIncident]);

  const headerSlot = (
    <div className="incident-board__header-slot">
      {header}
      <div className="incident-board__status">
        {loading ? <span className="incident-board__pill">Loading</span> : null}
        {refreshing ? <span className="incident-board__pill">Refreshing</span> : null}
        {syncing ? <span className="incident-board__pill">Live</span> : null}
        {isStale ? <span className="incident-board__pill">Stale</span> : null}
        {error ? <span className="incident-board__pill incident-board__pill--error">Error</span> : null}
      </div>
    </div>
  );

  const primary = (
    <div className="incident-board__main">
      <div className="incident-board__summary">
        <div className="incident-board__summary-count">{summary?.total ?? incidents.length} incidents</div>
        <div className="incident-board__summary-last">Last update: {formatWhen(lastUpdatedAt)}</div>
      </div>

      <IncidentList incidents={incidents} compact={compact} selectedId={selected?.id ?? null} onSelect={handleSelect} />
    </div>
  );

  const secondary = (
    <div className="incident-board__panel">
      <IncidentDetail incident={selected} />
    </div>
  );

  // Render based on chosen layout
  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? 'Incidents'}
        header={headerSlot}
        left={primary}
        right={secondary}
        loading={loading}
        empty={Array.isArray(incidents) && incidents.length === 0}
        error={Boolean(error)}
        success={!loading && !error && !(Array.isArray(incidents) && incidents.length === 0)}
      />
    );
  }

  // default to dashboard
  return (
    <DashboardLayout
      title={title ?? 'Incidents'}
      header={headerSlot}
      kpiStrip={kpi}
      primary={primary}
      secondary={secondary}
      loading={loading}
      empty={Array.isArray(incidents) && incidents.length === 0}
      error={Boolean(error)}
      success={!loading && !error && !(Array.isArray(incidents) && incidents.length === 0)}
    />
  );
}

export default memo(IncidentBoard);

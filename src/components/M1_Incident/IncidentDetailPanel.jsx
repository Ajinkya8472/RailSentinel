import React, { memo, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * Detailed incident panel for Module-1 incident workflows. Presents full
 * incident metadata, timeline, and actions in an accessible panel suitable
 * for embedding inside `DashboardLayout` or `SplitPanelLayout`.
 *
 * Dependencies:
 * - React
 * - `src/store/incidentStore` (Zustand hook) for canonical incident selectors/actions
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx` for optional wrapping
 *
 * Props:
 * - `incidentId` (string|number|null): id to render; if omitted, uses store's selected incident
 * - `incident` (object|null): optional incident model to render instead of store lookup
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout; default null
 * - `title` (string|null): optional layout title override
 * - `staleThreshold` (number): ms after which data is considered stale (default 60000)
 * - `onClose` (fn): optional callback invoked when the panel requests close
 * - `onRefresh` (fn): optional callback to trigger refresh; component does not call services
 * - `showActions` (boolean): whether to render action buttons (default: true)
 *
 * State:
 * - Derived from `useIncidentStore`: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, and selected/target incident
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

function TimelineItem({ item }) {
  if (!item) return null;
  return (
    <li className="incident-detail__timeline-item">
      <div className="incident-detail__timeline-ts">{formatWhen(item.ts ?? item.timestamp)}</div>
      <div className="incident-detail__timeline-msg">{item.message ?? item.note ?? JSON.stringify(item)}</div>
    </li>
  );
}

function DetailBody({ incident }) {
  if (!incident) {
    return <div className="incident-detail__empty">No incident selected.</div>;
  }

  const timeline = Array.isArray(incident.timeline) ? incident.timeline : incident.events ?? [];

  return (
    <div className="incident-detail__content">
      <section className="incident-detail__overview">
        <h2 className="incident-detail__title">{incident.title ?? 'Untitled incident'}</h2>
        <div className="incident-detail__meta">
          <span className="incident-detail__severity">Severity: {incident.severity ?? 'n/a'}</span>
          <span className="incident-detail__status">Status: {incident.status ?? 'unknown'}</span>
          <span className="incident-detail__when">Last updated: {formatWhen(incident.lastUpdatedAt ?? incident.createdAt)}</span>
        </div>
        <div className="incident-detail__location">{incident.locationName ?? incident.location ?? 'Unknown location'}</div>
        <div className="incident-detail__desc">{incident.description ?? 'No description available.'}</div>
      </section>

      <section className="incident-detail__timeline" aria-label="Incident timeline">
        <h3 className="incident-detail__timeline-title">Timeline</h3>
        {timeline && timeline.length > 0 ? (
          <ol className="incident-detail__timeline-list">
            {timeline.map((t, i) => (
              <TimelineItem key={t.id ?? t.ts ?? i} item={t} />
            ))}
          </ol>
        ) : (
          <div className="incident-detail__timeline-empty">No timeline events.</div>
        )}
      </section>
    </div>
  );
}

function IncidentDetailPanel({ incidentId = null, incident: incidentProp = null, layout = null, title = null, staleThreshold = 60000, onClose = null, onRefresh = null, showActions = true }) {
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const syncing = useIncidentStore((s) => s.syncing);
  const error = useIncidentStore((s) => s.error);
  const lastUpdatedAt = useIncidentStore((s) => s.lastUpdatedAt);
  const clearSelection = useIncidentStore((s) => s.clearSelection);
  const incidentFromStore = useIncidentStore((s) => (incidentId ? s.getIncidentById(incidentId) : s.getSelectedIncident()));

  const incident = incidentProp ?? incidentFromStore;

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleClose = useCallback(() => {
    try {
      clearSelection();
    } catch (e) {
      // ignore
    }
    if (typeof onClose === 'function') onClose();
  }, [clearSelection, onClose]);

  const handleRefresh = useCallback(() => {
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  }, [onRefresh]);

  const header = useMemo(() => (
    <div className="incident-detail__header">
      <div className="incident-detail__title-slot">{title ?? (incident ? incident.title : 'Incident detail')}</div>
      <div className="incident-detail__controls">
        {showActions ? (
          <>
            <button type="button" className="incident-detail__btn" onClick={handleRefresh} aria-label="Refresh incident">Refresh</button>
            <button type="button" className="incident-detail__btn incident-detail__btn--close" onClick={handleClose} aria-label="Close detail">Close</button>
          </>
        ) : null}
      </div>
    </div>
  ), [incident, title, showActions, handleClose, handleRefresh]);

  const body = <DetailBody incident={incident} />;

  const statusProps = {
    loading: Boolean(loading),
    empty: !incident,
    error: Boolean(error),
    success: !loading && !error && Boolean(incident),
  };

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (incident ? incident.title : 'Incident detail')}
        header={header}
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
        title={title ?? (incident ? incident.title : 'Incident detail')}
        header={header}
        primary={body}
        loading={statusProps.loading}
        empty={statusProps.empty}
        error={statusProps.error}
        success={statusProps.success}
      />
    );
  }

  return (
    <div className={["incident-detail-panel", isStale ? 'incident-detail-panel--stale' : null, error ? 'incident-detail-panel--error' : null].filter(Boolean).join(' ')}>
      {header}
      {body}
    </div>
  );
}

export default memo(IncidentDetailPanel);

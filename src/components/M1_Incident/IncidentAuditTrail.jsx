import React, { memo, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * IncidentAuditTrail renders a chronological audit trail for an incident
 * (who changed what and when) using the approved Incident domain model.
 * The component reads state exclusively from `incidentStore` selectors and
 * presents loading, empty, stale, error and live-update states. It can be
 * embedded into `DashboardLayout` or `SplitPanelLayout`.
 *
 * Dependencies:
 * - React
 * - `src/store/incidentStore` (selectors only)
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `incidentId` (string|number|null): explicit incident id (optional)
 * - `incident` (object|null): optional incident object to render instead of store lookup
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout
 * - `title` (string|null): optional title override
 * - `staleThreshold` (number): ms to treat data as stale (default: 60000)
 * - `limit` (number|null): maximum audit entries to show (default: null = all)
 * - `onEntryClick` (fn): optional handler when an audit entry is clicked
 * - `showSystem` (boolean): whether to include system-generated entries (default: true)
 *
 * State:
 * - Derived from `useIncidentStore`: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, and incident lookup selectors
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

function AuditEntry({ entry, onClick }) {
  if (!entry) return null;
  const actor = entry.actor ?? entry.user ?? entry.by ?? 'system';
  const action = entry.action ?? entry.type ?? 'updated';
  const details = entry.details ?? entry.payload ?? entry.change ?? null;

  return (
    <li className="incident-audit__entry" role="article">
      <div className="incident-audit__ts">{formatWhen(entry.ts ?? entry.timestamp ?? entry.at)}</div>
      <div className="incident-audit__body">
        <div className="incident-audit__meta">
          <span className="incident-audit__actor">{actor}</span>
          <span className="incident-audit__action">{action}</span>
        </div>
        {details ? <pre className="incident-audit__details">{typeof details === 'string' ? details : JSON.stringify(details, null, 2)}</pre> : null}
      </div>
      {onClick ? <button type="button" className="incident-audit__open" onClick={() => onClick(entry)}>Open</button> : null}
    </li>
  );
}

export default memo(function IncidentAuditTrail({ incidentId = null, incident: incidentProp = null, layout = null, title = null, staleThreshold = 60000, limit = null, onEntryClick = null, showSystem = true }) {
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const syncing = useIncidentStore((s) => s.syncing);
  const error = useIncidentStore((s) => s.error);
  const lastUpdatedAt = useIncidentStore((s) => s.lastUpdatedAt);

  const incidentFromStore = useIncidentStore((s) => (incidentId ? s.getIncidentById(incidentId) : s.getSelectedIncident()));
  const incident = incidentProp ?? incidentFromStore;

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const raw = incident?.audit ?? incident?.auditTrail ?? incident?.audit_log ?? incident?.events ?? [];

  const entries = useMemo(() => {
    if (!Array.isArray(raw)) return [];
    const normalized = raw
      .filter((e) => e && typeof e === 'object')
      .filter((e) => (showSystem ? true : Boolean(e.actor || e.user || e.by)))
      .map((e) => ({ ...e }))
      .sort((a, b) => String(b.ts ?? b.timestamp ?? b.at ?? '').localeCompare(String(a.ts ?? a.timestamp ?? a.at ?? '')));

    if (limit && Number.isFinite(Number(limit))) return normalized.slice(0, Number(limit));
    return normalized;
  }, [raw, limit, showSystem]);

  const handleEntryClick = useCallback((entry) => {
    if (typeof onEntryClick === 'function') onEntryClick(entry);
  }, [onEntryClick]);

  const statusProps = {
    loading: Boolean(loading),
    empty: !incident || entries.length === 0,
    error: Boolean(error),
    success: !loading && !error && Boolean(incident) && entries.length > 0,
  };

  const body = (
    <div className={[ 'incident-audit', isStale ? 'incident-audit--stale' : null, error ? 'incident-audit--error' : null ].filter(Boolean).join(' ')}>
      <header className="incident-audit__header">
        <h3 className="incident-audit__title">{title ?? 'Audit trail'}</h3>
        <div className="incident-audit__status">
          {loading ? <span className="incident-audit__pill">Loading</span> : null}
          {refreshing ? <span className="incident-audit__pill">Refreshing</span> : null}
          {syncing ? <span className="incident-audit__pill">Live</span> : null}
          {isStale ? <span className="incident-audit__pill">Stale</span> : null}
          {error ? <span className="incident-audit__pill incident-audit__pill--error">Error</span> : null}
        </div>
      </header>

      {statusProps.empty ? (
        <div className="incident-audit__empty">No audit entries available for this incident.</div>
      ) : (
        <ol className="incident-audit__list" aria-live="polite">
          {entries.map((entry, idx) => (
            <AuditEntry key={entry.id ?? entry.ts ?? entry.timestamp ?? idx} entry={entry} onClick={onEntryClick ? handleEntryClick : null} />
          ))}
        </ol>
      )}
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? 'Audit trail'}
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
        title={title ?? 'Audit trail'}
        header={null}
        primary={body}
        loading={statusProps.loading}
        empty={statusProps.empty}
        error={statusProps.error}
        success={statusProps.success}
      />
    );
  }

  return body;
});

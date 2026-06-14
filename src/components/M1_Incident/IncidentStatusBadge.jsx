import React, { memo, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * Small, focused status badge component for Module-1 incidents. Shows the
 * canonical incident status (open/closed/acknowledged/etc) and severity,
 * along with lightweight presentation indicators for loading, stale, error,
 * and live-update states. Designed to be embeddable in dashboards, panels,
 * or card headers and to read state only from the canonical `incidentStore`.
 *
 * Dependencies:
 * - React
 * - `src/store/incidentStore` for selectors only
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx` for optional wrappers
 *
 * Props:
 * - `incidentId` (string|number|null): id of the incident to display (optional)
 * - `incident` (object|null): direct incident object to display instead of store lookup (optional)
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout (default null)
 * - `title` (string|null): optional layout title when wrapped
 * - `staleThreshold` (number): ms considered stale (default: 60000)
 * - `showSeverity` (boolean): show severity chip (default: true)
 * - `compact` (boolean): compact rendering (default: true)
 * - `onClick` (fn): optional click handler for the badge
 *
 * State:
 * - Derived from `useIncidentStore`: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, and incident lookup selectors
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function StatusPill({ status }) {
  const tone = String(status ?? '').toLowerCase();
  return (
    <span className={cx('incident-status-badge__pill', `incident-status-badge__pill--${tone}`)}>
      {String(status ?? '').toUpperCase()}
    </span>
  );
}

function SeverityChip({ severity }) {
  if (!severity) return null;
  return <span className={cx('incident-status-badge__severity', `incident-status-badge__severity--${String(severity).toLowerCase()}`)}>{String(severity)}</span>;
}

function InternalBadge({ incident, loading, refreshing, syncing, error, isStale, compact, showSeverity, onClick }) {
  if (loading) {
    return <div className="incident-status-badge__skeleton">Loading…</div>;
  }

  if (!incident) {
    return <div className="incident-status-badge__empty">—</div>;
  }

  return (
    <div
      role={onClick ? 'button' : 'status'}
      tabIndex={onClick ? 0 : -1}
      className={cx('incident-status-badge', compact ? 'incident-status-badge--compact' : null, error ? 'incident-status-badge--error' : null, isStale ? 'incident-status-badge--stale' : null)}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && e.key === 'Enter') onClick(); }}
      aria-live="polite"
    >
      <div className="incident-status-badge__main">
        <StatusPill status={incident.status} />
        {showSeverity ? <SeverityChip severity={incident.severity} /> : null}
      </div>

      <div className="incident-status-badge__meta">
        {syncing ? <span className="incident-status-badge__meta-pill">Live</span> : null}
        {refreshing ? <span className="incident-status-badge__meta-pill">Refreshing</span> : null}
        {isStale ? <span className="incident-status-badge__meta-pill">Stale</span> : null}
        {error ? <span className="incident-status-badge__meta-pill incident-status-badge__meta-pill--error">Error</span> : null}
      </div>
    </div>
  );
}

export default memo(function IncidentStatusBadge({ incidentId = null, incident: incidentProp = null, layout = null, title = null, staleThreshold = 60000, showSeverity = true, compact = true, onClick = null }) {
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

  const badge = (
    <InternalBadge
      incident={incident}
      loading={loading}
      refreshing={refreshing}
      syncing={syncing}
      error={error}
      isStale={isStale}
      compact={compact}
      showSeverity={showSeverity}
      onClick={() => { if (typeof onClick === 'function') onClick(incident); }}
    />
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? (incident ? `Status — ${incident.title}` : 'Status')}
        header={null}
        left={badge}
        right={null}
        loading={loading}
        empty={!incident}
        error={Boolean(error)}
        success={!loading && !error && Boolean(incident)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? (incident ? `Status — ${incident.title}` : 'Status')}
        kpiStrip={badge}
        loading={loading}
        empty={!incident}
        error={Boolean(error)}
        success={!loading && !error && Boolean(incident)}
      />
    );
  }

  return badge;
});

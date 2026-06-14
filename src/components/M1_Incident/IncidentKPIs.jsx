import React, { memo, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * Render a concise KPI strip for Module-1 Incident Management. The KPI strip
 * surfaces high-level metrics (total, open, critical, avg time-to-resolve)
 * derived from the canonical `incidentStore`. It supports embedding in
 * `DashboardLayout` or `SplitPanelLayout` and presents loading/empty/stale/
 * error/live states.
 *
 * Dependencies:
 * - React
 * - `src/store/incidentStore` selectors only
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx` for optional layout wrapping
 *
 * Props:
 * - `layout` ('dashboard'|'split'|null): wrap the KPI strip in the chosen layout (default null)
 * - `title` (string|null): optional layout title override
 * - `staleThreshold` (number): ms to treat data as stale (default 60000)
 * - `compact` (boolean): render condensed KPI tiles (default false)
 * - `showTrend` (boolean): render simple trend indicators (default true)
 *
 * State:
 * - Derived from `useIncidentStore`: `getIncidentSummary`, `getIncidentCounts`, `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function KpiTile({ label, value, hint, compact }) {
  return (
    <div className={cx('incident-kpi', compact ? 'incident-kpi--compact' : null)} role="group" aria-label={label}>
      <div className="incident-kpi__value">{value}</div>
      <div className="incident-kpi__label">{label}</div>
      {hint ? <div className="incident-kpi__hint">{hint}</div> : null}
    </div>
  );
}

export default memo(function IncidentKPIs({ layout = null, title = null, staleThreshold = 60000, compact = false, showTrend = true }) {
  const summary = useIncidentStore((s) => s.getIncidentSummary());
  const counts = useIncidentStore((s) => s.getIncidentCounts());
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const syncing = useIncidentStore((s) => s.syncing);
  const error = useIncidentStore((s) => s.error);
  const lastUpdatedAt = useIncidentStore((s) => s.lastUpdatedAt);

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  // derive avg time-to-resolve if available on the summary; otherwise null
  const avgTTR = useMemo(() => {
    if (!summary) return null;
    // if the store exposes an average resolve time in seconds or ms, honor it
    if (summary.avgResolveMs) return `${Math.round(summary.avgResolveMs / 1000)}s`;
    if (summary.avgResolveSec) return `${Math.round(summary.avgResolveSec)}s`;
    return null;
  }, [summary]);

  const kpis = useMemo(() => [
    { label: 'Total', value: counts?.total ?? 0, hint: null },
    { label: 'Open', value: counts?.byStatus?.open ?? 0, hint: showTrend ? null : null },
    { label: 'Critical', value: counts?.bySeverity?.critical ?? 0, hint: null },
    { label: 'Avg TTR', value: avgTTR ?? '—', hint: null },
  ], [counts, avgTTR, showTrend]);

  const statusBar = (
    <div className="incident-kpi__status">
      {loading ? <span className="incident-kpi__pill">Loading</span> : null}
      {refreshing ? <span className="incident-kpi__pill">Refreshing</span> : null}
      {syncing ? <span className="incident-kpi__pill">Live</span> : null}
      {isStale ? <span className="incident-kpi__pill">Stale</span> : null}
      {error ? <span className="incident-kpi__pill incident-kpi__pill--error">Error</span> : null}
    </div>
  );

  const strip = (
    <div className={cx('incident-kpi-strip', compact ? 'incident-kpi-strip--compact' : null)}>
      <div className="incident-kpi__header">
        <div className="incident-kpi__title">{title ?? 'Incident KPIs'}</div>
        {statusBar}
      </div>

      <div className="incident-kpi__tiles" role="list">
        {kpis.map((k) => (
          <div role="listitem" key={k.label}>
            <KpiTile label={k.label} value={k.value} hint={k.hint} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? 'Incidents KPIs'}
        header={null}
        left={strip}
        right={null}
        loading={loading}
        empty={false}
        error={Boolean(error)}
        success={!loading && !error}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? 'Incidents KPIs'}
        kpiStrip={strip}
        loading={loading}
        empty={false}
        error={Boolean(error)}
        success={!loading && !error}
      />
    );
  }

  return strip;
});

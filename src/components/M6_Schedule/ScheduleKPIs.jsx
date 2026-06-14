import React, { memo, useMemo } from 'react';

/**
 * Purpose:
 * ScheduleKPIs — aggregate KPI tile bar for Module-6 Smart Scheduling.
 * Computes eight key performance indicators from the `conflicts` prop array:
 *
 *   1. Total Conflicts       — total count
 *   2. Critical              — severity: 'critical' count
 *   3. Unresolved            — status ≠ 'resolved' count
 *   4. Escalated             — escalationLevel > 0 count
 *   5. Pending Approval      — resolutionStatus: 'pending' count
 *   6. Avg Impact Score      — mean `impactScore` across all conflicts
 *   7. Trains Affected       — unique `conflictingTrainIds` count
 *   8. Route Segments        — unique `affectedRouteSegments` count
 *
 * Caller sources `conflicts` from scheduleService. Zero store reads.
 *
 * Dependencies:
 * - React (memo, useMemo)
 *
 * Props:
 * - `conflicts`    (object[])  — ScheduleConflict array (default: [])
 * - `loading`      (boolean)   (default: false)
 * - `refreshing`   (boolean)   (default: false)
 * - `syncing`      (boolean)   (default: false)
 * - `error`        (any)       (default: null)
 * - `isStale`      (boolean)   (default: false)
 * - `compact`      (boolean)   (default: false)
 *
 * State: all derived via useMemo — zero mutations.
 */

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

function computeKPIs(conflicts) {
  let critical = 0, unresolved = 0, escalated = 0, pending = 0;
  const trainIds   = new Set();
  const routeSegs  = new Set();
  const scores     = [];

  for (const c of conflicts) {
    const sev    = String(c.severity ?? '').toLowerCase();
    const status = String(c.status   ?? '').toLowerCase();
    const resSt  = String(c.resolutionStatus ?? '').toLowerCase();
    const escLvl = Number(c.escalationLevel ?? 0);

    if (sev === 'critical')            critical   += 1;
    if (status !== 'resolved')         unresolved += 1;
    if (escLvl > 0)                    escalated  += 1;
    if (resSt === 'pending')           pending    += 1;
    if (c.impactScore != null)         scores.push(Number(c.impactScore));

    for (const t of (Array.isArray(c.conflictingTrainIds) ? c.conflictingTrainIds : [])) {
      trainIds.add(String(t));
    }
    for (const r of (Array.isArray(c.affectedRouteSegments) ? c.affectedRouteSegments : [])) {
      routeSegs.add(String(r));
    }
  }

  const avgImpact = scores.length > 0
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : null;

  return {
    total:       conflicts.length,
    critical,
    unresolved,
    escalated,
    pending,
    avgImpact,
    trainsAffected: trainIds.size,
    routeSegments:  routeSegs.size,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="schedule-kpis__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function KPITile({ id, label, value, cssModifier }) {
  return (
    <div
      id={id}
      className={[
        'schedule-kpis__tile',
        cssModifier ? `schedule-kpis__tile--${cssModifier}` : null,
      ].filter(Boolean).join(' ')}
      role="figure"
      aria-label={`${label}: ${value ?? '—'}`}
    >
      <div className="schedule-kpis__tile-value">{value ?? '—'}</div>
      <div className="schedule-kpis__tile-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ScheduleKPIs({
  conflicts  = [],
  loading    = false,
  refreshing = false,
  syncing    = false,
  error      = null,
  isStale    = false,
  compact    = false,
}) {
  const kpis = useMemo(() => computeKPIs(conflicts), [conflicts]);

  return (
    <div
      className={[
        'schedule-kpis',
        compact ? 'schedule-kpis--compact' : null,
        isStale ? 'schedule-kpis--stale'   : null,
        error   ? 'schedule-kpis--error'   : null,
        syncing ? 'schedule-kpis--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label="Schedule Conflict KPIs"
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />

      <div className="schedule-kpis__grid" role="list">
        <KPITile id="kpi-sc-total"      label="Total"            value={kpis.total}          />
        <KPITile id="kpi-sc-critical"   label="Critical"         value={kpis.critical}       cssModifier={kpis.critical > 0 ? 'critical' : null} />
        <KPITile id="kpi-sc-unresolved" label="Unresolved"       value={kpis.unresolved}     cssModifier={kpis.unresolved > 0 ? 'unresolved' : null} />
        <KPITile id="kpi-sc-escalated"  label="Escalated"        value={kpis.escalated}      cssModifier={kpis.escalated > 0 ? 'escalated' : null} />
        {!compact && <KPITile id="kpi-sc-pending"   label="Pending Approval" value={kpis.pending}     />}
        {!compact && <KPITile id="kpi-sc-impact"    label="Avg Impact"       value={kpis.avgImpact != null ? `${kpis.avgImpact}` : '—'} />}
        {!compact && <KPITile id="kpi-sc-trains"    label="Trains Affected"  value={kpis.trainsAffected} />}
        {!compact && <KPITile id="kpi-sc-routes"    label="Route Segments"   value={kpis.routeSegments} />}
      </div>
    </div>
  );
});

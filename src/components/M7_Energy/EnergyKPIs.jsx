import React, { memo, useMemo } from 'react';

/**
 * Purpose:
 * EnergyKPIs — aggregate KPI tile bar for Module-7 Energy Optimization.
 * Derives eight performance indicators from the `profiles` prop (EnergyProfile[]):
 *
 *   1. Total Profiles         — total count
 *   2. Avg Efficiency Score   — mean efficiencyScore across all profiles
 *   3. Total Consumption      — sum of consumption (kWh) across profiles
 *   4. Savings Potential      — sum of savingsPotential (kWh / %)
 *   5. Active Anomalies       — count of active non-resolved anomalies
 *   6. Active Recommendations — count of pending/accepted recommendations
 *   7. Optimized Count        — profiles with efficiencyScore >= 90
 *   8. Degrading Count        — profiles with trendDirection: 'degrading' or score < 50
 *
 * Caller sources `profiles` from energyService — zero store reads.
 *
 * Dependencies:
 * - React (memo, useMemo)
 *
 * Props:
 * - `profiles`    (object[])  — EnergyProfile array (default: [])
 * - `loading`     (boolean)   (default: false)
 * - `refreshing`  (boolean)   (default: false)
 * - `syncing`     (boolean)   (default: false)
 * - `error`       (any)       (default: null)
 * - `isStale`     (boolean)   (default: false)
 * - `compact`     (boolean)   (default: false)
 *
 * State: all derived via useMemo — zero mutations.
 */

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

const ANOMALY_ACTIVE_STATUSES = new Set(['active', 'open', 'investigating']);
const REC_ACTIVE_STATUSES     = new Set(['pending', 'accepted', 'in-progress', 'in_progress']);

function computeKPIs(profiles) {
  let totalConsumption   = 0;
  let totalSavings       = 0;
  let scoreSum           = 0;
  let scoreCount         = 0;
  let activeAnomalies    = 0;
  let activeRecs         = 0;
  let optimizedCount     = 0;
  let degradingCount     = 0;

  for (const p of profiles) {
    const score    = Number(p.efficiencyScore ?? 0);
    const trend    = String(p.trendDirection ?? p.trend ?? '').toLowerCase();
    const consumpt = Number(p.consumption ?? p.actualConsumption ?? 0);
    const savings  = Number(p.savingsPotential ?? 0);

    scoreSum     += score;
    scoreCount   += 1;
    totalConsumption += consumpt;
    totalSavings     += savings;

    if (score >= 90) optimizedCount  += 1;
    if (trend === 'degrading' || score < 50) degradingCount += 1;

    for (const a of (Array.isArray(p.anomalies) ? p.anomalies : [])) {
      if (ANOMALY_ACTIVE_STATUSES.has(String(a.status ?? 'active').toLowerCase())) activeAnomalies += 1;
    }
    for (const r of (Array.isArray(p.recommendations) ? p.recommendations : [])) {
      if (REC_ACTIVE_STATUSES.has(String(r.status ?? 'pending').toLowerCase())) activeRecs += 1;
    }
  }

  return {
    total:           profiles.length,
    avgEfficiency:   scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    totalConsumption: Math.round(totalConsumption),
    totalSavings:    Math.round(totalSavings),
    activeAnomalies,
    activeRecs,
    optimizedCount,
    degradingCount,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-kpis__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function KPITile({ id, label, value, unit, cssModifier }) {
  const display = value != null ? `${value}${unit ?? ''}` : '—';
  return (
    <div
      id={id}
      className={[
        'energy-kpis__tile',
        cssModifier ? `energy-kpis__tile--${cssModifier}` : null,
      ].filter(Boolean).join(' ')}
      role="figure"
      aria-label={`${label}: ${display}`}
    >
      <div className="energy-kpis__tile-value">{display}</div>
      <div className="energy-kpis__tile-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyKPIs({
  profiles   = [],
  loading    = false,
  refreshing = false,
  syncing    = false,
  error      = null,
  isStale    = false,
  compact    = false,
}) {
  const kpis = useMemo(() => computeKPIs(profiles), [profiles]);

  return (
    <div
      className={[
        'energy-kpis',
        compact ? 'energy-kpis--compact' : null,
        isStale ? 'energy-kpis--stale'   : null,
        error   ? 'energy-kpis--error'   : null,
        syncing ? 'energy-kpis--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label="Energy Optimization KPIs"
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />

      <div className="energy-kpis__grid" role="list">
        <KPITile id="kpi-e-total"      label="Profiles"          value={kpis.total}          />
        <KPITile id="kpi-e-efficiency" label="Avg Efficiency"    value={kpis.avgEfficiency}  unit="%" cssModifier={kpis.avgEfficiency != null && kpis.avgEfficiency < 70 ? 'warn' : null} />
        <KPITile id="kpi-e-consumption"label="Consumption"       value={kpis.totalConsumption} unit=" kWh" />
        <KPITile id="kpi-e-savings"    label="Savings Potential" value={kpis.totalSavings}   unit=" kWh" cssModifier="savings" />
        <KPITile id="kpi-e-anomalies"  label="Active Anomalies"  value={kpis.activeAnomalies} cssModifier={kpis.activeAnomalies > 0 ? 'anomaly' : null} />
        {!compact && <KPITile id="kpi-e-recs"   label="Active Recs"    value={kpis.activeRecs}     />}
        {!compact && <KPITile id="kpi-e-opt"    label="Optimized"      value={kpis.optimizedCount} cssModifier="optimized" />}
        {!compact && <KPITile id="kpi-e-deg"    label="Degrading"      value={kpis.degradingCount} cssModifier={kpis.degradingCount > 0 ? 'degrading' : null} />}
      </div>
    </div>
  );
});

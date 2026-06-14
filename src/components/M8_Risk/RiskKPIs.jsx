import React, { memo, useMemo } from 'react';
import useRiskStore from '../../store/riskStore';
import RiskSeverityBadge from './RiskSeverityBadge';
import RiskConfidenceIndicator from './RiskConfidenceIndicator';

/**
 * Purpose:
 * RiskKPIs — aggregate KPI tile bar for Module-8 Risk Intelligence. Reads
 * directly from riskStore approved selectors — zero prop-drilling for the
 * KPI data itself:
 *
 *   Selectors used:
 *   - `getRiskCounts()`         → total, byCategory, bySeverityBand
 *   - `getVisibleRiskScores()`  → visible list (post-filter/sort)
 *   - store state               → loading, syncing, error, refreshing
 *
 * Derived KPIs (8 tiles):
 *   1. Total Risk Scores
 *   2. Critical
 *   3. High
 *   4. Medium
 *   5. Low
 *   6. Avg Severity Score
 *   7. Avg Confidence (across visible scores)
 *   8. Unique Categories
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore` (read-only — getRiskCounts, getVisibleRiskScores)
 * - `./RiskSeverityBadge`
 * - `./RiskConfidenceIndicator`
 *
 * Props:
 * - `compact`  (boolean) (default: false) — show 4 tiles instead of 8
 * - `showBars` (boolean) (default: true)  — show severity distribution bar
 *
 * State: all derived from riskStore — zero local state.
 */

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, error }) {
  if (!loading && !refreshing && !syncing && !error) return null;
  return (
    <div className="risk-kpis__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
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
        'risk-kpis__tile',
        cssModifier ? `risk-kpis__tile--${cssModifier}` : null,
      ].filter(Boolean).join(' ')}
      role="figure"
      aria-label={`${label}: ${display}`}
    >
      <div className="risk-kpis__tile-value">{display}</div>
      <div className="risk-kpis__tile-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskKPIs({
  compact  = false,
  showBars = true,
}) {
  // ── Store reads ────────────────────────────────────────────────────────────
  const loading    = useRiskStore((s) => s.loading);
  const refreshing = useRiskStore((s) => s.refreshing);
  const syncing    = useRiskStore((s) => s.syncing);
  const error      = useRiskStore((s) => s.error);
  const getRiskCounts       = useRiskStore((s) => s.getRiskCounts);
  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);

  const counts  = useMemo(() => getRiskCounts(),          [getRiskCounts]);
  const visible = useMemo(() => getVisibleRiskScores(),   [getVisibleRiskScores]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const avgSeverity = useMemo(() => {
    const withScore = visible.filter((r) => r.severityScore != null);
    if (withScore.length === 0) return null;
    return Math.round(withScore.reduce((s, r) => s + Number(r.severityScore), 0) / withScore.length);
  }, [visible]);

  const avgConfidence = useMemo(() => {
    const withConf = visible.filter((r) => r.confidence != null);
    if (withConf.length === 0) return null;
    return Math.round(withConf.reduce((s, r) => s + Number(r.confidence), 0) / withConf.length);
  }, [visible]);

  const uniqueCategories = useMemo(() =>
    Object.keys(counts.byCategory ?? {}).length,
  [counts.byCategory]);

  const critical = counts.bySeverityBand?.critical ?? 0;
  const high     = counts.bySeverityBand?.high     ?? 0;
  const medium   = counts.bySeverityBand?.medium   ?? 0;
  const low      = counts.bySeverityBand?.low      ?? 0;

  // Severity distribution bar: relative widths
  const total     = counts.total || 1;
  const distBars  = [
    { band: 'critical', count: critical, label: 'Crit', pct: Math.round((critical / total) * 100) },
    { band: 'high',     count: high,     label: 'High', pct: Math.round((high     / total) * 100) },
    { band: 'medium',   count: medium,   label: 'Med',  pct: Math.round((medium   / total) * 100) },
    { band: 'low',      count: low,      label: 'Low',  pct: Math.round((low      / total) * 100) },
  ].filter((d) => d.count > 0);

  return (
    <div
      className={[
        'risk-kpis',
        compact ? 'risk-kpis--compact' : null,
        syncing ? 'risk-kpis--live'    : null,
        error   ? 'risk-kpis--error'   : null,
      ].filter(Boolean).join(' ')}
      aria-label="Risk Intelligence KPIs"
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} error={error} />

      {/* KPI tiles */}
      <div className="risk-kpis__grid" role="list">
        <KPITile id="kpi-r-total"    label="Total Risks"     value={counts.total} />
        <KPITile id="kpi-r-critical" label="Critical"        value={critical}  cssModifier={critical > 0 ? 'critical' : null} />
        <KPITile id="kpi-r-high"     label="High"            value={high}      cssModifier={high     > 0 ? 'high'     : null} />
        <KPITile id="kpi-r-medium"   label="Medium"          value={medium}    cssModifier={medium   > 0 ? 'medium'   : null} />
        {!compact && <KPITile id="kpi-r-low"      label="Low"             value={low} />}
        {!compact && <KPITile id="kpi-r-avg-sev"  label="Avg Severity"    value={avgSeverity}   unit="/100" />}
        {!compact && <KPITile id="kpi-r-avg-conf" label="Avg Confidence"  value={avgConfidence} unit="%" />}
        {!compact && <KPITile id="kpi-r-cats"     label="Categories"      value={uniqueCategories} />}
      </div>

      {/* Severity distribution bar */}
      {showBars && distBars.length > 0 && (
        <div
          className="risk-kpis__dist-bar"
          role="img"
          aria-label={`Risk severity distribution: ${distBars.map((d) => `${d.label} ${d.pct}%`).join(', ')}`}
        >
          {distBars.map((d) => (
            <div
              key={d.band}
              className={`risk-kpis__dist-segment risk-kpis__dist-segment--${d.band}`}
              style={{ flexBasis: `${d.pct}%` }}
              aria-hidden="true"
              title={`${d.label}: ${d.count} (${d.pct}%)`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

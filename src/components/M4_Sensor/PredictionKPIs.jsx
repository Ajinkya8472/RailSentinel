import React, { memo, useMemo } from 'react';
import useRiskStore from '../../store/riskStore';

/**
 * Purpose:
 * PredictionKPIs — aggregate KPI surface for Module-4 Predictive Intelligence.
 * Derives and displays six key performance indicators across all visible
 * Prediction entities in the riskStore:
 *
 *   1. Total Predictions   — count of all visible predictions
 *   2. Critical            — count of severityBand: 'critical'
 *   3. High Risk           — count of severityBand: 'high'
 *   4. Overdue             — count where predictedFailureAt < now
 *   5. Avg Confidence      — mean confidenceScore across all predictions (%)
 *   6. Affected Assets     — unique affectedTrainId / affectedAssetId count
 *
 * Designed for DashboardLayout header/kpi slot. Read-only. No mutations.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore` (Zustand — read-only)
 *
 * Props:
 * - `staleThreshold`  (number)   — ms before stale (default: 60000)
 * - `compact`         (boolean)  — compact single-row mode (default: false)
 *
 * State (derived from riskStore selectors only — zero mutations):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getVisibleRiskScores`
 */

function deriveConfidencePct(score) {
  if (score == null) return null;
  return score <= 1 ? score * 100 : Math.min(100, score);
}

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

function computeKPIs(predictions) {
  const now = Date.now();
  let critical = 0, high = 0, overdue = 0;
  const confScores = [];
  const affectedAssets = new Set();

  for (const p of predictions) {
    const band = String(p.severityBand ?? 'low').toLowerCase();
    if (band === 'critical') critical += 1;
    if (band === 'high')     high     += 1;

    const failAt = p.predictedFailureAt ? Date.parse(p.predictedFailureAt) : null;
    if (failAt != null && failAt < now) overdue += 1;

    const conf = deriveConfidencePct(p.confidenceScore);
    if (conf != null) confScores.push(conf);

    const assetKey = p.affectedTrainId ?? p.affectedAssetId ?? null;
    if (assetKey) affectedAssets.add(assetKey);
  }

  const avgConf = confScores.length > 0
    ? Math.round(confScores.reduce((s, v) => s + v, 0) / confScores.length)
    : null;

  return {
    total:          predictions.length,
    critical,
    high,
    overdue,
    avgConf,
    affectedAssets: affectedAssets.size,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="prediction-kpis__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function KPITile({ id, label, value, sub, cssModifier, ariaLabel }) {
  return (
    <div
      id={id}
      className={[
        'prediction-kpis__tile',
        cssModifier ? `prediction-kpis__tile--${cssModifier}` : null,
      ].filter(Boolean).join(' ')}
      aria-label={ariaLabel ?? `${label}: ${value}`}
      role="figure"
    >
      <div className="prediction-kpis__tile-value">{value ?? '—'}</div>
      <div className="prediction-kpis__tile-label">{label}</div>
      {sub && <div className="prediction-kpis__tile-sub">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionKPIs({
  staleThreshold = 60000,
  compact        = false,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useRiskStore((s) => s.loading);
  const refreshing    = useRiskStore((s) => s.refreshing);
  const syncing       = useRiskStore((s) => s.syncing);
  const error         = useRiskStore((s) => s.error);
  const lastUpdatedAt = useRiskStore((s) => s.lastUpdatedAt);

  const getVisibleRiskScores = useRiskStore((s) =>
    typeof s.getVisibleRiskScores === 'function' ? s.getVisibleRiskScores : null,
  );

  // ── Data ─────────────────────────────────────────────────────────────────
  const predictions = useMemo(() => {
    try { return getVisibleRiskScores ? getVisibleRiskScores() : []; }
    catch { return []; }
  }, [getVisibleRiskScores]);

  const kpis = useMemo(() => computeKPIs(predictions), [predictions]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, staleThreshold]);

  return (
    <div
      className={[
        'prediction-kpis',
        compact ? 'prediction-kpis--compact' : null,
        isStale ? 'prediction-kpis--stale'   : null,
        error   ? 'prediction-kpis--error'   : null,
        syncing ? 'prediction-kpis--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label="Prediction KPIs"
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />

      <div className="prediction-kpis__grid" role="list">
        <KPITile
          id="kpi-total-predictions"
          label="Total Predictions"
          value={kpis.total}
          ariaLabel={`Total predictions: ${kpis.total}`}
        />
        <KPITile
          id="kpi-critical-predictions"
          label="Critical"
          value={kpis.critical}
          cssModifier={kpis.critical > 0 ? 'critical' : 'clear'}
          ariaLabel={`Critical predictions: ${kpis.critical}`}
        />
        <KPITile
          id="kpi-high-predictions"
          label="High Risk"
          value={kpis.high}
          cssModifier={kpis.high > 0 ? 'high' : null}
          ariaLabel={`High risk predictions: ${kpis.high}`}
        />
        <KPITile
          id="kpi-overdue-predictions"
          label="Overdue"
          value={kpis.overdue}
          cssModifier={kpis.overdue > 0 ? 'overdue' : 'clear'}
          ariaLabel={`Overdue predictions: ${kpis.overdue}`}
        />
        {!compact && (
          <KPITile
            id="kpi-avg-confidence"
            label="Avg Confidence"
            value={kpis.avgConf != null ? `${kpis.avgConf}%` : '—'}
            ariaLabel={`Average model confidence: ${kpis.avgConf != null ? `${kpis.avgConf}%` : 'unavailable'}`}
          />
        )}
        {!compact && (
          <KPITile
            id="kpi-affected-assets"
            label="Affected Assets"
            value={kpis.affectedAssets}
            ariaLabel={`Unique affected assets: ${kpis.affectedAssets}`}
          />
        )}
      </div>

      {!compact && formatWhen(lastUpdatedAt) && (
        <div className="prediction-kpis__updated">Updated {formatWhen(lastUpdatedAt)}</div>
      )}
    </div>
  );
});

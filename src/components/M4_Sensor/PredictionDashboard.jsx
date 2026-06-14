import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';
import PredictionKPIs from './PredictionKPIs';
import PredictionCard from './PredictionCard';

/**
 * Purpose:
 * PredictionDashboard — primary orchestration surface for M4 Predictive
 * Intelligence. Assembles the full DashboardLayout with four coordinated
 * sections:
 *
 *   1. KPI Strip         — aggregate health metrics via PredictionKPIs
 *   2. Critical Board    — predictions at severityBand: 'critical', ranked
 *                         by severityScore descending
 *   3. High Risk Board   — predictions at severityBand: 'high'
 *   4. Asset Risk Matrix — per-affected-train / affected-asset rollup:
 *                         worst severity + prediction count per asset
 *
 * DashboardLayout is the primary usage. Renders bare when `layout` is null.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/riskStore`  (Zustand — read-only)
 * - `src/store/trainStore` (Zustand — read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./PredictionKPIs`
 * - `./PredictionCard`
 *
 * Props:
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)           (default: null)
 * - `staleThreshold` (number)                (default: 60000)
 * - `maxCritical`    (number)                (default: 6)
 * - `maxHigh`        (number)                (default: 6)
 * - `maxAssets`      (number)                (default: 12)
 * - `compact`        (boolean)               (default: false)
 * - `onPredictionOpen` (fn|null)             — callback with Prediction
 *                    (default: null)
 * - `onRetry`        (fn|null)               (default: null)
 *
 * State (derived from store selectors only — zero mutations):
 * - riskStore: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`,
 *              `getVisibleRiskScores`
 * - trainStore: `getTrainById` (asset name resolution)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
function sevRank(k) { return SEVERITY_RANK[String(k ?? 'low').toLowerCase()] ?? 0; }

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="prediction-dashboard__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function PredictionBoard({ id, title, predictions, compact, onPredictionOpen }) {
  if (predictions.length === 0) return (
    <section id={id} className="prediction-dashboard__board prediction-dashboard__board--empty" aria-label={title}>
      <h3 className="prediction-dashboard__board-title">{title}</h3>
      <div className="prediction-dashboard__board-empty" role="status">No predictions in this category.</div>
    </section>
  );

  return (
    <section id={id} className="prediction-dashboard__board" aria-label={title}>
      <h3 className="prediction-dashboard__board-title">{title} <span className="prediction-dashboard__board-count">{predictions.length}</span></h3>
      <div className="prediction-dashboard__card-grid" role="list">
        {predictions.map((p) => (
          <div key={p.id} role="listitem">
            <PredictionCard prediction={p} compact={compact} onOpen={onPredictionOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AssetRiskMatrix({ assets, compact }) {
  if (assets.length === 0) return (
    <div className="prediction-dashboard__matrix-empty" role="status">No asset risk data.</div>
  );

  return (
    <section className="prediction-dashboard__matrix" aria-label="Asset Risk Matrix">
      <h3 className="prediction-dashboard__matrix-title">Asset Risk Matrix</h3>
      <table className="prediction-dashboard__matrix-table" role="table" aria-label="Predictions by affected asset">
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col">Worst Severity</th>
            <th scope="col">Predictions</th>
            {!compact && <th scope="col">Category</th>}
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.assetKey} className={`prediction-dashboard__matrix-row prediction-dashboard__matrix-row--${String(a.worstSeverity).toLowerCase()}`}>
              <td className="prediction-dashboard__matrix-asset">{a.assetName}</td>
              <td>
                <span className={`prediction-dashboard__severity-chip prediction-dashboard__severity-chip--${String(a.worstSeverity).toLowerCase()}`}>
                  {a.worstSeverity}
                </span>
              </td>
              <td className="prediction-dashboard__matrix-count">{a.count}</td>
              {!compact && <td>{a.categories.join(', ')}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionDashboard({
  layout           = null,
  title            = null,
  staleThreshold   = 60000,
  maxCritical      = 6,
  maxHigh          = 6,
  maxAssets        = 12,
  compact          = false,
  onPredictionOpen = null,
  onRetry          = null,
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

  const getTrainById = useTrainStore((s) => s.getTrainById);

  // ── Data ─────────────────────────────────────────────────────────────────
  const allPredictions = useMemo(() => {
    try { return getVisibleRiskScores ? getVisibleRiskScores() : []; }
    catch { return []; }
  }, [getVisibleRiskScores]);

  const criticalPredictions = useMemo(() =>
    allPredictions
      .filter((p) => String(p.severityBand ?? '').toLowerCase() === 'critical')
      .sort((a, b) => Number(b.severityScore ?? 0) - Number(a.severityScore ?? 0))
      .slice(0, maxCritical),
  [allPredictions, maxCritical]);

  const highPredictions = useMemo(() =>
    allPredictions
      .filter((p) => String(p.severityBand ?? '').toLowerCase() === 'high')
      .sort((a, b) => Number(b.severityScore ?? 0) - Number(a.severityScore ?? 0))
      .slice(0, maxHigh),
  [allPredictions, maxHigh]);

  // ── Asset risk matrix ─────────────────────────────────────────────────────
  const assetMatrix = useMemo(() => {
    const assetMap = {};
    for (const p of allPredictions) {
      const assetKey  = p.affectedTrainId ?? p.affectedAssetId ?? 'unknown';
      const train     = p.affectedTrainId ? (typeof getTrainById === 'function' ? getTrainById(p.affectedTrainId) : null) : null;
      const assetName = train?.name ?? train?.number ?? p.affectedAssetId ?? p.affectedTrainId ?? assetKey;
      const category  = p.category ?? 'unknown';

      if (!assetMap[assetKey]) {
        assetMap[assetKey] = { assetKey, assetName, worstSeverity: p.severityBand ?? 'low', count: 1, categories: new Set([category]) };
      } else {
        const cur = assetMap[assetKey];
        if (sevRank(p.severityBand) > sevRank(cur.worstSeverity)) cur.worstSeverity = p.severityBand ?? cur.worstSeverity;
        cur.count += 1;
        cur.categories.add(category);
      }
    }
    return Object.values(assetMap)
      .map((a) => ({ ...a, categories: Array.from(a.categories) }))
      .sort((a, b) => sevRank(b.worstSeverity) - sevRank(a.worstSeverity))
      .slice(0, maxAssets);
  }, [allPredictions, getTrainById, maxAssets]);

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, staleThreshold]);

  const isEmpty       = allPredictions.length === 0 && !loading;
  const resolvedTitle = title ?? 'Predictive Intelligence Dashboard';

  // ── Dashboard body ────────────────────────────────────────────────────────
  const body = (
    <div
      className={[
        'prediction-dashboard',
        compact ? 'prediction-dashboard--compact' : null,
        isStale ? 'prediction-dashboard--stale'   : null,
        error   ? 'prediction-dashboard--error'   : null,
        syncing ? 'prediction-dashboard--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="prediction-dashboard__empty" role="status">No prediction data available.</div>
      ) : (
        <>
          <PredictionKPIs staleThreshold={staleThreshold} compact={compact} />
          <PredictionBoard
            id="prediction-board-critical"
            title="Critical Predictions"
            predictions={criticalPredictions}
            compact={compact}
            onPredictionOpen={onPredictionOpen}
          />
          <PredictionBoard
            id="prediction-board-high"
            title="High Risk Predictions"
            predictions={highPredictions}
            compact={compact}
            onPredictionOpen={onPredictionOpen}
          />
          <AssetRiskMatrix assets={assetMatrix} compact={compact} />
        </>
      )}

      {!compact && formatWhen(lastUpdatedAt) && (
        <div className="prediction-dashboard__updated">Last updated: {formatWhen(lastUpdatedAt)}</div>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={
          <div className="prediction-dashboard__detail-summary">
            <span>{allPredictions.length} predictions</span>
            {criticalPredictions.length > 0 && (
              <span className="prediction-dashboard__detail-critical">{criticalPredictions.length} critical</span>
            )}
            <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
          </div>
        }
        body={body}
        rail={<AssetRiskMatrix assets={assetMatrix.slice(0, 6)} compact={true} />}
        footer={null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && !isEmpty}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={null}
        left={body}
        right={<AssetRiskMatrix assets={assetMatrix} compact={compact} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

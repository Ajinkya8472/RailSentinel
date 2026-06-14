import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';

/**
 * Purpose:
 * ConfidencePanel — deep-review confidence intelligence surface for M4
 * Predictive Intelligence. Renders confidence scoring and model trust
 * information derived from the Prediction (RiskScore) domain model:
 *
 *   1. Confidence Distribution — bar showing count of predictions at
 *                               high (≥80%) / medium (50–79%) / low (<50%)
 *                               confidence bands across all scoped predictions.
 *
 *   2. Confidence Detail       — per-prediction confidence score with visual
 *                               gauge, model source, and severity context.
 *
 *   3. Low Confidence Warnings — predictions where confidenceScore < 0.5,
 *                               requiring operational caution before acting
 *                               on the failure prediction.
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore` (Zustand — read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `predictionId`   (string|null)  — anchor prediction (default: null)
 * - `prediction`     (object|null)  — direct override (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `staleThreshold` (number)       (default: 60000)
 * - `lowThreshold`   (number)       — confidence below this is "low"
 *                    (0–1 scale) (default: 0.5)
 * - `highThreshold`  (number)       — confidence at or above this is "high"
 *                    (default: 0.8)
 * - `maxItems`       (number)       (default: 20)
 * - `compact`        (boolean)      (default: false)
 * - `onRetry`        (fn|null)      (default: null)
 *
 * State (derived from riskStore selectors only — zero mutations):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getRiskScoreById`, `getSelectedRiskScore`, `getVisibleRiskScores`
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseConf(score) {
  if (score == null) return null;
  return score <= 1 ? score : score / 100;
}

function confPct(score) {
  const n = normaliseConf(score);
  return n == null ? null : Math.round(n * 100);
}

function confBand(score, low, high) {
  const n = normaliseConf(score);
  if (n == null) return 'unknown';
  if (n >= high) return 'high';
  if (n >= low)  return 'medium';
  return 'low';
}

const BAND_CONFIG = {
  high:    { label: 'High',    cssModifier: 'high',    description: 'Model confidence is strong. Prediction is reliable.' },
  medium:  { label: 'Medium',  cssModifier: 'medium',  description: 'Moderate confidence. Monitor trend closely.'         },
  low:     { label: 'Low',     cssModifier: 'low',     description: 'Low confidence. Verify before acting on prediction.' },
  unknown: { label: 'Unknown', cssModifier: 'unknown', description: 'No confidence data available.'                       },
};

function bandConfig(key) { return BAND_CONFIG[key ?? 'unknown'] ?? BAND_CONFIG.unknown; }

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="confidence-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function ConfidenceGauge({ pct, mod, id }) {
  return (
    <div
      id={id}
      className={`confidence-panel__gauge confidence-panel__gauge--${mod}`}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence: ${pct}%`}
    >
      <div className="confidence-panel__gauge-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
      <span className="confidence-panel__gauge-value">{pct}%</span>
    </div>
  );
}

function DistributionSection({ counts, total }) {
  const bands = ['high', 'medium', 'low'];
  return (
    <section className="confidence-panel__section" aria-label="Confidence distribution">
      <h3 className="confidence-panel__section-title">Distribution</h3>
      <div className="confidence-panel__dist-bar" role="img" aria-label="Confidence band distribution">
        {bands.map((k) => {
          const pct = total > 0 ? Math.round((counts[k] / total) * 100) : 0;
          if (pct === 0) return null;
          const cfg = bandConfig(k);
          return (
            <div key={k}
              className={`confidence-panel__dist-segment confidence-panel__dist-segment--${cfg.cssModifier}`}
              style={{ width: `${pct}%` }}
              title={`${cfg.label}: ${counts[k]} (${pct}%)`}
              aria-label={`${cfg.label}: ${counts[k]} predictions (${pct}%)`}
            />
          );
        })}
      </div>
      <div className="confidence-panel__dist-legend" role="list">
        {bands.map((k) => {
          const cfg = bandConfig(k);
          return (
            <span key={k} className={`confidence-panel__dist-item confidence-panel__dist-item--${cfg.cssModifier}`} role="listitem">
              {cfg.label}: {counts[k]}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function PredictionConfidenceRow({ p, low, high, compact, idx }) {
  const pct    = confPct(p.confidenceScore);
  const band   = confBand(p.confidenceScore, low, high);
  const cfg    = bandConfig(band);

  if (pct == null) return null;

  return (
    <li
      className={[
        'confidence-panel__pred-row',
        `confidence-panel__pred-row--${cfg.cssModifier}`,
        compact ? 'confidence-panel__pred-row--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${p.title ?? p.name ?? p.id}: ${pct}% confidence — ${cfg.label}`}
    >
      <div className="confidence-panel__pred-identity">
        <span className="confidence-panel__pred-title">{p.title ?? p.name ?? p.id}</span>
        {!compact && p.source && (
          <span className="confidence-panel__pred-source">{p.source}</span>
        )}
      </div>
      <ConfidenceGauge pct={pct} mod={cfg.cssModifier} id={`conf-gauge-${p.id}`} />
      <span className={`confidence-panel__pred-badge confidence-panel__pred-badge--${cfg.cssModifier}`}>{pct}%</span>
    </li>
  );
}

function LowConfidenceWarnings({ lowPreds, lowThreshold, compact }) {
  if (lowPreds.length === 0) return null;
  return (
    <section className="confidence-panel__section confidence-panel__section--warnings" aria-label="Low confidence warnings">
      <h3 className="confidence-panel__section-title">
        Low Confidence Warnings
        <span className="confidence-panel__section-badge confidence-panel__section-badge--low">{lowPreds.length}</span>
      </h3>
      <div className="confidence-panel__warning-note" role="note">
        The following predictions have confidence below {Math.round(lowThreshold * 100)}%. Exercise caution before acting.
      </div>
      <ul className="confidence-panel__warning-list" aria-label="Low confidence predictions">
        {lowPreds.slice(0, 8).map((p) => {
          const pct = confPct(p.confidenceScore);
          return (
            <li key={p.id} className="confidence-panel__warning-row" role="listitem"
              aria-label={`${p.title ?? p.id}: ${pct}% confidence`}>
              <span className="confidence-panel__warning-icon" aria-hidden="true">⚠</span>
              <span className="confidence-panel__warning-title">{p.title ?? p.name ?? p.id}</span>
              <span className="confidence-panel__warning-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ConfidenceRailSummary({ avgConf, counts, total, highThreshold, lowThreshold }) {
  const mod = avgConf == null ? 'unknown' : avgConf >= highThreshold * 100 ? 'high' : avgConf >= lowThreshold * 100 ? 'medium' : 'low';
  return (
    <div className="confidence-panel__rail" aria-label="Confidence summary">
      <div className="confidence-panel__rail-title">Model Confidence</div>
      {avgConf != null && (
        <div className={`confidence-panel__rail-avg confidence-panel__rail-avg--${mod}`} aria-label={`Average confidence: ${avgConf}%`}>
          <span className="confidence-panel__rail-avg-value">{avgConf}%</span>
          <span className="confidence-panel__rail-avg-label">Average</span>
        </div>
      )}
      <dl className="confidence-panel__rail-counts">
        <dt>High</dt><dd>{counts.high}</dd>
        <dt>Medium</dt><dd>{counts.medium}</dd>
        <dt>Low</dt><dd>{counts.low}</dd>
        <dt>Unknown</dt><dd>{counts.unknown}</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ConfidencePanel({
  predictionId      = null,
  prediction: pProp = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  lowThreshold      = 0.5,
  highThreshold     = 0.8,
  maxItems          = 20,
  compact           = false,
  onRetry           = null,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useRiskStore((s) => s.loading);
  const refreshing    = useRiskStore((s) => s.refreshing);
  const syncing       = useRiskStore((s) => s.syncing);
  const error         = useRiskStore((s) => s.error);
  const lastUpdatedAt = useRiskStore((s) => s.lastUpdatedAt);

  const predFromStore = useRiskStore((s) =>
    predictionId ? s.getRiskScoreById(predictionId) : s.getSelectedRiskScore(),
  );
  const getVisibleRiskScores = useRiskStore((s) =>
    typeof s.getVisibleRiskScores === 'function' ? s.getVisibleRiskScores : null,
  );

  // ── Data ─────────────────────────────────────────────────────────────────
  const anchor = useMemo(() => pProp ?? predFromStore ?? null, [pProp, predFromStore]);

  const allPredictions = useMemo(() => {
    try { return getVisibleRiskScores ? getVisibleRiskScores() : []; }
    catch { return []; }
  }, [getVisibleRiskScores]);

  const scopedPredictions = useMemo(() => {
    if (!predictionId && !pProp) return allPredictions;
    const assetKey = anchor?.affectedTrainId ?? anchor?.affectedAssetId ?? anchor?.id;
    if (!assetKey) return anchor ? [anchor] : [];
    return allPredictions.filter((p) =>
      (p.affectedTrainId ?? p.affectedAssetId ?? p.id) === assetKey,
    );
  }, [predictionId, pProp, allPredictions, anchor]);

  const sorted = useMemo(() =>
    [...scopedPredictions]
      .filter((p) => p.confidenceScore != null)
      .sort((a, b) => normaliseConf(b.confidenceScore) - normaliseConf(a.confidenceScore))
      .slice(0, maxItems),
  [scopedPredictions, maxItems]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, unknown: 0 };
    for (const p of scopedPredictions) {
      c[confBand(p.confidenceScore, lowThreshold, highThreshold)] += 1;
    }
    return c;
  }, [scopedPredictions, lowThreshold, highThreshold]);

  const total = scopedPredictions.length;

  const avgConf = useMemo(() => {
    const vals = scopedPredictions.map((p) => confPct(p.confidenceScore)).filter((v) => v != null);
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  }, [scopedPredictions]);

  const lowPreds = useMemo(() =>
    scopedPredictions.filter((p) => {
      const n = normaliseConf(p.confidenceScore);
      return n != null && n < lowThreshold;
    }),
  [scopedPredictions, lowThreshold]);

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchor?.lastUpdatedAt ? Date.parse(anchor.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchor, staleThreshold]);

  const isEmpty       = total === 0 && !loading;
  const resolvedTitle = title ?? 'Model Confidence';

  const body = (
    <div
      className={[
        'confidence-panel',
        compact ? 'confidence-panel--compact' : null,
        isStale ? 'confidence-panel--stale'   : null,
        error   ? 'confidence-panel--error'   : null,
        syncing ? 'confidence-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="confidence-panel__empty" role="status">No prediction confidence data available.</div>
      ) : (
        <>
          <DistributionSection counts={counts} total={total} />
          {sorted.length > 0 && (
            <section className="confidence-panel__section" aria-label="Per-prediction confidence">
              <h3 className="confidence-panel__section-title">Prediction Confidence</h3>
              <ul className="confidence-panel__pred-list">
                {sorted.map((p, idx) => (
                  <PredictionConfidenceRow key={p.id} p={p} low={lowThreshold} high={highThreshold} compact={compact} idx={idx} />
                ))}
              </ul>
            </section>
          )}
          <LowConfidenceWarnings lowPreds={lowPreds} lowThreshold={lowThreshold} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={<div className="confidence-panel__detail-summary">{total} predictions · avg {avgConf != null ? `${avgConf}%` : '—'}<StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<ConfidenceRailSummary avgConf={avgConf} counts={counts} total={total} highThreshold={highThreshold} lowThreshold={lowThreshold} />}
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
        right={<ConfidenceRailSummary avgConf={avgConf} counts={counts} total={total} highThreshold={highThreshold} lowThreshold={lowThreshold} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

// export for internal use
function normaliseConf(score) {
  if (score == null) return 0;
  return score <= 1 ? score : score / 100;
}

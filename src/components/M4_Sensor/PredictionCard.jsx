import React, { memo, useMemo } from 'react';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * PredictionCard — compact summary card for a single M4 Prediction entity.
 * Renders prediction summary, severity badge, confidence score, affected asset
 * identity, expected impact description, and time-to-predicted-failure.
 *
 * The card is the standard list-item / grid-item component for the Predictive
 * Intelligence module. It is used in DashboardLayout grid sections,
 * SplitPanelLayout left-panel lists, and standalone wherever a compact
 * Prediction overview is needed.
 *
 * Domain model mapping (RiskScore as Prediction):
 * - `id`                — prediction identifier
 * - `title` / `name`   — prediction label
 * - `category`         — failure category (mechanical, electrical, sensor, …)
 * - `severityBand`     — low / medium / high / critical
 * - `severityScore`    — 0–100 numeric severity
 * - `confidenceScore`  — 0–1 model confidence (pass-through)
 * - `predictedFailureAt` — ISO timestamp for expected failure (pass-through)
 * - `affectedAssetId`  — component / subsystem reference (pass-through)
 * - `affectedTrainId`  — train cross-domain reference → resolved via trainStore
 * - `expectedImpact`   — free-text expected operational impact (pass-through)
 * - `source`           — model / sensor source identifier
 * - `computedAt`       — when the prediction was computed
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore`  (Zustand — read-only; prediction data)
 * - `src/store/trainStore` (Zustand — read-only; asset name resolution)
 *
 * Props:
 * - `predictionId`     (string|null)  — riskStore key; falls back to
 *                      `getSelectedRiskScore()` (default: null)
 * - `prediction`       (object|null)  — direct Prediction override (default: null)
 * - `staleThreshold`   (number)       — ms before stale (default: 60000)
 * - `compact`          (boolean)      — compact single-line mode (default: false)
 * - `onOpen`           (fn|null)      — callback with Prediction on card click
 *                      (default: null)
 *
 * State (derived from store selectors only — zero mutations):
 * - `getRiskScoreById`, `getSelectedRiskScore` from riskStore
 * - `getTrainById` from trainStore for asset name resolution
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
};

function severityConfig(key) {
  return SEVERITY_CONFIG[String(key ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low;
}

function deriveConfidencePct(score) {
  if (score == null) return null;
  return score <= 1 ? Math.round(score * 100) : Math.min(100, Math.round(score));
}

function formatTimeToFailure(iso) {
  if (!iso) return null;
  try {
    const diff = Date.parse(iso) - Date.now();
    if (Number.isNaN(diff)) return null;
    if (diff < 0) return 'Overdue';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0)   return `${h}h ${m}m`;
    return `${m}m`;
  } catch { return null; }
}

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionCard({
  predictionId    = null,
  prediction: pProp = null,
  staleThreshold  = 60000,
  compact         = false,
  onOpen          = null,
}) {
  // ── riskStore selectors (read-only) ──────────────────────────────────────
  const predFromStore = useRiskStore((s) =>
    predictionId ? s.getRiskScoreById(predictionId) : s.getSelectedRiskScore(),
  );
  const lastUpdatedAt = useRiskStore((s) => s.lastUpdatedAt);

  // ── trainStore selector (read-only asset resolution) ────────────────────
  const getTrainById = useTrainStore((s) => s.getTrainById);

  // ── Resolved prediction ──────────────────────────────────────────────────
  const prediction = useMemo(() => pProp ?? predFromStore ?? null, [pProp, predFromStore]);

  // ── Asset resolution ─────────────────────────────────────────────────────
  const affectedTrain = useMemo(() => {
    if (!prediction?.affectedTrainId) return null;
    try { return getTrainById(prediction.affectedTrainId); } catch { return null; }
  }, [prediction?.affectedTrainId, getTrainById]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : prediction?.lastUpdatedAt ? Date.parse(prediction.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, prediction, staleThreshold]);

  if (!prediction) {
    return (
      <div className="prediction-card prediction-card--empty" aria-label="No prediction data" role="status">
        No prediction selected.
      </div>
    );
  }

  const sevCfg     = severityConfig(prediction.severityBand);
  const confPct    = deriveConfidencePct(prediction.confidenceScore);
  const ttf        = formatTimeToFailure(prediction.predictedFailureAt);
  const assetName  = affectedTrain?.name ?? affectedTrain?.number ?? prediction.affectedAssetId ?? prediction.affectedTrainId ?? null;
  const isClickable = typeof onOpen === 'function';

  return (
    <article
      className={[
        'prediction-card',
        `prediction-card--${sevCfg.cssModifier}`,
        compact   ? 'prediction-card--compact'   : null,
        isStale   ? 'prediction-card--stale'     : null,
        isClickable ? 'prediction-card--clickable' : null,
      ].filter(Boolean).join(' ')}
      aria-label={`Prediction: ${prediction.title ?? prediction.name ?? prediction.id} — ${sevCfg.label} severity`}
      role={isClickable ? 'button' : 'article'}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onOpen(prediction) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(prediction); } } : undefined}
    >
      {/* Header */}
      <div className="prediction-card__header">
        <span
          className={`prediction-card__severity prediction-card__severity--${sevCfg.cssModifier}`}
          aria-label={`Severity: ${sevCfg.label}`}
        >
          <span aria-hidden="true">{sevCfg.icon}</span> {sevCfg.label}
        </span>
        {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
        {ttf && (
          <span
            className={`prediction-card__ttf ${ttf === 'Overdue' ? 'prediction-card__ttf--overdue' : ''}`}
            aria-label={`Time to failure: ${ttf}`}
          >
            {ttf === 'Overdue' ? '⚠ Overdue' : `T−${ttf}`}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="prediction-card__title">
        {prediction.title ?? prediction.name ?? prediction.id}
      </div>

      {/* Category */}
      {prediction.category && (
        <div className="prediction-card__category">{prediction.category}</div>
      )}

      {/* Asset */}
      {assetName && (
        <div className="prediction-card__asset" aria-label={`Affected asset: ${assetName}`}>
          <span aria-hidden="true">🚆</span> {assetName}
        </div>
      )}

      {/* Expected impact */}
      {!compact && (prediction.expectedImpact ?? prediction.description) && (
        <div className="prediction-card__impact">
          {prediction.expectedImpact ?? prediction.description}
        </div>
      )}

      {/* Confidence */}
      {confPct != null && (
        <div
          className="prediction-card__confidence"
          role="meter"
          aria-valuenow={confPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Confidence: ${confPct}%`}
        >
          <div className="prediction-card__confidence-bar">
            <div className="prediction-card__confidence-fill" style={{ width: `${confPct}%` }} aria-hidden="true" />
          </div>
          <span className="prediction-card__confidence-value">{confPct}%</span>
        </div>
      )}

      {/* Computed at */}
      {!compact && prediction.computedAt && (
        <div className="prediction-card__meta">{formatWhen(prediction.computedAt)}</div>
      )}
    </article>
  );
});

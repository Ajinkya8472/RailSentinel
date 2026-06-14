import React, { memo, useMemo } from 'react';
import useRiskStore from '../../store/riskStore';

/**
 * Purpose:
 * PredictionStatusBadge — canonical inline badge for M4 Prediction status.
 * Maps `severityBand` and `confidenceScore` from the RiskScore domain model
 * to five operational display states with consistent colour encoding:
 *
 *   Nominal    → severityBand: 'low'      + confidenceScore ≥ 0.7
 *   Watch      → severityBand: 'low'      + confidenceScore < 0.7
 *                OR severityBand: 'medium' + confidenceScore < 0.5
 *   Elevated   → severityBand: 'medium'   + confidenceScore ≥ 0.5
 *   High Risk  → severityBand: 'high'
 *   Critical   → severityBand: 'critical'
 *
 * The badge also reflects system-level states:
 *   Loading    → riskStore loading flag active
 *   Stale      → data age > staleThreshold
 *   Error      → riskStore error flag active
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore` (Zustand — read-only)
 *
 * Props:
 * - `predictionId`   (string|null)  — store key; falls back to
 *                    `getSelectedRiskScore()` (default: null)
 * - `prediction`     (object|null)  — direct Prediction override (default: null)
 * - `staleThreshold` (number)       — ms before stale (default: 60000)
 * - `size`           ('sm'|'md'|'lg') — badge size (default: 'md')
 * - `showLabel`      (boolean)      — show text label (default: true)
 * - `onClick`        (fn|null)      — optional click callback (default: null)
 *
 * State (derived from riskStore selectors only — zero mutations):
 * - `loading`, `error`, `lastUpdatedAt`
 * - `getRiskScoreById`, `getSelectedRiskScore`
 */

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  nominal:   { label: 'Nominal',   cssModifier: 'nominal',   icon: '✓', ariaLabel: 'Nominal — no failure predicted'       },
  watch:     { label: 'Watch',     cssModifier: 'watch',     icon: '○', ariaLabel: 'Watch — low confidence or low severity' },
  elevated:  { label: 'Elevated',  cssModifier: 'elevated',  icon: '◔', ariaLabel: 'Elevated — medium risk'                },
  high:      { label: 'High Risk', cssModifier: 'high',      icon: '▲', ariaLabel: 'High Risk — failure likely'            },
  critical:  { label: 'Critical',  cssModifier: 'critical',  icon: '✕', ariaLabel: 'Critical — imminent failure'           },
  loading:   { label: 'Loading',   cssModifier: 'loading',   icon: '…', ariaLabel: 'Loading prediction data'               },
  stale:     { label: 'Stale',     cssModifier: 'stale',     icon: '⧗', ariaLabel: 'Data may be stale'                     },
  error:     { label: 'Error',     cssModifier: 'error',     icon: '!', ariaLabel: 'Prediction data error'                  },
};

function deriveStatus(prediction, isLoading, isStale, hasError) {
  if (isLoading) return 'loading';
  if (hasError)  return 'error';

  if (!prediction) return 'nominal';

  const band = String(prediction.severityBand ?? 'low').toLowerCase();
  const confRaw = prediction.confidenceScore ?? null;
  const conf = confRaw == null ? null : (confRaw <= 1 ? confRaw : confRaw / 100);

  if (band === 'critical') return 'critical';
  if (band === 'high')     return 'high';

  if (band === 'medium') {
    return conf == null || conf >= 0.5 ? 'elevated' : 'watch';
  }

  // low severity
  if (conf != null && conf < 0.7) return 'watch';

  if (isStale) return 'stale';
  return 'nominal';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionStatusBadge({
  predictionId      = null,
  prediction: pProp = null,
  staleThreshold    = 60000,
  size              = 'md',
  showLabel         = true,
  onClick           = null,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useRiskStore((s) => s.loading);
  const error         = useRiskStore((s) => s.error);
  const lastUpdatedAt = useRiskStore((s) => s.lastUpdatedAt);

  const predFromStore = useRiskStore((s) =>
    predictionId ? s.getRiskScoreById(predictionId) : s.getSelectedRiskScore(),
  );

  // ── Resolved prediction ──────────────────────────────────────────────────
  const prediction = useMemo(() => pProp ?? predFromStore ?? null, [pProp, predFromStore]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : prediction?.lastUpdatedAt ? Date.parse(prediction.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, prediction, staleThreshold]);

  // ── Status derivation ─────────────────────────────────────────────────────
  const statusKey = deriveStatus(prediction, loading, isStale, Boolean(error));
  const cfg       = STATUS_CONFIG[statusKey];
  const isClickable = typeof onClick === 'function';

  return (
    <span
      className={[
        'prediction-status-badge',
        `prediction-status-badge--${cfg.cssModifier}`,
        `prediction-status-badge--${size}`,
        isClickable ? 'prediction-status-badge--clickable' : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'status'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={cfg.ariaLabel}
      onClick={isClickable ? () => onClick(prediction) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(prediction); } } : undefined}
    >
      <span className="prediction-status-badge__icon" aria-hidden="true">{cfg.icon}</span>
      {showLabel && <span className="prediction-status-badge__label">{cfg.label}</span>}
    </span>
  );
});

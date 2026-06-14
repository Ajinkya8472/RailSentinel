import React, { memo } from 'react';
import useRiskStore from '../../store/riskStore';

/**
 * Purpose:
 * RiskSeverityBadge — canonical inline severity badge for Module-8 Risk
 * Intelligence. Maps `RiskScore.severityBand` (and optional `severityScore`)
 * to one of five deterministic display states with colour, icon, and
 * accessible labelling:
 *
 *   critical — severityBand: 'critical'  (score ≥ 85)
 *   high     — severityBand: 'high'      (score 60–84)
 *   medium   — severityBand: 'medium'    (score 30–59)
 *   low      — severityBand: 'low'       (score < 30)
 *   unknown  — no severityBand field
 *
 * System states:
 *   loading  — isLoading = true
 *   stale    — isStale = true
 *
 * Usage:
 *   <RiskSeverityBadge riskScore={rs} size="md" />
 *   <RiskSeverityBadge riskScore={rs} showScore size="sm" />
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `riskScore`  (object|null)    — RiskScore entity (default: null)
 * - `isLoading`  (boolean)        (default: false)
 * - `isStale`    (boolean)        (default: false)
 * - `size`       ('sm'|'md'|'lg') (default: 'md')
 * - `showLabel`  (boolean)        (default: true)
 * - `showScore`  (boolean)        — show severityScore value (default: false)
 * - `onClick`    (fn|null)        (default: null)
 *
 * State: none — pure derived display.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BAND_CONFIG = {
  critical: { label: 'Critical', cssModifier: 'critical', icon: '✕', ariaLabel: 'Critical risk' },
  high:     { label: 'High',     cssModifier: 'high',     icon: '▲', ariaLabel: 'High risk'     },
  medium:   { label: 'Medium',   cssModifier: 'medium',   icon: '◉', ariaLabel: 'Medium risk'   },
  low:      { label: 'Low',      cssModifier: 'low',      icon: 'ℹ', ariaLabel: 'Low risk'      },
  unknown:  { label: 'Unknown',  cssModifier: 'unknown',  icon: '?', ariaLabel: 'Unknown risk'  },
  loading:  { label: 'Loading',  cssModifier: 'loading',  icon: '…', ariaLabel: 'Loading risk'  },
  stale:    { label: 'Stale',    cssModifier: 'stale',    icon: '⧗', ariaLabel: 'Stale risk'   },
};

function deriveBandKey(riskScore, isLoading, isStale) {
  if (isLoading) return 'loading';
  if (!riskScore) return 'unknown';
  const band = String(riskScore.severityBand ?? '').toLowerCase();
  if (BAND_CONFIG[band]) return band;
  // Derive from severityScore if no band
  const score = Number(riskScore.severityScore ?? riskScore.score ?? -1);
  if (score < 0) return isStale ? 'stale' : 'unknown';
  if (score >= 85) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskSeverityBadge({
  riskScore  = null,
  isLoading  = false,
  isStale    = false,
  size       = 'md',
  showLabel  = true,
  showScore  = false,
  onClick    = null,
}) {
  const bandKey    = deriveBandKey(riskScore, isLoading, isStale);
  const cfg        = BAND_CONFIG[bandKey] ?? BAND_CONFIG.unknown;
  const score      = riskScore?.severityScore ?? riskScore?.score ?? null;
  const isClickable = typeof onClick === 'function';

  return (
    <span
      className={[
        'risk-severity-badge',
        `risk-severity-badge--${cfg.cssModifier}`,
        `risk-severity-badge--${size}`,
        isClickable ? 'risk-severity-badge--clickable' : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'status'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`${cfg.ariaLabel}${score != null && showScore ? `: ${score}` : ''}`}
      onClick={isClickable ? () => onClick(riskScore) : undefined}
      onKeyDown={isClickable
        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(riskScore); } }
        : undefined}
    >
      <span className="risk-severity-badge__icon" aria-hidden="true">{cfg.icon}</span>
      {showLabel && <span className="risk-severity-badge__label">{cfg.label}</span>}
      {showScore && score != null && (
        <span className="risk-severity-badge__score" aria-hidden="true">{score}</span>
      )}
    </span>
  );
});

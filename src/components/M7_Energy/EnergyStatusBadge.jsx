import React, { memo } from 'react';

/**
 * Purpose:
 * EnergyStatusBadge — canonical inline status badge for Module-7 Energy
 * Optimization. Maps EnergyProfile fields (`efficiencyScore`, `thresholdStatus`,
 * `anomalies[]`, `status`) to one of five deterministic display states:
 *
 *   Optimized  — efficiencyScore >= 90 and no active anomalies
 *   Normal     — efficiencyScore 70–89 and no active anomalies
 *   Improving  — trend direction: 'improving' and no active anomalies
 *   Degrading  — trend direction: 'degrading' OR efficiencyScore < 50
 *   Anomalous  — any active anomaly with severity >= 'high'
 *
 * System states:
 *   Loading    — isLoading = true
 *   Stale      — isStale = true (no active anomaly override)
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `profile`     (object|null)    — EnergyProfile entity (default: null)
 * - `isLoading`   (boolean)        (default: false)
 * - `isStale`     (boolean)        (default: false)
 * - `size`        ('sm'|'md'|'lg') (default: 'md')
 * - `showLabel`   (boolean)        (default: true)
 * - `onClick`     (fn|null)        (default: null)
 *
 * State: none — pure derived display.
 */

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

const BADGE_CONFIG = {
  optimized: { label: 'Optimized', cssModifier: 'optimized', icon: '★', ariaLabel: 'Energy optimized'           },
  normal:    { label: 'Normal',    cssModifier: 'normal',    icon: '●', ariaLabel: 'Energy normal'              },
  improving: { label: 'Improving', cssModifier: 'improving', icon: '↑', ariaLabel: 'Energy improving'           },
  degrading: { label: 'Degrading', cssModifier: 'degrading', icon: '↓', ariaLabel: 'Energy degrading'          },
  anomalous: { label: 'Anomalous', cssModifier: 'anomalous', icon: '⚠', ariaLabel: 'Energy anomaly detected'   },
  loading:   { label: 'Loading',   cssModifier: 'loading',   icon: '…', ariaLabel: 'Loading energy status'      },
  stale:     { label: 'Stale',     cssModifier: 'stale',     icon: '⧗', ariaLabel: 'Energy data may be stale'  },
};

const ANOMALY_SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

function deriveState(profile, isLoading, isStale) {
  if (isLoading) return 'loading';
  if (!profile) return 'normal';

  const anomalies = Array.isArray(profile.anomalies) ? profile.anomalies : [];
  const hasHighAnomaly = anomalies.some((a) =>
    (ANOMALY_SEVERITY_RANK[String(a.severity ?? 'low').toLowerCase()] ?? 0) >= 2 &&
    String(a.status ?? 'active').toLowerCase() !== 'resolved'
  );
  if (hasHighAnomaly) return 'anomalous';

  const score = Number(profile.efficiencyScore ?? 100);
  if (score >= 90) return 'optimized';

  const trend = String(profile.trendDirection ?? profile.trend ?? '').toLowerCase();
  if (trend === 'degrading' || score < 50) return 'degrading';
  if (trend === 'improving') return 'improving';

  if (isStale) return 'stale';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyStatusBadge({
  profile    = null,
  isLoading  = false,
  isStale    = false,
  size       = 'md',
  showLabel  = true,
  onClick    = null,
}) {
  const displayState = deriveState(profile, isLoading, isStale);
  const cfg          = BADGE_CONFIG[displayState] ?? BADGE_CONFIG.normal;
  const isClickable  = typeof onClick === 'function';

  return (
    <span
      className={[
        'energy-status-badge',
        `energy-status-badge--${cfg.cssModifier}`,
        `energy-status-badge--${size}`,
        isClickable ? 'energy-status-badge--clickable' : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'status'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={cfg.ariaLabel}
      onClick={isClickable ? () => onClick(profile) : undefined}
      onKeyDown={isClickable
        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(profile); } }
        : undefined}
    >
      <span className="energy-status-badge__icon" aria-hidden="true">{cfg.icon}</span>
      {showLabel && <span className="energy-status-badge__label">{cfg.label}</span>}
    </span>
  );
});

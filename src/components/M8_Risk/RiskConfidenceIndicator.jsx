import React, { memo } from 'react';

/**
 * Purpose:
 * RiskConfidenceIndicator — visual confidence level widget for Module-8 Risk
 * Intelligence. Renders `RiskScore.confidence` (0–100 float) as:
 *
 *   1. Segmented confidence bar (5 segments; filled = confidence tier)
 *   2. Numeric percentage label
 *   3. Qualitative tier label: Very Low / Low / Moderate / High / Very High
 *
 * Confidence tier thresholds:
 *   Very High  ≥ 80
 *   High       ≥ 60
 *   Moderate   ≥ 40
 *   Low        ≥ 20
 *   Very Low   < 20
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `confidence`   (number|null)   — 0–100 (default: null)
 * - `size`         ('sm'|'md'|'lg') (default: 'md')
 * - `showLabel`    (boolean)        (default: true)
 * - `showPct`      (boolean)        (default: true)
 * - `compact`      (boolean)        (default: false)
 *
 * State: none — pure display.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TIERS = [
  { min: 80, label: 'Very High', cssModifier: 'very-high', segments: 5 },
  { min: 60, label: 'High',      cssModifier: 'high',      segments: 4 },
  { min: 40, label: 'Moderate',  cssModifier: 'moderate',  segments: 3 },
  { min: 20, label: 'Low',       cssModifier: 'low',       segments: 2 },
  { min: 0,  label: 'Very Low',  cssModifier: 'very-low',  segments: 1 },
];

function deriveTier(confidence) {
  const n = Number(confidence ?? 0);
  return TIERS.find((t) => n >= t.min) ?? TIERS[TIERS.length - 1];
}

const TOTAL_SEGMENTS = 5;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskConfidenceIndicator({
  confidence = null,
  size       = 'md',
  showLabel  = true,
  showPct    = true,
  compact    = false,
}) {
  if (confidence == null) {
    return (
      <span
        className={`risk-confidence-indicator risk-confidence-indicator--${size} risk-confidence-indicator--unknown`}
        role="status"
        aria-label="Confidence unknown">
        <span className="risk-confidence-indicator__label">—</span>
      </span>
    );
  }

  const tier  = deriveTier(confidence);
  const pct   = Math.min(100, Math.max(0, Math.round(Number(confidence))));

  return (
    <span
      className={[
        'risk-confidence-indicator',
        `risk-confidence-indicator--${tier.cssModifier}`,
        `risk-confidence-indicator--${size}`,
        compact ? 'risk-confidence-indicator--compact' : null,
      ].filter(Boolean).join(' ')}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence: ${tier.label} (${pct}%)`}
    >
      {/* Segmented bar */}
      <span className="risk-confidence-indicator__bar" aria-hidden="true">
        {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={[
              'risk-confidence-indicator__segment',
              i < tier.segments ? `risk-confidence-indicator__segment--filled risk-confidence-indicator__segment--${tier.cssModifier}` : 'risk-confidence-indicator__segment--empty',
            ].join(' ')}
          />
        ))}
      </span>

      {showPct && !compact && (
        <span className="risk-confidence-indicator__pct" aria-hidden="true">{pct}%</span>
      )}

      {showLabel && !compact && (
        <span className="risk-confidence-indicator__label" aria-hidden="true">{tier.label}</span>
      )}
    </span>
  );
});

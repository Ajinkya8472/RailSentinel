/**
 * src/utils/riskCalculations.js
 *
 * Purpose:
 * Provides pure utility functions for calculating, aggregating, and comparing
 * risk scores. It centralizes risk math logic to ensure consistency across the
 * RailSentinel platform while strictly adhering to the canonical RiskScore
 * domain model.
 *
 * Dependencies:
 * - `src/types/risk.js` (for threshold enums)
 *
 * Exports:
 * - normalizeSeverityScore
 * - applyConfidenceWeighting
 * - determinePriorityBand
 * - compareRiskTrends
 * - aggregateRiskScores
 */

import { RISK_LEVEL, PRIORITY_BAND } from '../types/risk';

// ---------------------------------------------------------------------------
// Calculations
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw severity score into the standardized 0-100 range.
 *
 * @param {number} rawScore - The raw score from a subsystem to normalize.
 * @param {number} [maxScale=100] - The maximum expected scale of the raw score.
 * @returns {number} Normalized score bounded between 0 and 100.
 */
export function normalizeSeverityScore(rawScore, maxScale = 100) {
  const score = Number(rawScore);
  if (Number.isNaN(score) || score < 0) return 0;
  if (maxScale <= 0) return 0;

  const normalized = (score / maxScale) * 100;
  return Math.min(Math.max(Math.round(normalized), 0), 100);
}

/**
 * Applies a confidence penalty to a risk score based on the model's confidence float.
 * Scores with low confidence are mathematically dampened to prevent false alarms.
 *
 * @param {number} baseScore - The base severity score (0-100).
 * @param {number} confidence - The confidence float (0.0-1.0).
 * @returns {number} The confidence-weighted score (0-100).
 */
export function applyConfidenceWeighting(baseScore, confidence) {
  const score = Number(baseScore);
  const conf = Number(confidence);

  if (Number.isNaN(score)) return 0;
  if (Number.isNaN(conf)) return score; // If no confidence is passed, assume full base score

  // Ensure confidence is clamped between 0 and 1
  const clampedConf = Math.min(Math.max(conf, 0), 1);

  // Apply a non-linear weighting: High confidence retains most of the score,
  // while low confidence significantly dampens it.
  const weighted = score * (0.5 + (clampedConf * 0.5));
  return Math.round(weighted);
}

/**
 * Maps a risk score (0-100) to its corresponding dispatch priority band.
 * Ensures consistent urgency assignment logic across all modules.
 *
 * @param {number} score - The composite risk score (0-100).
 * @returns {string} The priority band (e.g., 'immediate', 'urgent', 'standard', 'monitor').
 */
export function determinePriorityBand(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return PRIORITY_BAND.MONITOR;

  const level = RISK_LEVEL.fromScore(n);
  return PRIORITY_BAND.fromLevel[level] ?? PRIORITY_BAND.MONITOR;
}

/**
 * Compares two risk scores to determine the trend direction.
 * Applies a noise filter so minor fluctuations are considered 'stable'.
 *
 * @param {number} currentScore - The current risk score.
 * @param {number} previousScore - The previous risk score.
 * @returns {string} Trend direction: 'increasing', 'decreasing', 'stable', or 'unknown'.
 */
export function compareRiskTrends(currentScore, previousScore) {
  const curr = Number(currentScore);
  const prev = Number(previousScore);

  if (Number.isNaN(curr) || Number.isNaN(prev)) return 'unknown';

  const diff = curr - prev;

  // Assume a difference of less than 3 points is statistically "stable" noise
  if (Math.abs(diff) < 3) return 'stable';
  if (diff > 0) return 'increasing';
  return 'decreasing';
}

/**
 * Aggregates an array of individual risk scores into a single composite score.
 * Used when combining multiple subsystem alerts into a single station/train score.
 *
 * @param {Array<number|Object>} items - Array of numeric scores or RiskScore objects.
 * @param {string} [strategy='max'] - Aggregation strategy ('max', 'average', 'weighted').
 * @returns {number} The aggregated score bounded between 0-100.
 */
export function aggregateRiskScores(items, strategy = 'max') {
  if (!Array.isArray(items) || items.length === 0) return 0;

  // Extract numeric scores, defaulting to 0 for invalid entries
  const numericScores = items.map(item => {
    if (typeof item === 'number') return item;
    if (item && typeof item === 'object' && typeof item.score === 'number') return item.score;
    return 0;
  });

  switch (strategy) {
    case 'average': {
      const sum = numericScores.reduce((acc, val) => acc + val, 0);
      return Math.round(sum / numericScores.length);
    }
    
    case 'weighted': {
      // Weighted strategy biases towards the highest score but adds a penalty for volume.
      // E.g., one 80 and two 40s -> 80 + (40 * 0.1) + (40 * 0.1) = 88
      const sorted = [...numericScores].sort((a, b) => b - a);
      const primary = sorted[0];
      const secondaries = sorted.slice(1).reduce((acc, val) => acc + (val * 0.1), 0);
      return Math.min(Math.round(primary + secondaries), 100);
    }
    
    case 'max':
    default:
      return Math.max(...numericScores);
  }
}

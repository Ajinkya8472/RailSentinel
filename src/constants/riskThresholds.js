/**
 * src/constants/riskThresholds.js
 *
 * Purpose:
 * Defines canonical Risk Intelligence threshold constants for RailSentinel.
 * Serves as the numeric source of truth for severity band boundaries,
 * machine learning confidence tiers, and operational auto-escalation rules.
 * Keeps business math globally consistent and decoupled from domain models.
 *
 * Dependencies:
 * - None. Pure JS constants.
 *
 * Exports:
 * - RISK_THRESHOLDS
 * - CONFIDENCE_THRESHOLDS
 * - ESCALATION_THRESHOLDS
 */

function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach((name) => {
    const value = obj[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

// ---------------------------------------------------------------------------
// 1. RISK_THRESHOLDS
// Defines the inclusive lower-bound score (0-100) for each severity band.
// Aligned with the RiskScore domain model from src/types/risk.js.
// ---------------------------------------------------------------------------

export const RISK_THRESHOLDS = deepFreeze({
  /** Score 80-100: Immediate danger, life-safety or service-halt risk */
  CRITICAL: 80,
  /** Score 60-79: Significant disruption or safety concern */
  HIGH:     60,
  /** Score 40-59: Notable risk requiring monitoring (Moderate) */
  MODERATE: 40, // Note: Architecturally synonymous with 'MEDIUM'
  MEDIUM:   40,
  /** Score 20-39: Minor operational risk */
  LOW:      20,
  /** Score 0-19: Negligible risk, baseline noise */
  MINIMAL:  0,
});

// ---------------------------------------------------------------------------
// 2. CONFIDENCE_THRESHOLDS
// Defines the inclusive lower-bound float (0.0-1.0) for AI/ML confidence bands.
// Determines when mathematical dampening (penalty) should be applied.
// ---------------------------------------------------------------------------

export const CONFIDENCE_THRESHOLDS = deepFreeze({
  /** >= 90% confidence: Highly reliable signal, no penalty */
  HIGH:     0.90,
  /** >= 70% confidence: Standard reliability, minimal penalty */
  MODERATE: 0.70,
  MEDIUM:   0.70,
  /** >= 50% confidence: Uncertain signal, noticeable mathematical dampening */
  LOW:      0.50,
  /** < 50% confidence: Indicative only, heavily dampened to avoid false alarms */
  VERY_LOW: 0.00,
});

// ---------------------------------------------------------------------------
// 3. ESCALATION_THRESHOLDS
// Defines time-based (minutes) and score-based auto-escalation triggers.
// Used by background workers and the M5 predictive intelligence engine.
// ---------------------------------------------------------------------------

export const ESCALATION_THRESHOLDS = deepFreeze({
  /** 
   * Minutes an active Critical (P1) risk can remain unacknowledged 
   * before auto-escalating to Management / NDRF. 
   */
  CRITICAL_TIMEOUT_MINS: 5,
  
  /** 
   * Minutes an active High (P2) risk can remain unacknowledged 
   * before auto-escalating to the next supervisory tier. 
   */
  HIGH_TIMEOUT_MINS: 15,
  
  /** 
   * Minutes an active Medium (P3) risk can remain unacknowledged.
   */
  MEDIUM_TIMEOUT_MINS: 60,

  /**
   * Minimum Risk Score required to bypass normal operator triage
   * and immediately trigger network-wide alerting.
   */
  AUTO_BROADCAST_SCORE: 90,

  /**
   * Minimum Confidence Float required to allow auto-broadcasting
   * without a human-in-the-loop review.
   */
  AUTO_BROADCAST_CONFIDENCE: 0.95,
});

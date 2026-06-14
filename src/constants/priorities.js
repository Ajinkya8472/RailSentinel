/**
 * src/constants/priorities.js
 *
 * Purpose:
 * Defines the canonical RailSentinel operational priority model. This file
 * serves as the single source of truth for P-level priority definitions,
 * ensuring consistent terminology, severity metadata, and sorting logic
 * across all domain models (incidents, notifications, schedule conflicts).
 *
 * Dependencies:
 * - None. Pure JS constants.
 *
 * Exports:
 * - PRIORITIES: The canonical map of P1 through P5 priority definitions.
 * - PRIORITY_ORDER_DESC: Ordered array of IDs from most to least severe.
 * - PRIORITY_ORDER_ASC: Ordered array of IDs from least to most severe.
 */

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

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
// Constants
// ---------------------------------------------------------------------------

/**
 * The canonical RailSentinel operational priority model.
 */
export const PRIORITIES = deepFreeze({
  P1: {
    id: 'P1',
    level: 'critical',
    label: 'Critical',
    fullLabel: 'P1 — Critical',
    description: 'Immediate threat to life-safety, severe infrastructure damage, or network-wide service halt. Requires immediate intervention and immediate broadcast.',
    severityScore: 100, // Normalized severity value for math/thresholds
    rank: 1,            // Numeric rank for sorting (1 is highest priority)
  },
  P2: {
    id: 'P2',
    level: 'high',
    label: 'High',
    fullLabel: 'P2 — High',
    description: 'Significant disruption to service, potential safety hazard, or localized infrastructure risk. Requires rapid escalation within 15 minutes.',
    severityScore: 75,
    rank: 2,
  },
  P3: {
    id: 'P3',
    level: 'medium',
    label: 'Medium',
    fullLabel: 'P3 — Medium',
    description: 'Notable operational risk or degraded performance requiring active monitoring and standard response within 1 hour.',
    severityScore: 50,
    rank: 3,
  },
  P4: {
    id: 'P4',
    level: 'low',
    label: 'Low',
    fullLabel: 'P4 — Low',
    description: 'Minor operational anomaly or schedule variation within normal tolerance limits. Monitor and log, no immediate action required.',
    severityScore: 25,
    rank: 4,
  },
  P5: {
    id: 'P5',
    level: 'informational',
    label: 'Informational',
    fullLabel: 'P5 — Informational',
    description: 'General system status updates, telemetry heartbeats, or standard lifecycle events. No risk and no action required.',
    severityScore: 0,
    rank: 5,
  },
});

/** Ordered descending by urgency/severity (P1 -> P5) */
export const PRIORITY_ORDER_DESC = deepFreeze(['P1', 'P2', 'P3', 'P4', 'P5']);

/** Ordered ascending by urgency/severity (P5 -> P1) */
export const PRIORITY_ORDER_ASC = deepFreeze(['P5', 'P4', 'P3', 'P2', 'P1']);

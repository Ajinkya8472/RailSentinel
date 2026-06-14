/**
 * src/constants/statuses.js
 *
 * Purpose:
 * Defines the canonical operational and lifecycle statuses across all major
 * RailSentinel domain models. Consolidating these ensures typo-free consistency
 * across stores, services, utility functions, and the UI without circular
 * dependencies to the individual type definitions.
 *
 * Dependencies:
 * - None. Pure JS constants.
 *
 * Exports:
 * - STATUS_INCIDENT
 * - STATUS_TRAIN
 * - STATUS_CROWD
 * - STATUS_SCHEDULE
 * - STATUS_ENERGY
 * - STATUS_RISK
 * - STATUS_NOTIFICATION
 * - STATUS_DELIVERY
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
// 1. INCIDENT Lifecycle
// ---------------------------------------------------------------------------

export const STATUS_INCIDENT = deepFreeze({
  /** Newly detected, awaiting triage */
  OPEN:         'open',
  /** Operator has seen and claimed the incident */
  ACKNOWLEDGED: 'acknowledged',
  /** Actively being mitigated or investigated */
  IN_PROGRESS:  'in_progress',
  /** Mitigation complete, normal operations resuming */
  RESOLVED:     'resolved',
  /** Formally closed post-mortem */
  CLOSED:       'closed',
  /** Pushed to higher management or external authorities */
  ESCALATED:    'escalated',

  ordered: ['open', 'acknowledged', 'in_progress', 'resolved', 'closed', 'escalated'],
});

// ---------------------------------------------------------------------------
// 2. TRAIN Operational State
// ---------------------------------------------------------------------------

export const STATUS_TRAIN = deepFreeze({
  /** Moving and adhering to schedule */
  ON_TIME:     'on-time',
  /** Moving but behind schedule */
  DELAYED:     'delayed',
  /** Service completely cancelled */
  CANCELLED:   'cancelled',
  /** Major disruption (e.g. stalled on track) */
  DISRUPTED:   'disrupted',
  /** Technical fault reported by telemetry */
  FAULT:       'fault',
  /** Blocked due to schedule conflict / pathing */
  CONFLICT:    'conflict',
  /** In depot or scheduled maintenance */
  MAINTENANCE: 'maintenance',
  /** Moving normally (generic alias) */
  RUNNING:     'running',
  /** Telemetry lost */
  UNKNOWN:     'unknown',
});

// ---------------------------------------------------------------------------
// 3. CROWD Forecast States
// ---------------------------------------------------------------------------

export const STATUS_CROWD = deepFreeze({
  /** Density well within safe limits */
  NORMAL:   'normal',
  /** Noticeable crowding, but manageable */
  ELEVATED: 'elevated',
  /** Approaching safe limits, requires staff attention */
  HIGH:     'high',
  /** Unsafe density, restrict platform access */
  CRITICAL: 'critical',
  /** Absolute limit exceeded, immediate intervention needed */
  BREACH:   'breach',
  /** Sensor offline */
  UNKNOWN:  'unknown',
});

// ---------------------------------------------------------------------------
// 4. SCHEDULE Conflict States
// ---------------------------------------------------------------------------

export const STATUS_SCHEDULE = deepFreeze({
  /** No conflict */
  ON_TIME:   'on_time',
  /** Close margins, potential conflict emerging */
  AT_RISK:   'at_risk',
  /** Active conflict detected, requires pathing resolution */
  CONFLICT:  'conflict',
  /** Schedule is broken due to external delay */
  DISRUPTED: 'disrupted',
  /** Operator has selected a resolution plan */
  RESOLVED:  'resolved',
  /** Waiting on approval or algorithmic plan */
  PENDING:   'pending',
});

// ---------------------------------------------------------------------------
// 5. ENERGY Profile States
// ---------------------------------------------------------------------------

export const STATUS_ENERGY = deepFreeze({
  /** Consumption below baseline */
  OPTIMAL:  'optimal',
  /** Consumption within standard deviation */
  NORMAL:   'normal',
  /** Consumption slightly above baseline */
  ELEVATED: 'elevated',
  /** Unexpected surge or leak detected */
  ANOMALY:  'anomaly',
  /** Severe power failure or hazardous spike */
  CRITICAL: 'critical',
  /** Meter/substation unreachable */
  OFFLINE:  'offline',
});

// ---------------------------------------------------------------------------
// 6. RISK Lifecycle States
// Note: Risk Score severity levels are generally managed via RISK_LEVEL,
// but the item lifecycle (actioning) uses these statuses.
// ---------------------------------------------------------------------------

export const STATUS_RISK = deepFreeze({
  /** Engine computed, unactioned by operator */
  ACTIVE:       'active',
  /** Operator recognized the risk */
  ACKNOWLEDGED: 'acknowledged',
  /** Mitigations applied or underlying cause removed */
  RESOLVED:     'resolved',
  /** Stale or superseded by newer computation */
  EXPIRED:      'expired',
  /** Marked as false positive by operator */
  DISMISSED:    'dismissed',
});

// ---------------------------------------------------------------------------
// 7. NOTIFICATION Reader Lifecycle
// ---------------------------------------------------------------------------

export const STATUS_NOTIFICATION = deepFreeze({
  UNREAD:       'unread',
  READ:         'read',
  ACKNOWLEDGED: 'acknowledged',
  DISMISSED:    'dismissed',
  EXPIRED:      'expired',

  terminal: ['dismissed', 'expired'],
});

// ---------------------------------------------------------------------------
// 8. DELIVERY Transport Status
// ---------------------------------------------------------------------------

export const STATUS_DELIVERY = deepFreeze({
  PENDING:   'pending',
  SENT:      'sent',
  DELIVERED: 'delivered',
  FAILED:    'failed',
  RETRYING:  'retrying',
  SKIPPED:   'skipped',

  terminal: ['delivered', 'failed', 'skipped'],
});

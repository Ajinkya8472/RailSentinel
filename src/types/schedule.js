/**
 * src/types/schedule.js
 *
 * Purpose:
 * Canonical ScheduleConflict domain model for RailSentinel. This file is the
 * authoritative definition of what a ScheduleConflict record is: its fields,
 * allowed enum values, field-level documentation, default values, and
 * relationship references to other domain models.
 *
 * A ScheduleConflict is a detected or operator-raised timetable disruption
 * affecting one or more train services on one or more routes. It is the
 * core entity of the M6 Smart Scheduling module. Conflicts are derived from
 * DISRUPTED_STATUS trains (delayed / cancelled / disrupted / conflict / fault)
 * and schedule-type Incidents, and may carry a linked RiskScore for priority
 * ranking.
 *
 * Architecture rules:
 *   - No API logic — does not fetch, send, or transform HTTP payloads.
 *   - No UI logic — does not import React, design tokens, or components.
 *   - No store logic — does not import or call Zustand.
 *   - Used by: scheduleService.js (mapping), useSchedules.js (normalization),
 *     M6/Dashboard components (prop validation), and future TypeScript migration.
 *
 * Schema fields:
 *   id                  — Unique conflict record identifier (UUID / string)
 *   scheduleId          — Alias used by useSchedules hook (payload?.scheduleId)
 *   title               — Short human-readable conflict title
 *   description         — Full narrative description of the conflict
 *   summary             — One-line summary for list / search display
 *   conflictReason      — Free-text reason string displayed in SchedulePage ConflictRow
 *   type                — Conflict classification: CONFLICT_TYPE enum
 *   subtype             — Free string sub-type within type
 *   severity            — Operational severity: CONFLICT_SEVERITY enum
 *   priority            — Dispatch urgency: CONFLICT_PRIORITY enum
 *   status              — Lifecycle state: CONFLICT_STATUS enum
 *   resolutionStatus    — Resolution workflow state: RESOLUTION_STATUS enum
 *   resolvedAt          — ISO timestamp of resolution (null if unresolved)
 *   resolvedBy          — Operator ID who resolved the conflict
 *   resolution          — Description of resolution action taken
 *   affectedTrainIds    — IDs of Train records disrupted by this conflict
 *   affectedTrainCount  — Count of disrupted trains (may be > length of affectedTrainIds)
 *   primaryTrainId      — The single highest-priority affected train (for UI detail panels)
 *   routeId             — Primary affected route ID (from routes.json)
 *   routeName           — Human-readable route name
 *   routeIds            — All affected route IDs (if multi-route conflict)
 *   stationId           — Primary affected station ID (null if route-wide)
 *   stationCode         — Primary affected station code
 *   stationName         — Primary affected station name
 *   segmentFrom         — Track segment start station code
 *   segmentTo           — Track segment end station code
 *   zoneCode            — Indian Railway zone code
 *   impactEstimate      — Structured impact assessment: IMPACT_ESTIMATE object
 *   delayMinutes        — Estimated or measured delay in minutes for primary train
 *   source              — How the conflict was detected: CONFLICT_SOURCE enum
 *   detectedAt          — ISO timestamp when conflict was first detected
 *   acknowledgedAt      — ISO timestamp of operator acknowledgement
 *   acknowledgedBy      — Operator ID who acknowledged
 *   assignedTo          — Assigned operator / controller
 *   assigneeId          — Structured assignee record reference ID
 *   tags                — Arbitrary string tags for filtering
 *   linkedIncidentIds   — IDs of Incident records related to this conflict
 *   linkedRiskScoreIds  — IDs of RiskScore records assessing this conflict
 *   linkedNotificationIds — IDs of Notifications dispatched for this conflict
 *   createdAt           — ISO timestamp of record creation
 *   updatedAt           — ISO timestamp of last modification
 *   lastUpdatedAt       — Store-canonical alias for updatedAt
 *   syncedAt            — ISO timestamp of last backend sync
 *   version             — Optimistic-concurrency version counter
 *   meta                — Arbitrary extension object for future fields
 *
 * impactEstimate object shape:
 *   passengerImpact     — Estimated number of passengers affected
 *   delayMinutesTotal   — Total delay-minutes across all affected trains
 *   cascadeRisk         — Whether the conflict may cascade to other services
 *   revenueImpact       — Estimated revenue impact category (low/medium/high)
 *   recoveryTimeMinutes — Estimated time to restore normal service
 *
 * Relationships:
 *   ScheduleConflict → Train[]        via affectedTrainIds     (M-to-M)
 *   ScheduleConflict → Route          via routeId              (M-to-1)
 *   ScheduleConflict → Route[]        via routeIds             (M-to-M)
 *   ScheduleConflict → Station        via stationId            (M-to-1, optional)
 *   ScheduleConflict → Incident[]     via linkedIncidentIds    (M-to-M)
 *   ScheduleConflict → RiskScore[]    via linkedRiskScoreIds   (M-to-M)
 *   ScheduleConflict → Notification[] via linkedNotificationIds(1-to-M)
 *
 * Dependencies:
 *   - None. Pure JS constants and plain objects.
 *
 * Exports:
 *   - CONFLICT_TYPE        → frozen enum: conflict classification types
 *   - CONFLICT_SEVERITY    → frozen enum: severity band values
 *   - CONFLICT_PRIORITY    → frozen enum: dispatch priority values
 *   - CONFLICT_STATUS      → frozen enum: lifecycle state values
 *   - RESOLUTION_STATUS    → frozen enum: resolution workflow state values
 *   - CONFLICT_SOURCE      → frozen enum: detection source values
 *   - SCHEDULE_SORT        → frozen enum: valid sort key strings
 *   - SCHEDULE_FIELD       → frozen map: field name → metadata
 *   - SCHEDULE_DEFAULTS    → frozen default ScheduleConflict record
 *   - createScheduleConflict  → factory: merges partial with defaults
 *   - isValidScheduleConflict → validator: minimum-contract check
 *   - normalizeScheduleConflict → normalizer: coerces raw payload to valid shape
 *   - ScheduleConflict (default) → frozen reference object
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
// CONFLICT_TYPE
// Classification of the timetable disruption.
// Aligned with SchedulePage ConflictRow display and incident category 'schedule'.
// ---------------------------------------------------------------------------

export const CONFLICT_TYPE = deepFreeze({
  /** Train running behind schedule */
  DELAY:            'delay',
  /** Service withdrawn entirely */
  CANCELLATION:     'cancellation',
  /** Partial cancellation — train terminates early or starts late */
  PARTIAL_CANCEL:   'partial_cancel',
  /** Train diverted to alternate route */
  DIVERSION:        'diversion',
  /** Train reversed or short-worked at intermediate station */
  SHORT_WORKING:    'short_working',
  /** Two trains competing for same platform / track slot */
  PLATFORM_CLASH:   'platform_clash',
  /** Signal / infrastructure blockage creating queue */
  TRACK_BLOCKAGE:   'track_blockage',
  /** Crossing loop / passing loop conflict on single line */
  CROSSING_CONFLICT:'crossing_conflict',
  /** Train held at station due to path not available */
  PATH_CONFLICT:    'path_conflict',
  /** Crew or loco change causing delay */
  CREW_LOCO:        'crew_loco',
  /** Technical fault on rolling stock */
  TECHNICAL_FAULT:  'technical_fault',
  /** External event causing timetable disruption */
  EXTERNAL_EVENT:   'external_event',
  /** Cascade delay — conflict caused by another train's delay */
  CASCADE:          'cascade',
  /** Catch-all */
  OTHER:            'other',

  /** Ordered display list */
  ordered: [
    'delay', 'cancellation', 'partial_cancel', 'diversion',
    'short_working', 'platform_clash', 'track_blockage',
    'crossing_conflict', 'path_conflict', 'crew_loco',
    'technical_fault', 'external_event', 'cascade', 'other',
  ],

  /** Human-readable labels */
  labels: {
    delay:             'Delay',
    cancellation:      'Cancellation',
    partial_cancel:    'Partial Cancellation',
    diversion:         'Diversion',
    short_working:     'Short Working',
    platform_clash:    'Platform Clash',
    track_blockage:    'Track Blockage',
    crossing_conflict: 'Crossing Conflict',
    path_conflict:     'Path Conflict',
    crew_loco:         'Crew / Loco Change',
    technical_fault:   'Technical Fault',
    external_event:    'External Event',
    cascade:           'Cascade Delay',
    other:             'Other',
  },
});

// ---------------------------------------------------------------------------
// CONFLICT_SEVERITY
// Operational severity band. Directly mirrors SchedulePage conflictSeverity()
// helper mapping: cancelled → critical, delayed → high, disrupted → medium.
// Aligned with colors.RISK for badge coloring.
// ---------------------------------------------------------------------------

export const CONFLICT_SEVERITY = deepFreeze({
  /** Service-halt level — cancellation or major route blockage */
  CRITICAL: 'critical',
  /** Significant disruption — major delay (>60 min) or multi-train impact */
  HIGH:     'high',
  /** Notable disruption — moderate delay (15–60 min) */
  MEDIUM:   'medium',
  /** Minor delay (<15 min) — within recovery tolerance */
  LOW:      'low',
  /** Informational — monitoring only */
  INFO:     'info',

  /**
   * Derive severity from a Train record status (matches SchedulePage logic).
   * @param {string} trainStatus
   * @returns {string}
   */
  fromTrainStatus(trainStatus) {
    switch (String(trainStatus ?? '').toLowerCase()) {
      case 'cancelled':  return 'critical';
      case 'delayed':    return 'high';
      case 'disrupted':  return 'medium';
      case 'fault':      return 'medium';
      case 'conflict':   return 'high';
      default:           return 'low';
    }
  },

  /** Ordered ascending (index 0 = least severe) */
  ordered: ['info', 'low', 'medium', 'high', 'critical'],
  orderedDesc: ['critical', 'high', 'medium', 'low', 'info'],
});

// ---------------------------------------------------------------------------
// CONFLICT_PRIORITY
// Dispatch urgency. Independent of severity — a medium-severity conflict on
// a VIP / Rajdhani route may be P1.
// ---------------------------------------------------------------------------

export const CONFLICT_PRIORITY = deepFreeze({
  /** Immediate — life-safety or full service-halt / P1 notification */
  P1: 'P1',
  /** Urgent — major disruption, escalate within 15 min */
  P2: 'P2',
  /** Standard — respond within 1 hour */
  P3: 'P3',
  /** Monitor — log and watch, no immediate action */
  P4: 'P4',

  /** Mapping from CONFLICT_SEVERITY to default CONFLICT_PRIORITY */
  fromSeverity: {
    critical: 'P1',
    high:     'P2',
    medium:   'P3',
    low:      'P4',
    info:     'P4',
  },

  /** Ordered ascending urgency (index 0 = lowest) */
  ordered: ['P1', 'P2', 'P3', 'P4'],
});

// ---------------------------------------------------------------------------
// CONFLICT_STATUS
// Lifecycle state of the ScheduleConflict record.
//
//   active → acknowledged → in_progress → resolved → closed
//                                ↓
//                            escalated
// ---------------------------------------------------------------------------

export const CONFLICT_STATUS = deepFreeze({
  /** Detected — no operator engagement */
  ACTIVE:       'active',
  /** Operator has acknowledged */
  ACKNOWLEDGED: 'acknowledged',
  /** Operator is actively managing */
  IN_PROGRESS:  'in_progress',
  /** Conflict is resolved, service restoring */
  RESOLVED:     'resolved',
  /** Archived — no further action */
  CLOSED:       'closed',
  /** Escalated to higher authority */
  ESCALATED:    'escalated',

  /** Terminal states */
  terminal: ['closed'],
  /** Active states requiring attention */
  active:   ['active', 'acknowledged', 'in_progress', 'escalated'],
});

// ---------------------------------------------------------------------------
// RESOLUTION_STATUS
// Resolution workflow progress — separate from lifecycle CONFLICT_STATUS.
// Maps to operator resolution actions in the M6 module.
// ---------------------------------------------------------------------------

export const RESOLUTION_STATUS = deepFreeze({
  /** No resolution action has been taken yet */
  UNRESOLVED:      'unresolved',
  /** Resolution options being assessed */
  UNDER_REVIEW:    'under_review',
  /** A mitigation action is being implemented */
  MITIGATING:      'mitigating',
  /** Conflict resolved by rerouting affected trains */
  REROUTED:        'rerouted',
  /** Conflict resolved by rescheduling the affected service */
  RESCHEDULED:     'rescheduled',
  /** Conflict resolved by cancelling the service */
  CANCELLED:       'cancelled',
  /** Conflict resolved through partial recovery (some delay remains) */
  PARTIAL:         'partial',
  /** Conflict fully resolved — service restored to normal */
  RESOLVED:        'resolved',
  /** Conflict auto-cleared by the scheduling engine without operator action */
  AUTO_CLEARED:    'auto_cleared',

  /** Ordered display list */
  ordered: [
    'unresolved', 'under_review', 'mitigating', 'rerouted',
    'rescheduled', 'cancelled', 'partial', 'resolved', 'auto_cleared',
  ],
});

// ---------------------------------------------------------------------------
// CONFLICT_SOURCE
// How the conflict was first detected.
// ---------------------------------------------------------------------------

export const CONFLICT_SOURCE = deepFreeze({
  /** Real-time feed from National Train Enquiry System / NTES */
  NTES:           'ntes',
  /** SCADA / control system generated alert */
  SCADA:          'scada',
  /** Schedule conflict detection engine (automated rule) */
  DETECTION_ENGINE:'detection_engine',
  /** AI prediction model flagged a likely conflict */
  AI_MODEL:       'ai_model',
  /** Operator manually raised the conflict */
  OPERATOR:       'operator',
  /** Crew / train staff reported via radio */
  CREW:           'crew',
  /** Station staff reported */
  STAFF:          'staff',
  /** Cascaded from another ScheduleConflict or Incident */
  CASCADE:        'cascade',
  /** External authority (transport department, state government) */
  EXTERNAL:       'external',
  /** Source not recorded */
  UNKNOWN:        'unknown',
});

// ---------------------------------------------------------------------------
// SCHEDULE_SORT
// Valid sort key strings (anticipating a future scheduleStore.setSort()).
// ---------------------------------------------------------------------------

export const SCHEDULE_SORT = deepFreeze({
  SEVERITY_DESC:  'severity_desc',
  SEVERITY_ASC:   'severity_asc',
  PRIORITY_DESC:  'priority_desc',
  PRIORITY_ASC:   'priority_asc',
  CREATED_DESC:   'createdAt_desc',
  CREATED_ASC:    'createdAt_asc',
  UPDATED_DESC:   'lastUpdatedAt_desc',
  UPDATED_ASC:    'lastUpdatedAt_asc',
  DELAY_DESC:     'delayMinutes_desc',
  DELAY_ASC:      'delayMinutes_asc',

  DEFAULT: 'severity_desc',
});

// ---------------------------------------------------------------------------
// SCHEDULE_FIELD
// Field-level metadata map.
// ---------------------------------------------------------------------------

export const SCHEDULE_FIELD = deepFreeze({
  id: {
    key: 'id', label: 'Conflict ID',
    type: 'string', required: true, indexed: true,
  },
  scheduleId: {
    key: 'scheduleId', label: 'Schedule ID (alias)',
    type: 'string', required: false, indexed: true,
    note: 'Alias used in useSchedules hook (payload?.scheduleId).',
  },
  title: {
    key: 'title', label: 'Title',
    type: 'string', required: false, indexed: false,
  },
  description: {
    key: 'description', label: 'Description',
    type: 'string', required: false, indexed: false,
  },
  summary: {
    key: 'summary', label: 'Summary',
    type: 'string', required: false, indexed: false,
  },
  conflictReason: {
    key: 'conflictReason', label: 'Conflict Reason',
    type: 'string', required: false, indexed: false,
    note: 'Displayed in SchedulePage ConflictRow (train.conflictReason).',
  },
  type: {
    key: 'type', label: 'Type',
    type: 'CONFLICT_TYPE', required: true, indexed: true,
  },
  subtype: {
    key: 'subtype', label: 'Sub-type',
    type: 'string', required: false, indexed: false,
  },
  severity: {
    key: 'severity', label: 'Severity',
    type: 'CONFLICT_SEVERITY', required: true, indexed: true,
  },
  priority: {
    key: 'priority', label: 'Priority',
    type: 'CONFLICT_PRIORITY', required: false, indexed: true,
  },
  status: {
    key: 'status', label: 'Status',
    type: 'CONFLICT_STATUS', required: true, indexed: true,
  },
  resolutionStatus: {
    key: 'resolutionStatus', label: 'Resolution Status',
    type: 'RESOLUTION_STATUS', required: false, indexed: true,
  },
  resolvedAt: {
    key: 'resolvedAt', label: 'Resolved At',
    type: 'ISO8601', required: false, indexed: false,
  },
  resolvedBy: {
    key: 'resolvedBy', label: 'Resolved By',
    type: 'string', required: false, indexed: false,
  },
  resolution: {
    key: 'resolution', label: 'Resolution',
    type: 'string', required: false, indexed: false,
  },
  affectedTrainIds: {
    key: 'affectedTrainIds', label: 'Affected Trains',
    type: 'string[]', required: false, indexed: false,
  },
  affectedTrainCount: {
    key: 'affectedTrainCount', label: 'Affected Train Count',
    type: 'number', required: false, indexed: true,
  },
  primaryTrainId: {
    key: 'primaryTrainId', label: 'Primary Train',
    type: 'string', required: false, indexed: true,
  },
  routeId: {
    key: 'routeId', label: 'Route ID',
    type: 'string', required: false, indexed: true,
  },
  routeName: {
    key: 'routeName', label: 'Route',
    type: 'string', required: false, indexed: true,
  },
  routeIds: {
    key: 'routeIds', label: 'All Affected Routes',
    type: 'string[]', required: false, indexed: false,
  },
  stationId: {
    key: 'stationId', label: 'Station ID',
    type: 'string', required: false, indexed: true,
  },
  stationCode: {
    key: 'stationCode', label: 'Station Code',
    type: 'string', required: false, indexed: false,
  },
  stationName: {
    key: 'stationName', label: 'Station',
    type: 'string', required: false, indexed: false,
  },
  segmentFrom: {
    key: 'segmentFrom', label: 'Segment From',
    type: 'string', required: false, indexed: false,
  },
  segmentTo: {
    key: 'segmentTo', label: 'Segment To',
    type: 'string', required: false, indexed: false,
  },
  zoneCode: {
    key: 'zoneCode', label: 'Zone',
    type: 'string', required: false, indexed: true,
  },
  impactEstimate: {
    key: 'impactEstimate', label: 'Impact Estimate',
    type: 'ImpactEstimate', required: false, indexed: false,
  },
  delayMinutes: {
    key: 'delayMinutes', label: 'Delay (min)',
    type: 'number', required: false, indexed: true,
  },
  source: {
    key: 'source', label: 'Source',
    type: 'CONFLICT_SOURCE', required: false, indexed: true,
  },
  detectedAt: {
    key: 'detectedAt', label: 'Detected At',
    type: 'ISO8601', required: false, indexed: true,
  },
  acknowledgedAt: {
    key: 'acknowledgedAt', label: 'Acknowledged At',
    type: 'ISO8601', required: false, indexed: false,
  },
  acknowledgedBy: {
    key: 'acknowledgedBy', label: 'Acknowledged By',
    type: 'string', required: false, indexed: false,
  },
  assignedTo: {
    key: 'assignedTo', label: 'Assigned To',
    type: 'string', required: false, indexed: true,
  },
  assigneeId: {
    key: 'assigneeId', label: 'Assignee ID',
    type: 'string', required: false, indexed: true,
  },
  tags: {
    key: 'tags', label: 'Tags',
    type: 'string[]', required: false, indexed: false,
  },
  linkedIncidentIds: {
    key: 'linkedIncidentIds', label: 'Linked Incidents',
    type: 'string[]', required: false, indexed: false,
  },
  linkedRiskScoreIds: {
    key: 'linkedRiskScoreIds', label: 'Linked Risk Scores',
    type: 'string[]', required: false, indexed: false,
  },
  linkedNotificationIds: {
    key: 'linkedNotificationIds', label: 'Linked Notifications',
    type: 'string[]', required: false, indexed: false,
  },
  createdAt: {
    key: 'createdAt', label: 'Created At',
    type: 'ISO8601', required: false, indexed: true,
  },
  updatedAt: {
    key: 'updatedAt', label: 'Updated At',
    type: 'ISO8601', required: false, indexed: false,
  },
  lastUpdatedAt: {
    key: 'lastUpdatedAt', label: 'Last Updated',
    type: 'ISO8601', required: false, indexed: false,
    note: 'Store-canonical alias for updatedAt.',
  },
  syncedAt: {
    key: 'syncedAt', label: 'Synced At',
    type: 'ISO8601', required: false, indexed: false,
  },
  version: {
    key: 'version', label: 'Version',
    type: 'number', required: false, indexed: false,
  },
  meta: {
    key: 'meta', label: 'Meta',
    type: 'object', required: false, indexed: false,
  },
});

// ---------------------------------------------------------------------------
// SCHEDULE_DEFAULTS
// Safe baseline values for every ScheduleConflict field.
// ---------------------------------------------------------------------------

export const SCHEDULE_DEFAULTS = deepFreeze({
  id:                    '',
  scheduleId:            null,
  title:                 '',
  description:           '',
  summary:               '',
  conflictReason:        '',
  type:                  CONFLICT_TYPE.OTHER,
  subtype:               '',
  severity:              CONFLICT_SEVERITY.LOW,
  priority:              CONFLICT_PRIORITY.P4,
  status:                CONFLICT_STATUS.ACTIVE,
  resolutionStatus:      RESOLUTION_STATUS.UNRESOLVED,
  resolvedAt:            null,
  resolvedBy:            null,
  resolution:            '',
  affectedTrainIds:      [],
  affectedTrainCount:    0,
  primaryTrainId:        null,
  routeId:               null,
  routeName:             '',
  routeIds:              [],
  stationId:             null,
  stationCode:           '',
  stationName:           '',
  segmentFrom:           '',
  segmentTo:             '',
  zoneCode:              '',
  impactEstimate: {
    passengerImpact:      0,
    delayMinutesTotal:    0,
    cascadeRisk:          false,
    revenueImpact:        'low',
    recoveryTimeMinutes:  0,
  },
  delayMinutes:          0,
  source:                CONFLICT_SOURCE.UNKNOWN,
  detectedAt:            null,
  acknowledgedAt:        null,
  acknowledgedBy:        null,
  assignedTo:            null,
  assigneeId:            null,
  tags:                  [],
  linkedIncidentIds:     [],
  linkedRiskScoreIds:    [],
  linkedNotificationIds: [],
  createdAt:             null,
  updatedAt:             null,
  lastUpdatedAt:         null,
  syncedAt:              null,
  version:               1,
  meta:                  {},
});

// ---------------------------------------------------------------------------
// createScheduleConflict
// Factory — merges a partial record with SCHEDULE_DEFAULTS.
// Auto-derives priority from severity if not provided.
//
// @param {Partial<typeof SCHEDULE_DEFAULTS>} partial
// @returns {typeof SCHEDULE_DEFAULTS}
// ---------------------------------------------------------------------------

export function createScheduleConflict(partial = {}) {
  if (!partial || typeof partial !== 'object') {
    return { ...SCHEDULE_DEFAULTS };
  }

  const now = new Date().toISOString();

  // Resolve severity
  const severity = partial.severity ?? SCHEDULE_DEFAULTS.severity;

  // Derive priority from severity if not provided
  const priority = partial.priority
    ?? CONFLICT_PRIORITY.fromSeverity[severity]
    ?? CONFLICT_PRIORITY.P4;

  // Normalize impactEstimate — merge with defaults, never null
  const impactEstimate = (partial.impactEstimate && typeof partial.impactEstimate === 'object')
    ? { ...SCHEDULE_DEFAULTS.impactEstimate, ...partial.impactEstimate }
    : { ...SCHEDULE_DEFAULTS.impactEstimate };

  // Derive conflictReason from description if not provided
  const conflictReason = partial.conflictReason ?? partial.description ?? '';

  return {
    ...SCHEDULE_DEFAULTS,
    ...partial,
    severity,
    priority,
    impactEstimate,
    conflictReason,
    // Ensure array fields
    affectedTrainIds:      Array.isArray(partial.affectedTrainIds)      ? partial.affectedTrainIds      : SCHEDULE_DEFAULTS.affectedTrainIds,
    routeIds:              Array.isArray(partial.routeIds)              ? partial.routeIds              : SCHEDULE_DEFAULTS.routeIds,
    tags:                  Array.isArray(partial.tags)                  ? partial.tags                  : SCHEDULE_DEFAULTS.tags,
    linkedIncidentIds:     Array.isArray(partial.linkedIncidentIds)     ? partial.linkedIncidentIds     : SCHEDULE_DEFAULTS.linkedIncidentIds,
    linkedRiskScoreIds:    Array.isArray(partial.linkedRiskScoreIds)    ? partial.linkedRiskScoreIds    : SCHEDULE_DEFAULTS.linkedRiskScoreIds,
    linkedNotificationIds: Array.isArray(partial.linkedNotificationIds) ? partial.linkedNotificationIds : SCHEDULE_DEFAULTS.linkedNotificationIds,
    meta: (partial.meta && typeof partial.meta === 'object' && !Array.isArray(partial.meta))
      ? { ...partial.meta }
      : {},
    // Timestamps
    detectedAt:    partial.detectedAt    ?? now,
    createdAt:     partial.createdAt     ?? now,
    updatedAt:     partial.updatedAt     ?? now,
    lastUpdatedAt: partial.lastUpdatedAt ?? partial.updatedAt ?? now,
    version: (typeof partial.version === 'number' && partial.version > 0) ? partial.version : 1,
  };
}

// ---------------------------------------------------------------------------
// isValidScheduleConflict
// Minimum-contract validator.
//
// @param {unknown} obj
// @returns {boolean}
// ---------------------------------------------------------------------------

export function isValidScheduleConflict(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.id || typeof obj.id !== 'string' || obj.id.trim() === '') return false;
  if (!obj.type) return false;
  if (!obj.severity) return false;
  if (!obj.status) return false;
  return true;
}

// ---------------------------------------------------------------------------
// normalizeScheduleConflict
// Coerces a raw API payload to a valid ScheduleConflict shape.
// Handles field-name aliases:
//   scheduleConflictId → id            (service layer uses scheduleConflictId)
//   schedule_conflict_id → id
//   scheduleId → scheduleId alias
//   updated_at → updatedAt
//   detected_at → detectedAt
//   conflict_reason → conflictReason
//   affected_trains → affectedTrainIds (array of IDs or Train objects)
//   delay → delayMinutes
//
// @param {unknown} raw
// @returns {typeof SCHEDULE_DEFAULTS | null}
// ---------------------------------------------------------------------------

export function normalizeScheduleConflict(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id =
    raw.id ??
    raw.scheduleConflictId ??
    raw.schedule_conflict_id ??
    raw.scheduleId ??
    null;
  if (!id) return null;

  // Resolve scheduleId alias
  const scheduleId = raw.scheduleId ?? raw.schedule_id ?? id;

  // Resolve timestamps
  const detectedAt    = raw.detectedAt    ?? raw.detected_at    ?? null;
  const updatedAt     = raw.updatedAt     ?? raw.updated_at     ?? detectedAt ?? null;
  const lastUpdatedAt = raw.lastUpdatedAt ?? updatedAt ?? null;
  const createdAt     = raw.createdAt     ?? raw.created_at     ?? null;

  // Resolve conflictReason
  const conflictReason = raw.conflictReason ?? raw.conflict_reason ?? raw.description ?? '';

  // Resolve delayMinutes
  const delayMinutes =
    typeof raw.delayMinutes === 'number' ? raw.delayMinutes :
    typeof raw.delay        === 'number' ? raw.delay        :
    0;

  // Resolve affectedTrainIds — accept array of IDs or array of Train objects
  let affectedTrainIds = SCHEDULE_DEFAULTS.affectedTrainIds;
  const rawTrains = raw.affectedTrainIds ?? raw.affected_trains ?? raw.affectedTrains ?? null;
  if (Array.isArray(rawTrains)) {
    affectedTrainIds = rawTrains.map((t) =>
      typeof t === 'string' ? t : (t?.id ?? t?.trainId ?? null)
    ).filter(Boolean);
  }

  // Resolve routeName
  const routeName = raw.routeName ?? raw.route_name ?? raw.route ?? '';

  return createScheduleConflict({
    ...raw,
    id,
    scheduleId,
    conflictReason,
    delayMinutes,
    routeName,
    affectedTrainIds,
    detectedAt,
    updatedAt,
    lastUpdatedAt,
    createdAt,
  });
}

// ---------------------------------------------------------------------------
// ScheduleConflict — reference schema object (default export)
// ---------------------------------------------------------------------------

/**
 * Canonical ScheduleConflict domain model — reference shape.
 *
 * @example
 * import ScheduleConflict from '../types/schedule.js';
 * // ScheduleConflict documents every field with its default value and type.
 */
const ScheduleConflict = deepFreeze({
  // ── Identity ──────────────────────────────────────────────────────────────
  id:                    'SC-00441',
  scheduleId:            'SC-00441',
  title:                 'Howrah Rajdhani path conflict — Kanpur loop',
  description:           'Train 12301 (Howrah Rajdhani) delayed 48 min at Kanpur Central due to path conflict with Goods train on UP main line. Cascading impact expected on trains 12309 and 14006.',
  summary:               'Path conflict at CNB — 3 trains affected, 48 min delay',
  conflictReason:        'Path conflict with goods train on UP main line at Kanpur Central',

  // ── Classification ────────────────────────────────────────────────────────
  type:                  CONFLICT_TYPE.PATH_CONFLICT,
  subtype:               'goods_vs_express',
  severity:              CONFLICT_SEVERITY.HIGH,
  priority:              CONFLICT_PRIORITY.P2,

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  status:                CONFLICT_STATUS.ACKNOWLEDGED,
  resolutionStatus:      RESOLUTION_STATUS.UNDER_REVIEW,
  resolvedAt:            null,
  resolvedBy:            null,
  resolution:            '',

  // ── Train impact ──────────────────────────────────────────────────────────
  affectedTrainIds:      ['TRN-12301', 'TRN-12309', 'TRN-14006'],
  affectedTrainCount:    3,
  primaryTrainId:        'TRN-12301',

  // ── Route & location ──────────────────────────────────────────────────────
  routeId:               'RT-001',
  routeName:             'New Delhi – Howrah',
  routeIds:              ['RT-001', 'RT-007'],
  stationId:             'STN-CNB',
  stationCode:           'CNB',
  stationName:           'Kanpur Central',
  segmentFrom:           'CNB',
  segmentTo:             'ALD',
  zoneCode:              'NCR',

  // ── Impact estimate ───────────────────────────────────────────────────────
  impactEstimate: {
    passengerImpact:      4380,
    delayMinutesTotal:    144,   // 48 min × 3 trains
    cascadeRisk:          true,
    revenueImpact:        'high',
    recoveryTimeMinutes:  65,
  },
  delayMinutes:          48,

  // ── Provenance ────────────────────────────────────────────────────────────
  source:                CONFLICT_SOURCE.DETECTION_ENGINE,
  detectedAt:            '2025-06-10T07:42:00.000Z',

  // ── Assignment ────────────────────────────────────────────────────────────
  acknowledgedAt:        '2025-06-10T07:45:00.000Z',
  acknowledgedBy:        'Controller-NCR-04',
  assignedTo:            'Controller-NCR-04',
  assigneeId:            'USR-0089',

  // ── Tags ──────────────────────────────────────────────────────────────────
  tags:                  ['path-conflict', 'cnb', 'rajdhani', 'ncr'],

  // ── Relationships ─────────────────────────────────────────────────────────
  linkedIncidentIds:     ['INC-000103'],
  linkedRiskScoreIds:    ['RSK-00220'],
  linkedNotificationIds: ['NTF-55601', 'NTF-55602'],

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt:             '2025-06-10T07:42:00.000Z',
  updatedAt:             '2025-06-10T07:45:10.000Z',
  lastUpdatedAt:         '2025-06-10T07:45:10.000Z',
  syncedAt:              '2025-06-10T07:45:15.000Z',

  // ── Concurrency ───────────────────────────────────────────────────────────
  version:               1,

  // ── Extension ─────────────────────────────────────────────────────────────
  meta:                  {},
});

export default ScheduleConflict;

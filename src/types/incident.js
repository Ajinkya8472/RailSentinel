/**
 * src/types/incident.js
 *
 * Purpose:
 * Canonical Incident domain model for RailSentinel. This file is the
 * authoritative definition of what an Incident record is: its fields,
 * allowed enum values, field-level documentation, default values, and
 * relationship references to other domain models.
 *
 * Architecture rules:
 *   - No API logic — this file does not fetch, send, or transform HTTP payloads.
 *   - No UI logic — this file does not import React, design tokens, or components.
 *   - No store logic — this file does not import or call Zustand.
 *   - Used by: incidentStore.js (normalization), incidentService.js (mapping),
 *     M1 components (prop validation), and any future TypeScript migration.
 *
 * Schema fields:
 *   id                    — Unique incident identifier (UUID / string)
 *   title                 — Short human-readable incident name
 *   description           — Full narrative describing the incident
 *   severity              — Operational severity band: SEVERITY enum
 *   priority              — Dispatch urgency: PRIORITY enum
 *   status                — Lifecycle state: STATUS enum
 *   category              — Domain category: CATEGORY enum
 *   type                  — Sub-type within category (free string, e.g. 'signal_failure')
 *   source                — How the incident was detected: SOURCE enum
 *   locationName          — Human-readable location string (station / route / track)
 *   locationCode          — Station or waypoint code (e.g. 'NDLS', 'CSTM')
 *   coordinates           — { lat, lng } GPS position of incident
 *   zoneCode              — Indian Railway zone code (e.g. 'NR', 'CR')
 *   routeId               — Affected route ID (from routes.json)
 *   affectedTrainCount    — Count of trains directly affected
 *   estimatedDelay        — Estimated delay in minutes (0 if none)
 *   assignedTo            — Assigned operator / controller identifier
 *   assigneeId            — Structured assignee record reference ID
 *   reportedBy            — User or system that raised the incident
 *   escalatedTo           — Next escalation target identifier (null if not escalated)
 *   tags                  — Arbitrary string tags for search / filtering
 *   notes                 — Ordered array of time-stamped operator notes
 *   attachments           — Array of attachment metadata records
 *   linkedTrainIds        — IDs of Train records involved in this incident
 *   linkedRiskScoreIds    — IDs of RiskScore records causally linked
 *   linkedNotificationIds — IDs of Notification records dispatched for this incident
 *   linkedIncidentIds     — IDs of related / parent / child Incident records
 *   isAcknowledged        — Whether an operator has acknowledged the incident
 *   acknowledgedAt        — ISO timestamp of acknowledgement
 *   acknowledgedBy        — Operator ID who acknowledged
 *   resolvedAt            — ISO timestamp of resolution (null if unresolved)
 *   resolvedBy            — Operator ID who resolved
 *   closedAt              — ISO timestamp of record closure
 *   createdAt             — ISO timestamp of record creation
 *   updatedAt             — ISO timestamp of last record modification (alias: lastUpdatedAt)
 *   lastUpdatedAt         — Store-canonical alias for updatedAt
 *   syncedAt              — ISO timestamp of last successful backend sync
 *   version               — Optimistic-concurrency version counter
 *   meta                  — Arbitrary extension object for future fields
 *
 * Relationships:
 *   Incident → Train[]         via linkedTrainIds       (M-to-M)
 *   Incident → RiskScore[]     via linkedRiskScoreIds   (M-to-M)
 *   Incident → Notification[]  via linkedNotificationIds(1-to-M, Incident is parent)
 *   Incident → Incident[]      via linkedIncidentIds    (M-to-M, e.g. related / parent)
 *   Incident → ScheduleConflict (indirect via routeId / linkedTrainIds)
 *
 * Dependencies:
 *   - None. Pure JS constants and plain objects.
 *
 * Exports:
 *   - INCIDENT_SEVERITY    → frozen enum: severity band values
 *   - INCIDENT_PRIORITY    → frozen enum: priority / urgency values
 *   - INCIDENT_STATUS      → frozen enum: lifecycle state values
 *   - INCIDENT_CATEGORY    → frozen enum: operational domain category values
 *   - INCIDENT_SOURCE      → frozen enum: detection source values
 *   - INCIDENT_SORT        → frozen enum: valid sort key strings
 *   - INCIDENT_FIELD       → frozen map: field name → metadata (label, type, required)
 *   - INCIDENT_DEFAULTS    → frozen default Incident record (safe baseline values)
 *   - createIncident       → factory function: merges a partial record with defaults
 *   - isValidIncident      → validator: returns true if object meets minimum contract
 *   - normalizeIncident    → normalizer: coerces a raw object into a valid Incident shape
 *   - Incident (default)   → frozen reference object documenting the full schema shape
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
// INCIDENT_SEVERITY
// Operational severity band. Aligned with RiskScore.band and colors.RISK.
// Higher severity = higher human / operational impact.
// ---------------------------------------------------------------------------

export const INCIDENT_SEVERITY = deepFreeze({
  /** Life-safety, service suspension, or fleet-wide impact */
  CRITICAL: 'critical',
  /** Significant disruption, major delay, or safety concern */
  HIGH:     'high',
  /** Notable degradation, moderate delay, or isolated fault */
  MEDIUM:   'medium',
  /** Minor issue, recoverable within normal operations */
  LOW:      'low',
  /** Informational / monitoring only */
  INFO:     'info',

  /** Ordered array — ascending severity (index 0 = least severe) */
  ordered: ['info', 'low', 'medium', 'high', 'critical'],

  /** Reverse ordered — descending severity (index 0 = most severe) */
  orderedDesc: ['critical', 'high', 'medium', 'low', 'info'],
});

// ---------------------------------------------------------------------------
// INCIDENT_PRIORITY
// Dispatch urgency. Priority determines alert channel, escalation SLA,
// and notification P-level. Independent of severity — a low-severity
// incident on a VIP route may be P1.
// ---------------------------------------------------------------------------

export const INCIDENT_PRIORITY = deepFreeze({
  /** Immediate dispatch — life-safety / service halt */
  P1: 'P1',
  /** Urgent — major disruption, escalate within 15 min */
  P2: 'P2',
  /** Standard — respond within 1 hour */
  P3: 'P3',
  /** Informational — log and monitor, no immediate action required */
  P4: 'P4',

  /** Ordered ascending (P4 = lowest urgency) */
  ordered: ['P1', 'P2', 'P3', 'P4'],
});

// ---------------------------------------------------------------------------
// INCIDENT_STATUS
// Lifecycle state machine.
//
//   open → acknowledged → in_progress → resolved → closed
//                                ↓
//                            escalated (re-enters acknowledged)
// ---------------------------------------------------------------------------

export const INCIDENT_STATUS = deepFreeze({
  /** Raised but no operator has engaged */
  OPEN:         'open',
  /** Operator has acknowledged; not yet working it */
  ACKNOWLEDGED: 'acknowledged',
  /** Actively being worked by an operator */
  IN_PROGRESS:  'in_progress',
  /** Root cause mitigated; service restoration underway */
  RESOLVED:     'resolved',
  /** Archived — no further action required */
  CLOSED:       'closed',
  /** Escalated to a higher authority or team */
  ESCALATED:    'escalated',
  /** Duplicate of another incident — suppressed */
  DUPLICATE:    'duplicate',
  /** Automatically suppressed (noise-reduction rule fired) */
  SUPPRESSED:   'suppressed',

  /** Valid terminal states — incident cannot be re-opened once in these */
  terminal: ['closed', 'duplicate', 'suppressed'],

  /** Valid non-terminal active states */
  active: ['open', 'acknowledged', 'in_progress', 'escalated'],
});

// ---------------------------------------------------------------------------
// INCIDENT_CATEGORY
// Domain category — top-level operational domain this incident belongs to.
// Used for module routing, chart grouping, and SLA tier selection.
// ---------------------------------------------------------------------------

export const INCIDENT_CATEGORY = deepFreeze({
  /** Train operational fault (signal, traction, door, brake) */
  TRAIN:        'train',
  /** Station infrastructure (platform, gate, lift, PA) */
  STATION:      'station',
  /** Track / civil infrastructure (track geometry, OHE, points) */
  TRACK:        'track',
  /** Crowd / passenger safety event */
  CROWD:        'crowd',
  /** Power / energy supply anomaly */
  POWER:        'power',
  /** Level crossing, trespass, or external road event */
  LEVEL_CROSSING:'level_crossing',
  /** Natural event (flood, cyclone, fog, landslide) */
  WEATHER:      'weather',
  /** Cybersecurity or data integrity event */
  CYBER:        'cyber',
  /** Medical emergency on train or station */
  MEDICAL:      'medical',
  /** Fire on train or station */
  FIRE:         'fire',
  /** Suspicious object, security threat */
  SECURITY:     'security',
  /** Fleet / rolling-stock maintenance alert */
  MAINTENANCE:  'maintenance',
  /** System-generated watchdog / anomaly detection event */
  SYSTEM:       'system',
  /** Catch-all for uncategorised incidents */
  OTHER:        'other',

  /** Ordered display list for filter dropdowns */
  ordered: [
    'train', 'station', 'track', 'crowd', 'power',
    'level_crossing', 'weather', 'cyber', 'medical',
    'fire', 'security', 'maintenance', 'system', 'other',
  ],
});

// ---------------------------------------------------------------------------
// INCIDENT_SOURCE
// How the incident was first detected.
// ---------------------------------------------------------------------------

export const INCIDENT_SOURCE = deepFreeze({
  /** Automatic: sensor / IoT reading exceeded threshold */
  SENSOR:       'sensor',
  /** Automatic: AI / ML anomaly detection model fired */
  AI:           'ai',
  /** Automatic: SCADA or control system alert */
  SCADA:        'scada',
  /** Automatic: crowd density / footfall model */
  CROWD_MODEL:  'crowd_model',
  /** Automatic: schedule conflict engine */
  SCHEDULE:     'schedule',
  /** Manual: train crew report via radio / console */
  CREW:         'crew',
  /** Manual: station staff report */
  STAFF:        'staff',
  /** Manual: operator created via dashboard */
  OPERATOR:     'operator',
  /** Manual: passenger report (helpline, app, SMS) */
  PASSENGER:    'passenger',
  /** External: railway police / emergency services */
  EXTERNAL:     'external',
  /** Imported from external incident management system */
  IMPORT:       'import',
  /** Source unknown or not recorded */
  UNKNOWN:      'unknown',
});

// ---------------------------------------------------------------------------
// INCIDENT_SORT
// Valid sort key strings for incidentStore.setSort().
// ---------------------------------------------------------------------------

export const INCIDENT_SORT = deepFreeze({
  SEVERITY_DESC:      'severity_desc',
  SEVERITY_ASC:       'severity_asc',
  CREATED_DESC:       'createdAt_desc',
  CREATED_ASC:        'createdAt_asc',
  UPDATED_DESC:       'lastUpdatedAt_desc',
  UPDATED_ASC:        'lastUpdatedAt_asc',
  PRIORITY_DESC:      'priority_desc',
  PRIORITY_ASC:       'priority_asc',

  /** Default sort used by incidentStore */
  DEFAULT:            'lastUpdatedAt_desc',
});

// ---------------------------------------------------------------------------
// INCIDENT_FIELD
// Field-level metadata map. Used by table column definitions, forms, and
// any future schema validation layer. Each entry documents:
//   key      — canonical field name (matches Incident schema)
//   label    — human-readable display label
//   type     — JS type string or enum name
//   required — whether the field must be present for a valid record
//   indexed  — whether the store indexes / sorts on this field
// ---------------------------------------------------------------------------

export const INCIDENT_FIELD = deepFreeze({
  id: {
    key: 'id', label: 'Incident ID',
    type: 'string', required: true, indexed: true,
  },
  title: {
    key: 'title', label: 'Title',
    type: 'string', required: true, indexed: false,
  },
  description: {
    key: 'description', label: 'Description',
    type: 'string', required: false, indexed: false,
  },
  severity: {
    key: 'severity', label: 'Severity',
    type: 'INCIDENT_SEVERITY', required: true, indexed: true,
  },
  priority: {
    key: 'priority', label: 'Priority',
    type: 'INCIDENT_PRIORITY', required: true, indexed: true,
  },
  status: {
    key: 'status', label: 'Status',
    type: 'INCIDENT_STATUS', required: true, indexed: true,
  },
  category: {
    key: 'category', label: 'Category',
    type: 'INCIDENT_CATEGORY', required: true, indexed: true,
  },
  type: {
    key: 'type', label: 'Type',
    type: 'string', required: false, indexed: true,
  },
  source: {
    key: 'source', label: 'Detection Source',
    type: 'INCIDENT_SOURCE', required: false, indexed: true,
  },
  locationName: {
    key: 'locationName', label: 'Location',
    type: 'string', required: false, indexed: false,
  },
  locationCode: {
    key: 'locationCode', label: 'Location Code',
    type: 'string', required: false, indexed: true,
  },
  coordinates: {
    key: 'coordinates', label: 'GPS Coordinates',
    type: '{ lat: number, lng: number }', required: false, indexed: false,
  },
  zoneCode: {
    key: 'zoneCode', label: 'Railway Zone',
    type: 'string', required: false, indexed: true,
  },
  routeId: {
    key: 'routeId', label: 'Affected Route',
    type: 'string', required: false, indexed: true,
  },
  affectedTrainCount: {
    key: 'affectedTrainCount', label: 'Affected Trains',
    type: 'number', required: false, indexed: false,
  },
  estimatedDelay: {
    key: 'estimatedDelay', label: 'Est. Delay (min)',
    type: 'number', required: false, indexed: false,
  },
  assignedTo: {
    key: 'assignedTo', label: 'Assigned To',
    type: 'string', required: false, indexed: true,
  },
  assigneeId: {
    key: 'assigneeId', label: 'Assignee ID',
    type: 'string', required: false, indexed: true,
  },
  reportedBy: {
    key: 'reportedBy', label: 'Reported By',
    type: 'string', required: false, indexed: false,
  },
  escalatedTo: {
    key: 'escalatedTo', label: 'Escalated To',
    type: 'string', required: false, indexed: false,
  },
  tags: {
    key: 'tags', label: 'Tags',
    type: 'string[]', required: false, indexed: false,
  },
  notes: {
    key: 'notes', label: 'Notes',
    type: 'IncidentNote[]', required: false, indexed: false,
  },
  attachments: {
    key: 'attachments', label: 'Attachments',
    type: 'IncidentAttachment[]', required: false, indexed: false,
  },
  linkedTrainIds: {
    key: 'linkedTrainIds', label: 'Linked Trains',
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
  linkedIncidentIds: {
    key: 'linkedIncidentIds', label: 'Related Incidents',
    type: 'string[]', required: false, indexed: false,
  },
  isAcknowledged: {
    key: 'isAcknowledged', label: 'Acknowledged',
    type: 'boolean', required: false, indexed: true,
  },
  acknowledgedAt: {
    key: 'acknowledgedAt', label: 'Acknowledged At',
    type: 'ISO8601', required: false, indexed: false,
  },
  acknowledgedBy: {
    key: 'acknowledgedBy', label: 'Acknowledged By',
    type: 'string', required: false, indexed: false,
  },
  resolvedAt: {
    key: 'resolvedAt', label: 'Resolved At',
    type: 'ISO8601', required: false, indexed: true,
  },
  resolvedBy: {
    key: 'resolvedBy', label: 'Resolved By',
    type: 'string', required: false, indexed: false,
  },
  closedAt: {
    key: 'closedAt', label: 'Closed At',
    type: 'ISO8601', required: false, indexed: false,
  },
  createdAt: {
    key: 'createdAt', label: 'Created At',
    type: 'ISO8601', required: true, indexed: true,
  },
  updatedAt: {
    key: 'updatedAt', label: 'Updated At',
    type: 'ISO8601', required: false, indexed: true,
  },
  lastUpdatedAt: {
    key: 'lastUpdatedAt', label: 'Last Updated',
    type: 'ISO8601', required: false, indexed: true,
    note: 'Store-canonical alias for updatedAt — always kept in sync.',
  },
  syncedAt: {
    key: 'syncedAt', label: 'Last Synced',
    type: 'ISO8601', required: false, indexed: false,
  },
  version: {
    key: 'version', label: 'Version',
    type: 'number', required: false, indexed: false,
  },
  meta: {
    key: 'meta', label: 'Meta',
    type: 'object', required: false, indexed: false,
    note: 'Arbitrary extension object — never used for filtering or display.',
  },
});

// ---------------------------------------------------------------------------
// INCIDENT_DEFAULTS
// Safe baseline values for every Incident field. Use as the merge target
// in createIncident() to guarantee a fully-shaped record even from partial
// API payloads.
// ---------------------------------------------------------------------------

export const INCIDENT_DEFAULTS = deepFreeze({
  id:                    '',
  title:                 '',
  description:           '',
  severity:              INCIDENT_SEVERITY.MEDIUM,
  priority:              INCIDENT_PRIORITY.P3,
  status:                INCIDENT_STATUS.OPEN,
  category:              INCIDENT_CATEGORY.OTHER,
  type:                  '',
  source:                INCIDENT_SOURCE.UNKNOWN,
  locationName:          '',
  locationCode:          '',
  coordinates:           null,
  zoneCode:              '',
  routeId:               null,
  affectedTrainCount:    0,
  estimatedDelay:        0,
  assignedTo:            null,
  assigneeId:            null,
  reportedBy:            null,
  escalatedTo:           null,
  tags:                  [],
  notes:                 [],
  attachments:           [],
  linkedTrainIds:        [],
  linkedRiskScoreIds:    [],
  linkedNotificationIds: [],
  linkedIncidentIds:     [],
  isAcknowledged:        false,
  acknowledgedAt:        null,
  acknowledgedBy:        null,
  resolvedAt:            null,
  resolvedBy:            null,
  closedAt:              null,
  createdAt:             null,
  updatedAt:             null,
  lastUpdatedAt:         null,
  syncedAt:              null,
  version:               1,
  meta:                  {},
});

// ---------------------------------------------------------------------------
// createIncident
// Factory function — merges a partial record with INCIDENT_DEFAULTS to produce
// a fully-shaped Incident object. Does not validate enum membership; call
// isValidIncident() afterward if strict validation is required.
//
// @param {Partial<typeof INCIDENT_DEFAULTS>} partial
// @returns {typeof INCIDENT_DEFAULTS}
// ---------------------------------------------------------------------------

export function createIncident(partial = {}) {
  if (!partial || typeof partial !== 'object') {
    return { ...INCIDENT_DEFAULTS };
  }

  const now = new Date().toISOString();

  // Merge defaults with the provided partial record.
  // Arrays and objects from partial take priority; null/undefined fields
  // fall back to defaults.
  const merged = {
    ...INCIDENT_DEFAULTS,
    ...partial,
    // Ensure array fields are always arrays, never null
    tags:                  Array.isArray(partial.tags)                  ? partial.tags                  : INCIDENT_DEFAULTS.tags,
    notes:                 Array.isArray(partial.notes)                 ? partial.notes                 : INCIDENT_DEFAULTS.notes,
    attachments:           Array.isArray(partial.attachments)           ? partial.attachments           : INCIDENT_DEFAULTS.attachments,
    linkedTrainIds:        Array.isArray(partial.linkedTrainIds)        ? partial.linkedTrainIds        : INCIDENT_DEFAULTS.linkedTrainIds,
    linkedRiskScoreIds:    Array.isArray(partial.linkedRiskScoreIds)    ? partial.linkedRiskScoreIds    : INCIDENT_DEFAULTS.linkedRiskScoreIds,
    linkedNotificationIds: Array.isArray(partial.linkedNotificationIds) ? partial.linkedNotificationIds : INCIDENT_DEFAULTS.linkedNotificationIds,
    linkedIncidentIds:     Array.isArray(partial.linkedIncidentIds)     ? partial.linkedIncidentIds     : INCIDENT_DEFAULTS.linkedIncidentIds,
    meta: (partial.meta && typeof partial.meta === 'object' && !Array.isArray(partial.meta))
      ? { ...partial.meta }
      : {},
    // Timestamps — seed with now if not provided
    createdAt:     partial.createdAt     ?? now,
    updatedAt:     partial.updatedAt     ?? now,
    lastUpdatedAt: partial.lastUpdatedAt ?? partial.updatedAt ?? now,
    version:       (typeof partial.version === 'number' && partial.version > 0) ? partial.version : 1,
  };

  return merged;
}

// ---------------------------------------------------------------------------
// isValidIncident
// Minimum-contract validator. Returns true if the object has the required
// fields with non-empty values. Does not validate enum membership — intended
// for fast runtime checks (e.g., before upsert into the store).
//
// @param {unknown} obj
// @returns {boolean}
// ---------------------------------------------------------------------------

export function isValidIncident(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.id || typeof obj.id !== 'string' || obj.id.trim() === '') return false;
  if (!obj.title || typeof obj.title !== 'string') return false;
  if (!obj.severity) return false;
  if (!obj.status) return false;
  return true;
}

// ---------------------------------------------------------------------------
// normalizeIncident
// Coerces a raw API payload or partial object into a valid, complete Incident
// shape. Handles field-name aliases used by different backend versions:
//   incidentId → id
//   updatedAt  → lastUpdatedAt (sync)
//   lastUpdated → lastUpdatedAt
//   assignee   → assignedTo (if assignedTo absent)
//
// @param {unknown} raw
// @returns {typeof INCIDENT_DEFAULTS | null} null if raw has no usable id
// ---------------------------------------------------------------------------

export function normalizeIncident(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Resolve ID from multiple possible backend field names
  const id = raw.id ?? raw.incidentId ?? raw.incident_id ?? null;
  if (!id) return null;

  // Resolve timestamp aliases
  const updatedAt     = raw.updatedAt ?? raw.updated_at ?? raw.lastUpdated ?? null;
  const lastUpdatedAt = raw.lastUpdatedAt ?? updatedAt ?? null;
  const createdAt     = raw.createdAt ?? raw.created_at ?? null;

  // Resolve assignee aliases
  const assignedTo = raw.assignedTo ?? raw.assignee ?? null;
  const assigneeId = raw.assigneeId ?? raw.assignee_id ?? null;

  // Resolve linked ID arrays — coerce nulls to empty arrays
  const linkedTrainIds        = Array.isArray(raw.linkedTrainIds)        ? raw.linkedTrainIds        : [];
  const linkedRiskScoreIds    = Array.isArray(raw.linkedRiskScoreIds)    ? raw.linkedRiskScoreIds    : [];
  const linkedNotificationIds = Array.isArray(raw.linkedNotificationIds) ? raw.linkedNotificationIds : [];
  const linkedIncidentIds     = Array.isArray(raw.linkedIncidentIds)     ? raw.linkedIncidentIds     : [];

  return createIncident({
    ...raw,
    id,
    assignedTo,
    assigneeId,
    updatedAt,
    lastUpdatedAt,
    createdAt,
    linkedTrainIds,
    linkedRiskScoreIds,
    linkedNotificationIds,
    linkedIncidentIds,
  });
}

// ---------------------------------------------------------------------------
// Incident — reference schema object (default export)
// Documents the canonical shape of a fully-formed Incident record.
// This object is frozen and serves as the authoritative schema reference
// for documentation, Storybook args, and mock data generators.
// ---------------------------------------------------------------------------

/**
 * Canonical Incident domain model — reference shape.
 *
 * @example
 * import Incident from '../types/incident.js';
 * // Incident documents every field with its default value and type.
 */
const Incident = deepFreeze({
  // ── Identity ─────────────────────────────────────────────────────────────
  id:                    'INC-000000',
  title:                 'Signal failure at Hazrat Nizamuddin',
  description:           'Automatic signal at DN track has failed. Manual token working in effect.',

  // ── Severity & priority ───────────────────────────────────────────────────
  severity:              INCIDENT_SEVERITY.HIGH,
  priority:              INCIDENT_PRIORITY.P2,

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  status:                INCIDENT_STATUS.OPEN,
  isAcknowledged:        false,
  acknowledgedAt:        null,
  acknowledgedBy:        null,
  resolvedAt:            null,
  resolvedBy:            null,
  closedAt:              null,

  // ── Classification ────────────────────────────────────────────────────────
  category:              INCIDENT_CATEGORY.TRACK,
  type:                  'signal_failure',
  source:                INCIDENT_SOURCE.SCADA,
  tags:                  ['signal', 'track', 'delhi'],

  // ── Location ──────────────────────────────────────────────────────────────
  locationName:          'Hazrat Nizamuddin Station',
  locationCode:          'NZM',
  coordinates:           { lat: 28.5895, lng: 77.2544 },
  zoneCode:              'NR',
  routeId:               'RT-001',

  // ── Impact ────────────────────────────────────────────────────────────────
  affectedTrainCount:    4,
  estimatedDelay:        35,

  // ── Assignment ────────────────────────────────────────────────────────────
  assignedTo:            'Controller-A12',
  assigneeId:            'USR-0042',
  reportedBy:            'SCADA-NR-01',
  escalatedTo:           null,

  // ── Rich content ──────────────────────────────────────────────────────────
  notes:                 [],
  attachments:           [],

  // ── Relationships ─────────────────────────────────────────────────────────
  linkedTrainIds:        ['TRN-12345', 'TRN-67890'],
  linkedRiskScoreIds:    ['RSK-00112'],
  linkedNotificationIds: ['NTF-88001'],
  linkedIncidentIds:     [],

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt:             '2025-06-10T05:30:00.000Z',
  updatedAt:             '2025-06-10T05:45:00.000Z',
  lastUpdatedAt:         '2025-06-10T05:45:00.000Z',
  syncedAt:              '2025-06-10T05:45:10.000Z',

  // ── Optimistic concurrency ────────────────────────────────────────────────
  version:               1,

  // ── Extension ─────────────────────────────────────────────────────────────
  meta:                  {},
});

export default Incident;

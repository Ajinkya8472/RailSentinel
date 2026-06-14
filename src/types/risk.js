/**
 * src/types/risk.js
 *
 * Purpose:
 * Canonical RiskScore domain model for RailSentinel. This file is the
 * authoritative definition of what a RiskScore record is: its fields,
 * allowed enum values, field-level documentation, default values, and
 * relationship references to other domain models.
 *
 * A RiskScore is a computed, time-stamped composite risk assessment produced
 * by the RailSentinel risk engine. It aggregates signals from one or more
 * source domains (incidents, train health, crowd density, energy, schedule)
 * into a single numeric score (0–100) and a named severity band. It drives
 * the M5 Predictive Intelligence module, alert priority assignment, and
 * operator intervention recommendations.
 *
 * Architecture rules:
 *   - No API logic — this file does not fetch, send, or transform HTTP payloads.
 *   - No UI logic — this file does not import React, design tokens, or components.
 *   - No store logic — this file does not import or call Zustand.
 *   - Used by: riskStore.js (normalization), riskService.js (mapping),
 *     M5/Dashboard components (prop validation), and future TypeScript migration.
 *
 * Schema fields:
 *   id                — Unique risk score record identifier (UUID / string)
 *   name              — Short human-readable risk item name
 *   title             — Full descriptive title for the risk assessment
 *   description       — Narrative explanation of the risk
 *   summary           — One-line summary for list / search (used in store search)
 *   score             — Composite risk score 0–100 (100 = maximum risk)
 *   severityScore     — Raw severity signal 0–100 (used in riskStore sort)
 *   level             — Alias for severityBand: RISK_LEVEL enum
 *   severityBand      — Named severity band derived from score: RISK_LEVEL enum
 *                       (used in riskStore applyFilters severity filter)
 *   priorityBand      — Dispatch priority band: PRIORITY_BAND enum
 *   confidence        — Model confidence 0.0–1.0 float
 *   confidenceBand    — Named confidence band from confidence float
 *   explanation       — Structured array of contributing factor explanations
 *   sourceDomains     — List of domain names that contributed to this score
 *   source            — Primary signal source (used in riskStore applyFilters)
 *   category          — Risk domain category: RISK_CATEGORY enum
 *                       (used in riskStore applyFilters category filter)
 *   subcategory       — Free string sub-category within category
 *   entityType        — Type of entity this score is attached to: ENTITY_TYPE enum
 *   entityId          — ID of the entity being scored (Train / Station / Route / etc.)
 *   entityName        — Human-readable entity name
 *   stationId         — Station context (null if not station-scoped)
 *   stationCode       — Station code context
 *   routeId           — Route context (null if not route-scoped)
 *   zoneCode          — Indian Railway zone code context
 *   recommendation    — Primary operator action recommendation
 *   mitigations       — Ordered list of mitigation step objects
 *   isAcknowledged    — Whether an operator has acknowledged this risk item
 *   acknowledgedAt    — ISO timestamp of acknowledgement
 *   acknowledgedBy    — Operator ID who acknowledged
 *   isResolved        — Whether the risk has been resolved
 *   resolvedAt        — ISO timestamp of resolution
 *   resolvedBy        — Operator ID who resolved
 *   linkedIncidentIds — IDs of Incident records contributing to or caused by this score
 *   linkedTrainIds    — IDs of Train records assessed by this score
 *   linkedCrowdIds    — IDs of CrowdForecast records contributing to this score
 *   linkedNotificationIds — IDs of Notifications dispatched for this risk
 *   tags              — Arbitrary string tags
 *   computedAt        — ISO timestamp when the risk engine computed this score
 *                       (primary sort key in riskStore: computedAt_desc)
 *   validUntil        — ISO timestamp after which this score should be considered stale
 *   createdAt         — ISO timestamp of record creation
 *   updatedAt         — ISO timestamp of last modification
 *   lastUpdatedAt     — Store-canonical alias for updatedAt
 *   syncedAt          — ISO timestamp of last backend sync
 *   modelVersion      — Risk engine version string
 *   version           — Optimistic-concurrency version counter
 *   meta              — Arbitrary extension object for future fields
 *
 * Relationships:
 *   RiskScore → Train[]         via linkedTrainIds       (M-to-M)
 *   RiskScore → Incident[]      via linkedIncidentIds    (M-to-M)
 *   RiskScore → CrowdForecast[] via linkedCrowdIds       (M-to-M)
 *   RiskScore → Notification[]  via linkedNotificationIds(1-to-M)
 *   RiskScore → Station         via stationId            (M-to-1, optional)
 *   RiskScore → Route           via routeId              (M-to-1, optional)
 *   RiskScore → entity          via entityType + entityId(polymorphic, M-to-1)
 *
 * Dependencies:
 *   - None. Pure JS constants and plain objects.
 *
 * Exports:
 *   - RISK_LEVEL        → frozen enum: severity band / level values
 *   - PRIORITY_BAND     → frozen enum: dispatch priority band values
 *   - RISK_CATEGORY     → frozen enum: domain category values
 *   - ENTITY_TYPE       → frozen enum: scorable entity type values
 *   - RISK_CONFIDENCE   → frozen enum: confidence band values + fromScore()
 *   - RISK_SOURCE       → frozen enum: contributing signal source values
 *   - RISK_SORT         → frozen enum: valid sort key strings for riskStore
 *   - RISK_FIELD        → frozen map: field name → metadata
 *   - RISK_DEFAULTS     → frozen default RiskScore record
 *   - createRiskScore   → factory: merges partial record with defaults
 *   - isValidRiskScore  → validator: minimum-contract check
 *   - normalizeRiskScore → normalizer: coerces raw payload to valid RiskScore shape
 *   - RiskScore (default) → frozen reference object documenting the full schema
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
// RISK_LEVEL
// Severity band derived from the composite score (0–100).
// Aligned with colors.RISK, incident severity mapping, and the map-marker
// asset colour coding.
// ---------------------------------------------------------------------------

export const RISK_LEVEL = deepFreeze({
  /** Score 80–100 — immediate danger, life-safety or service-halt risk */
  CRITICAL: 'critical',
  /** Score 60–79 — significant disruption or safety concern */
  HIGH:     'high',
  /** Score 40–59 — notable risk requiring monitoring */
  MEDIUM:   'medium',
  /** Score 20–39 — minor risk, within normal tolerance */
  LOW:      'low',
  /** Score 0–19 — negligible risk, baseline operational noise */
  MINIMAL:  'minimal',
  /** Level not determinable from available signals */
  UNKNOWN:  'unknown',

  /** Score thresholds — inclusive lower bound for each band */
  thresholds: {
    critical: 80,
    high:     60,
    medium:   40,
    low:      20,
    minimal:  0,
  },

  /**
   * Derive a RISK_LEVEL from a raw 0–100 numeric score.
   * @param {number | null | undefined} score
   * @returns {string}
   */
  fromScore(score) {
    const n = typeof score === 'number' ? score : -1;
    if (n < 0)    return 'unknown';
    if (n >= 80)  return 'critical';
    if (n >= 60)  return 'high';
    if (n >= 40)  return 'medium';
    if (n >= 20)  return 'low';
    return 'minimal';
  },

  /** Ordered ascending (index 0 = least severe) */
  ordered: ['minimal', 'low', 'medium', 'high', 'critical'],
  /** Ordered descending (index 0 = most severe) */
  orderedDesc: ['critical', 'high', 'medium', 'low', 'minimal', 'unknown'],
});

// ---------------------------------------------------------------------------
// PRIORITY_BAND
// Dispatch urgency derived from the risk level and entity context.
// Maps to Notification priority levels (P1–P4).
// ---------------------------------------------------------------------------

export const PRIORITY_BAND = deepFreeze({
  /** Immediate — life-safety / service halt / P1 notification */
  IMMEDIATE:  'immediate',
  /** Urgent — major disruption, escalate within 15 min / P2 */
  URGENT:     'urgent',
  /** Standard — respond within 1 hour / P3 */
  STANDARD:   'standard',
  /** Monitor — log and watch, no immediate action / P4 */
  MONITOR:    'monitor',

  /** Mapping from RISK_LEVEL to default PRIORITY_BAND */
  fromLevel: {
    critical: 'immediate',
    high:     'urgent',
    medium:   'standard',
    low:      'monitor',
    minimal:  'monitor',
    unknown:  'monitor',
  },

  /** Ordered ascending urgency (index 0 = lowest) */
  ordered: ['monitor', 'standard', 'urgent', 'immediate'],
});

// ---------------------------------------------------------------------------
// RISK_CATEGORY
// Domain category of the risk. Used in riskStore applyFilters category field.
// Aligned with INCIDENT_CATEGORY where domains overlap.
// ---------------------------------------------------------------------------

export const RISK_CATEGORY = deepFreeze({
  /** Train operational fault or fleet risk */
  TRAIN:           'train',
  /** Station infrastructure risk */
  STATION:         'station',
  /** Track / civil infrastructure risk */
  TRACK:           'track',
  /** Crowd density / passenger safety risk */
  CROWD:           'crowd',
  /** Power / energy supply risk */
  POWER:           'power',
  /** Schedule conflict or disruption risk */
  SCHEDULE:        'schedule',
  /** Natural event risk (weather, flood) */
  WEATHER:         'weather',
  /** Level crossing or external road risk */
  LEVEL_CROSSING:  'level_crossing',
  /** Cybersecurity or data integrity risk */
  CYBER:           'cyber',
  /** Composite multi-domain risk */
  COMPOSITE:       'composite',
  /** Catch-all for unclassified risks */
  OTHER:           'other',

  /** Ordered display list for filter dropdown */
  ordered: [
    'train', 'station', 'track', 'crowd', 'power', 'schedule',
    'weather', 'level_crossing', 'cyber', 'composite', 'other',
  ],
});

// ---------------------------------------------------------------------------
// ENTITY_TYPE
// The type of entity this RiskScore is attached to (polymorphic FK).
// Used alongside entityId to resolve the scored entity record.
// ---------------------------------------------------------------------------

export const ENTITY_TYPE = deepFreeze({
  TRAIN:          'train',
  STATION:        'station',
  ROUTE:          'route',
  PLATFORM:       'platform',
  TRACK_SECTION:  'track_section',
  ZONE:           'zone',
  NETWORK:        'network',
  SYSTEM:         'system',
  UNKNOWN:        'unknown',
});

// ---------------------------------------------------------------------------
// RISK_CONFIDENCE
// Named confidence band for the risk engine's self-reported certainty.
// Mirrors CONFIDENCE_BAND in crowd.js but is independently authoritative
// here so types/risk.js remains free of cross-type imports.
// ---------------------------------------------------------------------------

export const RISK_CONFIDENCE = deepFreeze({
  /** confidence ≥ 0.90 */
  HIGH:     'high',
  /** confidence 0.70–0.89 */
  MEDIUM:   'medium',
  /** confidence 0.50–0.69 */
  LOW:      'low',
  /** confidence < 0.50 — treat as indicative only */
  VERY_LOW: 'very_low',
  /** Model did not return a confidence value */
  UNKNOWN:  'unknown',

  /**
   * Derive a RISK_CONFIDENCE band from a raw 0–1 float.
   * @param {number | null | undefined} score
   * @returns {string}
   */
  fromScore(score) {
    const n = typeof score === 'number' ? score : -1;
    if (n >= 0.90) return 'high';
    if (n >= 0.70) return 'medium';
    if (n >= 0.50) return 'low';
    if (n >= 0)    return 'very_low';
    return 'unknown';
  },

  /** Ordered descending confidence */
  ordered: ['high', 'medium', 'low', 'very_low', 'unknown'],
});

// ---------------------------------------------------------------------------
// RISK_SOURCE
// Primary signal source for the risk computation.
// Used in riskStore applyFilters source field.
// ---------------------------------------------------------------------------

export const RISK_SOURCE = deepFreeze({
  /** Triggered by an active Incident record */
  INCIDENT:     'incident',
  /** Triggered by a Train health / telemetry signal */
  TRAIN:        'train',
  /** Triggered by a CrowdForecast threshold breach */
  CROWD:        'crowd',
  /** Triggered by an Energy / power anomaly */
  ENERGY:       'energy',
  /** Triggered by a Schedule conflict */
  SCHEDULE:     'schedule',
  /** Triggered by a Sensor reading alert */
  SENSOR:       'sensor',
  /** Triggered by an AI anomaly detection model (no single source) */
  AI:           'ai',
  /** Composite — aggregated from multiple domain signals */
  COMPOSITE:    'composite',
  /** Operator-defined risk (manually created) */
  MANUAL:       'manual',
  /** Historical pattern / calendar risk */
  HISTORICAL:   'historical',
  /** External data feed */
  EXTERNAL:     'external',
  /** Source not recorded */
  UNKNOWN:      'unknown',
});

// ---------------------------------------------------------------------------
// RISK_SORT
// Valid sort key strings for riskStore.setSort().
// ---------------------------------------------------------------------------

export const RISK_SORT = deepFreeze({
  SEVERITY_DESC:   'severity_desc',
  SEVERITY_ASC:    'severity_asc',
  COMPUTED_DESC:   'computedAt_desc',
  COMPUTED_ASC:    'computedAt_asc',
  SCORE_DESC:      'score_desc',
  SCORE_ASC:       'score_asc',
  LEVEL_DESC:      'level_desc',
  LEVEL_ASC:       'level_asc',

  /** Default sort used by riskStore */
  DEFAULT: 'computedAt_desc',
});

// ---------------------------------------------------------------------------
// RISK_FIELD
// Field-level metadata map — label, type, required, indexed.
// ---------------------------------------------------------------------------

export const RISK_FIELD = deepFreeze({
  id: {
    key: 'id', label: 'Risk Score ID',
    type: 'string', required: true, indexed: true,
  },
  name: {
    key: 'name', label: 'Name',
    type: 'string', required: false, indexed: true,
    note: 'Used in riskStore search.',
  },
  title: {
    key: 'title', label: 'Title',
    type: 'string', required: false, indexed: true,
    note: 'Used in riskStore search.',
  },
  description: {
    key: 'description', label: 'Description',
    type: 'string', required: false, indexed: false,
    note: 'Used in riskStore search.',
  },
  summary: {
    key: 'summary', label: 'Summary',
    type: 'string', required: false, indexed: false,
    note: 'Used in riskStore search.',
  },
  score: {
    key: 'score', label: 'Risk Score',
    type: 'number (0–100)', required: true, indexed: true,
  },
  severityScore: {
    key: 'severityScore', label: 'Severity Score',
    type: 'number (0–100)', required: false, indexed: true,
    note: 'Used in riskStore sortRiskScores (severity_desc / severity_asc).',
  },
  level: {
    key: 'level', label: 'Risk Level',
    type: 'RISK_LEVEL', required: false, indexed: true,
    note: 'Alias for severityBand — kept in sync by normalizeRiskScore.',
  },
  severityBand: {
    key: 'severityBand', label: 'Severity Band',
    type: 'RISK_LEVEL', required: true, indexed: true,
    note: 'Used in riskStore applyFilters (severity filter).',
  },
  priorityBand: {
    key: 'priorityBand', label: 'Priority Band',
    type: 'PRIORITY_BAND', required: false, indexed: true,
  },
  confidence: {
    key: 'confidence', label: 'Confidence',
    type: 'number (0.0–1.0)', required: false, indexed: false,
  },
  confidenceBand: {
    key: 'confidenceBand', label: 'Confidence Band',
    type: 'RISK_CONFIDENCE', required: false, indexed: false,
  },
  explanation: {
    key: 'explanation', label: 'Explanation',
    type: 'RiskExplanation[]', required: false, indexed: false,
  },
  sourceDomains: {
    key: 'sourceDomains', label: 'Source Domains',
    type: 'string[]', required: false, indexed: false,
  },
  source: {
    key: 'source', label: 'Source',
    type: 'RISK_SOURCE', required: false, indexed: true,
    note: 'Used in riskStore applyFilters (source filter).',
  },
  category: {
    key: 'category', label: 'Category',
    type: 'RISK_CATEGORY', required: false, indexed: true,
    note: 'Used in riskStore applyFilters (category filter).',
  },
  subcategory: {
    key: 'subcategory', label: 'Sub-category',
    type: 'string', required: false, indexed: false,
  },
  entityType: {
    key: 'entityType', label: 'Entity Type',
    type: 'ENTITY_TYPE', required: false, indexed: true,
  },
  entityId: {
    key: 'entityId', label: 'Entity ID',
    type: 'string', required: false, indexed: true,
  },
  entityName: {
    key: 'entityName', label: 'Entity Name',
    type: 'string', required: false, indexed: false,
  },
  stationId: {
    key: 'stationId', label: 'Station ID',
    type: 'string', required: false, indexed: true,
  },
  stationCode: {
    key: 'stationCode', label: 'Station Code',
    type: 'string', required: false, indexed: false,
  },
  routeId: {
    key: 'routeId', label: 'Route ID',
    type: 'string', required: false, indexed: true,
  },
  zoneCode: {
    key: 'zoneCode', label: 'Zone',
    type: 'string', required: false, indexed: true,
  },
  recommendation: {
    key: 'recommendation', label: 'Recommendation',
    type: 'string', required: false, indexed: false,
  },
  mitigations: {
    key: 'mitigations', label: 'Mitigations',
    type: 'RiskMitigation[]', required: false, indexed: false,
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
  isResolved: {
    key: 'isResolved', label: 'Resolved',
    type: 'boolean', required: false, indexed: true,
  },
  resolvedAt: {
    key: 'resolvedAt', label: 'Resolved At',
    type: 'ISO8601', required: false, indexed: false,
  },
  resolvedBy: {
    key: 'resolvedBy', label: 'Resolved By',
    type: 'string', required: false, indexed: false,
  },
  linkedIncidentIds: {
    key: 'linkedIncidentIds', label: 'Linked Incidents',
    type: 'string[]', required: false, indexed: false,
  },
  linkedTrainIds: {
    key: 'linkedTrainIds', label: 'Linked Trains',
    type: 'string[]', required: false, indexed: false,
  },
  linkedCrowdIds: {
    key: 'linkedCrowdIds', label: 'Linked Crowd Forecasts',
    type: 'string[]', required: false, indexed: false,
  },
  linkedNotificationIds: {
    key: 'linkedNotificationIds', label: 'Linked Notifications',
    type: 'string[]', required: false, indexed: false,
  },
  tags: {
    key: 'tags', label: 'Tags',
    type: 'string[]', required: false, indexed: false,
  },
  computedAt: {
    key: 'computedAt', label: 'Computed At',
    type: 'ISO8601', required: true, indexed: true,
    note: 'Primary sort key in riskStore (computedAt_desc).',
  },
  validUntil: {
    key: 'validUntil', label: 'Valid Until',
    type: 'ISO8601', required: false, indexed: false,
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
  modelVersion: {
    key: 'modelVersion', label: 'Model Version',
    type: 'string', required: false, indexed: false,
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
// RISK_DEFAULTS
// Safe baseline values for every RiskScore field.
// ---------------------------------------------------------------------------

export const RISK_DEFAULTS = deepFreeze({
  id:                    '',
  name:                  '',
  title:                 '',
  description:           '',
  summary:               '',
  score:                 0,
  severityScore:         0,
  level:                 RISK_LEVEL.UNKNOWN,      // alias — synced with severityBand
  severityBand:          RISK_LEVEL.UNKNOWN,
  priorityBand:          PRIORITY_BAND.MONITOR,
  confidence:            null,
  confidenceBand:        RISK_CONFIDENCE.UNKNOWN,
  explanation:           [],
  sourceDomains:         [],
  source:                RISK_SOURCE.UNKNOWN,
  category:              RISK_CATEGORY.OTHER,
  subcategory:           '',
  entityType:            ENTITY_TYPE.UNKNOWN,
  entityId:              null,
  entityName:            '',
  stationId:             null,
  stationCode:           '',
  routeId:               null,
  zoneCode:              '',
  recommendation:        '',
  mitigations:           [],
  isAcknowledged:        false,
  acknowledgedAt:        null,
  acknowledgedBy:        null,
  isResolved:            false,
  resolvedAt:            null,
  resolvedBy:            null,
  linkedIncidentIds:     [],
  linkedTrainIds:        [],
  linkedCrowdIds:        [],
  linkedNotificationIds: [],
  tags:                  [],
  computedAt:            null,
  validUntil:            null,
  createdAt:             null,
  updatedAt:             null,
  lastUpdatedAt:         null,
  syncedAt:              null,
  modelVersion:          '',
  version:               1,
  meta:                  {},
});

// ---------------------------------------------------------------------------
// createRiskScore
// Factory — merges a partial record with RISK_DEFAULTS.
// Automatically derives severityBand, level, priorityBand, severityScore,
// and confidenceBand from score / confidence if not explicitly provided.
//
// @param {Partial<typeof RISK_DEFAULTS>} partial
// @returns {typeof RISK_DEFAULTS}
// ---------------------------------------------------------------------------

export function createRiskScore(partial = {}) {
  if (!partial || typeof partial !== 'object') {
    return { ...RISK_DEFAULTS };
  }

  const now = new Date().toISOString();

  // Resolve score
  const score = typeof partial.score === 'number' ? partial.score :
                typeof partial.severityScore === 'number' ? partial.severityScore : 0;

  // Derive severityBand from score if not provided
  const severityBand = partial.severityBand
    ?? partial.level
    ?? RISK_LEVEL.fromScore(score);

  // level is always kept in sync with severityBand
  const level = partial.level ?? severityBand;

  // Derive severityScore — keep aligned with score
  const severityScore = typeof partial.severityScore === 'number'
    ? partial.severityScore
    : score;

  // Derive priorityBand from severityBand if not provided
  const priorityBand = partial.priorityBand
    ?? PRIORITY_BAND.fromLevel[severityBand]
    ?? PRIORITY_BAND.MONITOR;

  // Derive confidenceBand from confidence float if not provided
  const confidence    = typeof partial.confidence === 'number' ? partial.confidence : null;
  const confidenceBand = partial.confidenceBand
    ?? (confidence !== null ? RISK_CONFIDENCE.fromScore(confidence) : RISK_CONFIDENCE.UNKNOWN);

  return {
    ...RISK_DEFAULTS,
    ...partial,
    score,
    severityScore,
    severityBand,
    level,
    priorityBand,
    confidence,
    confidenceBand,
    // Ensure array fields
    explanation:           Array.isArray(partial.explanation)           ? partial.explanation           : RISK_DEFAULTS.explanation,
    sourceDomains:         Array.isArray(partial.sourceDomains)         ? partial.sourceDomains         : RISK_DEFAULTS.sourceDomains,
    mitigations:           Array.isArray(partial.mitigations)           ? partial.mitigations           : RISK_DEFAULTS.mitigations,
    linkedIncidentIds:     Array.isArray(partial.linkedIncidentIds)     ? partial.linkedIncidentIds     : RISK_DEFAULTS.linkedIncidentIds,
    linkedTrainIds:        Array.isArray(partial.linkedTrainIds)        ? partial.linkedTrainIds        : RISK_DEFAULTS.linkedTrainIds,
    linkedCrowdIds:        Array.isArray(partial.linkedCrowdIds)        ? partial.linkedCrowdIds        : RISK_DEFAULTS.linkedCrowdIds,
    linkedNotificationIds: Array.isArray(partial.linkedNotificationIds) ? partial.linkedNotificationIds : RISK_DEFAULTS.linkedNotificationIds,
    tags:                  Array.isArray(partial.tags)                  ? partial.tags                  : RISK_DEFAULTS.tags,
    meta: (partial.meta && typeof partial.meta === 'object' && !Array.isArray(partial.meta))
      ? { ...partial.meta }
      : {},
    // Timestamps
    computedAt:    partial.computedAt    ?? now,
    createdAt:     partial.createdAt     ?? now,
    updatedAt:     partial.updatedAt     ?? now,
    lastUpdatedAt: partial.lastUpdatedAt ?? partial.updatedAt ?? now,
    version: (typeof partial.version === 'number' && partial.version > 0) ? partial.version : 1,
  };
}

// ---------------------------------------------------------------------------
// isValidRiskScore
// Minimum-contract validator.
//
// @param {unknown} obj
// @returns {boolean}
// ---------------------------------------------------------------------------

export function isValidRiskScore(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.id || typeof obj.id !== 'string' || obj.id.trim() === '') return false;
  if (typeof obj.score !== 'number') return false;
  if (!obj.severityBand) return false;
  return true;
}

// ---------------------------------------------------------------------------
// normalizeRiskScore
// Coerces a raw API payload into a valid, complete RiskScore shape.
// Handles field-name aliases from different backend versions:
//   riskScoreId     → id
//   risk_score_id   → id
//   severity        → severityBand (if string)
//   risk_level      → severityBand / level
//   riskLevel       → severityBand / level
//   computed_at     → computedAt
//   updated_at      → updatedAt
//   confidence_score → confidence
//   source_domains  → sourceDomains
//
// @param {unknown} raw
// @returns {typeof RISK_DEFAULTS | null}
// ---------------------------------------------------------------------------

export function normalizeRiskScore(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id ?? raw.riskScoreId ?? raw.risk_score_id ?? null;
  if (!id) return null;

  // Resolve score
  const score = typeof raw.score === 'number'         ? raw.score         :
                typeof raw.riskScore === 'number'     ? raw.riskScore     :
                typeof raw.risk_score === 'number'    ? raw.risk_score    :
                typeof raw.severityScore === 'number' ? raw.severityScore :
                0;

  // Resolve severityBand / level
  const rawBand = raw.severityBand ?? raw.severity ?? raw.riskLevel ?? raw.risk_level ?? raw.level ?? null;
  const severityBand = rawBand ?? RISK_LEVEL.fromScore(score);
  const level = raw.level ?? severityBand;

  // Resolve confidence
  const confidence =
    typeof raw.confidence === 'number'        ? raw.confidence        :
    typeof raw.confidence_score === 'number'  ? raw.confidence_score  :
    null;

  // Resolve sourceDomains
  const sourceDomains = Array.isArray(raw.sourceDomains)   ? raw.sourceDomains   :
                        Array.isArray(raw.source_domains)  ? raw.source_domains  :
                        [];

  // Resolve timestamps
  const computedAt    = raw.computedAt    ?? raw.computed_at    ?? null;
  const updatedAt     = raw.updatedAt     ?? raw.updated_at     ?? computedAt ?? null;
  const lastUpdatedAt = raw.lastUpdatedAt ?? updatedAt ?? null;
  const createdAt     = raw.createdAt     ?? raw.created_at     ?? null;

  return createRiskScore({
    ...raw,
    id,
    score,
    severityScore: typeof raw.severityScore === 'number' ? raw.severityScore : score,
    severityBand,
    level,
    confidence,
    sourceDomains,
    computedAt,
    updatedAt,
    lastUpdatedAt,
    createdAt,
  });
}

// ---------------------------------------------------------------------------
// RiskScore — reference schema object (default export)
// ---------------------------------------------------------------------------

/**
 * Canonical RiskScore domain model — reference shape.
 *
 * @example
 * import RiskScore from '../types/risk.js';
 * // RiskScore documents every field with its default value and type.
 */
const RiskScore = deepFreeze({
  // ── Identity ──────────────────────────────────────────────────────────────
  id:                    'RSK-00112',
  name:                  'Signal failure compounded by peak-hour crowd',
  title:                 'Composite risk: Track signal failure + platform overcrowding at Nizamuddin',
  description:           'A signal failure at Hazrat Nizamuddin (INC-000045) is coinciding with an 85% platform occupancy forecast (CF-00321), creating a high probability of cascading delays and crowd safety breach.',
  summary:               'Signal + crowd composite risk — Nizamuddin NZM',

  // ── Score ─────────────────────────────────────────────────────────────────
  score:                 82,
  severityScore:         82,
  level:                 RISK_LEVEL.CRITICAL,
  severityBand:          RISK_LEVEL.CRITICAL,
  priorityBand:          PRIORITY_BAND.IMMEDIATE,

  // ── Confidence ────────────────────────────────────────────────────────────
  confidence:            0.88,
  confidenceBand:        RISK_CONFIDENCE.MEDIUM,

  // ── Explanation ───────────────────────────────────────────────────────────
  explanation: [
    {
      factor:      'Signal failure duration',
      contribution: 45,
      description: 'Signal at DN track failed 35 minutes ago with no ETA for restoration.',
    },
    {
      factor:      'Platform occupancy forecast',
      contribution: 37,
      description: 'Platform 4 forecast at 105% capacity in 30 minutes.',
    },
  ],

  // ── Source ────────────────────────────────────────────────────────────────
  sourceDomains:         ['incident', 'crowd'],
  source:                RISK_SOURCE.COMPOSITE,

  // ── Classification ────────────────────────────────────────────────────────
  category:              RISK_CATEGORY.COMPOSITE,
  subcategory:           'signal_crowd_convergence',
  entityType:            ENTITY_TYPE.STATION,
  entityId:              'STN-NZM',
  entityName:            'Hazrat Nizamuddin',
  stationId:             'STN-NZM',
  stationCode:           'NZM',
  routeId:               'RT-001',
  zoneCode:              'NR',

  // ── Action ────────────────────────────────────────────────────────────────
  recommendation:        'Deploy crowd control on Platform 4 and initiate manual signalling protocol for DN track.',
  mitigations: [
    {
      step:     1,
      action:   'Deploy RPF/staff to Platform 4',
      priority: 'immediate',
      owner:    'Station Controller',
    },
    {
      step:     2,
      action:   'Activate manual token working for DN track',
      priority: 'immediate',
      owner:    'Signal Engineer',
    },
  ],

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  isAcknowledged:        false,
  acknowledgedAt:        null,
  acknowledgedBy:        null,
  isResolved:            false,
  resolvedAt:            null,
  resolvedBy:            null,

  // ── Relationships ─────────────────────────────────────────────────────────
  linkedIncidentIds:     ['INC-000045'],
  linkedTrainIds:        ['TRN-12301', 'TRN-22691'],
  linkedCrowdIds:        ['CF-00321'],
  linkedNotificationIds: ['NTF-88001'],
  tags:                  ['critical', 'composite', 'nzm', 'signal'],

  // ── Timestamps ────────────────────────────────────────────────────────────
  computedAt:            '2025-06-10T06:10:00.000Z',
  validUntil:            '2025-06-10T07:10:00.000Z',
  createdAt:             '2025-06-10T06:10:00.000Z',
  updatedAt:             '2025-06-10T06:10:05.000Z',
  lastUpdatedAt:         '2025-06-10T06:10:05.000Z',
  syncedAt:              '2025-06-10T06:10:10.000Z',

  // ── Provenance ────────────────────────────────────────────────────────────
  modelVersion:          'v1.8.0',
  version:               1,

  // ── Extension ─────────────────────────────────────────────────────────────
  meta:                  {},
});

export default RiskScore;

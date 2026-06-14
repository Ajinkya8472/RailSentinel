/**
 * src/types/crowd.js
 *
 * Purpose:
 * Canonical CrowdForecast domain model for RailSentinel. This file is the
 * authoritative definition of what a CrowdForecast record is: its fields,
 * allowed enum values, field-level documentation, default values, and
 * relationship references to other domain models.
 *
 * A CrowdForecast represents the predicted or live-measured crowd density
 * state at a specific station (and optionally a specific platform or gate)
 * over a defined forecast horizon. It drives M3 Crowd Intelligence module
 * views, map hotspot markers, and threshold-breach notifications.
 *
 * Architecture rules:
 *   - No API logic — this file does not fetch, send, or transform HTTP payloads.
 *   - No UI logic — this file does not import React, design tokens, or components.
 *   - No store logic — this file does not import or call Zustand.
 *   - Used by: crowdStore.js (normalization), crowdService.js (mapping),
 *     M3 components (prop validation), and future TypeScript migration.
 *
 * Schema fields:
 *   id                  — Unique forecast record identifier (UUID / string)
 *   stationId           — Station identifier (from india-railways.json)
 *   stationCode         — Station code (e.g. 'NDLS', 'CSTM')
 *   stationName         — Human-readable station name
 *   station             — Store alias for stationName (used in applyFilters)
 *   platformId          — Platform identifier within the station (null = all platforms)
 *   platformNumber      — Display platform number (e.g. '3A')
 *   gateId              — Entry/exit gate identifier (null = whole station)
 *   gateName            — Display gate name
 *   zoneCode            — Indian Railway zone code (e.g. 'NR', 'CR')
 *   lineId              — Metro / suburban line identifier (null for mainline)
 *   lineName            — Human-readable line name
 *   line                — Store alias for lineName (used in applyFilters)
 *   densityLevel        — Current measured density: DENSITY_LEVEL enum
 *   forecastLevel       — Predicted density for horizon window: DENSITY_LEVEL enum
 *   thresholdStatus     — Whether density is within/near/above threshold: THRESHOLD_STATUS enum
 *   passengerCount      — Live measured passenger count (null if model-only)
 *   forecastCount       — Predicted passenger count for horizon window
 *   capacityLimit       — Design capacity of the platform / station area
 *   occupancyPercent    — Live occupancy as 0–100 (null if not measured)
 *   forecastOccupancy   — Predicted occupancy for horizon window (0–100)
 *   confidenceScore     — Model confidence as 0.0–1.0 float
 *   confidenceBand      — Named band from confidence score: CONFIDENCE_BAND enum
 *   confidence          — Store alias for confidenceBand (used in applyFilters)
 *   horizon             — Forecast look-ahead window: FORECAST_HORIZON enum
 *   forecastWindowStart — ISO timestamp: start of forecast validity window
 *   forecastWindowEnd   — ISO timestamp: end of forecast validity window
 *   modelVersion        — Crowd model version string (e.g. 'v2.3.1')
 *   generatedBy         — Identifier of model / service that produced the forecast
 *   source              — How the base data was obtained: CROWD_SOURCE enum
 *   description         — Human-readable forecast summary sentence
 *   summary             — Short one-line summary (used in search / list)
 *   recommendedAction   — Operator action recommendation text
 *   tags                — Arbitrary string tags for search / filtering
 *   linkedTrainIds      — IDs of arriving trains contributing to forecast density
 *   linkedIncidentIds   — IDs of active incidents at this station
 *   linkedNotificationIds — IDs of Notifications dispatched for this forecast breach
 *   isBreached          — True when thresholdStatus is BREACH or CRITICAL
 *   breachStartedAt     — ISO timestamp when breach condition first triggered
 *   breachAcknowledgedBy — Operator ID who acknowledged the breach
 *   generatedAt         — ISO timestamp when model produced this forecast
 *   validAt             — ISO timestamp this reading / forecast is valid for
 *   updatedAt           — ISO timestamp of last record modification
 *   lastUpdatedAt       — Store-canonical alias for updatedAt
 *   syncedAt            — ISO timestamp of last successful backend sync
 *   version             — Optimistic-concurrency version counter
 *   meta                — Arbitrary extension object for future fields
 *
 * Relationships:
 *   CrowdForecast → Station (india-railways.json)  via stationId / stationCode  (M-to-1)
 *   CrowdForecast → Train[]                        via linkedTrainIds            (M-to-M)
 *   CrowdForecast → Incident[]                     via linkedIncidentIds         (M-to-M)
 *   CrowdForecast → Notification[]                 via linkedNotificationIds     (1-to-M)
 *   CrowdForecast → RiskScore                      (indirect — RiskScore references stationId)
 *
 * Dependencies:
 *   - None. Pure JS constants and plain objects.
 *
 * Exports:
 *   - DENSITY_LEVEL       → frozen enum: density classification levels
 *   - THRESHOLD_STATUS    → frozen enum: threshold breach state values
 *   - CONFIDENCE_BAND     → frozen enum: model confidence band names
 *   - FORECAST_HORIZON    → frozen enum: look-ahead time window values
 *   - CROWD_SOURCE        → frozen enum: data source type values
 *   - CROWD_SORT          → frozen enum: valid sort key strings for crowdStore
 *   - CROWD_FIELD         → frozen map: field name → metadata
 *   - CROWD_DEFAULTS      → frozen default CrowdForecast record
 *   - createCrowdForecast → factory: merges partial record with defaults
 *   - isValidCrowdForecast → validator: minimum-contract check
 *   - normalizeCrowdForecast → normalizer: coerces raw payload to valid shape
 *   - CrowdForecast (default) → frozen reference object documenting the full schema
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
// DENSITY_LEVEL
// Crowd density classification. Applies to both measured (densityLevel) and
// predicted (forecastLevel) fields. Aligned with colors.STATUS.crowd.
// ---------------------------------------------------------------------------

export const DENSITY_LEVEL = deepFreeze({
  /** Comfortably below platform capacity — free movement */
  NORMAL:   'normal',
  /** Approaching comfortable limits — monitoring advised */
  ELEVATED: 'elevated',
  /** High density — restricted movement, operator attention required */
  HIGH:     'high',
  /** Near capacity limit — intervention likely required */
  CRITICAL: 'critical',
  /** At or above design capacity — evacuation / diversion protocols */
  BREACH:   'breach',
  /** No data available or sensor offline */
  UNKNOWN:  'unknown',

  /** Ordered ascending (index 0 = lightest) */
  ordered: ['normal', 'elevated', 'high', 'critical', 'breach'],
  /** Ordered descending (index 0 = most severe) */
  orderedDesc: ['breach', 'critical', 'high', 'elevated', 'normal'],

  /**
   * Thresholds — typical passenger counts relative to platform capacity
   * at which each level begins. Values are percentages of capacityLimit.
   * These are heuristic defaults; actual thresholds are station-specific.
   */
  thresholds: {
    normal:   { min: 0,   max: 60  }, // 0–60% of capacity
    elevated: { min: 60,  max: 75  }, // 60–75%
    high:     { min: 75,  max: 90  }, // 75–90%
    critical: { min: 90,  max: 100 }, // 90–100%
    breach:   { min: 100, max: null}, // > 100%
  },
});

// ---------------------------------------------------------------------------
// THRESHOLD_STATUS
// Whether the current or forecast density crosses a monitored threshold.
// Drives thresholdStatus field and isBreached flag.
// ---------------------------------------------------------------------------

export const THRESHOLD_STATUS = deepFreeze({
  /** Well within safe capacity limits */
  SAFE:     'safe',
  /** Approaching a watch threshold — situational awareness */
  WATCH:    'watch',
  /** At a warning threshold — intervention planning required */
  WARNING:  'warning',
  /** At a critical threshold — immediate action required */
  CRITICAL: 'critical',
  /** Capacity limit breached — emergency protocols */
  BREACH:   'breach',
  /** Status cannot be determined from available data */
  UNKNOWN:  'unknown',

  /** States that set isBreached = true */
  breachedStates: ['breach', 'critical'],
  /** States that require active operator attention */
  actionRequired: ['warning', 'critical', 'breach'],

  /** Ordered ascending by severity (index 0 = safest) */
  ordered: ['safe', 'watch', 'warning', 'critical', 'breach'],
});

// ---------------------------------------------------------------------------
// CONFIDENCE_BAND
// Named band derived from the 0.0–1.0 confidenceScore float.
// Used for filter UI (crowdStore.applyFilters confidence field).
// ---------------------------------------------------------------------------

export const CONFIDENCE_BAND = deepFreeze({
  /** confidenceScore ≥ 0.90 */
  HIGH:     'high',
  /** confidenceScore 0.70–0.89 */
  MEDIUM:   'medium',
  /** confidenceScore 0.50–0.69 */
  LOW:      'low',
  /** confidenceScore < 0.50 — treat as unreliable */
  VERY_LOW: 'very_low',
  /** Model did not produce a confidence estimate */
  UNKNOWN:  'unknown',

  /**
   * Derive a CONFIDENCE_BAND value from a raw 0–1 float.
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

  /** Ordered descending confidence (index 0 = most confident) */
  ordered: ['high', 'medium', 'low', 'very_low', 'unknown'],
});

// ---------------------------------------------------------------------------
// FORECAST_HORIZON
// Look-ahead time window for the forecastLevel, forecastCount, and
// forecastOccupancy fields. Used in crowdStore applyFilters horizon field.
// ---------------------------------------------------------------------------

export const FORECAST_HORIZON = deepFreeze({
  /** Live/real-time — current measured state, no prediction */
  LIVE:    'live',
  /** 15-minute ahead forecast */
  MIN_15:  '15min',
  /** 30-minute ahead forecast */
  MIN_30:  '30min',
  /** 1-hour ahead forecast */
  HOUR_1:  '1hr',
  /** 2-hour ahead forecast */
  HOUR_2:  '2hr',
  /** 4-hour ahead forecast */
  HOUR_4:  '4hr',
  /** End-of-day aggregate forecast */
  EOD:     'eod',
  /** Custom/unspecified horizon */
  CUSTOM:  'custom',

  /** Ordered by look-ahead (index 0 = shortest) */
  ordered: ['live', '15min', '30min', '1hr', '2hr', '4hr', 'eod'],

  /** Human-readable labels for display */
  labels: {
    live:   'Live',
    '15min':'15 min',
    '30min':'30 min',
    '1hr':  '1 hr',
    '2hr':  '2 hr',
    '4hr':  '4 hr',
    eod:    'End of Day',
    custom: 'Custom',
  },
});

// ---------------------------------------------------------------------------
// CROWD_SOURCE
// How the base measurement or seed data was obtained.
// ---------------------------------------------------------------------------

export const CROWD_SOURCE = deepFreeze({
  /** Automated passenger counter (APC) — turnstile, camera-based */
  SENSOR:        'sensor',
  /** CCTV video analytics / computer vision */
  CCTV:          'cctv',
  /** Wi-Fi probe / Bluetooth beacon density estimation */
  WIFI_PROBE:    'wifi_probe',
  /** Ticket validation / PNR-based estimation */
  TICKETING:     'ticketing',
  /** AI demand-forecast model (no live sensor) */
  AI_MODEL:      'ai_model',
  /** Historical pattern — schedule / calendar based */
  HISTORICAL:    'historical',
  /** Operator manual entry */
  MANUAL:        'manual',
  /** Composite — multiple sources fused by model */
  COMPOSITE:     'composite',
  /** External data provider (smart city, transport authority) */
  EXTERNAL:      'external',
  /** Source unknown */
  UNKNOWN:       'unknown',
});

// ---------------------------------------------------------------------------
// CROWD_SORT
// Valid sort key strings for crowdStore.setSort().
// ---------------------------------------------------------------------------

export const CROWD_SORT = deepFreeze({
  CONFIDENCE_DESC:  'confidence_desc',
  CONFIDENCE_ASC:   'confidence_asc',
  GENERATED_DESC:   'generatedAt_desc',
  GENERATED_ASC:    'generatedAt_asc',
  DENSITY_DESC:     'densityLevel_desc',
  DENSITY_ASC:      'densityLevel_asc',
  OCCUPANCY_DESC:   'occupancyPercent_desc',
  OCCUPANCY_ASC:    'occupancyPercent_asc',

  /** Default sort used by crowdStore */
  DEFAULT: 'generatedAt_desc',
});

// ---------------------------------------------------------------------------
// CROWD_FIELD
// Field-level metadata map — label, type, required, indexed flags.
// ---------------------------------------------------------------------------

export const CROWD_FIELD = deepFreeze({
  id: {
    key: 'id', label: 'Forecast ID',
    type: 'string', required: true, indexed: true,
  },
  stationId: {
    key: 'stationId', label: 'Station ID',
    type: 'string', required: true, indexed: true,
  },
  stationCode: {
    key: 'stationCode', label: 'Station Code',
    type: 'string', required: false, indexed: true,
  },
  stationName: {
    key: 'stationName', label: 'Station',
    type: 'string', required: false, indexed: true,
    note: 'Used in crowdStore applyFilters (station filter).',
  },
  station: {
    key: 'station', label: 'Station (alias)',
    type: 'string', required: false, indexed: true,
    note: 'Store alias for stationName.',
  },
  platformId: {
    key: 'platformId', label: 'Platform ID',
    type: 'string', required: false, indexed: true,
  },
  platformNumber: {
    key: 'platformNumber', label: 'Platform',
    type: 'string', required: false, indexed: false,
  },
  gateId: {
    key: 'gateId', label: 'Gate ID',
    type: 'string', required: false, indexed: false,
  },
  gateName: {
    key: 'gateName', label: 'Gate',
    type: 'string', required: false, indexed: false,
  },
  zoneCode: {
    key: 'zoneCode', label: 'Zone',
    type: 'string', required: false, indexed: true,
  },
  lineId: {
    key: 'lineId', label: 'Line ID',
    type: 'string', required: false, indexed: true,
  },
  lineName: {
    key: 'lineName', label: 'Line',
    type: 'string', required: false, indexed: true,
    note: 'Used in crowdStore applyFilters (line filter).',
  },
  line: {
    key: 'line', label: 'Line (alias)',
    type: 'string', required: false, indexed: true,
    note: 'Store alias for lineName.',
  },
  densityLevel: {
    key: 'densityLevel', label: 'Density Level',
    type: 'DENSITY_LEVEL', required: true, indexed: true,
  },
  forecastLevel: {
    key: 'forecastLevel', label: 'Forecast Level',
    type: 'DENSITY_LEVEL', required: false, indexed: true,
  },
  thresholdStatus: {
    key: 'thresholdStatus', label: 'Threshold Status',
    type: 'THRESHOLD_STATUS', required: false, indexed: true,
  },
  passengerCount: {
    key: 'passengerCount', label: 'Live Count',
    type: 'number', required: false, indexed: false,
  },
  forecastCount: {
    key: 'forecastCount', label: 'Forecast Count',
    type: 'number', required: false, indexed: false,
  },
  capacityLimit: {
    key: 'capacityLimit', label: 'Capacity',
    type: 'number', required: false, indexed: false,
  },
  occupancyPercent: {
    key: 'occupancyPercent', label: 'Occupancy (%)',
    type: 'number', required: false, indexed: true,
  },
  forecastOccupancy: {
    key: 'forecastOccupancy', label: 'Forecast Occupancy (%)',
    type: 'number', required: false, indexed: false,
  },
  confidenceScore: {
    key: 'confidenceScore', label: 'Confidence Score',
    type: 'number (0.0–1.0)', required: false, indexed: true,
    note: 'Used in crowdStore sortCrowdForecasts.',
  },
  confidenceBand: {
    key: 'confidenceBand', label: 'Confidence Band',
    type: 'CONFIDENCE_BAND', required: false, indexed: true,
    note: 'Used in crowdStore applyFilters (confidence filter).',
  },
  confidence: {
    key: 'confidence', label: 'Confidence (alias)',
    type: 'CONFIDENCE_BAND', required: false, indexed: true,
    note: 'Store alias for confidenceBand.',
  },
  horizon: {
    key: 'horizon', label: 'Forecast Horizon',
    type: 'FORECAST_HORIZON', required: false, indexed: true,
    note: 'Used in crowdStore applyFilters (horizon filter).',
  },
  forecastWindowStart: {
    key: 'forecastWindowStart', label: 'Window Start',
    type: 'ISO8601', required: false, indexed: false,
  },
  forecastWindowEnd: {
    key: 'forecastWindowEnd', label: 'Window End',
    type: 'ISO8601', required: false, indexed: false,
  },
  modelVersion: {
    key: 'modelVersion', label: 'Model Version',
    type: 'string', required: false, indexed: false,
  },
  generatedBy: {
    key: 'generatedBy', label: 'Generated By',
    type: 'string', required: false, indexed: true,
    note: 'Used in crowdStore search.',
  },
  source: {
    key: 'source', label: 'Data Source',
    type: 'CROWD_SOURCE', required: false, indexed: true,
  },
  description: {
    key: 'description', label: 'Description',
    type: 'string', required: false, indexed: false,
    note: 'Used in crowdStore search.',
  },
  summary: {
    key: 'summary', label: 'Summary',
    type: 'string', required: false, indexed: false,
    note: 'Used in crowdStore search.',
  },
  recommendedAction: {
    key: 'recommendedAction', label: 'Recommended Action',
    type: 'string', required: false, indexed: false,
  },
  tags: {
    key: 'tags', label: 'Tags',
    type: 'string[]', required: false, indexed: false,
  },
  linkedTrainIds: {
    key: 'linkedTrainIds', label: 'Linked Trains',
    type: 'string[]', required: false, indexed: false,
  },
  linkedIncidentIds: {
    key: 'linkedIncidentIds', label: 'Linked Incidents',
    type: 'string[]', required: false, indexed: false,
  },
  linkedNotificationIds: {
    key: 'linkedNotificationIds', label: 'Linked Notifications',
    type: 'string[]', required: false, indexed: false,
  },
  isBreached: {
    key: 'isBreached', label: 'Breached',
    type: 'boolean', required: false, indexed: true,
  },
  breachStartedAt: {
    key: 'breachStartedAt', label: 'Breach Started',
    type: 'ISO8601', required: false, indexed: false,
  },
  breachAcknowledgedBy: {
    key: 'breachAcknowledgedBy', label: 'Breach Acknowledged By',
    type: 'string', required: false, indexed: false,
  },
  generatedAt: {
    key: 'generatedAt', label: 'Generated At',
    type: 'ISO8601', required: true, indexed: true,
    note: 'Primary sort key in crowdStore (generatedAt_desc).',
  },
  validAt: {
    key: 'validAt', label: 'Valid At',
    type: 'ISO8601', required: false, indexed: false,
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
// CROWD_DEFAULTS
// Safe baseline values for every CrowdForecast field.
// ---------------------------------------------------------------------------

export const CROWD_DEFAULTS = deepFreeze({
  id:                    '',
  stationId:             '',
  stationCode:           '',
  stationName:           '',
  station:               '',       // alias — kept in sync with stationName
  platformId:            null,
  platformNumber:        null,
  gateId:                null,
  gateName:              null,
  zoneCode:              '',
  lineId:                null,
  lineName:              '',
  line:                  '',       // alias — kept in sync with lineName
  densityLevel:          DENSITY_LEVEL.UNKNOWN,
  forecastLevel:         DENSITY_LEVEL.UNKNOWN,
  thresholdStatus:       THRESHOLD_STATUS.UNKNOWN,
  passengerCount:        null,
  forecastCount:         null,
  capacityLimit:         null,
  occupancyPercent:      null,
  forecastOccupancy:     null,
  confidenceScore:       null,
  confidenceBand:        CONFIDENCE_BAND.UNKNOWN,
  confidence:            CONFIDENCE_BAND.UNKNOWN, // alias — kept in sync
  horizon:               FORECAST_HORIZON.LIVE,
  forecastWindowStart:   null,
  forecastWindowEnd:     null,
  modelVersion:          '',
  generatedBy:           '',
  source:                CROWD_SOURCE.UNKNOWN,
  description:           '',
  summary:               '',
  recommendedAction:     '',
  tags:                  [],
  linkedTrainIds:        [],
  linkedIncidentIds:     [],
  linkedNotificationIds: [],
  isBreached:            false,
  breachStartedAt:       null,
  breachAcknowledgedBy:  null,
  generatedAt:           null,
  validAt:               null,
  updatedAt:             null,
  lastUpdatedAt:         null,
  syncedAt:              null,
  version:               1,
  meta:                  {},
});

// ---------------------------------------------------------------------------
// createCrowdForecast
// Factory function — merges a partial record with CROWD_DEFAULTS.
//
// @param {Partial<typeof CROWD_DEFAULTS>} partial
// @returns {typeof CROWD_DEFAULTS}
// ---------------------------------------------------------------------------

export function createCrowdForecast(partial = {}) {
  if (!partial || typeof partial !== 'object') {
    return { ...CROWD_DEFAULTS };
  }

  const now = new Date().toISOString();

  // Resolve alias pairs
  const stationName = partial.stationName ?? partial.station ?? CROWD_DEFAULTS.stationName;
  const station     = partial.station ?? stationName;
  const lineName    = partial.lineName ?? partial.line ?? CROWD_DEFAULTS.lineName;
  const line        = partial.line ?? lineName;

  // Derive confidenceBand from score if not explicitly provided
  const confidenceScore = typeof partial.confidenceScore === 'number' ? partial.confidenceScore : null;
  const confidenceBand  = partial.confidenceBand
    ?? (confidenceScore !== null ? CONFIDENCE_BAND.fromScore(confidenceScore) : CONFIDENCE_BAND.UNKNOWN);
  const confidence = partial.confidence ?? confidenceBand;

  // Derive isBreached from thresholdStatus if not explicitly set
  const thresholdStatus = partial.thresholdStatus ?? CROWD_DEFAULTS.thresholdStatus;
  const isBreached = typeof partial.isBreached === 'boolean'
    ? partial.isBreached
    : THRESHOLD_STATUS.breachedStates.includes(thresholdStatus);

  return {
    ...CROWD_DEFAULTS,
    ...partial,
    stationName,
    station,
    lineName,
    line,
    confidenceScore,
    confidenceBand,
    confidence,
    thresholdStatus,
    isBreached,
    // Ensure array fields
    tags:                  Array.isArray(partial.tags)                  ? partial.tags                  : CROWD_DEFAULTS.tags,
    linkedTrainIds:        Array.isArray(partial.linkedTrainIds)        ? partial.linkedTrainIds        : CROWD_DEFAULTS.linkedTrainIds,
    linkedIncidentIds:     Array.isArray(partial.linkedIncidentIds)     ? partial.linkedIncidentIds     : CROWD_DEFAULTS.linkedIncidentIds,
    linkedNotificationIds: Array.isArray(partial.linkedNotificationIds) ? partial.linkedNotificationIds : CROWD_DEFAULTS.linkedNotificationIds,
    meta: (partial.meta && typeof partial.meta === 'object' && !Array.isArray(partial.meta))
      ? { ...partial.meta }
      : {},
    // Timestamps
    generatedAt:   partial.generatedAt   ?? now,
    updatedAt:     partial.updatedAt     ?? now,
    lastUpdatedAt: partial.lastUpdatedAt ?? partial.updatedAt ?? now,
    version: (typeof partial.version === 'number' && partial.version > 0) ? partial.version : 1,
  };
}

// ---------------------------------------------------------------------------
// isValidCrowdForecast
// Minimum-contract validator.
//
// @param {unknown} obj
// @returns {boolean}
// ---------------------------------------------------------------------------

export function isValidCrowdForecast(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.id || typeof obj.id !== 'string' || obj.id.trim() === '') return false;
  if (!obj.stationId && !obj.stationCode) return false;
  if (!obj.densityLevel) return false;
  return true;
}

// ---------------------------------------------------------------------------
// normalizeCrowdForecast
// Coerces a raw API payload into a valid, complete CrowdForecast shape.
// Handles field-name aliases from different backend versions:
//   crowdForecastId  → id
//   station_name     → stationName
//   station_id       → stationId
//   line_name        → lineName
//   confidence       → confidenceBand
//   confidence_score → confidenceScore
//   generated_at     → generatedAt
//   updated_at       → updatedAt
//   density          → densityLevel (coerce numeric → band string)
//
// @param {unknown} raw
// @returns {typeof CROWD_DEFAULTS | null} null if raw has no usable id
// ---------------------------------------------------------------------------

export function normalizeCrowdForecast(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id ?? raw.crowdForecastId ?? raw.crowd_forecast_id ?? null;
  if (!id) return null;

  // Resolve aliases
  const stationId   = raw.stationId   ?? raw.station_id   ?? '';
  const stationCode = raw.stationCode ?? raw.station_code ?? '';
  const stationName = raw.stationName ?? raw.station_name ?? raw.station ?? '';
  const lineName    = raw.lineName    ?? raw.line_name    ?? raw.line    ?? '';

  // Resolve confidence
  const confidenceScore =
    typeof raw.confidenceScore === 'number'  ? raw.confidenceScore  :
    typeof raw.confidence_score === 'number' ? raw.confidence_score :
    null;
  const confidenceBand =
    raw.confidenceBand ?? raw.confidence_band ??
    CONFIDENCE_BAND.fromScore(confidenceScore);

  // Resolve densityLevel — coerce numeric occupancy to band if raw.density is numeric
  let densityLevel = raw.densityLevel ?? raw.density_level ?? raw.density ?? DENSITY_LEVEL.UNKNOWN;
  if (typeof densityLevel === 'number') {
    // Treat as occupancy percent and derive band
    const pct = densityLevel;
    if      (pct >= 100) densityLevel = DENSITY_LEVEL.BREACH;
    else if (pct >= 90)  densityLevel = DENSITY_LEVEL.CRITICAL;
    else if (pct >= 75)  densityLevel = DENSITY_LEVEL.HIGH;
    else if (pct >= 60)  densityLevel = DENSITY_LEVEL.ELEVATED;
    else                 densityLevel = DENSITY_LEVEL.NORMAL;
  }

  // Resolve timestamps
  const generatedAt   = raw.generatedAt   ?? raw.generated_at   ?? null;
  const updatedAt     = raw.updatedAt     ?? raw.updated_at     ?? generatedAt ?? null;
  const lastUpdatedAt = raw.lastUpdatedAt ?? updatedAt ?? null;

  return createCrowdForecast({
    ...raw,
    id,
    stationId,
    stationCode,
    stationName,
    station: stationName,
    lineName,
    line: lineName,
    confidenceScore,
    confidenceBand,
    confidence: confidenceBand,
    densityLevel,
    generatedAt,
    updatedAt,
    lastUpdatedAt,
  });
}

// ---------------------------------------------------------------------------
// CrowdForecast — reference schema object (default export)
// ---------------------------------------------------------------------------

/**
 * Canonical CrowdForecast domain model — reference shape.
 *
 * @example
 * import CrowdForecast from '../types/crowd.js';
 * // CrowdForecast documents every field with its default value and type.
 */
const CrowdForecast = deepFreeze({
  // ── Identity ──────────────────────────────────────────────────────────────
  id:                    'CF-00881',

  // ── Location ──────────────────────────────────────────────────────────────
  stationId:             'STN-NDLS',
  stationCode:           'NDLS',
  stationName:           'New Delhi',
  station:               'New Delhi',
  platformId:            'PLT-NDLS-04',
  platformNumber:        '4',
  gateId:                null,
  gateName:              null,
  zoneCode:              'NR',
  lineId:                null,
  lineName:              '',
  line:                  '',

  // ── Density & threshold ───────────────────────────────────────────────────
  densityLevel:          DENSITY_LEVEL.HIGH,
  forecastLevel:         DENSITY_LEVEL.CRITICAL,
  thresholdStatus:       THRESHOLD_STATUS.WARNING,
  isBreached:            false,
  breachStartedAt:       null,
  breachAcknowledgedBy:  null,

  // ── Counts & capacity ────────────────────────────────────────────────────
  passengerCount:        3120,
  forecastCount:         4200,
  capacityLimit:         4000,
  occupancyPercent:      78,
  forecastOccupancy:     105,

  // ── Model confidence ─────────────────────────────────────────────────────
  confidenceScore:       0.87,
  confidenceBand:        CONFIDENCE_BAND.MEDIUM,
  confidence:            CONFIDENCE_BAND.MEDIUM,

  // ── Forecast window ───────────────────────────────────────────────────────
  horizon:               FORECAST_HORIZON.MIN_30,
  forecastWindowStart:   '2025-06-10T10:00:00.000Z',
  forecastWindowEnd:     '2025-06-10T10:30:00.000Z',

  // ── Provenance ────────────────────────────────────────────────────────────
  modelVersion:          'v2.3.1',
  generatedBy:           'crowd-model-nr-01',
  source:                CROWD_SOURCE.COMPOSITE,

  // ── Text ──────────────────────────────────────────────────────────────────
  description:           'Platform 4 at New Delhi is forecast to reach critical density within 30 minutes due to Rajdhani arrival.',
  summary:               'High crowd — critical forecast in 30 min',
  recommendedAction:     'Deploy crowd management staff to Platform 4. Consider opening overflow gate G-North.',
  tags:                  ['peak-hour', 'platform', 'ndls'],

  // ── Relationships ─────────────────────────────────────────────────────────
  linkedTrainIds:        ['TRN-12301', 'TRN-22691'],
  linkedIncidentIds:     [],
  linkedNotificationIds: ['NTF-44201'],

  // ── Timestamps ────────────────────────────────────────────────────────────
  generatedAt:           '2025-06-10T09:58:00.000Z',
  validAt:               '2025-06-10T10:00:00.000Z',
  updatedAt:             '2025-06-10T09:58:05.000Z',
  lastUpdatedAt:         '2025-06-10T09:58:05.000Z',
  syncedAt:              '2025-06-10T09:58:10.000Z',

  // ── Concurrency ───────────────────────────────────────────────────────────
  version:               1,

  // ── Extension ─────────────────────────────────────────────────────────────
  meta:                  {},
});

export default CrowdForecast;

/**
 * src/types/energy.js
 *
 * Purpose:
 * Canonical EnergyProfile domain model for RailSentinel. This file is the
 * authoritative definition of what an EnergyProfile record is: its fields,
 * allowed enum values, field-level documentation, default values, and
 * relationship references to other domain models.
 *
 * An EnergyProfile is a time-stamped energy measurement and efficiency
 * assessment for a scored entity (Train, Station, Route, or Zone). It
 * captures live consumption readings, baseline comparisons, efficiency
 * scoring, and anomaly detection results. It drives the M7 Energy
 * Optimization module, fleet-level consumption KPIs, and energy-category
 * RiskScores and Incidents.
 *
 * EnergyPage field alignment:
 *   EnergyPage reads from Train objects with these aliases:
 *     train.energyConsumption ?? train.consumption   → EnergyProfile.consumption
 *     train.energyEfficiency  ?? train.efficiency    → EnergyProfile.efficiencyScore
 *     train.energyAnomaly     || train.hasEnergyAnomaly → EnergyProfile.anomalyStatus
 *   These aliases are preserved in ENERGY_DEFAULTS and normalizeEnergyProfile()
 *   to ensure backwards compatibility when energy data is embedded on Train records.
 *
 * Architecture rules:
 *   - No API logic — does not fetch, send, or transform HTTP payloads.
 *   - No UI logic — does not import React, design tokens, or components.
 *   - No store logic — does not import or call Zustand.
 *   - Used by: energyService.js (mapping), M7 components (prop validation),
 *     and future TypeScript migration.
 *
 * Schema fields:
 *   id                    — Unique profile record identifier (UUID / string)
 *   entityType            — Type of entity being profiled: ENERGY_ENTITY enum
 *   entityId              — ID of the entity (Train / Station / Route / Zone)
 *   entityName            — Human-readable entity name
 *   consumption           — Live measured consumption in kWh (current window)
 *   energyConsumption     — EnergyPage alias for consumption (kept in sync)
 *   efficiency            — EnergyPage alias for efficiencyScore (0–100)
 *   energyEfficiency      — EnergyPage alias for efficiencyScore (0–100)
 *   baselineConsumption   — Expected consumption for this entity type / period in kWh
 *   consumptionDelta      — Difference: consumption − baselineConsumption (positive = over)
 *   consumptionDeltaPct   — Delta as % of baseline (positive = over baseline)
 *   efficiencyScore       — Efficiency as 0–100 percent (100 = perfect efficiency)
 *   efficiencyBand        — Named band derived from score: EFFICIENCY_BAND enum
 *   anomalyStatus         — Whether anomaly detected: ANOMALY_STATUS enum
 *   energyAnomaly         — EnergyPage boolean alias (true when anomaly active)
 *   hasEnergyAnomaly      — EnergyPage boolean alias (same as energyAnomaly)
 *   anomalySeverity       — If anomaly, its severity: ANOMALY_SEVERITY enum
 *   anomalyType           — Anomaly classification: ANOMALY_TYPE enum
 *   anomalyDescription    — Human-readable anomaly description
 *   anomalyDetectedAt     — ISO timestamp when anomaly was first flagged
 *   anomalyAcknowledgedBy — Operator ID who acknowledged the anomaly
 *   periodStart           — ISO timestamp: measurement window start
 *   periodEnd             — ISO timestamp: measurement window end
 *   periodType            — Measurement window type: PERIOD_TYPE enum
 *   peakConsumption       — Peak kWh recorded within the period
 *   peakAt                — ISO timestamp when peak was recorded
 *   minConsumption        — Minimum kWh recorded within the period
 *   unit                  — Energy unit string (default 'kWh')
 *   sourceSystem          — Data source: ENERGY_SOURCE enum
 *   meterId               — Hardware meter / sensor identifier
 *   meterCode             — Short code for meter (e.g. 'TRN-12301-M1')
 *   routeId               — Route context (null if not route-scoped)
 *   stationId             — Station context (null if not station-scoped)
 *   zoneCode              — Indian Railway zone code
 *   savingsPotentialKwh   — Estimated kWh savings if efficiency is optimal
 *   savingsPotentialPct   — Savings potential as % of baseline
 *   recommendation        — Operator / system energy-saving recommendation
 *   tags                  — Arbitrary string tags
 *   linkedRiskScoreIds    — IDs of energy-category RiskScore records
 *   linkedIncidentIds     — IDs of energy-type Incident records
 *   linkedNotificationIds — IDs of Notifications dispatched for this profile
 *   isAcknowledged        — Whether an operator has acknowledged anomaly/alert
 *   acknowledgedAt        — ISO timestamp of acknowledgement
 *   acknowledgedBy        — Operator ID who acknowledged
 *   measuredAt            — ISO timestamp of the primary measurement reading
 *   updatedAt             — ISO timestamp of last record modification
 *   lastUpdatedAt         — Store-canonical alias for updatedAt
 *   syncedAt              — ISO timestamp of last backend sync
 *   version               — Optimistic-concurrency version counter
 *   meta                  — Arbitrary extension object for future fields
 *
 * Relationships:
 *   EnergyProfile → Train     via entityId (when entityType = 'train')    (M-to-1)
 *   EnergyProfile → Station   via entityId / stationId                    (M-to-1, optional)
 *   EnergyProfile → Route     via entityId / routeId                      (M-to-1, optional)
 *   EnergyProfile → RiskScore[] via linkedRiskScoreIds                    (M-to-M)
 *   EnergyProfile → Incident[] via linkedIncidentIds                      (M-to-M)
 *   EnergyProfile → Notification[] via linkedNotificationIds              (1-to-M)
 *
 * Dependencies:
 *   - None. Pure JS constants and plain objects.
 *
 * Exports:
 *   - ENERGY_ENTITY      → frozen enum: profiled entity type values
 *   - EFFICIENCY_BAND    → frozen enum: efficiency band names + fromScore()
 *   - ANOMALY_STATUS     → frozen enum: anomaly detection state values
 *   - ANOMALY_SEVERITY   → frozen enum: anomaly severity values
 *   - ANOMALY_TYPE       → frozen enum: anomaly classification types
 *   - PERIOD_TYPE        → frozen enum: measurement window types
 *   - ENERGY_SOURCE      → frozen enum: data source type values
 *   - ENERGY_SORT        → frozen enum: valid sort key strings
 *   - ENERGY_FIELD       → frozen map: field name → metadata
 *   - ENERGY_DEFAULTS    → frozen default EnergyProfile record
 *   - createEnergyProfile → factory: merges partial with defaults
 *   - isValidEnergyProfile → validator: minimum-contract check
 *   - normalizeEnergyProfile → normalizer: coerces raw payload to valid shape
 *   - EnergyProfile (default) → frozen reference object
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
// ENERGY_ENTITY
// The type of entity this EnergyProfile is measuring.
// Aligned with ENTITY_TYPE in risk.js but independently authoritative.
// ---------------------------------------------------------------------------

export const ENERGY_ENTITY = deepFreeze({
  /** Individual train / rake */
  TRAIN:    'train',
  /** Station (platform + concourse + ancillary) */
  STATION:  'station',
  /** Route segment (OHE, traction substations along route) */
  ROUTE:    'route',
  /** Traction substation */
  SUBSTATION:'substation',
  /** Indian Railway zone aggregate */
  ZONE:     'zone',
  /** Network-wide aggregate */
  NETWORK:  'network',

  /** Ordered display list */
  ordered: ['train', 'station', 'route', 'substation', 'zone', 'network'],
});

// ---------------------------------------------------------------------------
// EFFICIENCY_BAND
// Named efficiency band derived from efficiencyScore (0–100).
// Aligned with EnergyPage efficiencyConfig() helper:
//   score ≥ 90 → excellent   (mod: 'ok')
//   score ≥ 70 → good        (mod: 'low')
//   score ≥ 50 → fair        (mod: 'medium')
//   score  < 50 → poor       (mod: 'critical')
// ---------------------------------------------------------------------------

export const EFFICIENCY_BAND = deepFreeze({
  /** efficiencyScore ≥ 90 — excellent energy use, no action needed */
  EXCELLENT: 'excellent',
  /** efficiencyScore 70–89 — good, minor optimisation possible */
  GOOD:      'good',
  /** efficiencyScore 50–69 — fair, optimisation recommended */
  FAIR:      'fair',
  /** efficiencyScore < 50 — poor, intervention required */
  POOR:      'poor',
  /** Score not available */
  UNKNOWN:   'unknown',

  /**
   * CSS modifier class aligned with EnergyPage efficiencyConfig().
   * Returns { label, mod } matching the page's rendering logic.
   */
  uiConfig: {
    excellent: { label: 'Excellent', mod: 'ok'       },
    good:      { label: 'Good',      mod: 'low'      },
    fair:      { label: 'Fair',      mod: 'medium'   },
    poor:      { label: 'Poor',      mod: 'critical' },
    unknown:   { label: 'Unknown',   mod: 'unknown'  },
  },

  /**
   * Derive EFFICIENCY_BAND from a raw 0–100 score.
   * @param {number | null | undefined} score
   * @returns {string}
   */
  fromScore(score) {
    const n = typeof score === 'number' ? score : -1;
    if (n < 0)    return 'unknown';
    if (n >= 90)  return 'excellent';
    if (n >= 70)  return 'good';
    if (n >= 50)  return 'fair';
    return 'poor';
  },

  /** Ordered descending quality (index 0 = best) */
  orderedDesc: ['excellent', 'good', 'fair', 'poor', 'unknown'],
});

// ---------------------------------------------------------------------------
// ANOMALY_STATUS
// Whether an energy anomaly has been detected for this entity.
// Drives the EnergyPage energyAnomaly / hasEnergyAnomaly flags.
// ---------------------------------------------------------------------------

export const ANOMALY_STATUS = deepFreeze({
  /** No anomaly detected — consumption within normal range */
  NORMAL:        'normal',
  /** Minor deviation — monitoring advised */
  WATCH:         'watch',
  /** Anomaly confirmed — operator attention required */
  ANOMALY:       'anomaly',
  /** Critical anomaly — likely hardware fault or major overconsumption */
  CRITICAL:      'critical',
  /** Anomaly was detected and resolved */
  RESOLVED:      'resolved',
  /** Sensor / meter offline — status cannot be determined */
  DATA_MISSING:  'data_missing',

  /** States where energyAnomaly boolean should be true */
  anomalyStates: ['anomaly', 'critical'],
  /** States requiring operator attention */
  actionRequired: ['anomaly', 'critical'],

  /** Ordered ascending severity */
  ordered: ['normal', 'watch', 'anomaly', 'critical', 'resolved', 'data_missing'],
});

// ---------------------------------------------------------------------------
// ANOMALY_SEVERITY
// Severity band for confirmed anomalies.
// ---------------------------------------------------------------------------

export const ANOMALY_SEVERITY = deepFreeze({
  CRITICAL: 'critical',
  HIGH:     'high',
  MEDIUM:   'medium',
  LOW:      'low',
  UNKNOWN:  'unknown',

  ordered: ['critical', 'high', 'medium', 'low', 'unknown'],
});

// ---------------------------------------------------------------------------
// ANOMALY_TYPE
// Classification of the detected energy anomaly.
// ---------------------------------------------------------------------------

export const ANOMALY_TYPE = deepFreeze({
  /** Consumption significantly above baseline for entity / time of day */
  OVERCONSUMPTION:   'overconsumption',
  /** Unexpectedly low consumption (possible sensor fault or offline) */
  UNDERCONSUMPTION:  'underconsumption',
  /** Sharp spike within measurement window */
  SPIKE:             'spike',
  /** Rapid large drop in consumption */
  DROP:              'drop',
  /** Consumption pattern does not match historical for this time slot */
  PATTERN_MISMATCH:  'pattern_mismatch',
  /** Continuous high-load condition exceeding rated traction demand */
  SUSTAINED_HIGH:    'sustained_high',
  /** Meter fault — consecutive zero or null readings */
  METER_FAULT:       'meter_fault',
  /** Power factor degradation detected */
  POWER_FACTOR:      'power_factor',
  /** Harmonic distortion exceeding threshold */
  HARMONIC:          'harmonic',
  /** Catch-all */
  OTHER:             'other',
  /** No anomaly type (non-anomaly records) */
  NONE:              'none',
});

// ---------------------------------------------------------------------------
// PERIOD_TYPE
// Measurement window type for periodStart / periodEnd.
// ---------------------------------------------------------------------------

export const PERIOD_TYPE = deepFreeze({
  /** Point-in-time / instantaneous reading */
  INSTANT:   'instant',
  /** 5-minute rolling window */
  MIN_5:     '5min',
  /** 15-minute window */
  MIN_15:    '15min',
  /** Hourly aggregate */
  HOURLY:    'hourly',
  /** Daily aggregate */
  DAILY:     'daily',
  /** Weekly aggregate */
  WEEKLY:    'weekly',
  /** Monthly aggregate */
  MONTHLY:   'monthly',
  /** Trip-level aggregate (train journey) */
  TRIP:      'trip',
  /** Custom / variable window */
  CUSTOM:    'custom',

  /** Ordered short-to-long */
  ordered: ['instant', '5min', '15min', 'hourly', 'daily', 'weekly', 'monthly', 'trip'],
});

// ---------------------------------------------------------------------------
// ENERGY_SOURCE
// Data source / metering system that produced the reading.
// ---------------------------------------------------------------------------

export const ENERGY_SOURCE = deepFreeze({
  /** On-board train energy meter */
  ONBOARD_METER:   'onboard_meter',
  /** Traction substation energy measurement */
  SUBSTATION:      'substation',
  /** AMR (Automatic Meter Reading) system */
  AMR:             'amr',
  /** SCADA system energy channel */
  SCADA:           'scada',
  /** IoT / smart sensor */
  IOT_SENSOR:      'iot_sensor',
  /** AI estimation model (no direct meter) */
  AI_MODEL:        'ai_model',
  /** Manual entry by operator */
  MANUAL:          'manual',
  /** External / utility provider data */
  EXTERNAL:        'external',
  /** Source unknown */
  UNKNOWN:         'unknown',
});

// ---------------------------------------------------------------------------
// ENERGY_SORT
// Valid sort key strings for a future energyStore or component-level sort.
// ---------------------------------------------------------------------------

export const ENERGY_SORT = deepFreeze({
  CONSUMPTION_DESC:  'consumption_desc',
  CONSUMPTION_ASC:   'consumption_asc',
  EFFICIENCY_DESC:   'efficiencyScore_desc',
  EFFICIENCY_ASC:    'efficiencyScore_asc',
  DELTA_DESC:        'consumptionDelta_desc',
  DELTA_ASC:         'consumptionDelta_asc',
  UPDATED_DESC:      'lastUpdatedAt_desc',
  UPDATED_ASC:       'lastUpdatedAt_asc',
  MEASURED_DESC:     'measuredAt_desc',
  MEASURED_ASC:      'measuredAt_asc',

  DEFAULT: 'consumption_desc',
});

// ---------------------------------------------------------------------------
// ENERGY_FIELD
// Field-level metadata map.
// ---------------------------------------------------------------------------

export const ENERGY_FIELD = deepFreeze({
  id: {
    key: 'id', label: 'Profile ID',
    type: 'string', required: true, indexed: true,
  },
  entityType: {
    key: 'entityType', label: 'Entity Type',
    type: 'ENERGY_ENTITY', required: true, indexed: true,
  },
  entityId: {
    key: 'entityId', label: 'Entity ID',
    type: 'string', required: true, indexed: true,
  },
  entityName: {
    key: 'entityName', label: 'Entity Name',
    type: 'string', required: false, indexed: false,
  },
  consumption: {
    key: 'consumption', label: 'Consumption (kWh)',
    type: 'number', required: true, indexed: true,
    note: 'Primary consumption value. EnergyPage reads train.energyConsumption ?? train.consumption.',
  },
  energyConsumption: {
    key: 'energyConsumption', label: 'Energy Consumption (kWh)',
    type: 'number', required: false, indexed: true,
    note: 'EnergyPage alias — kept in sync with consumption.',
  },
  efficiency: {
    key: 'efficiency', label: 'Efficiency (%) [alias]',
    type: 'number (0–100)', required: false, indexed: false,
    note: 'EnergyPage alias — kept in sync with efficiencyScore.',
  },
  energyEfficiency: {
    key: 'energyEfficiency', label: 'Energy Efficiency (%) [alias]',
    type: 'number (0–100)', required: false, indexed: false,
    note: 'EnergyPage alias — kept in sync with efficiencyScore.',
  },
  baselineConsumption: {
    key: 'baselineConsumption', label: 'Baseline (kWh)',
    type: 'number', required: false, indexed: false,
  },
  consumptionDelta: {
    key: 'consumptionDelta', label: 'Delta (kWh)',
    type: 'number', required: false, indexed: true,
    note: 'consumption − baselineConsumption. Positive = over baseline.',
  },
  consumptionDeltaPct: {
    key: 'consumptionDeltaPct', label: 'Delta (%)',
    type: 'number', required: false, indexed: false,
  },
  efficiencyScore: {
    key: 'efficiencyScore', label: 'Efficiency Score',
    type: 'number (0–100)', required: false, indexed: true,
  },
  efficiencyBand: {
    key: 'efficiencyBand', label: 'Efficiency Band',
    type: 'EFFICIENCY_BAND', required: false, indexed: true,
  },
  anomalyStatus: {
    key: 'anomalyStatus', label: 'Anomaly Status',
    type: 'ANOMALY_STATUS', required: false, indexed: true,
  },
  energyAnomaly: {
    key: 'energyAnomaly', label: 'Energy Anomaly',
    type: 'boolean', required: false, indexed: true,
    note: 'EnergyPage boolean alias — true when anomalyStatus in ANOMALY_STATUS.anomalyStates.',
  },
  hasEnergyAnomaly: {
    key: 'hasEnergyAnomaly', label: 'Has Energy Anomaly',
    type: 'boolean', required: false, indexed: true,
    note: 'EnergyPage boolean alias — identical to energyAnomaly.',
  },
  anomalySeverity: {
    key: 'anomalySeverity', label: 'Anomaly Severity',
    type: 'ANOMALY_SEVERITY', required: false, indexed: true,
  },
  anomalyType: {
    key: 'anomalyType', label: 'Anomaly Type',
    type: 'ANOMALY_TYPE', required: false, indexed: true,
  },
  anomalyDescription: {
    key: 'anomalyDescription', label: 'Anomaly Description',
    type: 'string', required: false, indexed: false,
  },
  anomalyDetectedAt: {
    key: 'anomalyDetectedAt', label: 'Anomaly Detected At',
    type: 'ISO8601', required: false, indexed: false,
  },
  anomalyAcknowledgedBy: {
    key: 'anomalyAcknowledgedBy', label: 'Anomaly Acknowledged By',
    type: 'string', required: false, indexed: false,
  },
  periodStart: {
    key: 'periodStart', label: 'Period Start',
    type: 'ISO8601', required: false, indexed: false,
  },
  periodEnd: {
    key: 'periodEnd', label: 'Period End',
    type: 'ISO8601', required: false, indexed: false,
  },
  periodType: {
    key: 'periodType', label: 'Period Type',
    type: 'PERIOD_TYPE', required: false, indexed: true,
  },
  peakConsumption: {
    key: 'peakConsumption', label: 'Peak (kWh)',
    type: 'number', required: false, indexed: false,
  },
  peakAt: {
    key: 'peakAt', label: 'Peak At',
    type: 'ISO8601', required: false, indexed: false,
  },
  minConsumption: {
    key: 'minConsumption', label: 'Min (kWh)',
    type: 'number', required: false, indexed: false,
  },
  unit: {
    key: 'unit', label: 'Unit',
    type: 'string', required: false, indexed: false,
  },
  sourceSystem: {
    key: 'sourceSystem', label: 'Source System',
    type: 'ENERGY_SOURCE', required: false, indexed: true,
  },
  meterId: {
    key: 'meterId', label: 'Meter ID',
    type: 'string', required: false, indexed: true,
  },
  meterCode: {
    key: 'meterCode', label: 'Meter Code',
    type: 'string', required: false, indexed: false,
  },
  routeId: {
    key: 'routeId', label: 'Route ID',
    type: 'string', required: false, indexed: true,
  },
  stationId: {
    key: 'stationId', label: 'Station ID',
    type: 'string', required: false, indexed: true,
  },
  zoneCode: {
    key: 'zoneCode', label: 'Zone',
    type: 'string', required: false, indexed: true,
  },
  savingsPotentialKwh: {
    key: 'savingsPotentialKwh', label: 'Savings Potential (kWh)',
    type: 'number', required: false, indexed: false,
  },
  savingsPotentialPct: {
    key: 'savingsPotentialPct', label: 'Savings Potential (%)',
    type: 'number', required: false, indexed: false,
  },
  recommendation: {
    key: 'recommendation', label: 'Recommendation',
    type: 'string', required: false, indexed: false,
  },
  tags: {
    key: 'tags', label: 'Tags',
    type: 'string[]', required: false, indexed: false,
  },
  linkedRiskScoreIds: {
    key: 'linkedRiskScoreIds', label: 'Linked Risk Scores',
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
  isAcknowledged: {
    key: 'isAcknowledged', label: 'Acknowledged',
    type: 'boolean', required: false, indexed: false,
  },
  acknowledgedAt: {
    key: 'acknowledgedAt', label: 'Acknowledged At',
    type: 'ISO8601', required: false, indexed: false,
  },
  acknowledgedBy: {
    key: 'acknowledgedBy', label: 'Acknowledged By',
    type: 'string', required: false, indexed: false,
  },
  measuredAt: {
    key: 'measuredAt', label: 'Measured At',
    type: 'ISO8601', required: true, indexed: true,
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
// ENERGY_DEFAULTS
// Safe baseline values for every EnergyProfile field.
// ---------------------------------------------------------------------------

export const ENERGY_DEFAULTS = deepFreeze({
  id:                    '',
  entityType:            ENERGY_ENTITY.TRAIN,
  entityId:              '',
  entityName:            '',

  // ── Consumption (primary + EnergyPage aliases) ──────────────────────────
  consumption:           0,
  energyConsumption:     0,        // alias — synced with consumption
  baselineConsumption:   0,
  consumptionDelta:      0,
  consumptionDeltaPct:   0,

  // ── Efficiency (primary + EnergyPage aliases) ────────────────────────────
  efficiencyScore:       null,
  efficiencyBand:        EFFICIENCY_BAND.UNKNOWN,
  efficiency:            null,     // alias — synced with efficiencyScore
  energyEfficiency:      null,     // alias — synced with efficiencyScore

  // ── Anomaly (primary + EnergyPage boolean aliases) ───────────────────────
  anomalyStatus:         ANOMALY_STATUS.NORMAL,
  energyAnomaly:         false,    // alias — true when anomalyStatus in anomalyStates
  hasEnergyAnomaly:      false,    // alias — identical to energyAnomaly
  anomalySeverity:       ANOMALY_SEVERITY.UNKNOWN,
  anomalyType:           ANOMALY_TYPE.NONE,
  anomalyDescription:    '',
  anomalyDetectedAt:     null,
  anomalyAcknowledgedBy: null,

  // ── Measurement window ────────────────────────────────────────────────────
  periodStart:           null,
  periodEnd:             null,
  periodType:            PERIOD_TYPE.HOURLY,
  peakConsumption:       null,
  peakAt:                null,
  minConsumption:        null,
  unit:                  'kWh',

  // ── Source ────────────────────────────────────────────────────────────────
  sourceSystem:          ENERGY_SOURCE.UNKNOWN,
  meterId:               null,
  meterCode:             '',

  // ── Context ───────────────────────────────────────────────────────────────
  routeId:               null,
  stationId:             null,
  zoneCode:              '',

  // ── Optimisation ──────────────────────────────────────────────────────────
  savingsPotentialKwh:   null,
  savingsPotentialPct:   null,
  recommendation:        '',

  // ── Tags ──────────────────────────────────────────────────────────────────
  tags:                  [],

  // ── Relationships ─────────────────────────────────────────────────────────
  linkedRiskScoreIds:    [],
  linkedIncidentIds:     [],
  linkedNotificationIds: [],

  // ── Acknowledgement ───────────────────────────────────────────────────────
  isAcknowledged:        false,
  acknowledgedAt:        null,
  acknowledgedBy:        null,

  // ── Timestamps ────────────────────────────────────────────────────────────
  measuredAt:            null,
  updatedAt:             null,
  lastUpdatedAt:         null,
  syncedAt:              null,

  // ── Concurrency ───────────────────────────────────────────────────────────
  version:               1,

  // ── Extension ─────────────────────────────────────────────────────────────
  meta:                  {},
});

// ---------------------------------------------------------------------------
// createEnergyProfile
// Factory — merges a partial record with ENERGY_DEFAULTS.
// Auto-derives:
//   efficiencyBand from efficiencyScore
//   energyAnomaly / hasEnergyAnomaly from anomalyStatus
//   consumptionDelta / consumptionDeltaPct from consumption + baseline
//   All EnergyPage alias fields kept in sync
//
// @param {Partial<typeof ENERGY_DEFAULTS>} partial
// @returns {typeof ENERGY_DEFAULTS}
// ---------------------------------------------------------------------------

export function createEnergyProfile(partial = {}) {
  if (!partial || typeof partial !== 'object') {
    return { ...ENERGY_DEFAULTS };
  }

  const now = new Date().toISOString();

  // Resolve consumption — accept either name
  const consumption =
    typeof partial.consumption === 'number'        ? partial.consumption       :
    typeof partial.energyConsumption === 'number'  ? partial.energyConsumption :
    ENERGY_DEFAULTS.consumption;

  // Resolve efficiencyScore — accept either alias
  const efficiencyScore =
    typeof partial.efficiencyScore === 'number'  ? partial.efficiencyScore  :
    typeof partial.energyEfficiency === 'number' ? partial.energyEfficiency :
    typeof partial.efficiency === 'number'       ? partial.efficiency       :
    null;

  // Derive efficiencyBand
  const efficiencyBand = partial.efficiencyBand
    ?? EFFICIENCY_BAND.fromScore(efficiencyScore);

  // Resolve anomalyStatus
  const anomalyStatus = partial.anomalyStatus ?? ENERGY_DEFAULTS.anomalyStatus;

  // Derive boolean anomaly aliases from status
  const isAnomaly = ANOMALY_STATUS.anomalyStates.includes(anomalyStatus);
  const energyAnomaly    = typeof partial.energyAnomaly    === 'boolean' ? partial.energyAnomaly    : isAnomaly;
  const hasEnergyAnomaly = typeof partial.hasEnergyAnomaly === 'boolean' ? partial.hasEnergyAnomaly : isAnomaly;

  // Derive delta fields from consumption + baseline
  const baselineConsumption = typeof partial.baselineConsumption === 'number'
    ? partial.baselineConsumption
    : ENERGY_DEFAULTS.baselineConsumption;
  const consumptionDelta = partial.consumptionDelta
    ?? (consumption - baselineConsumption);
  const consumptionDeltaPct = partial.consumptionDeltaPct
    ?? (baselineConsumption > 0 ? Math.round((consumptionDelta / baselineConsumption) * 100 * 10) / 10 : 0);

  return {
    ...ENERGY_DEFAULTS,
    ...partial,
    consumption,
    energyConsumption:     consumption,         // sync alias
    efficiencyScore,
    efficiency:            efficiencyScore,      // sync alias
    energyEfficiency:      efficiencyScore,      // sync alias
    efficiencyBand,
    anomalyStatus,
    energyAnomaly,
    hasEnergyAnomaly,
    baselineConsumption,
    consumptionDelta,
    consumptionDeltaPct,
    // Ensure array fields
    tags:                  Array.isArray(partial.tags)                  ? partial.tags                  : ENERGY_DEFAULTS.tags,
    linkedRiskScoreIds:    Array.isArray(partial.linkedRiskScoreIds)    ? partial.linkedRiskScoreIds    : ENERGY_DEFAULTS.linkedRiskScoreIds,
    linkedIncidentIds:     Array.isArray(partial.linkedIncidentIds)     ? partial.linkedIncidentIds     : ENERGY_DEFAULTS.linkedIncidentIds,
    linkedNotificationIds: Array.isArray(partial.linkedNotificationIds) ? partial.linkedNotificationIds : ENERGY_DEFAULTS.linkedNotificationIds,
    meta: (partial.meta && typeof partial.meta === 'object' && !Array.isArray(partial.meta))
      ? { ...partial.meta }
      : {},
    // Timestamps
    measuredAt:    partial.measuredAt    ?? now,
    updatedAt:     partial.updatedAt     ?? now,
    lastUpdatedAt: partial.lastUpdatedAt ?? partial.updatedAt ?? now,
    version: (typeof partial.version === 'number' && partial.version > 0) ? partial.version : 1,
  };
}

// ---------------------------------------------------------------------------
// isValidEnergyProfile
// Minimum-contract validator.
//
// @param {unknown} obj
// @returns {boolean}
// ---------------------------------------------------------------------------

export function isValidEnergyProfile(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.id || typeof obj.id !== 'string' || obj.id.trim() === '') return false;
  if (!obj.entityId) return false;
  if (typeof obj.consumption !== 'number') return false;
  return true;
}

// ---------------------------------------------------------------------------
// normalizeEnergyProfile
// Coerces a raw API payload or Train-embedded energy object to a valid
// EnergyProfile shape. Handles all known field-name aliases:
//   energyProfileId    → id
//   energy_id          → id
//   energy_consumption → consumption / energyConsumption
//   energy_efficiency  → efficiencyScore / efficiency / energyEfficiency
//   energy_anomaly     → anomalyStatus + boolean aliases
//   baseline           → baselineConsumption
//   updated_at         → updatedAt
//   measured_at        → measuredAt
//
// @param {unknown} raw
// @returns {typeof ENERGY_DEFAULTS | null}
// ---------------------------------------------------------------------------

export function normalizeEnergyProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id ?? raw.energyProfileId ?? raw.energy_id ?? null;
  if (!id) return null;

  // Resolve entityId — may be embedded (e.g. Train object passed as entity)
  const entityId   = raw.entityId   ?? raw.entity_id   ?? raw.trainId ?? raw.id ?? '';
  const entityType = raw.entityType ?? raw.entity_type ?? ENERGY_ENTITY.TRAIN;
  const entityName = raw.entityName ?? raw.entity_name ?? raw.name ?? '';

  // Resolve consumption
  const consumption =
    typeof raw.consumption === 'number'            ? raw.consumption            :
    typeof raw.energyConsumption === 'number'      ? raw.energyConsumption      :
    typeof raw.energy_consumption === 'number'     ? raw.energy_consumption     :
    0;

  // Resolve efficiency
  const efficiencyScore =
    typeof raw.efficiencyScore === 'number'    ? raw.efficiencyScore    :
    typeof raw.energyEfficiency === 'number'   ? raw.energyEfficiency   :
    typeof raw.energy_efficiency === 'number'  ? raw.energy_efficiency  :
    typeof raw.efficiency === 'number'         ? raw.efficiency         :
    null;

  // Resolve baseline
  const baselineConsumption =
    typeof raw.baselineConsumption === 'number' ? raw.baselineConsumption :
    typeof raw.baseline === 'number'            ? raw.baseline            :
    0;

  // Resolve anomalyStatus — accept boolean, string, or derived
  let anomalyStatus = raw.anomalyStatus ?? raw.anomaly_status ?? ANOMALY_STATUS.NORMAL;
  if (typeof anomalyStatus === 'boolean') {
    anomalyStatus = anomalyStatus ? ANOMALY_STATUS.ANOMALY : ANOMALY_STATUS.NORMAL;
  }
  // Accept energyAnomaly / hasEnergyAnomaly booleans as fallback
  if (anomalyStatus === ANOMALY_STATUS.NORMAL) {
    const flag = raw.energyAnomaly ?? raw.energy_anomaly ?? raw.hasEnergyAnomaly ?? false;
    if (flag) anomalyStatus = ANOMALY_STATUS.ANOMALY;
  }

  // Resolve timestamps
  const measuredAt    = raw.measuredAt    ?? raw.measured_at    ?? null;
  const updatedAt     = raw.updatedAt     ?? raw.updated_at     ?? measuredAt ?? null;
  const lastUpdatedAt = raw.lastUpdatedAt ?? updatedAt ?? null;

  return createEnergyProfile({
    ...raw,
    id,
    entityId,
    entityType,
    entityName,
    consumption,
    energyConsumption: consumption,
    baselineConsumption,
    efficiencyScore,
    efficiency:       efficiencyScore,
    energyEfficiency: efficiencyScore,
    anomalyStatus,
    measuredAt,
    updatedAt,
    lastUpdatedAt,
  });
}

// ---------------------------------------------------------------------------
// EnergyProfile — reference schema object (default export)
// ---------------------------------------------------------------------------

/**
 * Canonical EnergyProfile domain model — reference shape.
 *
 * @example
 * import EnergyProfile from '../types/energy.js';
 * // EnergyProfile documents every field with its default value and type.
 */
const EnergyProfile = deepFreeze({
  // ── Identity ──────────────────────────────────────────────────────────────
  id:                    'EP-00301',
  entityType:            ENERGY_ENTITY.TRAIN,
  entityId:              'TRN-12301',
  entityName:            'Howrah Rajdhani Express (12301)',

  // ── Consumption ───────────────────────────────────────────────────────────
  consumption:           1840,      // kWh for this trip segment
  energyConsumption:     1840,      // alias — synced
  baselineConsumption:   1550,      // kWh expected for this route segment
  consumptionDelta:      290,       // 290 kWh above baseline
  consumptionDeltaPct:   18.7,      // 18.7% over baseline

  // ── Efficiency ────────────────────────────────────────────────────────────
  efficiencyScore:       72,
  efficiencyBand:        EFFICIENCY_BAND.GOOD,
  efficiency:            72,        // alias
  energyEfficiency:      72,        // alias

  // ── Anomaly ───────────────────────────────────────────────────────────────
  anomalyStatus:         ANOMALY_STATUS.WATCH,
  energyAnomaly:         false,     // watch is below the anomaly threshold
  hasEnergyAnomaly:      false,
  anomalySeverity:       ANOMALY_SEVERITY.UNKNOWN,
  anomalyType:           ANOMALY_TYPE.NONE,
  anomalyDescription:    '',
  anomalyDetectedAt:     null,
  anomalyAcknowledgedBy: null,

  // ── Measurement window ────────────────────────────────────────────────────
  periodStart:           '2025-06-10T14:00:00.000Z',
  periodEnd:             '2025-06-10T16:30:00.000Z',
  periodType:            PERIOD_TYPE.TRIP,
  peakConsumption:       320,       // kWh — peak 15-min block
  peakAt:                '2025-06-10T15:20:00.000Z',
  minConsumption:        85,
  unit:                  'kWh',

  // ── Source ────────────────────────────────────────────────────────────────
  sourceSystem:          ENERGY_SOURCE.ONBOARD_METER,
  meterId:               'MTR-12301-01',
  meterCode:             'TRN-12301-M1',

  // ── Context ───────────────────────────────────────────────────────────────
  routeId:               'RT-001',
  stationId:             null,
  zoneCode:              'NR',

  // ── Optimisation ──────────────────────────────────────────────────────────
  savingsPotentialKwh:   180,
  savingsPotentialPct:   9.8,
  recommendation:        'Reduce auxiliary load between CNB and ALD. Consider regenerative braking optimisation on downgrade sections.',

  // ── Tags ──────────────────────────────────────────────────────────────────
  tags:                  ['rajdhani', 'nr', 'trip', 'over-baseline'],

  // ── Relationships ─────────────────────────────────────────────────────────
  linkedRiskScoreIds:    [],
  linkedIncidentIds:     [],
  linkedNotificationIds: [],

  // ── Acknowledgement ───────────────────────────────────────────────────────
  isAcknowledged:        false,
  acknowledgedAt:        null,
  acknowledgedBy:        null,

  // ── Timestamps ────────────────────────────────────────────────────────────
  measuredAt:            '2025-06-10T16:30:00.000Z',
  updatedAt:             '2025-06-10T16:30:05.000Z',
  lastUpdatedAt:         '2025-06-10T16:30:05.000Z',
  syncedAt:              '2025-06-10T16:30:10.000Z',

  // ── Concurrency ───────────────────────────────────────────────────────────
  version:               1,

  // ── Extension ─────────────────────────────────────────────────────────────
  meta:                  {},
});

export default EnergyProfile;

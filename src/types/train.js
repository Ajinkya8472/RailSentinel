/**
 * src/types/train.js
 *
 * Purpose:
 * Canonical Train domain model for RailSentinel. This file is the authoritative
 * definition of what a Train record is: its fields, allowed enum values,
 * field-level documentation, default values, and relationship references to
 * other domain models.
 *
 * Architecture rules:
 *   - No API logic — this file does not fetch, send, or transform HTTP payloads.
 *   - No UI logic — this file does not import React, design tokens, or components.
 *   - No store logic — this file does not import or call Zustand.
 *   - Used by: trainStore.js (normalization), trainService.js (mapping),
 *     M1/Map/Schedule components (prop validation), and future TypeScript migration.
 *
 * Schema fields:
 *   id                  — Unique train identifier (UUID / string)
 *   trainNumber         — Official train number (e.g. '12301')
 *   number              — Store-canonical alias for trainNumber
 *   name                — Named train service (e.g. 'Rajdhani Express')
 *   routeId             — Linked route ID (from routes.json)
 *   routeName           — Human-readable route name
 *   route               — Store alias for routeName (used in filter)
 *   status              — Operational status: TRAIN_STATUS enum
 *   delayMinutes        — Current delay in whole minutes (0 = on time)
 *   currentStation      — Station code where train currently is / last reported
 *   currentStationName  — Human-readable name of current station
 *   nextStation         — Station code of the next scheduled stop
 *   nextStationName     — Human-readable name of next station
 *   originStation       — Departure terminus station code
 *   destinationStation  — Arrival terminus station code
 *   position            — { lat, lng } last known GPS position
 *   speedKmh            — Current speed in km/h
 *   distanceTravelledKm — Distance covered since origin in km
 *   platformNumber      — Platform at current station (null if en-route)
 *   healthStatus        — Fleet / rolling-stock health: HEALTH_STATUS enum
 *   serviceType         — Train category: SERVICE_TYPE enum
 *   operatorName        — Operating zone / railway division name
 *   operator            — Store alias for operatorName (used in filter)
 *   coachCount          — Number of coaches in this rake
 *   passengerCount      — Live passenger count (from crowd model, optional)
 *   occupancyPercent    — Occupancy as 0–100 percentage (optional)
 *   scheduledDeparture  — ISO timestamp of scheduled departure from origin
 *   scheduledArrival    — ISO timestamp of scheduled arrival at destination
 *   estimatedArrival    — ISO timestamp of estimated arrival (delay-adjusted)
 *   zoneCode            — Indian Railway zone code (e.g. 'NR', 'CR')
 *   linkedIncidentIds   — IDs of active Incident records affecting this train
 *   linkedRiskScoreIds  — IDs of RiskScore records for this train
 *   sensorReadingIds    — IDs of SensorReading records from on-board sensors
 *   tags                — Arbitrary string tags for search / filtering
 *   createdAt           — ISO timestamp of record creation
 *   updatedAt           — ISO timestamp of last record modification
 *   lastUpdatedAt       — Store-canonical alias for updatedAt (always kept in sync)
 *   syncedAt            — ISO timestamp of last successful backend sync
 *   version             — Optimistic-concurrency version counter
 *   meta                — Arbitrary extension object for future fields
 *
 * Relationships:
 *   Train → Route             via routeId               (M-to-1)
 *   Train → Incident[]        via linkedIncidentIds      (M-to-M)
 *   Train → RiskScore[]       via linkedRiskScoreIds     (M-to-M)
 *   Train → SensorReading[]   via sensorReadingIds       (1-to-M)
 *   Train → CrowdForecast     (indirect via currentStation / passengerCount)
 *   Train → ScheduleConflict  (indirect via routeId / id)
 *   Train → Notification[]    (indirect — Notifications reference Train.id)
 *
 * Dependencies:
 *   - None. Pure JS constants and plain objects.
 *
 * Exports:
 *   - TRAIN_STATUS       → frozen enum: operational status values
 *   - TRAIN_HEALTH       → frozen enum: rolling-stock health band values
 *   - TRAIN_SERVICE_TYPE → frozen enum: service / category type values
 *   - TRAIN_SORT         → frozen enum: valid sort key strings for trainStore
 *   - TRAIN_FIELD        → frozen map: field name → metadata
 *   - TRAIN_DEFAULTS     → frozen default Train record
 *   - createTrain        → factory: merges partial record with defaults
 *   - isValidTrain       → validator: minimum-contract check
 *   - normalizeTrain     → normalizer: coerces raw payload to valid Train shape
 *   - Train (default)    → frozen reference object documenting the full schema
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
// TRAIN_STATUS
// Operational status of the train. Aligned with colors.STATUS.train and
// the map-marker asset naming convention (train-active, train-delayed, etc.).
// ---------------------------------------------------------------------------

export const TRAIN_STATUS = deepFreeze({
  /** Train is running within schedule tolerance (±5 min) */
  ON_TIME:     'on-time',
  /** Same as ON_TIME — alias used by some backends */
  RUNNING:     'running',
  /** Train is running more than 5 min behind schedule */
  DELAYED:     'delayed',
  /** Service has been cancelled and will not run */
  CANCELLED:   'cancelled',
  /** Service disrupted (partial cancellation or diversion) */
  DISRUPTED:   'disrupted',
  /** Train has a reported fault (degraded service running) */
  FAULT:       'fault',
  /** Train is at a station / terminus, awaiting departure */
  AT_STATION:  'at_station',
  /** Active scheduling conflict detected for this train */
  CONFLICT:    'conflict',
  /** Scheduled for maintenance and not in revenue service */
  MAINTENANCE: 'maintenance',
  /** Train origin / termination unknown or feed not active */
  UNKNOWN:     'unknown',

  /** All values that indicate the train is revenue-active */
  active: ['on-time', 'running', 'delayed', 'at_station'],
  /** All values that indicate a disruption requiring attention */
  disrupted: ['delayed', 'cancelled', 'disrupted', 'fault', 'conflict'],
  /** Ordered for display in status filter dropdown */
  ordered: [
    'on-time', 'running', 'delayed', 'at_station',
    'conflict', 'disrupted', 'fault', 'cancelled',
    'maintenance', 'unknown',
  ],
});

// ---------------------------------------------------------------------------
// TRAIN_HEALTH
// Rolling-stock / fleet health status. Sourced from on-board sensor readings
// and maintenance records. Aligned with colors.STATUS.sensor.
// ---------------------------------------------------------------------------

export const TRAIN_HEALTH = deepFreeze({
  /** All systems nominal — no active faults */
  HEALTHY:     'healthy',
  /** Minor fault present but train is fit for service */
  DEGRADED:    'degraded',
  /** Active fault — service risk, monitoring required */
  FAULT:       'fault',
  /** Critical fault — train should be withdrawn from service */
  CRITICAL:    'critical',
  /** Rake in planned maintenance bay */
  MAINTENANCE: 'maintenance',
  /** No telemetry available from this rake */
  OFFLINE:     'offline',
  /** Health status not yet determined */
  UNKNOWN:     'unknown',

  /** Ordered descending severity (index 0 = worst) */
  orderedDesc: ['critical', 'fault', 'degraded', 'healthy', 'maintenance', 'offline', 'unknown'],
});

// ---------------------------------------------------------------------------
// TRAIN_SERVICE_TYPE
// Indian Railway service category. Used for route classification and SLA
// determination. Aligned with trainStore applyFilters serviceType field.
// ---------------------------------------------------------------------------

export const TRAIN_SERVICE_TYPE = deepFreeze({
  /** Rajdhani / Shatabdi / Vande Bharat class express */
  SUPER_FAST:        'super_fast',
  /** Mail / Express trains */
  MAIL_EXPRESS:      'mail_express',
  /** Intercity Express */
  INTERCITY:         'intercity',
  /** Passenger / Slow train */
  PASSENGER:         'passenger',
  /** Goods / Freight train */
  FREIGHT:           'freight',
  /** Metro Rail (MRTS) */
  METRO:             'metro',
  /** EMU / MEMU / DEMU suburban services */
  SUBURBAN:          'suburban',
  /** Vande Bharat Express (semi-high speed) */
  VANDE_BHARAT:      'vande_bharat',
  /** Tejas / Gatimaan (premium private/IRCTC operated) */
  PREMIUM:           'premium',
  /** Special / charter / seasonal train */
  SPECIAL:           'special',
  /** Heritage / tourist train */
  HERITAGE:          'heritage',

  /** Ordered display list */
  ordered: [
    'vande_bharat', 'super_fast', 'premium', 'mail_express',
    'intercity', 'suburban', 'passenger', 'metro',
    'freight', 'special', 'heritage',
  ],
});

// ---------------------------------------------------------------------------
// TRAIN_SORT
// Valid sort key strings for trainStore.setSort().
// ---------------------------------------------------------------------------

export const TRAIN_SORT = deepFreeze({
  STATUS_DESC:    'status_desc',
  STATUS_ASC:     'status_asc',
  CREATED_DESC:   'createdAt_desc',
  CREATED_ASC:    'createdAt_asc',
  UPDATED_DESC:   'lastUpdatedAt_desc',
  UPDATED_ASC:    'lastUpdatedAt_asc',
  DELAY_DESC:     'delayMinutes_desc',
  DELAY_ASC:      'delayMinutes_asc',
  NUMBER_ASC:     'trainNumber_asc',
  NUMBER_DESC:    'trainNumber_desc',

  /** Default sort used by trainStore */
  DEFAULT: 'lastUpdatedAt_desc',
});

// ---------------------------------------------------------------------------
// TRAIN_FIELD
// Field-level metadata map — label, type, required, indexed flags.
// ---------------------------------------------------------------------------

export const TRAIN_FIELD = deepFreeze({
  id: {
    key: 'id', label: 'Train ID',
    type: 'string', required: true, indexed: true,
  },
  trainNumber: {
    key: 'trainNumber', label: 'Train Number',
    type: 'string', required: true, indexed: true,
    note: 'Official IR train number, e.g. "12301".',
  },
  number: {
    key: 'number', label: 'Number',
    type: 'string', required: false, indexed: true,
    note: 'Store alias for trainNumber; kept in sync by normalizeTrain.',
  },
  name: {
    key: 'name', label: 'Train Name',
    type: 'string', required: true, indexed: false,
  },
  routeId: {
    key: 'routeId', label: 'Route ID',
    type: 'string', required: false, indexed: true,
  },
  routeName: {
    key: 'routeName', label: 'Route Name',
    type: 'string', required: false, indexed: true,
  },
  route: {
    key: 'route', label: 'Route',
    type: 'string', required: false, indexed: true,
    note: 'Store alias for routeName used in applyFilters.',
  },
  status: {
    key: 'status', label: 'Status',
    type: 'TRAIN_STATUS', required: true, indexed: true,
  },
  delayMinutes: {
    key: 'delayMinutes', label: 'Delay (min)',
    type: 'number', required: false, indexed: true,
  },
  currentStation: {
    key: 'currentStation', label: 'Current Station Code',
    type: 'string', required: false, indexed: true,
  },
  currentStationName: {
    key: 'currentStationName', label: 'Current Station',
    type: 'string', required: false, indexed: false,
  },
  nextStation: {
    key: 'nextStation', label: 'Next Station Code',
    type: 'string', required: false, indexed: false,
  },
  nextStationName: {
    key: 'nextStationName', label: 'Next Station',
    type: 'string', required: false, indexed: false,
  },
  originStation: {
    key: 'originStation', label: 'Origin',
    type: 'string', required: false, indexed: false,
  },
  destinationStation: {
    key: 'destinationStation', label: 'Destination',
    type: 'string', required: false, indexed: true,
    note: 'Used in trainStore applyFilters search.',
  },
  position: {
    key: 'position', label: 'GPS Position',
    type: '{ lat: number, lng: number }', required: false, indexed: false,
  },
  speedKmh: {
    key: 'speedKmh', label: 'Speed (km/h)',
    type: 'number', required: false, indexed: false,
  },
  distanceTravelledKm: {
    key: 'distanceTravelledKm', label: 'Distance Travelled (km)',
    type: 'number', required: false, indexed: false,
  },
  platformNumber: {
    key: 'platformNumber', label: 'Platform',
    type: 'string', required: false, indexed: false,
  },
  healthStatus: {
    key: 'healthStatus', label: 'Health Status',
    type: 'TRAIN_HEALTH', required: false, indexed: true,
  },
  serviceType: {
    key: 'serviceType', label: 'Service Type',
    type: 'TRAIN_SERVICE_TYPE', required: false, indexed: true,
  },
  operatorName: {
    key: 'operatorName', label: 'Operator',
    type: 'string', required: false, indexed: true,
  },
  operator: {
    key: 'operator', label: 'Operator (alias)',
    type: 'string', required: false, indexed: true,
    note: 'Store alias for operatorName used in applyFilters.',
  },
  coachCount: {
    key: 'coachCount', label: 'Coaches',
    type: 'number', required: false, indexed: false,
  },
  passengerCount: {
    key: 'passengerCount', label: 'Passenger Count',
    type: 'number', required: false, indexed: false,
  },
  occupancyPercent: {
    key: 'occupancyPercent', label: 'Occupancy (%)',
    type: 'number', required: false, indexed: false,
  },
  scheduledDeparture: {
    key: 'scheduledDeparture', label: 'Scheduled Departure',
    type: 'ISO8601', required: false, indexed: false,
  },
  scheduledArrival: {
    key: 'scheduledArrival', label: 'Scheduled Arrival',
    type: 'ISO8601', required: false, indexed: false,
  },
  estimatedArrival: {
    key: 'estimatedArrival', label: 'Estimated Arrival',
    type: 'ISO8601', required: false, indexed: false,
  },
  zoneCode: {
    key: 'zoneCode', label: 'Railway Zone',
    type: 'string', required: false, indexed: true,
  },
  linkedIncidentIds: {
    key: 'linkedIncidentIds', label: 'Linked Incidents',
    type: 'string[]', required: false, indexed: false,
  },
  linkedRiskScoreIds: {
    key: 'linkedRiskScoreIds', label: 'Linked Risk Scores',
    type: 'string[]', required: false, indexed: false,
  },
  sensorReadingIds: {
    key: 'sensorReadingIds', label: 'Sensor Readings',
    type: 'string[]', required: false, indexed: false,
  },
  tags: {
    key: 'tags', label: 'Tags',
    type: 'string[]', required: false, indexed: false,
  },
  createdAt: {
    key: 'createdAt', label: 'Created At',
    type: 'ISO8601', required: false, indexed: true,
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
// TRAIN_DEFAULTS
// Safe baseline values for every Train field.
// ---------------------------------------------------------------------------

export const TRAIN_DEFAULTS = deepFreeze({
  id:                  '',
  trainNumber:         '',
  number:              '',       // alias — kept in sync with trainNumber
  name:                '',
  routeId:             null,
  routeName:           '',
  route:               '',       // alias — kept in sync with routeName
  status:              TRAIN_STATUS.UNKNOWN,
  delayMinutes:        0,
  currentStation:      '',
  currentStationName:  '',
  nextStation:         '',
  nextStationName:     '',
  originStation:       '',
  destinationStation:  '',
  position:            null,
  speedKmh:            0,
  distanceTravelledKm: 0,
  platformNumber:      null,
  healthStatus:        TRAIN_HEALTH.UNKNOWN,
  serviceType:         TRAIN_SERVICE_TYPE.MAIL_EXPRESS,
  operatorName:        '',
  operator:            '',       // alias — kept in sync with operatorName
  coachCount:          0,
  passengerCount:      null,
  occupancyPercent:    null,
  scheduledDeparture:  null,
  scheduledArrival:    null,
  estimatedArrival:    null,
  zoneCode:            '',
  linkedIncidentIds:   [],
  linkedRiskScoreIds:  [],
  sensorReadingIds:    [],
  tags:                [],
  createdAt:           null,
  updatedAt:           null,
  lastUpdatedAt:       null,
  syncedAt:            null,
  version:             1,
  meta:                {},
});

// ---------------------------------------------------------------------------
// createTrain
// Factory function — merges a partial record with TRAIN_DEFAULTS to produce
// a fully-shaped Train object. Does not validate enum membership.
//
// @param {Partial<typeof TRAIN_DEFAULTS>} partial
// @returns {typeof TRAIN_DEFAULTS}
// ---------------------------------------------------------------------------

export function createTrain(partial = {}) {
  if (!partial || typeof partial !== 'object') {
    return { ...TRAIN_DEFAULTS };
  }

  const now = new Date().toISOString();

  // Resolve trainNumber ↔ number aliases — whichever is provided wins
  const trainNumber = partial.trainNumber ?? partial.number ?? TRAIN_DEFAULTS.trainNumber;
  const number      = partial.number ?? trainNumber;

  // Resolve routeName ↔ route aliases
  const routeName = partial.routeName ?? partial.route ?? TRAIN_DEFAULTS.routeName;
  const route     = partial.route ?? routeName;

  // Resolve operatorName ↔ operator aliases
  const operatorName = partial.operatorName ?? partial.operator ?? TRAIN_DEFAULTS.operatorName;
  const operator     = partial.operator ?? operatorName;

  return {
    ...TRAIN_DEFAULTS,
    ...partial,
    trainNumber,
    number,
    routeName,
    route,
    operatorName,
    operator,
    // Ensure array fields are always arrays
    linkedIncidentIds:  Array.isArray(partial.linkedIncidentIds)  ? partial.linkedIncidentIds  : TRAIN_DEFAULTS.linkedIncidentIds,
    linkedRiskScoreIds: Array.isArray(partial.linkedRiskScoreIds) ? partial.linkedRiskScoreIds : TRAIN_DEFAULTS.linkedRiskScoreIds,
    sensorReadingIds:   Array.isArray(partial.sensorReadingIds)   ? partial.sensorReadingIds   : TRAIN_DEFAULTS.sensorReadingIds,
    tags:               Array.isArray(partial.tags)               ? partial.tags               : TRAIN_DEFAULTS.tags,
    meta: (partial.meta && typeof partial.meta === 'object' && !Array.isArray(partial.meta))
      ? { ...partial.meta }
      : {},
    // Timestamps — seed with now if not provided
    createdAt:     partial.createdAt     ?? now,
    updatedAt:     partial.updatedAt     ?? now,
    lastUpdatedAt: partial.lastUpdatedAt ?? partial.updatedAt ?? now,
    version: (typeof partial.version === 'number' && partial.version > 0) ? partial.version : 1,
  };
}

// ---------------------------------------------------------------------------
// isValidTrain
// Minimum-contract validator. Returns true if the object has required fields.
//
// @param {unknown} obj
// @returns {boolean}
// ---------------------------------------------------------------------------

export function isValidTrain(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.id || typeof obj.id !== 'string' || obj.id.trim() === '') return false;
  if (!obj.name && !obj.trainNumber && !obj.number) return false;
  return true;
}

// ---------------------------------------------------------------------------
// normalizeTrain
// Coerces a raw API payload into a valid, complete Train shape.
// Handles field-name aliases from different backend versions:
//   trainId      → id
//   train_number → trainNumber
//   updated_at   → lastUpdatedAt (sync)
//   lastUpdated  → lastUpdatedAt
//   lat/lng      → position (coerce flat coords to position object)
//   delay        → delayMinutes
//
// @param {unknown} raw
// @returns {typeof TRAIN_DEFAULTS | null} null if raw has no usable id
// ---------------------------------------------------------------------------

export function normalizeTrain(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Resolve ID
  const id = raw.id ?? raw.trainId ?? raw.train_id ?? null;
  if (!id) return null;

  // Resolve trainNumber
  const trainNumber = raw.trainNumber ?? raw.train_number ?? raw.number ?? '';

  // Resolve timestamps
  const updatedAt     = raw.updatedAt ?? raw.updated_at ?? raw.lastUpdated ?? null;
  const lastUpdatedAt = raw.lastUpdatedAt ?? updatedAt ?? null;
  const createdAt     = raw.createdAt ?? raw.created_at ?? null;

  // Resolve operator aliases
  const operatorName = raw.operatorName ?? raw.operator ?? '';
  const operator     = operatorName;

  // Resolve route aliases
  const routeName = raw.routeName ?? raw.route ?? '';
  const route     = routeName;

  // Resolve position — accept { lat, lng }, { latitude, longitude }, or flat fields
  let position = raw.position ?? null;
  if (!position && (raw.lat != null || raw.latitude != null)) {
    const lat = raw.lat ?? raw.latitude;
    const lng = raw.lng ?? raw.longitude ?? raw.lon;
    if (lat != null && lng != null) {
      position = { lat: Number(lat), lng: Number(lng) };
    }
  }

  // Resolve delay — accept delayMinutes or delay
  const delayMinutes =
    typeof raw.delayMinutes === 'number' ? raw.delayMinutes :
    typeof raw.delay        === 'number' ? raw.delay        :
    0;

  return createTrain({
    ...raw,
    id,
    trainNumber,
    number: trainNumber,
    updatedAt,
    lastUpdatedAt,
    createdAt,
    operatorName,
    operator,
    routeName,
    route,
    position,
    delayMinutes,
  });
}

// ---------------------------------------------------------------------------
// Train — reference schema object (default export)
// Documents the canonical shape of a fully-formed Train record.
// ---------------------------------------------------------------------------

/**
 * Canonical Train domain model — reference shape.
 *
 * @example
 * import Train from '../types/train.js';
 * // Train documents every field with its default value and type.
 */
const Train = deepFreeze({
  // ── Identity ──────────────────────────────────────────────────────────────
  id:                  'TRN-12301',
  trainNumber:         '12301',
  number:              '12301',
  name:                'Howrah Rajdhani Express',

  // ── Route ─────────────────────────────────────────────────────────────────
  routeId:             'RT-001',
  routeName:           'New Delhi – Howrah',
  route:               'New Delhi – Howrah',

  // ── Operational status ────────────────────────────────────────────────────
  status:              TRAIN_STATUS.ON_TIME,
  delayMinutes:        0,

  // ── Position ──────────────────────────────────────────────────────────────
  currentStation:      'CNB',
  currentStationName:  'Kanpur Central',
  nextStation:         'ALD',
  nextStationName:     'Prayagraj Junction',
  originStation:       'NDLS',
  destinationStation:  'HWH',
  position:            { lat: 26.4499, lng: 80.3319 },
  speedKmh:            130,
  distanceTravelledKm: 440,
  platformNumber:      null,

  // ── Health & service ──────────────────────────────────────────────────────
  healthStatus:        TRAIN_HEALTH.HEALTHY,
  serviceType:         TRAIN_SERVICE_TYPE.SUPER_FAST,
  operatorName:        'Northern Railway',
  operator:            'Northern Railway',
  coachCount:          22,
  passengerCount:      1452,
  occupancyPercent:    88,

  // ── Schedule ──────────────────────────────────────────────────────────────
  scheduledDeparture:  '2025-06-10T16:10:00.000Z',
  scheduledArrival:    '2025-06-11T10:05:00.000Z',
  estimatedArrival:    '2025-06-11T10:05:00.000Z',

  // ── Zone ──────────────────────────────────────────────────────────────────
  zoneCode:            'NR',

  // ── Relationships ─────────────────────────────────────────────────────────
  linkedIncidentIds:   [],
  linkedRiskScoreIds:  ['RSK-00055'],
  sensorReadingIds:    ['SNS-10201', 'SNS-10202'],

  // ── Tags ──────────────────────────────────────────────────────────────────
  tags:                ['rajdhani', 'premium', 'nr'],

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt:           '2025-06-10T14:00:00.000Z',
  updatedAt:           '2025-06-10T16:30:00.000Z',
  lastUpdatedAt:       '2025-06-10T16:30:00.000Z',
  syncedAt:            '2025-06-10T16:30:10.000Z',

  // ── Optimistic concurrency ────────────────────────────────────────────────
  version:             1,

  // ── Extension ─────────────────────────────────────────────────────────────
  meta:                {},
});

export default Train;

import api from './api';

/**
 * Purpose:
 * Canonical sensor service for RailSentinel. It provides a focused API layer
 * for sensor reading CRUD, querying, calibration actions, and event ingestion
 * while keeping transport concerns isolated from UI and store code.
 *
 * Dependencies:
 * - ./api request client
 * - backend sensor REST endpoints
 * - sensor reading domain model and event payload shapes
 *
 * Props:
 * - basePath: optional override for the sensor API root
 * - client: optional API client instance for testing or advanced composition
 * - endpoints: optional endpoint overrides for each operation
 *
 * State:
 * - None persisted globally
 * - Each request is stateless and delegated to the shared API client
 */

const DEFAULT_BASE_PATH = '/sensor-readings';

const DEFAULT_ENDPOINTS = {
  list: '',
  create: '',
  getById: (id) => `/${encodeURIComponent(String(id))}`,
  update: (id) => `/${encodeURIComponent(String(id))}`,
  patch: (id) => `/${encodeURIComponent(String(id))}`,
  remove: (id) => `/${encodeURIComponent(String(id))}`,
  latest: (id) => `/${encodeURIComponent(String(id))}/latest`,
  history: (id) => `/${encodeURIComponent(String(id))}/history`,
  calibration: (id) => `/${encodeURIComponent(String(id))}/calibration`,
  status: (id) => `/${encodeURIComponent(String(id))}/status`,
  events: (id) => `/${encodeURIComponent(String(id))}/events`,
};

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function joinPath(basePath, suffix = '') {
  const base = String(basePath ?? '').replace(/\/+$/, '');
  const tail = String(suffix ?? '').replace(/^\/+/, '');
  return tail ? `${base}/${tail}` : base;
}

function buildQueryString(params = {}) {
  if (!isPlainObject(params)) {
    return '';
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') {
          searchParams.append(key, String(item));
        }
      }
      continue;
    }

    if (typeof value === 'object') {
      searchParams.append(key, JSON.stringify(value));
      continue;
    }

    searchParams.append(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function resolveEndpoint(endpoint, id) {
  if (typeof endpoint === 'function') {
    return endpoint(id);
  }

  return endpoint ?? '';
}

function createSensorService({ basePath = DEFAULT_BASE_PATH, client = api, endpoints = {} } = {}) {
  const mergedEndpoints = {
    ...DEFAULT_ENDPOINTS,
    ...endpoints,
  };

  const requestPath = (suffix = '') => joinPath(basePath, suffix);

  return {
    list: (params = {}, options = {}) =>
      client.get(`${requestPath(resolveEndpoint(mergedEndpoints.list))}${buildQueryString(params)}`, options),

    create: (sensorReading, options = {}) =>
      client.post(requestPath(resolveEndpoint(mergedEndpoints.create)), sensorReading, options),

    getById: (sensorReadingId, options = {}) =>
      client.get(requestPath(resolveEndpoint(mergedEndpoints.getById, sensorReadingId)), options),

    update: (sensorReadingId, sensorReading, options = {}) =>
      client.put(requestPath(resolveEndpoint(mergedEndpoints.update, sensorReadingId)), sensorReading, options),

    patch: (sensorReadingId, patch, options = {}) =>
      client.patch(requestPath(resolveEndpoint(mergedEndpoints.patch, sensorReadingId)), patch, options),

    remove: (sensorReadingId, options = {}) =>
      client.delete(requestPath(resolveEndpoint(mergedEndpoints.remove, sensorReadingId)), options),

    getLatest: (sensorId, options = {}) =>
      client.get(requestPath(resolveEndpoint(mergedEndpoints.latest, sensorId)), options),

    getHistory: (sensorId, options = {}) =>
      client.get(requestPath(resolveEndpoint(mergedEndpoints.history, sensorId)), options),

    calibrate: (sensorId, payload = {}, options = {}) =>
      client.post(requestPath(resolveEndpoint(mergedEndpoints.calibration, sensorId)), payload, options),

    getStatus: (sensorId, options = {}) =>
      client.get(requestPath(resolveEndpoint(mergedEndpoints.status, sensorId)), options),

    getEvents: (sensorReadingId, options = {}) =>
      client.get(requestPath(resolveEndpoint(mergedEndpoints.events, sensorReadingId)), options),

    ingestEvent: (sensorReadingId, event, options = {}) =>
      client.post(requestPath(resolveEndpoint(mergedEndpoints.events, sensorReadingId)), event, options),

    bulkUpsert: (sensorReadings, options = {}) =>
      client.post(joinPath(basePath, '/bulk'), { sensorReadings }, options),

    bulkDelete: (sensorReadingIds, options = {}) =>
      client.post(joinPath(basePath, '/bulk/delete'), { sensorReadingIds }, options),
  };
}

const sensorService = createSensorService();

export { createSensorService, DEFAULT_BASE_PATH, DEFAULT_ENDPOINTS };
export default sensorService;

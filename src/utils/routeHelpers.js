/**
 * src/utils/routeHelpers.js
 *
 * Purpose:
 * Centralized, pure utility functions for route and station operations.
 * Handles data lookups, distance math (Haversine), filtering, and status
 * aggregations across Indian Railway networks.
 *
 * Dependencies:
 * - None. Pure JS functions.
 *
 * Exports:
 * - getRouteById
 * - getStationByIdOrCode
 * - filterRoutes
 * - summarizeRouteStatuses
 * - calculateCoordinateDistance
 * - calculateRouteDistance
 */

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Safely looks up a route by its unique ID.
 *
 * @param {Array<Object>} routes - Array of route objects.
 * @param {string} routeId - The target route ID.
 * @returns {Object|null} The matching route object, or null if not found.
 */
export function getRouteById(routes, routeId) {
  if (!Array.isArray(routes) || !routeId) return null;
  return routes.find((r) => r.id === routeId) || null;
}

/**
 * Safely looks up a station by either its unique ID or its railway code (e.g. 'NDLS').
 * Matches are case-insensitive.
 *
 * @param {Array<Object>} stations - Array of station objects.
 * @param {string} stationIdOrCode - The target ID or station code.
 * @returns {Object|null} The matching station object, or null if not found.
 */
export function getStationByIdOrCode(stations, stationIdOrCode) {
  if (!Array.isArray(stations) || !stationIdOrCode) return null;
  
  const target = String(stationIdOrCode).toLowerCase();
  
  return stations.find((s) => {
    const matchId = s.id && String(s.id).toLowerCase() === target;
    const matchCode = s.code && String(s.code).toLowerCase() === target;
    return matchId || matchCode;
  }) || null;
}

// ---------------------------------------------------------------------------
// Filtering & Aggregation
// ---------------------------------------------------------------------------

/**
 * Filters an array of routes based on an optional criteria object.
 *
 * @param {Array<Object>} routes - The array of routes to filter.
 * @param {Object} [criteria={}] - Filtering criteria.
 * @param {string} [criteria.status] - Exact match for route status.
 * @param {string} [criteria.zoneCode] - Exact match for railway zone code.
 * @param {string} [criteria.type] - Exact match for route type.
 * @param {string} [criteria.searchQuery] - Case-insensitive substring match against name or id.
 * @returns {Array<Object>} The filtered array of routes.
 */
export function filterRoutes(routes, criteria = {}) {
  if (!Array.isArray(routes)) return [];

  return routes.filter((route) => {
    if (criteria.status && route.status !== criteria.status) return false;
    if (criteria.zoneCode && route.zoneCode !== criteria.zoneCode) return false;
    if (criteria.type && route.type !== criteria.type) return false;

    if (criteria.searchQuery) {
      const q = criteria.searchQuery.toLowerCase();
      const matchName = route.name && String(route.name).toLowerCase().includes(q);
      const matchId = route.id && String(route.id).toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }

    return true;
  });
}

/**
 * Generates a summary tally of all route statuses within an array.
 *
 * @param {Array<Object>} routes - Array of route objects.
 * @returns {Object} Summary object mapping statuses to counts, plus a `total` count.
 * @example
 * // returns { total: 10, active: 8, delayed: 2 }
 */
export function summarizeRouteStatuses(routes) {
  if (!Array.isArray(routes)) return { total: 0 };

  const summary = { total: routes.length };

  routes.forEach((r) => {
    const status = r.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Distance Math
// ---------------------------------------------------------------------------

/**
 * Calculates the great-circle distance between two geographical coordinates
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees.
 * @param {number} lon1 - Longitude of point 1 in degrees.
 * @param {number} lat2 - Latitude of point 2 in degrees.
 * @param {number} lon2 - Longitude of point 2 in degrees.
 * @returns {number} Distance in kilometers. Returns 0 if inputs are invalid.
 */
export function calculateCoordinateDistance(lat1, lon1, lat2, lon2) {
  const coords = [lat1, lon1, lat2, lon2];
  if (coords.some((c) => typeof c !== 'number' || Number.isNaN(c))) return 0;

  const R = 6371; // Earth's radius in kilometers
  const toRadians = (deg) => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the total sequential distance of a route given an ordered array of stations.
 * Each station must possess latitude/longitude fields.
 *
 * @param {Array<Object>} orderedStations - Array of stations in sequence.
 * @returns {number} Total distance in kilometers, rounded to 1 decimal place.
 */
export function calculateRouteDistance(orderedStations) {
  if (!Array.isArray(orderedStations) || orderedStations.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 0; i < orderedStations.length - 1; i++) {
    const s1 = orderedStations[i];
    const s2 = orderedStations[i + 1];

    // Safely extract coordinates using common naming conventions
    const lat1 = s1.lat ?? s1.latitude;
    const lon1 = s1.lng ?? s1.lon ?? s1.longitude;
    const lat2 = s2.lat ?? s2.latitude;
    const lon2 = s2.lng ?? s2.lon ?? s2.longitude;

    totalDistance += calculateCoordinateDistance(lat1, lon1, lat2, lon2);
  }

  // Round to one decimal place for readability
  return Math.round(totalDistance * 10) / 10;
}

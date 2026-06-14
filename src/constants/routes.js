/**
 * src/constants/routes.js
 *
 * Purpose:
 * Defines the canonical RailSentinel application routing paths. This file serves
 * as the single source of truth for all internal navigation, ensuring that links,
 * redirects, and router configurations remain completely synchronized without
 * introducing hardcoded strings throughout the application.
 *
 * Dependencies:
 * - None. Pure JS constants.
 *
 * Exports:
 * - APP_ROUTES
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
// 1. APP_ROUTES
// Canonical mapping of application modules to their respective URL paths.
// ---------------------------------------------------------------------------

export const APP_ROUTES = deepFreeze({
  /** Public-facing landing page / marketing / login entry point */
  LANDING: '/',

  /** M1: Main Operations Dashboard (Global Overview) */
  DASHBOARD: '/dashboard',

  /** M2: Incident Management & Resolution */
  INCIDENTS: '/incidents',

  /** M3: Core Map View / Live Spatial Tracking */
  MAP: '/map',

  /** M4: Sensor Diagnostics & Machine Learning Predictions */
  PREDICTIVE: '/predictive',

  /** M4 Extension: Station Crowding & Density Forecasts */
  CROWD: '/crowd',

  /** M5: Communications, Public Address, & Alerts */
  NOTIFICATIONS: '/notifications',

  /** M6: Operational Planning, Sequencing & Conflict Resolution */
  SCHEDULE: '/schedule',

  /** M7: Environmental, Power, & Efficiency Telemetry */
  ENERGY: '/energy',

  /** M8: Unified Risk Intelligence & Scoring Engine */
  RISK: '/risk',
});

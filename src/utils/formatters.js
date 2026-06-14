/**
 * src/utils/formatters.js
 *
 * Purpose:
 * Centralized formatting utilities for RailSentinel. Provides pure, locale-aware
 * functions to format dates, times, durations, and domain-specific values (energy,
 * risk, delays) into human-readable strings. Ensures consistent data presentation
 * across all modules and components without duplicating formatting logic.
 *
 * Dependencies:
 * - None. Pure JS functions.
 *
 * Exports:
 * - formatDate: Localed date (e.g., '10 Jun 2026')
 * - formatTime: Localed time (e.g., '10:30 AM' or '14:30')
 * - formatDateTime: Combined date and time
 * - formatRelativeTime: Human-readable relative delta (e.g., '2h ago', 'in 15m')
 * - formatDuration: Hours and minutes (e.g., '1h 45m')
 * - formatPercent: Localed percentage representation
 * - formatDelayMinutes: Operational delay strings (e.g., '+15 min', 'On time')
 * - formatRiskScore: Standardized risk score formatting
 * - formatEnergyKwh: Auto-scaling energy value (kWh / MWh)
 */

// Default locale for Indian Railways context
const DEFAULT_LOCALE = 'en-IN';

// ---------------------------------------------------------------------------
// Dates & Times
// ---------------------------------------------------------------------------

/**
 * Format an ISO string or Date into a localized date string.
 *
 * @param {string|Date} iso - The date to format.
 * @param {string} [locale=DEFAULT_LOCALE] - Target locale.
 * @returns {string|null} Localized date string or null if invalid.
 */
export function formatDate(iso, locale = DEFAULT_LOCALE) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return null;
  }
}

/**
 * Format an ISO string or Date into a localized time string.
 *
 * @param {string|Date} iso - The date to format.
 * @param {string} [locale=DEFAULT_LOCALE] - Target locale.
 * @returns {string|null} Localized time string or null if invalid.
 */
export function formatTime(iso, locale = DEFAULT_LOCALE) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false, // 24-hour time is standard for rail operations
    }).format(d);
  } catch {
    return null;
  }
}

/**
 * Format an ISO string or Date into a combined localized date and time string.
 *
 * @param {string|Date} iso - The date to format.
 * @param {string} [locale=DEFAULT_LOCALE] - Target locale.
 * @returns {string|null} Localized date/time string or null if invalid.
 */
export function formatDateTime(iso, locale = DEFAULT_LOCALE) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return null;
  }
}

/**
 * Returns a human-readable relative time string (e.g., "2h ago", "Just now", "in 15m").
 *
 * @param {string|Date} iso - The date to format.
 * @returns {string|null} Relative time string or null if invalid.
 */
export function formatRelativeTime(iso) {
  if (!iso) return null;
  try {
    const ts = typeof iso === 'string' ? Date.parse(iso) : iso.getTime();
    if (Number.isNaN(ts)) return null;

    const diff = Date.now() - ts;
    const isFuture = diff < 0;
    const absDiff = Math.abs(diff);

    const m = Math.floor(absDiff / 60000);
    const h = Math.floor(absDiff / 3600000);
    const d = Math.floor(absDiff / 86400000);

    if (isFuture) {
      if (d >= 1) return `in ${d}d`;
      if (h >= 1) return `in ${h}h`;
      if (m >= 1) return `in ${m}m`;
      return 'in a moment';
    }

    if (d >= 1) return `${d}d ago`;
    if (h >= 1) return `${h}h ago`;
    if (m >= 1) return `${m}m ago`;
    return 'Just now';
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Durations & Percentages
// ---------------------------------------------------------------------------

/**
 * Formats a duration in minutes into a human-readable string (e.g. "2h 15m" or "45m").
 *
 * @param {number} minutes - Duration in minutes.
 * @returns {string} Formatted duration string.
 */
export function formatDuration(minutes) {
  const n = Number(minutes);
  if (Number.isNaN(n) || n === 0) return '0m';

  const absN = Math.abs(n);
  const h = Math.floor(absN / 60);
  const m = Math.floor(absN % 60);

  const sign = n < 0 ? '-' : '';
  if (h > 0 && m > 0) return `${sign}${h}h ${m}m`;
  if (h > 0) return `${sign}${h}h`;
  return `${sign}${m}m`;
}

/**
 * Formats a decimal or integer into a localized percentage.
 *
 * @param {number} value - The value to format.
 * @param {boolean} [isFraction=false] - If true, treats 0.85 as 85%. If false, treats 85 as 85%.
 * @param {number} [decimals=0] - Number of decimal places to show.
 * @param {string} [locale=DEFAULT_LOCALE] - Target locale.
 * @returns {string} Formatted percentage.
 */
export function formatPercent(value, isFraction = false, decimals = 0, locale = DEFAULT_LOCALE) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0%';

  const fractionValue = isFraction ? n : n / 100;

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fractionValue);
}

// ---------------------------------------------------------------------------
// Domain Specific
// ---------------------------------------------------------------------------

/**
 * Formats a train delay in minutes into an operational string.
 *
 * @param {number} minutes - Delay minutes.
 * @returns {string} Formatted delay (e.g., "+15 min", "On time").
 */
export function formatDelayMinutes(minutes) {
  const n = Number(minutes);
  if (Number.isNaN(n) || n === 0) return 'On time';
  if (n < 0) return `-${Math.abs(n)} min (Early)`;
  return `+${n} min`;
}

/**
 * Formats a RailSentinel risk score (0-100) safely.
 *
 * @param {number} score - The risk score.
 * @param {number} [decimals=0] - Number of decimal places.
 * @param {string} [locale=DEFAULT_LOCALE] - Target locale.
 * @returns {string} Formatted score.
 */
export function formatRiskScore(score, decimals = 0, locale = DEFAULT_LOCALE) {
  const n = Number(score);
  if (Number.isNaN(n)) return '0';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Formats energy consumption values, auto-scaling to MWh if >= 1000 kWh.
 *
 * @param {number} kwh - Energy value in kilowatt-hours.
 * @param {string} [locale=DEFAULT_LOCALE] - Target locale.
 * @returns {string} Formatted energy value (e.g., '850 kWh', '1.2 MWh').
 */
export function formatEnergyKwh(kwh, locale = DEFAULT_LOCALE) {
  const n = Number(kwh ?? 0);
  if (Number.isNaN(n)) return '0 kWh';

  if (Math.abs(n) >= 1000) {
    const mwh = n / 1000;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(mwh) + ' MWh';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' kWh';
}

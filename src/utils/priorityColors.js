/**
 * src/utils/priorityColors.js
 *
 * Purpose:
 * Provides utility functions to map approved priority levels (P1 through P5) to
 * their corresponding design system color tokens. This ensures consistent
 * styling for priority badges, indicators, and text across the application without
 * embedding UI logic in domain models.
 *
 * Supported Priority Levels:
 * - P1 Critical       (Red)
 * - P2 High           (Orange)
 * - P3 Medium         (Yellow)
 * - P4 Low            (Green)
 * - P5 Informational  (Blue)
 *
 * Dependencies:
 * - `src/design/colors.js` (for base color tokens)
 *
 * Exports:
 * - getPriorityColorToken: Returns the full color token object (base, bg, text, etc.)
 * - getPriorityBaseColor: Returns just the base hex color string
 * - getPriorityBgColor: Returns the background rgba color string
 * - getPriorityTextColor: Returns the text hex color string
 */

import colors from '../design/colors';

const { NOTIFICATION, RISK, SEMANTIC } = colors;

// ---------------------------------------------------------------------------
// Token Definitions
// ---------------------------------------------------------------------------

/** Fallback token for unrecognized priorities */
const DEFAULT_TOKEN = {
  label: 'Unknown',
  base: SEMANTIC.neutral.base,
  light: SEMANTIC.neutral.light,
  bg: SEMANTIC.neutral.bg,
  border: SEMANTIC.neutral.border,
  text: SEMANTIC.neutral.text,
  badge: { 
    background: SEMANTIC.neutral.text, 
    color: SEMANTIC.neutral.light, 
    border: SEMANTIC.neutral.border 
  } 
};

/** P4 Low token mapped from RISK.low to ensure green coloring */
const P4_LOW_TOKEN = {
  label: 'P4 — Low',
  base: RISK.low.base,
  light: RISK.low.light,
  bg: RISK.low.bg,
  border: RISK.low.border,
  text: RISK.low.text,
  badge: RISK.low.badge,
};

/** P5 Informational token mapped from NOTIFICATION.P4 (which is blue 'Informational' in colors.js) */
const P5_INFO_TOKEN = {
  ...NOTIFICATION.P4,
  label: 'P5 — Informational',
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Get the full design system color token object for a given priority.
 * Supports both strict P-codes ('P1') and semantic labels ('critical').
 *
 * @param {string} priority - The priority level or label
 * @returns {Object} Color token object with base, light, bg, border, text, badge
 */
export function getPriorityColorToken(priority) {
  const normalized = String(priority || '').trim().toUpperCase();

  switch (normalized) {
    // P1 Critical
    case 'P1':
    case 'CRITICAL':
      return { ...NOTIFICATION.P1, label: 'P1 — Critical' };

    // P2 High
    case 'P2':
    case 'HIGH':
      return { ...NOTIFICATION.P2, label: 'P2 — High' };

    // P3 Medium
    case 'P3':
    case 'MEDIUM':
      return { ...NOTIFICATION.P3, label: 'P3 — Medium' };

    // P4 Low
    case 'P4':
    case 'LOW':
      return P4_LOW_TOKEN;

    // P5 Informational
    case 'P5':
    case 'INFORMATIONAL':
    case 'INFO':
      return P5_INFO_TOKEN;

    default:
      return DEFAULT_TOKEN;
  }
}

/**
 * Get the base hex color for a given priority.
 * Useful for icons, borders, or solid backgrounds.
 *
 * @param {string} priority - The priority level
 * @returns {string} Hex color string
 */
export function getPriorityBaseColor(priority) {
  return getPriorityColorToken(priority).base;
}

/**
 * Get the background wash color for a given priority.
 * Useful for soft badge backgrounds or highlighted rows.
 *
 * @param {string} priority - The priority level
 * @returns {string} rgba color string
 */
export function getPriorityBgColor(priority) {
  return getPriorityColorToken(priority).bg;
}

/**
 * Get the text color for a given priority.
 * Useful for colored text that must remain accessible against dark surfaces.
 *
 * @param {string} priority - The priority level
 * @returns {string} Hex color string
 */
export function getPriorityTextColor(priority) {
  return getPriorityColorToken(priority).text;
}

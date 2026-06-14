/**
 * src/design/colors.js
 *
 * Purpose:
 * Centralized, immutable color system for RailSentinel. This is the single
 * source of truth for every color token used across components, layouts,
 * charts, maps, and styles. All values are frozen objects — mutations throw
 * in strict mode and are silently ignored elsewhere.
 *
 * Design system rationale:
 *   - Brand palette    → identity, nav chrome, interactive elements
 *   - Semantic palette → meaning-bearing UI states (success, warning, error)
 *   - Risk severity    → aligned with approved RiskScore.band domain model
 *   - Notification priority → aligned with approved Notification.priority model
 *   - Status tokens    → train, incident, sensor, schedule, energy statuses
 *   - Chart palette    → ordered series colors for recharts / D3
 *   - Surface / background → dark-first layered surface system
 *   - Text             → accessible contrast hierarchy
 *   - Border           → structural separation tokens
 *   - Overlay          → modal scrims and glassmorphism fills
 *
 * Dependencies:
 *   - None. Pure JS constants — no React, no CSS-in-JS, no external libs.
 *
 * Exports:
 *   - BRAND              → brand blue/indigo gradient palette
 *   - SEMANTIC           → success / warning / error / info / neutral
 *   - RISK               → critical / high / medium / low / minimal / unknown
 *   - NOTIFICATION       → P1 / P2 / P3 / P4 priority colors
 *   - STATUS             → domain-specific status token maps
 *   - CHART              → ordered series + categorical colors
 *   - SURFACE            → background and surface layer scale
 *   - TEXT               → text color hierarchy
 *   - BORDER             → border / divider scale
 *   - OVERLAY            → modal scrims, glassmorphism fills
 *   - ZONE               → Indian railway zone palette
 *   - colors (default)   → all of the above under one frozen root object
 *
 * Usage:
 *   import colors from '../design/colors.js';
 *   colors.RISK.critical.base   // '#ef4444'
 *
 *   import { RISK, CHART } from '../design/colors.js';
 *   RISK.high.bg                // 'rgba(249,115,22,0.12)'
 *   CHART.series[2]             // '#a78bfa'
 */

// ---------------------------------------------------------------------------
// Utility — deep-freeze an object and all nested objects
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
// BRAND
// Core identity palette. Blue–Indigo gradient system used for primary
// interactive elements, nav chrome, logos, and CTA buttons.
// ---------------------------------------------------------------------------

export const BRAND = deepFreeze({
  /** Deep navy — darkest brand anchor, shell backgrounds */
  navy: {
    50:  '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  /** Indigo — accent, badges, secondary interactive */
  indigo: {
    50:  '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },

  /** Sky — live data, telemetry, AI assistant highlights */
  sky: {
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
  },

  /** Canonical gradient — left to right, brand primary */
  gradient: {
    primary:   'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    secondary: 'linear-gradient(135deg, #4338ca 0%, #818cf8 100%)',
    sky:       'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    hero:      'linear-gradient(135deg, #172554 0%, #1e3a8a 40%, #1e40af 100%)',
  },

  /** Primary interactive token (most commonly used single brand color) */
  primary:   '#3b82f6',
  primaryHover: '#2563eb',
  primaryActive: '#1d4ed8',
  primaryFocus: 'rgba(59,130,246,0.35)',
});

// ---------------------------------------------------------------------------
// SEMANTIC
// Meaning-bearing colors for UI states independent of domain severity.
// ---------------------------------------------------------------------------

export const SEMANTIC = deepFreeze({
  /** Success / OK / all-clear */
  success: {
    base:  '#22c55e',
    light: '#4ade80',
    dark:  '#15803d',
    bg:    'rgba(34,197,94,0.10)',
    border:'rgba(34,197,94,0.25)',
    text:  '#86efac',
  },

  /** Warning / caution / degraded */
  warning: {
    base:  '#eab308',
    light: '#fde047',
    dark:  '#a16207',
    bg:    'rgba(234,179,8,0.10)',
    border:'rgba(234,179,8,0.25)',
    text:  '#fef08a',
  },

  /** Error / failure / critical failure */
  error: {
    base:  '#ef4444',
    light: '#f87171',
    dark:  '#b91c1c',
    bg:    'rgba(239,68,68,0.10)',
    border:'rgba(239,68,68,0.25)',
    text:  '#fca5a5',
  },

  /** Info / context / tips */
  info: {
    base:  '#3b82f6',
    light: '#60a5fa',
    dark:  '#1d4ed8',
    bg:    'rgba(59,130,246,0.10)',
    border:'rgba(59,130,246,0.25)',
    text:  '#93c5fd',
  },

  /** Neutral / inactive / secondary content */
  neutral: {
    base:  '#64748b',
    light: '#94a3b8',
    dark:  '#334155',
    bg:    'rgba(100,116,139,0.10)',
    border:'rgba(100,116,139,0.20)',
    text:  '#cbd5e1',
  },
});

// ---------------------------------------------------------------------------
// RISK
// Aligned with approved RiskScore.band domain model:
//   critical > high > medium > low > minimal > unknown
// Each band has: base, light, dark, bg, border, text, badge
// ---------------------------------------------------------------------------

export const RISK = deepFreeze({
  critical: {
    base:   '#ef4444',
    light:  '#f87171',
    dark:   '#b91c1c',
    bg:     'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.30)',
    text:   '#fca5a5',
    badge:  { background: '#7f1d1d', color: '#fca5a5', border: '#991b1b' },
  },
  high: {
    base:   '#f97316',
    light:  '#fb923c',
    dark:   '#c2410c',
    bg:     'rgba(249,115,22,0.12)',
    border: 'rgba(249,115,22,0.30)',
    text:   '#fed7aa',
    badge:  { background: '#7c2d12', color: '#fed7aa', border: '#9a3412' },
  },
  medium: {
    base:   '#eab308',
    light:  '#fde047',
    dark:   '#a16207',
    bg:     'rgba(234,179,8,0.12)',
    border: 'rgba(234,179,8,0.30)',
    text:   '#fef08a',
    badge:  { background: '#713f12', color: '#fef08a', border: '#854d0e' },
  },
  low: {
    base:   '#22c55e',
    light:  '#4ade80',
    dark:   '#15803d',
    bg:     'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.25)',
    text:   '#86efac',
    badge:  { background: '#14532d', color: '#86efac', border: '#166534' },
  },
  minimal: {
    base:   '#3b82f6',
    light:  '#60a5fa',
    dark:   '#1d4ed8',
    bg:     'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.20)',
    text:   '#93c5fd',
    badge:  { background: '#1e3a8a', color: '#93c5fd', border: '#1e40af' },
  },
  unknown: {
    base:   '#64748b',
    light:  '#94a3b8',
    dark:   '#334155',
    bg:     'rgba(100,116,139,0.10)',
    border: 'rgba(100,116,139,0.20)',
    text:   '#cbd5e1',
    badge:  { background: '#1e293b', color: '#94a3b8', border: '#334155' },
  },

  /** Ordered array for band-rank iteration (index 0 = lowest risk) */
  ordered: ['minimal', 'low', 'medium', 'high', 'critical'],
});

// ---------------------------------------------------------------------------
// NOTIFICATION
// Aligned with approved Notification.priority domain model: P1–P4.
// P1 = highest urgency (life/safety), P4 = informational.
// ---------------------------------------------------------------------------

export const NOTIFICATION = deepFreeze({
  P1: {
    label:  'P1 — Critical',
    base:   '#ef4444',
    light:  '#f87171',
    bg:     'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.30)',
    text:   '#fca5a5',
    badge:  { background: '#7f1d1d', color: '#fca5a5' },
  },
  P2: {
    label:  'P2 — High',
    base:   '#f97316',
    light:  '#fb923c',
    bg:     'rgba(249,115,22,0.12)',
    border: 'rgba(249,115,22,0.30)',
    text:   '#fed7aa',
    badge:  { background: '#7c2d12', color: '#fed7aa' },
  },
  P3: {
    label:  'P3 — Medium',
    base:   '#eab308',
    light:  '#fde047',
    bg:     'rgba(234,179,8,0.10)',
    border: 'rgba(234,179,8,0.25)',
    text:   '#fef08a',
    badge:  { background: '#713f12', color: '#fef08a' },
  },
  P4: {
    label:  'P4 — Informational',
    base:   '#3b82f6',
    light:  '#60a5fa',
    bg:     'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.20)',
    text:   '#93c5fd',
    badge:  { background: '#1e3a8a', color: '#93c5fd' },
  },
});

// ---------------------------------------------------------------------------
// STATUS
// Domain-specific status color maps. Each key is a valid status string from
// the approved domain models. Values are { base, bg, border, text }.
// ---------------------------------------------------------------------------

export const STATUS = deepFreeze({
  /** Train operating status — trainStore.status values */
  train: {
    running:     { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    'on-time':   { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    delayed:     { base: '#f97316', bg: 'rgba(249,115,22,0.10)',   border: 'rgba(249,115,22,0.25)',   text: '#fed7aa' },
    cancelled:   { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    disrupted:   { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    fault:       { base: '#dc2626', bg: 'rgba(220,38,38,0.12)',    border: 'rgba(220,38,38,0.30)',    text: '#fca5a5' },
    conflict:    { base: '#f59e0b', bg: 'rgba(245,158,11,0.10)',   border: 'rgba(245,158,11,0.25)',   text: '#fde68a' },
    maintenance: { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
    unknown:     { base: '#475569', bg: 'rgba(71,85,105,0.10)',    border: 'rgba(71,85,105,0.20)',    text: '#94a3b8' },
  },

  /** Incident lifecycle status — incidentStore.status values */
  incident: {
    open:        { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    acknowledged:{ base: '#f97316', bg: 'rgba(249,115,22,0.10)',   border: 'rgba(249,115,22,0.25)',   text: '#fed7aa' },
    in_progress: { base: '#eab308', bg: 'rgba(234,179,8,0.10)',    border: 'rgba(234,179,8,0.25)',    text: '#fef08a' },
    resolved:    { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    closed:      { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
    escalated:   { base: '#a855f7', bg: 'rgba(168,85,247,0.10)',   border: 'rgba(168,85,247,0.25)',   text: '#d8b4fe' },
  },

  /** Crowd forecast status — crowdStore values */
  crowd: {
    normal:      { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    elevated:    { base: '#eab308', bg: 'rgba(234,179,8,0.10)',    border: 'rgba(234,179,8,0.25)',    text: '#fef08a' },
    high:        { base: '#f97316', bg: 'rgba(249,115,22,0.10)',   border: 'rgba(249,115,22,0.25)',   text: '#fed7aa' },
    critical:    { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    breach:      { base: '#dc2626', bg: 'rgba(220,38,38,0.12)',    border: 'rgba(220,38,38,0.30)',    text: '#fca5a5' },
    unknown:     { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
  },

  /** Sensor / prediction status — M4 module */
  sensor: {
    healthy:     { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    degraded:    { base: '#eab308', bg: 'rgba(234,179,8,0.10)',    border: 'rgba(234,179,8,0.25)',    text: '#fef08a' },
    fault:       { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    offline:     { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
    maintenance: { base: '#818cf8', bg: 'rgba(129,140,248,0.10)',  border: 'rgba(129,140,248,0.25)',  text: '#c7d2fe' },
    predicted:   { base: '#06b6d4', bg: 'rgba(6,182,212,0.10)',    border: 'rgba(6,182,212,0.25)',    text: '#67e8f9' },
  },

  /** Schedule conflict status — M6 module */
  schedule: {
    on_time:     { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    at_risk:     { base: '#eab308', bg: 'rgba(234,179,8,0.10)',    border: 'rgba(234,179,8,0.25)',    text: '#fef08a' },
    conflict:    { base: '#f97316', bg: 'rgba(249,115,22,0.10)',   border: 'rgba(249,115,22,0.25)',   text: '#fed7aa' },
    disrupted:   { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    resolved:    { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    pending:     { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
  },

  /** Energy optimization status — M7 module */
  energy: {
    optimal:     { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    normal:      { base: '#3b82f6', bg: 'rgba(59,130,246,0.10)',   border: 'rgba(59,130,246,0.20)',   text: '#93c5fd' },
    elevated:    { base: '#eab308', bg: 'rgba(234,179,8,0.10)',    border: 'rgba(234,179,8,0.25)',    text: '#fef08a' },
    anomaly:     { base: '#f97316', bg: 'rgba(249,115,22,0.10)',   border: 'rgba(249,115,22,0.25)',   text: '#fed7aa' },
    critical:    { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    offline:     { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
  },

  /** Route / network status — india-railways.json */
  route: {
    active:      { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    delayed:     { base: '#f97316', bg: 'rgba(249,115,22,0.10)',   border: 'rgba(249,115,22,0.25)',   text: '#fed7aa' },
    maintenance: { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
    suspended:   { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
  },

  /** Notification delivery status — M5 module */
  notification: {
    pending:     { base: '#64748b', bg: 'rgba(100,116,139,0.10)',  border: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
    delivered:   { base: '#22c55e', bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.25)',    text: '#86efac' },
    failed:      { base: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)',    text: '#fca5a5' },
    acknowledged:{ base: '#3b82f6', bg: 'rgba(59,130,246,0.10)',   border: 'rgba(59,130,246,0.20)',   text: '#93c5fd' },
    suppressed:  { base: '#475569', bg: 'rgba(71,85,105,0.10)',    border: 'rgba(71,85,105,0.20)',    text: '#94a3b8' },
    escalated:   { base: '#a855f7', bg: 'rgba(168,85,247,0.10)',   border: 'rgba(168,85,247,0.25)',   text: '#d8b4fe' },
  },
});

// ---------------------------------------------------------------------------
// CHART
// Ordered series colors for recharts, D3, and custom SVG charts.
// Designed for visual distinction on dark backgrounds.
// ---------------------------------------------------------------------------

export const CHART = deepFreeze({
  /**
   * series — use by index for multi-line, bar, and area charts.
   * Order is chosen for maximum contrast between adjacent series.
   */
  series: [
    '#3b82f6', // [0] blue     — primary series
    '#22c55e', // [1] green    — second series
    '#f97316', // [2] orange   — third series
    '#a78bfa', // [3] violet   — fourth series
    '#38bdf8', // [4] sky      — fifth series
    '#f43f5e', // [5] rose     — sixth series
    '#fbbf24', // [6] amber    — seventh series
    '#34d399', // [7] emerald  — eighth series
    '#818cf8', // [8] indigo   — ninth series
    '#fb7185', // [9] pink     — tenth series
  ],

  /** Categorical — named semantic series for domain-specific charts */
  categorical: {
    incidents:     '#ef4444',
    trains:        '#3b82f6',
    crowd:         '#a855f7',
    energy:        '#eab308',
    risk:          '#f97316',
    notifications: '#06b6d4',
    schedule:      '#818cf8',
    sensor:        '#34d399',
    baseline:      '#475569',
    forecast:      '#38bdf8',
  },

  /** Grid / axis styling for chart backgrounds */
  grid:       'rgba(51,65,85,0.5)',
  axis:       '#475569',
  axisLabel:  '#94a3b8',
  tick:       '#64748b',
  tooltip: {
    background: '#1e293b',
    border:     '#334155',
    text:       '#f1f5f9',
    label:      '#94a3b8',
  },

  /** Gradient fills for area charts (top→bottom) */
  gradients: {
    blue:    ['rgba(59,130,246,0.35)',   'rgba(59,130,246,0.00)'],
    green:   ['rgba(34,197,94,0.35)',    'rgba(34,197,94,0.00)'],
    orange:  ['rgba(249,115,22,0.35)',   'rgba(249,115,22,0.00)'],
    red:     ['rgba(239,68,68,0.35)',    'rgba(239,68,68,0.00)'],
    violet:  ['rgba(167,139,250,0.35)',  'rgba(167,139,250,0.00)'],
    amber:   ['rgba(251,191,36,0.35)',   'rgba(251,191,36,0.00)'],
  },
});

// ---------------------------------------------------------------------------
// SURFACE
// Layered dark-first surface system. Use layer numbers as depth index:
//   0 = page background (deepest)
//   1 = panel / card background
//   2 = elevated card / dialog
//   3 = popover / tooltip / dropdown
//   4 = topmost overlay
// ---------------------------------------------------------------------------

export const SURFACE = deepFreeze({
  /** Page-level backgrounds */
  page:       '#0a0f1e',
  pageAlt:    '#0d1526',

  /** Layer scale */
  layer: {
    0: '#0a0f1e', // page background
    1: '#0f172a', // primary shell
    2: '#1e293b', // card / panel
    3: '#263347', // elevated card / modal
    4: '#2d3d57', // popover / drawer header
  },

  /** Shorthand tokens */
  background: '#0a0f1e',
  shell:      '#0f172a',
  card:       '#1e293b',
  cardHover:  '#243244',
  elevated:   '#263347',
  popover:    '#1e293b',
  sidebar:    '#0d1526',
  topbar:     '#0f172a',
  input:      '#1e293b',
  inputFocus: '#263347',

  /** Glassmorphism fills (used with backdrop-filter) */
  glass: {
    light: 'rgba(30,41,59,0.65)',
    dark:  'rgba(10,15,30,0.75)',
    card:  'rgba(30,41,59,0.50)',
  },
});

// ---------------------------------------------------------------------------
// TEXT
// Accessible contrast hierarchy for dark-mode surfaces.
// ---------------------------------------------------------------------------

export const TEXT = deepFreeze({
  primary:     '#f1f5f9', // headings, primary values
  secondary:   '#cbd5e1', // body text, labels
  tertiary:    '#94a3b8', // captions, placeholders, help text
  disabled:    '#475569', // disabled state
  inverse:     '#0f172a', // text on light/brand backgrounds
  link:        '#60a5fa', // links
  linkHover:   '#93c5fd', // link hover
  brand:       '#3b82f6', // brand-colored text
  brandGradient: 'linear-gradient(135deg, #38bdf8, #818cf8)',
});

// ---------------------------------------------------------------------------
// BORDER
// Structural separation tokens. Use 'default' for most dividers,
// 'strong' for card frames, 'focus' for interactive focus rings.
// ---------------------------------------------------------------------------

export const BORDER = deepFreeze({
  subtle:  'rgba(51,65,85,0.40)',  // hairline separator
  default: 'rgba(51,65,85,0.70)',  // standard card border
  strong:  'rgba(71,85,105,0.90)', // prominent frame
  focus:   '#3b82f6',              // focus ring base color
  focusRing: '0 0 0 2px rgba(59,130,246,0.50)', // CSS box-shadow value
  brand:   'rgba(59,130,246,0.30)',
});

// ---------------------------------------------------------------------------
// OVERLAY
// Modal scrims and glassmorphism backdrops.
// ---------------------------------------------------------------------------

export const OVERLAY = deepFreeze({
  scrim:       'rgba(0,0,0,0.60)',
  scrimLight:  'rgba(0,0,0,0.35)',
  scrimHeavy:  'rgba(0,0,0,0.80)',
  glass:       'rgba(15,23,42,0.70)',
  notification: 'rgba(10,15,30,0.90)',
  sidebar:     'rgba(13,21,38,0.95)',
});

// ---------------------------------------------------------------------------
// ZONE
// Indian railway zone colors — matched to india-railways.json zone records.
// Each key is the zone code (e.g. "CR", "NR").
// ---------------------------------------------------------------------------

export const ZONE = deepFreeze({
  CR:   '#e74c3c', // Central Railway
  ER:   '#2ecc71', // Eastern Railway
  NR:   '#3498db', // Northern Railway
  NER:  '#9b59b6', // North Eastern Railway
  NFR:  '#1abc9c', // Northeast Frontier Railway
  SR:   '#e67e22', // Southern Railway
  SCR:  '#f39c12', // South Central Railway
  SER:  '#27ae60', // South Eastern Railway
  WR:   '#2980b9', // Western Railway
  NCR:  '#8e44ad', // North Central Railway
  NWR:  '#d35400', // North Western Railway
  SWR:  '#16a085', // South Western Railway
  WCR:  '#c0392b', // West Central Railway
  ECR:  '#7f8c8d', // East Central Railway
  ECoR: '#2c3e50', // East Coast Railway
  KR:   '#27ae60', // Konkan Railway
  MR:   '#f1c40f', // Metro Railway Kolkata
  SCoR: '#e91e63', // South Coast Railway
});

// ---------------------------------------------------------------------------
// Default export — all palettes under one frozen root
// ---------------------------------------------------------------------------

const colors = deepFreeze({
  BRAND,
  SEMANTIC,
  RISK,
  NOTIFICATION,
  STATUS,
  CHART,
  SURFACE,
  TEXT,
  BORDER,
  OVERLAY,
  ZONE,
});

export default colors;

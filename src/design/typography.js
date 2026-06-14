/**
 * src/design/typography.js
 *
 * Purpose:
 * Centralized, immutable typography system for RailSentinel. This is the
 * single source of truth for every font-family, font-size, font-weight,
 * line-height, letter-spacing, and text-transform token used across the
 * application. All tokens are optimized for a high-density operational
 * command-center interface displayed primarily on desktop and control-room
 * screens.
 *
 * Design rationale:
 *   - Primary typeface: Inter — variable, highly legible at small sizes,
 *     excellent tabular-numeral support, widely available via Google Fonts
 *     (preconnected in public/index.html).
 *   - Monospace typeface: JetBrains Mono / Fira Code / ui-monospace fallback
 *     — used for sensor readings, IDs, timestamps, and code values where
 *     column alignment and numeral consistency matter.
 *   - Type scale follows a modular scale ≈ 1.25× (Major Third) anchored at
 *     14 px (0.875 rem) as the base body size — chosen because operational
 *     UIs prioritise data density over reading comfort.
 *   - Line heights are tighter than editorial defaults to maximise vertical
 *     data density without sacrificing readability.
 *   - Letter spacing is slightly expanded for uppercase labels and badges to
 *     improve legibility at small sizes.
 *
 * Scale:
 *   2xs   →  10 px  (0.625 rem)  — micro label, table annotation
 *   xs    →  11 px  (0.6875 rem) — caption, timestamp
 *   sm    →  12 px  (0.75 rem)   — secondary label, help text
 *   base  →  13 px  (0.8125 rem) — dense body (data-rich panels)
 *   md    →  14 px  (0.875 rem)  — default body text
 *   lg    →  15 px  (0.9375 rem) — relaxed body, list item primary
 *   xl    →  16 px  (1 rem)      — sub-title, card header
 *   '2xl' →  18 px  (1.125 rem)  — title medium
 *   '3xl' →  20 px  (1.25 rem)   — title large
 *   '4xl' →  24 px  (1.5 rem)    — heading small
 *   '5xl' →  28 px  (1.75 rem)   — heading medium
 *   '6xl' →  32 px  (2 rem)      — heading large
 *   '7xl' →  36 px  (2.25 rem)   — display small
 *   '8xl' →  48 px  (3 rem)      — display medium
 *   '9xl' →  60 px  (3.75 rem)   — display large
 *
 * Dependencies:
 *   - None. Pure JS constants — no React, no CSS-in-JS, no external libs.
 *
 * Exports:
 *   - FONT_FAMILY    → font stack definitions (sans, mono, system)
 *   - FONT_SIZE      → modular type scale (2xs → 9xl)
 *   - FONT_WEIGHT    → named weight tokens
 *   - LINE_HEIGHT    → named line-height tokens
 *   - LETTER_SPACING → named tracking tokens
 *   - TEXT_TRANSFORM → text-transform token set
 *   - DISPLAY        → display-level text style objects
 *   - HEADING        → h1–h6 equivalent text style objects
 *   - TITLE          → section and card title style objects
 *   - BODY           → body text style objects (lg, md, sm, xs)
 *   - CAPTION        → caption / annotation / micro-label styles
 *   - LABEL          → UI label styles (field labels, nav labels)
 *   - MONOSPACE      → monospace numeric and code styles
 *   - TABULAR        → tabular / data cell text styles
 *   - typography (default) → all of the above under one frozen root object
 *
 * Usage:
 *   import typography from '../design/typography.js';
 *   typography.HEADING.h2.fontSize     // '1.75rem'
 *
 *   import { BODY, LABEL, MONOSPACE } from '../design/typography.js';
 *   BODY.md.lineHeight                 // 1.6
 *   LABEL.field.letterSpacing          // '0.025em'
 *   MONOSPACE.value.fontFamily         // "'JetBrains Mono',...
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
// FONT_FAMILY
// Font stack definitions. Always include system fallbacks so the UI renders
// correctly before the Google Fonts stylesheet has been parsed.
// ---------------------------------------------------------------------------

export const FONT_FAMILY = deepFreeze({
  /**
   * Primary sans-serif — Inter.
   * Preconnected via public/index.html. Falls back through the system
   * UI font chain so content is legible even if the network request fails.
   */
  sans: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    "'Segoe UI'",
    'Roboto',
    "'Helvetica Neue'",
    'Arial',
    "'Noto Sans'",
    'sans-serif',
  ].join(', '),

  /**
   * Monospace — JetBrains Mono preferred; Fira Code and ui-monospace as
   * first-class fallbacks. Used for sensor values, IDs, telemetry, code.
   */
  mono: [
    "'JetBrains Mono'",
    "'Fira Code'",
    "'Fira Mono'",
    "'Cascadia Code'",
    'ui-monospace',
    "'SFMono-Regular'",
    "Menlo",
    "Monaco",
    "Consolas",
    "'Liberation Mono'",
    "'Courier New'",
    'monospace',
  ].join(', '),

  /**
   * System UI — used for non-branded chrome where the native OS font is
   * preferable (e.g. native scrollbars, OS-level dialog hints).
   */
  system: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    "'Segoe UI'",
    'sans-serif',
  ].join(', '),
});

// ---------------------------------------------------------------------------
// FONT_SIZE
// Modular type scale. All values in rem (respects OS font-size settings).
// px equivalents assume 1 rem = 16 px (browser default).
// ---------------------------------------------------------------------------

export const FONT_SIZE = deepFreeze({
  '2xs': '0.625rem',    //  10 px — micro annotation
  xs:    '0.6875rem',   //  11 px — caption, timestamp
  sm:    '0.75rem',     //  12 px — secondary label
  base:  '0.8125rem',   //  13 px — dense body (data-rich)
  md:    '0.875rem',    //  14 px — default body
  lg:    '0.9375rem',   //  15 px — relaxed body / list item
  xl:    '1rem',        //  16 px — subtitle / card header
  '2xl': '1.125rem',    //  18 px — title medium
  '3xl': '1.25rem',     //  20 px — title large
  '4xl': '1.5rem',      //  24 px — heading small
  '5xl': '1.75rem',     //  28 px — heading medium
  '6xl': '2rem',        //  32 px — heading large
  '7xl': '2.25rem',     //  36 px — display small
  '8xl': '3rem',        //  48 px — display medium
  '9xl': '3.75rem',     //  60 px — display large
});

// ---------------------------------------------------------------------------
// FONT_WEIGHT
// Named weight tokens. Inter supports 300–700 from the preloaded subset.
// ---------------------------------------------------------------------------

export const FONT_WEIGHT = deepFreeze({
  light:    300,
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,

  /** Semantic aliases for role clarity */
  body:     400,
  label:    500,
  heading:  700,
  display:  700,
  kpi:      600,
  badge:    600,
  button:   600,
  caption:  400,
  code:     400,
  emphasis: 600,
});

// ---------------------------------------------------------------------------
// LINE_HEIGHT
// Named line-height tokens. Unitless values are preferred (relative to
// font-size) so they scale correctly at any zoom level.
// ---------------------------------------------------------------------------

export const LINE_HEIGHT = deepFreeze({
  none:    1,      // single-line — KPI values, badges, icon labels
  tight:   1.2,    // display headings, hero numbers
  snug:    1.3,    // section headings, card titles
  normal:  1.4,    // dense body text, data panel content
  relaxed: 1.6,    // standard body text, help text
  loose:   1.8,    // editorial / long-form explanatory text

  /** Semantic aliases */
  display: 1.1,
  heading: 1.25,
  title:   1.35,
  body:    1.6,
  caption: 1.4,
  label:   1.2,
  code:    1.6,
  kpi:     1,      // KPI values are always single-line
});

// ---------------------------------------------------------------------------
// LETTER_SPACING
// Named tracking (letter-spacing) tokens.
// ---------------------------------------------------------------------------

export const LETTER_SPACING = deepFreeze({
  tighter: '-0.04em',
  tight:   '-0.02em',
  normal:   '0',
  wide:     '0.025em',
  wider:    '0.05em',
  widest:   '0.1em',
  caps:     '0.08em',  // uppercase labels — improves legibility at small sizes

  /** Semantic aliases */
  display:  '-0.03em',  // large display text — tighter for visual weight
  heading:  '-0.01em',  // headings — slightly tighter
  body:      '0',
  label:     '0.025em', // field labels, nav labels
  badge:     '0.04em',  // status badges
  caption:   '0.01em',  // captions
  code:      '0',       // monospace — no tracking
  kpi:      '-0.02em',  // KPI numerals — tighter for visual density
  timestamp: '0.01em',
});

// ---------------------------------------------------------------------------
// TEXT_TRANSFORM
// Text-transform token set for consistent casing across components.
// ---------------------------------------------------------------------------

export const TEXT_TRANSFORM = deepFreeze({
  none:       'none',
  uppercase:  'uppercase',
  lowercase:  'lowercase',
  capitalize: 'capitalize',

  /** Semantic aliases */
  label:  'none',        // most labels are sentence-case
  badge:  'uppercase',   // status badges are uppercase
  nav:    'none',        // nav items are sentence-case
  kpi:    'none',        // KPI labels are sentence-case
  meta:   'uppercase',   // zone codes, category codes (e.g. "A1", "NR")
  button: 'none',
  caption:'none',
});

// ---------------------------------------------------------------------------
// DISPLAY
// Display-level text style objects. Used for hero sections, landing page
// headings, and control-room summary numbers.
// Each object is a complete inline style-compatible shape.
// ---------------------------------------------------------------------------

export const DISPLAY = deepFreeze({
  /** 60 px — hero headline, LandingPage module name */
  lg: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['9xl'],
    fontWeight:    FONT_WEIGHT.bold,
    lineHeight:    LINE_HEIGHT.display,
    letterSpacing: LETTER_SPACING.display,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 48 px — prominent feature heading */
  md: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['8xl'],
    fontWeight:    FONT_WEIGHT.bold,
    lineHeight:    LINE_HEIGHT.display,
    letterSpacing: LETTER_SPACING.display,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 36 px — section display heading, full-page KPI */
  sm: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['7xl'],
    fontWeight:    FONT_WEIGHT.bold,
    lineHeight:    LINE_HEIGHT.tight,
    letterSpacing: LETTER_SPACING.display,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 32 px — dashboard primary KPI value */
  kpi: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['6xl'],
    fontWeight:    FONT_WEIGHT.bold,
    lineHeight:    LINE_HEIGHT.kpi,
    letterSpacing: LETTER_SPACING.kpi,
    textTransform: TEXT_TRANSFORM.none,
  },
});

// ---------------------------------------------------------------------------
// HEADING
// H1–H6 equivalent text style objects.
// Maps to semantic heading levels for consistent hierarchy.
// ---------------------------------------------------------------------------

export const HEADING = deepFreeze({
  /** h1 — page title, module heading */
  h1: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['5xl'],   // 28 px
    fontWeight:    FONT_WEIGHT.bold,
    lineHeight:    LINE_HEIGHT.heading,
    letterSpacing: LETTER_SPACING.heading,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** h2 — section heading, split-panel title */
  h2: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['4xl'],   // 24 px
    fontWeight:    FONT_WEIGHT.bold,
    lineHeight:    LINE_HEIGHT.heading,
    letterSpacing: LETTER_SPACING.heading,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** h3 — card header, subsection heading */
  h3: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['3xl'],   // 20 px
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.snug,
    letterSpacing: LETTER_SPACING.heading,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** h4 — panel title, dialog heading */
  h4: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['2xl'],   // 18 px
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.snug,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** h5 — widget heading, timeline section */
  h5: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.xl,       // 16 px
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.snug,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** h6 — overline label heading, minor section */
  h6: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,       // 14 px
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.normal,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },
});

// ---------------------------------------------------------------------------
// TITLE
// Card, panel, and section title styles. Sit between HEADING and BODY.
// ---------------------------------------------------------------------------

export const TITLE = deepFreeze({
  /** 20 px — prominent panel title */
  lg: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['3xl'],
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.title,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 18 px — card title, drawer heading */
  md: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['2xl'],
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.title,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 16 px — section group title, list section header */
  sm: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.xl,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.snug,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 14 px — tight panel title, compact widget header */
  xs: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.snug,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },
});

// ---------------------------------------------------------------------------
// BODY
// Body text style objects for paragraph and list content.
// ---------------------------------------------------------------------------

export const BODY = deepFreeze({
  /** 16 px — relaxed editorial body (used sparingly in operational UIs) */
  lg: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.xl,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.relaxed,
    letterSpacing: LETTER_SPACING.body,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 14 px — default body text */
  md: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.relaxed,
    letterSpacing: LETTER_SPACING.body,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 13 px — dense body text for data-heavy panels */
  sm: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.normal,
    letterSpacing: LETTER_SPACING.body,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 12 px — secondary body text, help text, annotations */
  xs: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.sm,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.normal,
    letterSpacing: LETTER_SPACING.body,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 14 px medium — emphasized body text (inline highlights) */
  emphasis: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.relaxed,
    letterSpacing: LETTER_SPACING.body,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 14 px medium — list item primary text */
  listItem: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.body,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 13 px — list item secondary / subtitle text */
  listItemSub: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.body,
    textTransform: TEXT_TRANSFORM.none,
  },
});

// ---------------------------------------------------------------------------
// CAPTION
// Caption, annotation, and micro-label text styles.
// Used for timestamps, IDs, metadata rows, chart annotations.
// ---------------------------------------------------------------------------

export const CAPTION = deepFreeze({
  /** 12 px — standard caption */
  md: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.sm,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.caption,
    letterSpacing: LETTER_SPACING.caption,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 11 px — small caption, chart axis tick label */
  sm: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.caption,
    letterSpacing: LETTER_SPACING.caption,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 10 px — micro annotation, table corner label */
  xs: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['2xs'],
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.caption,
    letterSpacing: LETTER_SPACING.wider,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 11 px medium — timestamp in list items and timelines */
  timestamp: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.timestamp,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 10 px uppercase — zone code, category code, overline text */
  overline: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE['2xs'],
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.caps,
    textTransform: TEXT_TRANSFORM.uppercase,
  },
});

// ---------------------------------------------------------------------------
// LABEL
// UI label text styles for form fields, nav items, buttons, and badges.
// ---------------------------------------------------------------------------

export const LABEL = deepFreeze({
  /** 14 px — form field label */
  field: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.label,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 13 px — compact field label, filter label */
  fieldSm: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.label,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 14 px — sidebar nav item */
  nav: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 13 px — nav section group heading */
  navGroup: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.caps,
    textTransform: TEXT_TRANSFORM.uppercase,
  },

  /** 14 px — button label */
  button: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 13 px — small button label */
  buttonSm: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 11 px uppercase — status badge */
  badge: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.badge,
    textTransform: TEXT_TRANSFORM.uppercase,
  },

  /** 12 px — tab label */
  tab: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.sm,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 13 px — tooltip content */
  tooltip: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.normal,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 12 px — KPI tile label below the value */
  kpi: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.sm,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 14 px medium — table column header */
  tableHeader: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 13 px — filter chip label */
  chip: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
  },
});

// ---------------------------------------------------------------------------
// MONOSPACE
// Monospace numeric and code styles. Used for sensor values, train IDs,
// incident IDs, timestamps with precision, risk scores, and code blocks.
// ---------------------------------------------------------------------------

export const MONOSPACE = deepFreeze({
  /** 13 px — default monospace value (sensor reading, telemetry) */
  value: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.code,
    textTransform: TEXT_TRANSFORM.none,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 14 px — prominent metric value (KPI numeric, risk score) */
  metric: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE.md,
    fontWeight:    FONT_WEIGHT.medium,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.kpi,
    textTransform: TEXT_TRANSFORM.none,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 16 px — large metric (dashboard KPI number) */
  metricLg: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE.xl,
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.kpi,
    textTransform: TEXT_TRANSFORM.none,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 24 px — prominent KPI number displayed on dashboard tiles */
  kpi: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE['4xl'],
    fontWeight:    FONT_WEIGHT.bold,
    lineHeight:    LINE_HEIGHT.kpi,
    letterSpacing: LETTER_SPACING.kpi,
    textTransform: TEXT_TRANSFORM.none,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 11 px — compact ID, hash, code reference */
  id: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: TEXT_TRANSFORM.uppercase,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 12 px — timestamp with full precision */
  timestamp: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE.sm,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.timestamp,
    textTransform: TEXT_TRANSFORM.none,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 13 px — inline code (report values, config snippets) */
  code: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE.base,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.code,
    letterSpacing: LETTER_SPACING.code,
    textTransform: TEXT_TRANSFORM.none,
  },

  /** 12 px — coordinate display (lat/lng for map tooltips) */
  coordinate: {
    fontFamily:    FONT_FAMILY.mono,
    fontSize:      FONT_SIZE.sm,
    fontWeight:    FONT_WEIGHT.regular,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.normal,
    textTransform: TEXT_TRANSFORM.none,
    fontVariantNumeric: 'tabular-nums',
  },
});

// ---------------------------------------------------------------------------
// TABULAR
// Tabular data cell text styles for table components across M1–M8 modules.
// All tabular styles use tabular-nums for column alignment.
// ---------------------------------------------------------------------------

export const TABULAR = deepFreeze({
  /** 14 px — primary cell content (incident name, train number) */
  primary: {
    fontFamily:         FONT_FAMILY.sans,
    fontSize:           FONT_SIZE.md,
    fontWeight:         FONT_WEIGHT.medium,
    lineHeight:         LINE_HEIGHT.none,
    letterSpacing:      LETTER_SPACING.normal,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 13 px — secondary cell content (station, zone, route) */
  secondary: {
    fontFamily:         FONT_FAMILY.sans,
    fontSize:           FONT_SIZE.base,
    fontWeight:         FONT_WEIGHT.regular,
    lineHeight:         LINE_HEIGHT.none,
    letterSpacing:      LETTER_SPACING.normal,
    fontVariantNumeric: 'tabular-nums',
  },

  /** 13 px monospace — numeric data cell (distance, count, score) */
  numeric: {
    fontFamily:         FONT_FAMILY.mono,
    fontSize:           FONT_SIZE.base,
    fontWeight:         FONT_WEIGHT.regular,
    lineHeight:         LINE_HEIGHT.none,
    letterSpacing:      LETTER_SPACING.code,
    fontVariantNumeric: 'tabular-nums',
    textAlign:          'right',
  },

  /** 11 px — table column header label */
  header: {
    fontFamily:    FONT_FAMILY.sans,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    FONT_WEIGHT.semibold,
    lineHeight:    LINE_HEIGHT.none,
    letterSpacing: LETTER_SPACING.wider,
    textTransform: TEXT_TRANSFORM.uppercase,
  },
});

// ---------------------------------------------------------------------------
// Default export — all token groups under one frozen root
// ---------------------------------------------------------------------------

const typography = deepFreeze({
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
  LETTER_SPACING,
  TEXT_TRANSFORM,
  DISPLAY,
  HEADING,
  TITLE,
  BODY,
  CAPTION,
  LABEL,
  MONOSPACE,
  TABULAR,
});

export default typography;

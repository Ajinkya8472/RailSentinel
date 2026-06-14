/**
 * src/design/spacing.js
 *
 * Purpose:
 * Centralized, immutable spacing scale for RailSentinel. This is the single
 * source of truth for every margin, padding, gap, inset, width, height, and
 * layout dimension token used across components, layouts, panels, cards,
 * tables, charts, and shell regions.
 *
 * Design system rationale:
 *   - All values derive from a 4 px base unit (rem-equivalent: 0.25 rem).
 *     This is the industry-standard "4-point grid" — aligns to pixel grids
 *     across all DPI levels and is compatible with Figma 4pt grids.
 *   - Values are expressed in rem (root-relative) so they respect OS-level
 *     font-size accessibility overrides.
 *   - 1 rem = 16 px at standard browser default.
 *   - Pixel equivalents are documented in comments for quick reference.
 *
 * Scale naming:
 *   0  → 0        (0 px)
 *   px → 0.0625   (1 px)   fine borders, single-pixel rules
 *   0.5 → 0.125   (2 px)   micro gaps, tight icon spacing
 *   1  → 0.25 rem (4 px)   base unit
 *   2  → 0.5 rem  (8 px)
 *   3  → 0.75 rem (12 px)
 *   4  → 1 rem    (16 px)  ← primary component inset
 *   5  → 1.25 rem (20 px)
 *   6  → 1.5 rem  (24 px)
 *   7  → 1.75 rem (28 px)
 *   8  → 2 rem    (32 px)  ← section gap
 *   9  → 2.25 rem (36 px)
 *   10 → 2.5 rem  (40 px)
 *   11 → 2.75 rem (44 px)  min touch-target height
 *   12 → 3 rem    (48 px)  standard row / item height
 *   14 → 3.5 rem  (56 px)
 *   16 → 4 rem    (64 px)
 *   20 → 5 rem    (80 px)
 *   24 → 6 rem    (96 px)
 *   28 → 7 rem    (112 px)
 *   32 → 8 rem    (128 px)
 *   36 → 9 rem    (144 px)
 *   40 → 10 rem   (160 px)
 *   48 → 12 rem   (192 px)
 *   56 → 14 rem   (224 px)
 *   64 → 16 rem   (256 px)
 *   72 → 18 rem   (288 px)
 *   80 → 20 rem   (320 px)
 *   96 → 24 rem   (384 px)
 *
 * Dependencies:
 *   - None. Pure JS constants — no React, no CSS-in-JS, no external libs.
 *
 * Exports:
 *   - SCALE          → numeric scale (0–96), the raw 4px grid
 *   - INSET          → component internal padding tokens (xs–2xl)
 *   - GAP            → flexbox/grid gap tokens (xs–2xl)
 *   - LAYOUT         → shell and page-level structural dimensions
 *   - CARD           → card and panel dimension tokens
 *   - TABLE          → table row and cell dimensions
 *   - CHART          → chart margin, axis, and plot area tokens
 *   - TOUCH          → minimum touch/click target sizes (a11y)
 *   - RADIUS         → border-radius scale
 *   - ICON           → icon size tokens
 *   - BREAKPOINT     → responsive breakpoint widths
 *   - ZINDEX         → z-index stacking scale
 *   - spacing (default) → all of the above under one frozen root object
 *
 * Usage:
 *   import spacing from '../design/spacing.js';
 *   spacing.INSET.md             // '1rem'
 *   spacing.LAYOUT.sidebar.width // '16rem'
 *
 *   import { SCALE, INSET, GAP } from '../design/spacing.js';
 *   SCALE[4]                     // '1rem'
 *   INSET.lg                     // '1.5rem'
 *   GAP.sm                       // '0.5rem'
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
// SCALE
// The canonical 4 px grid. Index values match Tailwind's scale naming
// convention for team familiarity, expressed as rem strings.
// ---------------------------------------------------------------------------

export const SCALE = deepFreeze({
  0:    '0',
  px:   '0.0625rem',   //  1 px
  0.5:  '0.125rem',    //  2 px
  1:    '0.25rem',     //  4 px
  1.5:  '0.375rem',    //  6 px
  2:    '0.5rem',      //  8 px
  2.5:  '0.625rem',    // 10 px
  3:    '0.75rem',     // 12 px
  3.5:  '0.875rem',    // 14 px
  4:    '1rem',        // 16 px ← primary component inset
  5:    '1.25rem',     // 20 px
  6:    '1.5rem',      // 24 px
  7:    '1.75rem',     // 28 px
  8:    '2rem',        // 32 px ← section gap
  9:    '2.25rem',     // 36 px
  10:   '2.5rem',      // 40 px
  11:   '2.75rem',     // 44 px — min touch target
  12:   '3rem',        // 48 px — standard row height
  14:   '3.5rem',      // 56 px
  16:   '4rem',        // 64 px
  20:   '5rem',        // 80 px
  24:   '6rem',        // 96 px
  28:   '7rem',        // 112 px
  32:   '8rem',        // 128 px
  36:   '9rem',        // 144 px
  40:   '10rem',       // 160 px
  48:   '12rem',       // 192 px
  56:   '14rem',       // 224 px
  64:   '16rem',       // 256 px
  72:   '18rem',       // 288 px
  80:   '20rem',       // 320 px
  96:   '24rem',       // 384 px
});

// ---------------------------------------------------------------------------
// INSET
// Component internal padding. Use these instead of raw SCALE values inside
// components to maintain design-level semantic meaning.
// ---------------------------------------------------------------------------

export const INSET = deepFreeze({
  /** 2 px — badge inner padding, icon-only button */
  2xs: '0.125rem',
  /** 4 px — tight pill badge, compact chip */
  xs:  '0.25rem',
  /** 8 px — dense list item, compact table cell, status badge */
  sm:  '0.5rem',
  /** 12 px — small card inset, tight panel */
  md:  '0.75rem',
  /** 16 px — standard card padding, default component inset */
  lg:  '1rem',
  /** 20 px — relaxed card, form section */
  xl:  '1.25rem',
  /** 24 px — generous card, modal content */
  '2xl': '1.5rem',
  /** 32 px — page section inset, dashboard tile */
  '3xl': '2rem',
  /** 40 px — hero section, landing page block */
  '4xl': '2.5rem',

  /** Asymmetric insets — vertical/horizontal shorthand */
  compact: '0.375rem 0.625rem',    //  6 px 10 px — compact button/badge
  button:  '0.5rem 1rem',          //  8 px 16 px — standard button
  buttonSm:'0.375rem 0.75rem',     //  6 px 12 px — small button
  buttonLg:'0.625rem 1.5rem',      // 10 px 24 px — large button / CTA
  input:   '0.5rem 0.75rem',       //  8 px 12 px — form input
  tableCell:'0.5rem 1rem',         //  8 px 16 px — data table cell
  tableCellSm:'0.375rem 0.75rem',  //  6 px 12 px — dense table cell
  chip:    '0.25rem 0.625rem',     //  4 px 10 px — tag / filter chip
  kpi:     '1rem 1.25rem',         // 16 px 20 px — KPI tile inset
  panel:   '1.25rem',              // 20 px — operational panel default
  section: '1.5rem',               // 24 px — dashboard section
});

// ---------------------------------------------------------------------------
// GAP
// Flexbox and CSS Grid gap tokens. Prefer these over raw SCALE for clarity.
// ---------------------------------------------------------------------------

export const GAP = deepFreeze({
  /** 2 px — icon + label, inline badge gap */
  '2xs': '0.125rem',
  /** 4 px — tight inline element gap */
  xs:  '0.25rem',
  /** 8 px — standard inline gap, chip row */
  sm:  '0.5rem',
  /** 12 px — card grid column gap (small) */
  md:  '0.75rem',
  /** 16 px — standard component gap */
  lg:  '1rem',
  /** 20 px — section component gap */
  xl:  '1.25rem',
  /** 24 px — card row gap */
  '2xl': '1.5rem',
  /** 32 px — section gap */
  '3xl': '2rem',
  /** 40 px — major section gap */
  '4xl': '2.5rem',

  /** Semantic gap aliases for domain-specific use */
  kpiStrip:    '1rem',    // gap between KPI tiles
  cardGrid:    '1rem',    // gap between dashboard cards
  panelStack:  '0.75rem', // gap between stacked panels
  listItem:    '0.25rem', // gap between list rows
  formField:   '1rem',    // gap between form fields
  tableRow:    '0',       // table rows have no gap (use border)
  sidebarItem: '0.25rem', // gap between sidebar nav items
  breadcrumb:  '0.375rem',// gap between breadcrumb segments
  inlineTag:   '0.375rem',// gap between inline tag/badge elements
  chartLegend: '1rem',    // gap between chart legend items
});

// ---------------------------------------------------------------------------
// LAYOUT
// Shell and page-level structural dimensions.
// Consumed by AppShell, DashboardLayout, SplitPanelLayout, and MapLayout.
// ---------------------------------------------------------------------------

export const LAYOUT = deepFreeze({
  /** Sidebar */
  sidebar: {
    width:          '15rem',   // 240 px — expanded
    widthCollapsed: '3.5rem',  //  56 px — icon-only collapsed
    minWidth:       '3.5rem',
    maxWidth:       '20rem',
  },

  /** Topbar / Navbar */
  topbar: {
    height:    '3.5rem',  // 56 px — standard topbar
    heightLg:  '4rem',    // 64 px — large topbar
    zIndex:    40,
  },

  /** Main content area */
  content: {
    maxWidth:  '90rem',   // 1440 px — widescreen cap
    paddingX:  '1.5rem',  //  24 px — page-level horizontal padding
    paddingY:  '1.5rem',  //  24 px — page-level vertical padding
    paddingXSm:'1rem',    //  16 px — mobile horizontal padding
  },

  /** Detail / secondary panel (SplitPanelLayout right rail) */
  detailPanel: {
    width:    '22rem',    // 352 px — right-rail detail panel
    widthLg:  '28rem',    // 448 px — wide detail panel
    minWidth: '18rem',
    maxWidth: '36rem',
  },

  /** Map module canvas */
  map: {
    minHeight:   '28rem',  // 448 px
    defaultHeight:'calc(100vh - 3.5rem)', // full viewport minus topbar
  },

  /** KPI strip */
  kpiStrip: {
    height:    '5rem',    //  80 px — standard KPI strip row height
    tileMinW:  '10rem',   // 160 px — minimum KPI tile width
  },

  /** Notification center drawer */
  notificationCenter: {
    width:    '22rem',    // 352 px
    widthLg:  '28rem',    // 448 px
    maxHeight: 'calc(100vh - 3.5rem)',
  },

  /** Command palette modal */
  commandPalette: {
    width:    '36rem',    // 576 px
    maxWidth: '90vw',
    maxHeight:'28rem',    // 448 px
  },

  /** AI Assistant chat panel */
  assistant: {
    width:    '24rem',    // 384 px
    widthLg:  '28rem',    // 448 px
    maxHeight:'calc(100vh - 3.5rem)',
  },
});

// ---------------------------------------------------------------------------
// CARD
// Card and panel dimension tokens.
// ---------------------------------------------------------------------------

export const CARD = deepFreeze({
  /** Padding inside cards */
  padding: {
    sm: '0.75rem',   // 12 px — dense data card
    md: '1rem',      // 16 px — standard card (default)
    lg: '1.25rem',   // 20 px — relaxed card
    xl: '1.5rem',    // 24 px — featured / hero card
  },

  /** Gap between card header / body / footer sections */
  sectionGap: {
    sm: '0.5rem',    //  8 px
    md: '0.75rem',   // 12 px
    lg: '1rem',      // 16 px
  },

  /** Card minimum widths */
  minWidth: {
    sm:  '16rem',    // 256 px — compact data card
    md:  '20rem',    // 320 px — standard card
    lg:  '28rem',    // 448 px — wide card
    kpi: '10rem',    // 160 px — KPI tile
  },

  /** Card maximum widths */
  maxWidth: {
    sm:  '24rem',    // 384 px
    md:  '32rem',    // 512 px
    lg:  '48rem',    // 768 px
    full:'100%',
  },

  /** Incident / risk card specific */
  listItemHeight: {
    compact: '2.75rem', //  44 px — ultra-dense list row
    default: '3.5rem',  //  56 px — standard list item
    relaxed: '4.5rem',  //  72 px — with subtitle
    tall:    '5.5rem',  //  88 px — with meta + badge
  },

  /** Header height inside a card */
  headerHeight: '2.75rem', // 44 px
});

// ---------------------------------------------------------------------------
// TABLE
// Data table row and cell dimension tokens.
// Used by all tabular components across M1–M8 modules.
// ---------------------------------------------------------------------------

export const TABLE = deepFreeze({
  /** Row heights */
  rowHeight: {
    compact: '2.25rem',  //  36 px — ultra-dense mode
    default: '2.75rem',  //  44 px — standard data table row
    relaxed: '3.5rem',   //  56 px — with subtitle or badge
    header:  '2.5rem',   //  40 px — thead row
  },

  /** Cell horizontal padding */
  cellPaddingX: {
    sm: '0.75rem',       // 12 px — compact
    md: '1rem',          // 16 px — default
    lg: '1.25rem',       // 20 px — wide
  },

  /** Cell vertical padding */
  cellPaddingY: {
    sm: '0.375rem',      //  6 px — compact
    md: '0.5rem',        //  8 px — default
    lg: '0.625rem',      // 10 px — relaxed
  },

  /** Fixed column widths for common column types */
  column: {
    id:         '4rem',   //  64 px
    status:     '6rem',   //  96 px
    badge:      '7rem',   // 112 px
    timestamp:  '8rem',   // 128 px
    shortText:  '9rem',   // 144 px
    medText:    '12rem',  // 192 px
    longText:   '18rem',  // 288 px
    number:     '5rem',   //  80 px
    percent:    '4.5rem', //  72 px
    action:     '5rem',   //  80 px — action button column
    checkbox:   '2.5rem', //  40 px
    expander:   '2.5rem', //  40 px
  },

  /** Minimum table width before horizontal scroll activates */
  minWidth: '36rem',       // 576 px
});

// ---------------------------------------------------------------------------
// CHART
// Chart margin, axis, and plot area spacing tokens.
// Used by Recharts margin objects and custom SVG chart layouts.
// ---------------------------------------------------------------------------

export const CHART = deepFreeze({
  /** Recharts <ResponsiveContainer> height defaults */
  height: {
    xs:  '8rem',    // 128 px — sparkline / mini chart
    sm:  '12rem',   // 192 px — compact chart
    md:  '16rem',   // 256 px — standard chart
    lg:  '20rem',   // 320 px — large chart
    xl:  '24rem',   // 384 px — featured chart
    '2xl':'28rem',  // 448 px — full-panel chart
  },

  /** Recharts margin object (top, right, bottom, left in px) */
  margin: {
    tight:   { top: 4,  right: 8,  bottom: 4,  left: 8  },
    default: { top: 8,  right: 16, bottom: 8,  left: 16 },
    relaxed: { top: 16, right: 24, bottom: 16, left: 24 },
    /** Extra left margin to accommodate long Y-axis labels */
    yAxisLabel: { top: 8, right: 16, bottom: 8, left: 48 },
  },

  /** Axis label offsets (px) */
  axis: {
    tickSize:      4,   // px
    tickMargin:    4,   // px
    labelOffsetX: -8,   // px — X-axis label offset from axis line
    labelOffsetY: 16,   // px — Y-axis label offset from axis line
    fontSize:     11,   // px
  },

  /** Tooltip styling dimensions */
  tooltip: {
    padding:      '0.5rem 0.75rem',
    borderRadius: '6px',
    fontSize:     '0.8125rem',
  },

  /** Legend dimensions */
  legend: {
    iconSize:  10,   // px
    height:    32,   // px — legend row height
    marginTop: '0.75rem',
  },

  /** Dot / point sizes for line charts */
  dot: {
    r:       3,   // default dot radius (px)
    rActive: 5,   // active / hover dot radius (px)
    rHidden: 0,   // hidden mode radius
  },

  /** Bar chart dimensions */
  bar: {
    radius:   [4, 4, 0, 0], // top-left, top-right, bottom-right, bottom-left
    maxBarSize: 40,          // px — cap on bar width
    categoryGap: '20%',
    barGap: 4,               // px — gap between bars in same category
  },
});

// ---------------------------------------------------------------------------
// TOUCH
// Minimum touch / click target sizes (WCAG 2.5.5 AAA, Apple HIG, Material).
// All interactive elements must meet the minimum touch target.
// ---------------------------------------------------------------------------

export const TOUCH = deepFreeze({
  /** Minimum touch target — 44×44 px (Apple HIG / WCAG 2.5.5 AAA) */
  min:    '2.75rem',   // 44 px
  /** Comfortable touch target — 48×48 px */
  md:     '3rem',      // 48 px
  /** Large touch target — 56×56 px for primary actions */
  lg:     '3.5rem',    // 56 px

  /** Icon-only button sizes */
  iconSm: '1.75rem',   // 28 px — inline icon button
  iconMd: '2.25rem',   // 36 px — standard icon button
  iconLg: '2.75rem',   // 44 px — prominent icon button

  /** Input / select height */
  inputSm: '2rem',     // 32 px — compact input
  inputMd: '2.5rem',   // 40 px — standard input
  inputLg: '3rem',     // 48 px — large input
});

// ---------------------------------------------------------------------------
// RADIUS
// Border-radius scale. Use semantic names, not raw px values.
// ---------------------------------------------------------------------------

export const RADIUS = deepFreeze({
  none:   '0',
  xs:     '2px',
  sm:     '4px',
  md:     '6px',
  lg:     '8px',
  xl:     '12px',
  '2xl':  '16px',
  '3xl':  '24px',
  full:   '9999px',   // pill / circular

  /** Semantic aliases */
  badge:   '4px',     // status badge
  chip:    '9999px',  // filter chip (pill)
  button:  '8px',     // standard button
  card:    '12px',    // card / panel
  modal:   '16px',    // modal dialog
  input:   '6px',     // form input
  tooltip: '6px',     // tooltip
  avatar:  '9999px',  // avatar / user icon
  icon:    '4px',     // icon container
  tab:     '6px',     // tab button
  map:     '8px',     // map widget border
});

// ---------------------------------------------------------------------------
// ICON
// Icon size tokens. Use throughout components for consistency.
// All values in rem; px equivalents in comments.
// ---------------------------------------------------------------------------

export const ICON = deepFreeze({
  xs:   '0.75rem',    // 12 px — inline text icon
  sm:   '1rem',       // 16 px — small component icon
  md:   '1.25rem',    // 20 px — default icon size
  lg:   '1.5rem',     // 24 px — large icon
  xl:   '2rem',       // 32 px — feature icon
  '2xl':'2.5rem',     // 40 px — section icon
  '3xl':'3rem',       // 48 px — illustration icon
  '4xl':'4rem',       // 64 px — hero / empty-state icon

  /** Map marker sizes */
  markerSm: '1.5rem', // 24 px
  markerMd: '2rem',   // 32 px
  markerLg: '2.5rem', // 40 px

  /** Alert icon sizes */
  alertSm: '1rem',    // 16 px
  alertMd: '1.25rem', // 20 px
  alertLg: '1.5rem',  // 24 px
});

// ---------------------------------------------------------------------------
// BREAKPOINT
// Responsive breakpoint widths. Min-width values (mobile-first).
// Use in CSS media queries or JS window-width checks.
// ---------------------------------------------------------------------------

export const BREAKPOINT = deepFreeze({
  xs:   '20rem',      //  320 px — smallest supported mobile
  sm:   '36rem',      //  576 px — large mobile / small tablet
  md:   '48rem',      //  768 px — tablet portrait
  lg:   '64rem',      // 1024 px — tablet landscape / small laptop
  xl:   '80rem',      // 1280 px — desktop
  '2xl':'90rem',      // 1440 px — wide desktop
  '3xl':'120rem',     // 1920 px — ultra-wide / control-room display

  /** Pixel equivalents (for JS comparison) */
  px: {
    xs:   320,
    sm:   576,
    md:   768,
    lg:   1024,
    xl:   1280,
    '2xl':1440,
    '3xl':1920,
  },
});

// ---------------------------------------------------------------------------
// ZINDEX
// Z-index stacking scale. Explicit named layers prevent z-wars.
// ---------------------------------------------------------------------------

export const ZINDEX = deepFreeze({
  below:    -1,    // elements intentionally behind the stacking context
  base:      0,    // default flow content
  raised:    10,   // slightly elevated content (e.g. hover cards)
  sticky:    20,   // sticky table headers, scroll-locked elements
  sidebar:   30,   // sidebar navigation drawer
  topbar:    40,   // topbar / navbar
  dropdown:  50,   // dropdowns, select menus
  tooltip:   60,   // tooltips
  modal:     70,   // modal dialogs, command palette
  overlay:   80,   // modal scrims / backdrops
  notification: 90,// notification center, toasts
  max:       100,  // emergency override — use sparingly
});

// ---------------------------------------------------------------------------
// Default export — all palettes under one frozen root
// ---------------------------------------------------------------------------

const spacing = deepFreeze({
  SCALE,
  INSET,
  GAP,
  LAYOUT,
  CARD,
  TABLE,
  CHART,
  TOUCH,
  RADIUS,
  ICON,
  BREAKPOINT,
  ZINDEX,
});

export default spacing;

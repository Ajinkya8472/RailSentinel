/**
 * src/design/tokens.js
 *
 * Purpose:
 * Unified design token aggregator for RailSentinel. This is the single import
 * point for all design system primitives. It re-exports every named token from
 * the four design subsystems (colors, spacing, typography, animations) and
 * assembles them into one frozen root object — the canonical design token
 * object used throughout the application.
 *
 * This file owns no token definitions. All values are imported from their
 * authoritative source modules and re-exported verbatim. This ensures:
 *   - A single `import tokens from '../design/tokens.js'` gives access to
 *     the complete design system.
 *   - Named imports remain tree-shakeable:
 *       import { RISK, TRANSITION, HEADING } from '../design/tokens.js'
 *   - The subsystem files (colors, spacing, typography, animations) remain
 *     independently importable for consumers that only need one domain.
 *   - No risk of divergence — tokens.js is always a thin aggregation layer,
 *     never the authoritative definition source.
 *
 * Dependencies:
 *   - ./colors.js      → BRAND, SEMANTIC, RISK, NOTIFICATION, STATUS,
 *                        CHART (colors), SURFACE, TEXT, BORDER, OVERLAY, ZONE
 *   - ./spacing.js     → SCALE, INSET, GAP, LAYOUT, CARD, TABLE,
 *                        CHART (spacing), TOUCH, RADIUS, ICON,
 *                        BREAKPOINT, ZINDEX
 *   - ./typography.js  → FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT,
 *                        LETTER_SPACING, TEXT_TRANSFORM, DISPLAY, HEADING,
 *                        TITLE, BODY, CAPTION, LABEL, MONOSPACE, TABULAR
 *   - ./animations.js  → DURATION, EASING, TRANSITION, KEYFRAME, PAGE,
 *                        PANEL, OVERLAY (animation), NOTIFICATION (animation),
 *                        LIVE_UPDATE, REDUCED_MOTION, INJECT_KEYFRAMES,
 *                        detectReducedMotion, getMotionTokens
 *
 * Exports (named):
 *   ── Colors ────────────────────────────────────────────────────
 *   BRAND, SEMANTIC, RISK, NOTIFICATION_COLORS, STATUS,
 *   CHART_COLORS, SURFACE, TEXT, BORDER, COLOR_OVERLAY, ZONE
 *
 *   ── Spacing ───────────────────────────────────────────────────
 *   SCALE, INSET, GAP, LAYOUT, CARD, TABLE,
 *   CHART_SPACING, TOUCH, RADIUS, ICON, BREAKPOINT, ZINDEX
 *
 *   ── Typography ────────────────────────────────────────────────
 *   FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT,
 *   LETTER_SPACING, TEXT_TRANSFORM, DISPLAY, HEADING, TITLE,
 *   BODY, CAPTION, LABEL, MONOSPACE, TABULAR
 *
 *   ── Animations ────────────────────────────────────────────────
 *   DURATION, EASING, TRANSITION, KEYFRAME, PAGE, PANEL,
 *   ANIM_OVERLAY, ANIM_NOTIFICATION, LIVE_UPDATE,
 *   REDUCED_MOTION, INJECT_KEYFRAMES
 *
 *   ── Runtime utilities (non-frozen, functions) ─────────────────
 *   detectReducedMotion, getMotionTokens
 *
 *   ── Aggregated convenience sets ───────────────────────────────
 *   colors, spacing, typography, animations
 *
 *   ── Default export ────────────────────────────────────────────
 *   tokens — frozen root object with all subsystems namespaced
 *
 * Naming disambiguation:
 *   colors.js and spacing.js both export a namespace called CHART.
 *   colors.js and animations.js both export NOTIFICATION and OVERLAY.
 *   To avoid collision, this file re-exports them under aliased names:
 *     CHART_COLORS    ← colors.CHART
 *     CHART_SPACING   ← spacing.CHART
 *     NOTIFICATION_COLORS ← colors.NOTIFICATION
 *     COLOR_OVERLAY   ← colors.OVERLAY
 *     ANIM_OVERLAY    ← animations.OVERLAY
 *     ANIM_NOTIFICATION ← animations.NOTIFICATION
 *   The default export `tokens` uses fully-namespaced keys, so collisions
 *   never occur within the aggregated object.
 *
 * Usage — single import:
 *   import tokens from '../design/tokens.js';
 *   tokens.colors.RISK.critical.base         // '#ef4444'
 *   tokens.spacing.LAYOUT.sidebar.width      // '15rem'
 *   tokens.typography.HEADING.h2.fontSize    // '1.75rem'
 *   tokens.animations.TRANSITION.panel       // CSS string
 *
 * Usage — named imports (tree-shakeable):
 *   import { RISK, SURFACE, HEADING, TRANSITION } from '../design/tokens.js';
 *   RISK.high.bg                             // 'rgba(249,115,22,0.12)'
 *   SURFACE.card                             // '#1e293b'
 *   HEADING.h3.fontWeight                    // 600
 *   TRANSITION.liveFlash                     // CSS string
 *
 * Usage — subsystem imports (most granular, best tree-shaking):
 *   import { TRANSITION, LIVE_UPDATE } from '../design/animations.js';
 *   import { RISK } from '../design/colors.js';
 */

// ---------------------------------------------------------------------------
// ── Color tokens ─────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export {
  BRAND,
  SEMANTIC,
  RISK,
  /** colors.NOTIFICATION re-exported as NOTIFICATION_COLORS to avoid clash
   *  with animations.NOTIFICATION (ANIM_NOTIFICATION below). */
  NOTIFICATION as NOTIFICATION_COLORS,
  STATUS,
  /** colors.CHART re-exported as CHART_COLORS to avoid clash with
   *  spacing.CHART (CHART_SPACING below). */
  CHART as CHART_COLORS,
  SURFACE,
  TEXT,
  BORDER,
  /** colors.OVERLAY re-exported as COLOR_OVERLAY to avoid clash with
   *  animations.OVERLAY (ANIM_OVERLAY below). */
  OVERLAY as COLOR_OVERLAY,
  ZONE,
  /** colors default export — full color system as a single object */
  default as colors,
} from './colors.js';

// ---------------------------------------------------------------------------
// ── Spacing tokens ────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export {
  SCALE,
  INSET,
  GAP,
  LAYOUT,
  CARD,
  TABLE,
  /** spacing.CHART re-exported as CHART_SPACING to avoid clash with
   *  colors.CHART (CHART_COLORS above). */
  CHART as CHART_SPACING,
  TOUCH,
  RADIUS,
  ICON,
  BREAKPOINT,
  ZINDEX,
  /** spacing default export — full spacing system as a single object */
  default as spacing,
} from './spacing.js';

// ---------------------------------------------------------------------------
// ── Typography tokens ─────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export {
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
  /** typography default export — full typography system as a single object */
  default as typography,
} from './typography.js';

// ---------------------------------------------------------------------------
// ── Animation tokens ──────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

export {
  DURATION,
  EASING,
  TRANSITION,
  KEYFRAME,
  PAGE,
  PANEL,
  /** animations.OVERLAY re-exported as ANIM_OVERLAY to avoid clash with
   *  colors.OVERLAY (COLOR_OVERLAY above). */
  OVERLAY as ANIM_OVERLAY,
  /** animations.NOTIFICATION re-exported as ANIM_NOTIFICATION to avoid clash
   *  with colors.NOTIFICATION (NOTIFICATION_COLORS above). */
  NOTIFICATION as ANIM_NOTIFICATION,
  LIVE_UPDATE,
  REDUCED_MOTION,
  INJECT_KEYFRAMES,
  /** Runtime utilities — functions are not frozen, exported as-is */
  detectReducedMotion,
  getMotionTokens,
  /** animations default export — full animation system as a single object */
  default as animations,
} from './animations.js';

// ---------------------------------------------------------------------------
// Aggregated root — tokens
// One frozen object containing all four subsystems, each under its canonical
// namespace. Use this for exhaustive access without multiple imports.
//
// Internal structure mirrors the subsystem file organisation:
//   tokens.colors      ← everything from colors.js
//   tokens.spacing     ← everything from spacing.js
//   tokens.typography  ← everything from typography.js
//   tokens.animations  ← everything from animations.js
//
// The root object itself is also frozen; subsystem objects are already frozen
// by their respective source modules.
// ---------------------------------------------------------------------------

import colors     from './colors.js';
import spacing    from './spacing.js';
import typography from './typography.js';
import animations from './animations.js';

/**
 * tokens — unified, frozen design token root object.
 *
 * @type {{
 *   colors:     import('./colors.js').default,
 *   spacing:    import('./spacing.js').default,
 *   typography: import('./typography.js').default,
 *   animations: import('./animations.js').default,
 * }}
 */
const tokens = Object.freeze({
  colors,
  spacing,
  typography,
  animations,
});

export default tokens;

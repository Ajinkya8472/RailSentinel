// src/design/animations.js
/**
 * src/design/animations.js
 *
 * Purpose:
 * Centralized, immutable motion and animation token system for RailSentinel.
 * This is the single source of truth for every transition, keyframe,
 * duration, easing, and motion-preference guard used across the application.
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
// DURATION
// ---------------------------------------------------------------------------
export const DURATION = deepFreeze({
  ms: {
    instant:   0,    
    micro:     75,   
    fast:      100,  
    base:      150,  
    moderate:  200,  
    standard:  250,  
    relaxed:   300,  
    slow:      400,  
    slower:    500,  
    slowest:   600,  
    pulse:     2000, 
    blink:     1200, 
    breathe:   3000, 
  },
  css: {
    instant:   '0ms',
    micro:     '75ms',
    fast:      '100ms',
    base:      '150ms',
    moderate:  '200ms',
    standard:  '250ms',
    relaxed:   '300ms',
    slow:      '400ms',
    slower:    '500ms',
    slowest:   '600ms',
    pulse:     '2000ms',
    blink:     '1200ms',
    breathe:   '3000ms',
  },
});

// ---------------------------------------------------------------------------
// EASING
// ---------------------------------------------------------------------------
export const EASING = deepFreeze({
  linear:      'linear',
  ease:        'ease',
  easeIn:      'ease-in',
  easeOut:     'ease-out',
  easeInOut:   'ease-in-out',
  standard:    'cubic-bezier(0.2, 0.0, 0.0, 1.0)',    
  decelerate:  'cubic-bezier(0.0, 0.0, 0.2, 1.0)',    
  accelerate:  'cubic-bezier(0.4, 0.0, 1.0, 1.0)',    
  sharp:       'cubic-bezier(0.4, 0.0, 0.6, 1.0)',    
  emphasize:   'cubic-bezier(0.2, 0.0, 0.0, 1.4)',    
  bounce:      'cubic-bezier(0.34, 1.56, 0.64, 1.0)', 
  panelEnter:  'cubic-bezier(0.0, 0.0, 0.2, 1.0)',    
  panelExit:   'cubic-bezier(0.4, 0.0, 1.0, 1.0)',    
  overlayEnter:'cubic-bezier(0.0, 0.0, 0.2, 1.0)',    
  overlayExit: 'cubic-bezier(0.4, 0.0, 1.0, 1.0)',    
  toastEnter:  'cubic-bezier(0.0, 0.0, 0.2, 1.0)',    
  toastExit:   'cubic-bezier(0.4, 0.0, 1.0, 1.0)',    
  pageEnter:   'cubic-bezier(0.0, 0.0, 0.2, 1.0)',    
  pageExit:    'cubic-bezier(0.4, 0.0, 1.0, 1.0)',    
  liveUpdate:  'cubic-bezier(0.4, 0.0, 0.2, 1.0)',    
  hover:       'cubic-bezier(0.2, 0.0, 0.0, 1.0)',    
});

// ---------------------------------------------------------------------------
// TRANSITION
// ---------------------------------------------------------------------------
export const TRANSITION = deepFreeze({
  none: 'none',
  hover:       `background-color ${DURATION.css.base} ${EASING.hover}, color ${DURATION.css.base} ${EASING.hover}`,
  focus:       `outline ${DURATION.css.micro} ${EASING.standard}, box-shadow ${DURATION.css.micro} ${EASING.standard}`,
  press:       `transform ${DURATION.css.micro} ${EASING.sharp}, background-color ${DURATION.css.fast} ${EASING.hover}`,
  badge:       `background-color ${DURATION.css.base} ${EASING.standard}, color ${DURATION.css.base} ${EASING.standard}, border-color ${DURATION.css.base} ${EASING.standard}`,
  icon:        `transform ${DURATION.css.base} ${EASING.standard}`,
  default:     `all ${DURATION.css.standard} ${EASING.standard}`,
  card:        `box-shadow ${DURATION.css.standard} ${EASING.standard}, transform ${DURATION.css.standard} ${EASING.standard}, background-color ${DURATION.css.standard} ${EASING.standard}`,
  dropdown:    `opacity ${DURATION.css.moderate} ${EASING.decelerate}, transform ${DURATION.css.moderate} ${EASING.decelerate}`,
  status:      `background-color ${DURATION.css.relaxed} ${EASING.standard}, color ${DURATION.css.relaxed} ${EASING.standard}, border-color ${DURATION.css.relaxed} ${EASING.standard}`,
  sidebar:     `width ${DURATION.css.relaxed} ${EASING.standard}, transform ${DURATION.css.relaxed} ${EASING.standard}`,
  sidebarItem: `background-color ${DURATION.css.base} ${EASING.hover}, color ${DURATION.css.base} ${EASING.hover}, border-color ${DURATION.css.base} ${EASING.hover}`,
  progress:    `width ${DURATION.css.relaxed} ${EASING.decelerate}`,
  tab:         `transform ${DURATION.css.moderate} ${EASING.standard}, opacity ${DURATION.css.moderate} ${EASING.standard}`,
  kpi:         `color ${DURATION.css.relaxed} ${EASING.standard}, opacity ${DURATION.css.moderate} ${EASING.standard}`,
  panel:       `transform ${DURATION.css.slow} ${EASING.panelEnter}, opacity ${DURATION.css.slow} ${EASING.panelEnter}`,
  panelExit:   `transform ${DURATION.css.relaxed} ${EASING.panelExit}, opacity ${DURATION.css.relaxed} ${EASING.panelExit}`,
  page:        `opacity ${DURATION.css.slower} ${EASING.pageEnter}`,
  modal:       `opacity ${DURATION.css.slow} ${EASING.overlayEnter}, transform ${DURATION.css.slow} ${EASING.overlayEnter}`,
  scrim:       `opacity ${DURATION.css.slow} ${EASING.overlayEnter}`,
  toast:       `transform ${DURATION.css.relaxed} ${EASING.toastEnter}, opacity ${DURATION.css.moderate} ${EASING.toastEnter}`,
  drawer:      `transform ${DURATION.css.slow} ${EASING.panelEnter}, opacity ${DURATION.css.standard} ${EASING.panelEnter}`,
  commandPalette: `opacity ${DURATION.css.moderate} ${EASING.overlayEnter}, transform ${DURATION.css.moderate} ${EASING.overlayEnter}`,
  liveFlash:   `background-color ${DURATION.css.relaxed} ${EASING.liveUpdate}`,
  chart:       `opacity ${DURATION.css.relaxed} ${EASING.standard}`,
});

// ---------------------------------------------------------------------------
// KEYFRAME
// ---------------------------------------------------------------------------
export const KEYFRAME = deepFreeze({
  'rs-pulse': `
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.45; transform: scale(0.92); }
  `,
  'rs-ripple': `
    0%   { transform: scale(0.8); opacity: 0.9; }
    100% { transform: scale(2.4); opacity: 0; }
  `,
  'rs-blink': `
    0%, 49%  { opacity: 1; }
    50%, 100% { opacity: 0.15; }
  `,
  'rs-breathe': `
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(1.08); }
  `,
  'rs-live-flash': `
    0%   { background-color: rgba(59, 130, 246, 0.22); }
    100% { background-color: transparent; }
  `,
  'rs-success-flash': `
    0%   { background-color: rgba(34, 197, 94, 0.22); }
    100% { background-color: transparent; }
  `,
  'rs-warn-flash': `
    0%   { background-color: rgba(234, 179, 8, 0.22); }
    100% { background-color: transparent; }
  `,
  'rs-critical-flash': `
    0%   { background-color: rgba(239, 68, 68, 0.25); }
    100% { background-color: transparent; }
  `,
  'rs-fade-in': `
    from { opacity: 0; }
    to   { opacity: 1; }
  `,
  'rs-fade-out': `
    from { opacity: 1; }
    to   { opacity: 0; }
  `,
  'rs-slide-in-right': `
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  `,
  'rs-slide-out-right': `
    from { transform: translateX(0);    opacity: 1; }
    to   { transform: translateX(100%); opacity: 0; }
  `,
  'rs-slide-in-left': `
    from { transform: translateX(-100%); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
  `,
  'rs-slide-out-left': `
    from { transform: translateX(0);     opacity: 1; }
    to   { transform: translateX(-100%); opacity: 0; }
  `,
  'rs-slide-up': `
    from { transform: translateY(1.5rem); opacity: 0; }
    to   { transform: translateY(0);      opacity: 1; }
  `,
  'rs-slide-down': `
    from { transform: translateY(0);      opacity: 1; }
    to   { transform: translateY(1.5rem); opacity: 0; }
  `,
  'rs-scale-in': `
    from { transform: scale(0.94); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  `,
  'rs-scale-out': `
    from { transform: scale(1);    opacity: 1; }
    to   { transform: scale(0.94); opacity: 0; }
  `,
  'rs-spin': `
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  `,
  'rs-bounce': `
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40%            { transform: scale(1.0); opacity: 1;   }
  `,
  'rs-gradient-shift': `
    0%   { background-position: 0%   50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0%   50%; }
  `,
  'rs-shimmer': `
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  `,
});

// ---------------------------------------------------------------------------
// MODULE ROLES
// ---------------------------------------------------------------------------
export const PAGE = deepFreeze({
  enter: {
    initial: { opacity: 0, transform: 'translateY(6px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    transition: `opacity ${DURATION.css.slower} ${EASING.pageEnter}, transform ${DURATION.css.slower} ${EASING.pageEnter}`,
    durationMs: DURATION.ms.slower,
  },
  exit: {
    initial: { opacity: 1, transform: 'translateY(0)' },
    animate: { opacity: 0, transform: 'translateY(-4px)' },
    transition: `opacity ${DURATION.css.standard} ${EASING.pageExit}, transform ${DURATION.css.standard} ${EASING.pageExit}`,
    durationMs: DURATION.ms.standard,
  },
  minLoaderMs: 300,
  loadingAnimation: `rs-fade-in ${DURATION.css.moderate} ${EASING.decelerate} forwards`,
});

export const PANEL = deepFreeze({
  enterRight: {
    animation:   `rs-slide-in-right ${DURATION.css.slow} ${EASING.panelEnter} forwards`,
    transition:  TRANSITION.panel,
    durationMs:  DURATION.ms.slow,
    initial:     { transform: 'translateX(100%)', opacity: 0 },
    animate:     { transform: 'translateX(0)',    opacity: 1 },
  },
  exitRight: {
    animation:  `rs-slide-out-right ${DURATION.css.relaxed} ${EASING.panelExit} forwards`,
    transition: TRANSITION.panelExit,
    durationMs: DURATION.ms.relaxed,
    initial:    { transform: 'translateX(0)',    opacity: 1 },
    animate:    { transform: 'translateX(100%)', opacity: 0 },
  },
  enterLeft: {
    animation:  `rs-slide-in-left ${DURATION.css.slow} ${EASING.panelEnter} forwards`,
    durationMs: DURATION.ms.slow,
    initial:    { transform: 'translateX(-100%)', opacity: 0 },
    animate:    { transform: 'translateX(0)',      opacity: 1 },
  },
  exitLeft: {
    animation:  `rs-slide-out-left ${DURATION.css.relaxed} ${EASING.panelExit} forwards`,
    durationMs: DURATION.ms.relaxed,
    initial:    { transform: 'translateX(0)',      opacity: 1 },
    animate:    { transform: 'translateX(-100%)',  opacity: 0 },
  },
  expand: {
    transition:  `max-height ${DURATION.css.slow} ${EASING.decelerate}, opacity ${DURATION.css.relaxed} ${EASING.standard}`,
    durationMs:  DURATION.ms.slow,
  },
  collapse: {
    transition: `max-height ${DURATION.css.relaxed} ${EASING.accelerate}, opacity ${DURATION.css.moderate} ${EASING.standard}`,
    durationMs: DURATION.ms.relaxed,
  },
  sidebar: {
    transition:  TRANSITION.sidebar,
    durationMs:  DURATION.ms.relaxed,
  },
});

export const OVERLAY = deepFreeze({
  modalEnter: {
    animation:  `rs-scale-in ${DURATION.css.slow} ${EASING.overlayEnter} forwards`,
    transition: TRANSITION.modal,
    durationMs: DURATION.ms.slow,
    initial:    { transform: 'scale(0.94)', opacity: 0 },
    animate:    { transform: 'scale(1)',    opacity: 1 },
  },
  modalExit: {
    animation:  `rs-scale-out ${DURATION.css.standard} ${EASING.overlayExit} forwards`,
    durationMs: DURATION.ms.standard,
    initial:    { transform: 'scale(1)',    opacity: 1 },
    animate:    { transform: 'scale(0.94)', opacity: 0 },
  },
  scrimEnter: {
    animation:  `rs-fade-in ${DURATION.css.slow} ${EASING.overlayEnter} forwards`,
    transition: TRANSITION.scrim,
    durationMs: DURATION.ms.slow,
    initial:    { opacity: 0 },
    animate:    { opacity: 1 },
  },
  scrimExit: {
    animation:  `rs-fade-out ${DURATION.css.relaxed} ${EASING.overlayExit} forwards`,
    durationMs: DURATION.ms.relaxed,
    initial:    { opacity: 1 },
    animate:    { opacity: 0 },
  },
  commandPaletteEnter: {
    animation:  `rs-scale-in ${DURATION.css.moderate} ${EASING.overlayEnter} forwards`,
    transition: TRANSITION.commandPalette,
    durationMs: DURATION.ms.moderate,
  },
  commandPaletteExit: {
    animation:  `rs-scale-out ${DURATION.css.base} ${EASING.overlayExit} forwards`,
    durationMs: DURATION.ms.base,
  },
  notificationCenterEnter: {
    animation:  `rs-slide-in-right ${DURATION.css.slow} ${EASING.panelEnter} forwards`,
    transition: TRANSITION.drawer,
    durationMs: DURATION.ms.slow,
  },
  notificationCenterExit: {
    animation:  `rs-slide-out-right ${DURATION.css.relaxed} ${EASING.panelExit} forwards`,
    durationMs: DURATION.ms.relaxed,
  },
  assistantEnter: {
    animation:  `rs-slide-in-right ${DURATION.css.slow} ${EASING.panelEnter} forwards`,
    durationMs: DURATION.ms.slow,
  },
  assistantExit: {
    animation:  `rs-slide-out-right ${DURATION.css.relaxed} ${EASING.panelExit} forwards`,
    durationMs: DURATION.ms.relaxed,
  },
  dropdownEnter: {
    animation:  `rs-fade-in ${DURATION.css.moderate} ${EASING.decelerate} forwards, rs-scale-in ${DURATION.css.moderate} ${EASING.decelerate} forwards`,
    transition: TRANSITION.dropdown,
    durationMs: DURATION.ms.moderate,
  },
  dropdownExit: {
    animation:  `rs-fade-out ${DURATION.css.fast} ${EASING.accelerate} forwards`,
    durationMs: DURATION.ms.fast,
  },
});

export const NOTIFICATION = deepFreeze({
  toastEnter: {
    animation:  `rs-slide-up ${DURATION.css.relaxed} ${EASING.toastEnter} forwards`,
    transition: TRANSITION.toast,
    durationMs: DURATION.ms.relaxed,
    initial:    { transform: 'translateY(1.5rem)', opacity: 0 },
    animate:    { transform: 'translateY(0)',      opacity: 1 },
  },
  toastExit: {
    animation:  `rs-slide-down ${DURATION.css.standard} ${EASING.toastExit} forwards`,
    durationMs: DURATION.ms.standard,
    initial:    { transform: 'translateY(0)',      opacity: 1 },
    animate:    { transform: 'translateY(1.5rem)', opacity: 0 },
  },
  criticalBlink: {
    animation:   `rs-blink ${DURATION.css.blink} step-start infinite`,
    durationMs:  DURATION.ms.blink,
    iterationCount: 'infinite',
  },
  highPulse: {
    animation:   `rs-pulse ${DURATION.css.pulse} ${EASING.standard} infinite`,
    durationMs:  DURATION.ms.pulse,
    iterationCount: 'infinite',
  },
  infoBreathe: {
    animation:   `rs-breathe 4000ms ${EASING.standard} infinite`,
    durationMs:  4000,
    iterationCount: 'infinite',
  },
  alertEnter: {
    animation:  `rs-fade-in ${DURATION.css.moderate} ${EASING.decelerate} forwards`,
    durationMs: DURATION.ms.moderate,
  },
  alertExit: {
    animation:  `rs-fade-out ${DURATION.css.base} ${EASING.accelerate} forwards`,
    durationMs: DURATION.ms.base,
  },
  escalateFlash: {
    animation:  `rs-blink ${DURATION.css.blink} step-start 3`,
    durationMs: DURATION.ms.blink,
    iterationCount: 3,
  },
});

export const LIVE_UPDATE = deepFreeze({
  connected: {
    animation:       `rs-breathe ${DURATION.css.breathe} ${EASING.standard} infinite`,
    animationName:   'rs-breathe',
    durationMs:      DURATION.ms.breathe,
    iterationCount:  'infinite',
  },
  syncing: {
    animation:       `rs-pulse ${DURATION.css.pulse} ${EASING.standard} infinite`,
    animationName:   'rs-pulse',
    durationMs:      DURATION.ms.pulse,
    iterationCount:  'infinite',
  },
  error: {
    animation:       `rs-blink ${DURATION.css.blink} step-start infinite`,
    animationName:   'rs-blink',
    durationMs:      DURATION.ms.blink,
    iterationCount:  'infinite',
  },
  ripple: {
    animation:       `rs-ripple 2000ms ${EASING.standard} infinite`,
    animationName:   'rs-ripple',
    durationMs:      2000,
    iterationCount:  'infinite',
  },
  newRow: {
    animation:       `rs-live-flash ${DURATION.css.slower} ${EASING.liveUpdate} forwards`,
    animationName:   'rs-live-flash',
    durationMs:      DURATION.ms.slower,
    iterationCount:  1,
  },
  resolvedRow: {
    animation:       `rs-success-flash ${DURATION.css.slower} ${EASING.liveUpdate} forwards`,
    animationName:   'rs-success-flash',
    durationMs:      DURATION.ms.slower,
    iterationCount:  1,
  },
  warnRow: {
    animation:       `rs-warn-flash ${DURATION.css.slower} ${EASING.liveUpdate} forwards`,
    animationName:   'rs-warn-flash',
    durationMs:      DURATION.ms.slower,
    iterationCount:  1,
  },
  criticalRow: {
    animation:       `rs-critical-flash ${DURATION.css.slower} ${EASING.liveUpdate} forwards`,
    animationName:   'rs-critical-flash',
    durationMs:      DURATION.ms.slower,
    iterationCount:  1,
  },
  kpiUpdate: {
    animation:       `rs-shimmer 600ms ${EASING.standard} forwards`,
    animationName:   'rs-shimmer',
    durationMs:      600,
    iterationCount:  1,
  },
  spinner: {
    animation:       `rs-spin 800ms linear infinite`,
    animationName:   'rs-spin',
    durationMs:      800,
    iterationCount:  'infinite',
  },
  bounceDot: {
    animation:       `rs-bounce 1200ms ease-in-out infinite`,
    animationName:   'rs-bounce',
    durationMs:      1200,
    iterationCount:  'infinite',
  },
});

// ---------------------------------------------------------------------------
// REDUCED_MOTION
// ---------------------------------------------------------------------------
export const REDUCED_MOTION = deepFreeze({
  transition: {
    none:             'none',
    hover:            `opacity ${DURATION.css.micro} linear`,
    focus:            `outline ${DURATION.css.micro} linear, box-shadow ${DURATION.css.micro} linear`,
    press:            `opacity ${DURATION.css.micro} linear`,
    badge:            `opacity ${DURATION.css.micro} linear`,
    icon:             'none',
    default:          `opacity ${DURATION.css.base} linear`,
    card:             `opacity ${DURATION.css.base} linear`,
    dropdown:         `opacity ${DURATION.css.base} linear`,
    status:           `opacity ${DURATION.css.base} linear`,
    sidebar:          'none',
    sidebarItem:      `opacity ${DURATION.css.micro} linear`,
    progress:         'none',
    tab:              `opacity ${DURATION.css.base} linear`,
    kpi:              `opacity ${DURATION.css.base} linear`,
    panel:            `opacity ${DURATION.css.base} linear`,
    panelExit:        `opacity ${DURATION.css.base} linear`,
    page:             `opacity ${DURATION.css.base} linear`,
    modal:            `opacity ${DURATION.css.base} linear`,
    scrim:            `opacity ${DURATION.css.base} linear`,
    toast:            `opacity ${DURATION.css.base} linear`,
    drawer:           `opacity ${DURATION.css.base} linear`,
    commandPalette:   `opacity ${DURATION.css.base} linear`,
    liveFlash:        'none',
    chart:            'none',
  },
  animation: {
    none:          'none',
    fadeIn:        `rs-fade-in ${DURATION.css.base} linear forwards`,
    fadeOut:       `rs-fade-out ${DURATION.css.base} linear forwards`,
    pulse:         'none',
    blink:         'none',
    breathe:       'none',
    ripple:        'none',
    spinner:       `rs-spin 1600ms linear infinite`,
    slideInRight:  `rs-fade-in ${DURATION.css.base} linear forwards`,
    slideOutRight: `rs-fade-out ${DURATION.css.base} linear forwards`,
    slideUp:       `rs-fade-in ${DURATION.css.base} linear forwards`,
    slideDown:     `rs-fade-out ${DURATION.css.base} linear forwards`,
    scaleIn:       `rs-fade-in ${DURATION.css.base} linear forwards`,
    scaleOut:      `rs-fade-out ${DURATION.css.base} linear forwards`,
    liveFlash:     'none',
    shimmer:       'none',
  },
  duration: {
    micro:    '0ms',
    fast:     '0ms',
    base:     '50ms',
    moderate: '75ms',
    standard: '75ms',
    relaxed:  '100ms',
    slow:     '100ms',
    slower:   '100ms',
    slowest:  '100ms',
  },
});

// ---------------------------------------------------------------------------
// RUNTIME UTILITIES
// ---------------------------------------------------------------------------
export function detectReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false; 
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getMotionTokens() {
  if (detectReducedMotion()) {
    return {
      transition: REDUCED_MOTION.transition,
      animation:  REDUCED_MOTION.animation,
      duration:   REDUCED_MOTION.duration,
    };
  }
  return {
    transition: TRANSITION,
    animation:  { ...LIVE_UPDATE, ...NOTIFICATION },
    duration:   DURATION.css,
  };
}

export const INJECT_KEYFRAMES = Object.entries(KEYFRAME)
  .map(([name, body]) => `@keyframes ${name} { ${body} }`)
  .join('\n');

// Self-executing dynamic injection block so keyframe registries register immediately on load
if (typeof document !== 'undefined') {
  const STYLE_HOOK_ID = 'rs-embedded-keyframes';
  if (!document.getElementById(STYLE_HOOK_ID)) {
    const styleNode = document.createElement('style');
    styleNode.id = STYLE_HOOK_ID;
    styleNode.textContent = INJECT_KEYFRAMES;
    document.head.appendChild(styleNode);
  }
}

// All groups compiled under a frozen immutable single root
const animations = deepFreeze({
  DURATION,
  EASING,
  TRANSITION,
  KEYFRAME,
  PAGE,
  PANEL,
  OVERLAY,
  NOTIFICATION,
  LIVE_UPDATE,
  REDUCED_MOTION,
  INJECT_KEYFRAMES,
});

export default animations;
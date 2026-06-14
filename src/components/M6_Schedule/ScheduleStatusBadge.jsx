import React, { memo } from 'react';

/**
 * Purpose:
 * ScheduleStatusBadge — canonical inline badge for Module-6 ScheduleConflict
 * entities. Maps `severity`, `status`, and `resolutionStatus` to a single
 * deterministic display state using the scheduling colour system.
 *
 * Display state matrix:
 *   critical + unresolved          → CRITICAL
 *   critical + in-progress         → RESOLVING
 *   high + unresolved              → HIGH
 *   high + in-progress             → RESOLVING
 *   medium + unresolved            → ACTIVE
 *   medium + in-progress           → RESOLVING
 *   low + any open                 → NOMINAL
 *   any  + resolved                → RESOLVED
 *   escalationLevel > 0 + open     → ESCALATED (overrides severity)
 *   resolutionStatus: 'approved'   → APPROVED
 *   resolutionStatus: 'rejected'   → REJECTED
 *
 * System states:
 *   loading                        → LOADING
 *   stale                          → STALE
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `conflict`     (object|null)    — ScheduleConflict entity (default: null)
 * - `isLoading`    (boolean)        (default: false)
 * - `isStale`      (boolean)        (default: false)
 * - `size`         ('sm'|'md'|'lg') (default: 'md')
 * - `showLabel`    (boolean)        (default: true)
 * - `onClick`      (fn|null)        (default: null)
 */

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

const STATUS_DISPLAY = {
  critical:  { label: 'Critical',  cssModifier: 'critical',  icon: '✕', ariaLabel: 'Critical conflict'        },
  high:      { label: 'High',      cssModifier: 'high',      icon: '▲', ariaLabel: 'High severity conflict'   },
  active:    { label: 'Active',    cssModifier: 'active',    icon: '◉', ariaLabel: 'Active conflict'          },
  resolving: { label: 'Resolving', cssModifier: 'resolving', icon: '↺', ariaLabel: 'Conflict being resolved'  },
  resolved:  { label: 'Resolved',  cssModifier: 'resolved',  icon: '✓', ariaLabel: 'Conflict resolved'        },
  escalated: { label: 'Escalated', cssModifier: 'escalated', icon: '⚡', ariaLabel: 'Conflict escalated'      },
  approved:  { label: 'Approved',  cssModifier: 'approved',  icon: '✔', ariaLabel: 'Resolution approved'      },
  rejected:  { label: 'Rejected',  cssModifier: 'rejected',  icon: '✗', ariaLabel: 'Resolution rejected'      },
  nominal:   { label: 'Nominal',   cssModifier: 'nominal',   icon: '○', ariaLabel: 'Low priority conflict'    },
  loading:   { label: 'Loading',   cssModifier: 'loading',   icon: '…', ariaLabel: 'Loading'                  },
  stale:     { label: 'Stale',     cssModifier: 'stale',     icon: '⧗', ariaLabel: 'Data may be stale'        },
};

function deriveState(conflict, isLoading, isStale) {
  if (isLoading) return 'loading';
  if (!conflict) return 'nominal';

  const severity   = String(conflict.severity ?? 'low').toLowerCase();
  const status     = String(conflict.status ?? 'open').toLowerCase();
  const resSt      = String(conflict.resolutionStatus ?? '').toLowerCase();
  const escLevel   = Number(conflict.escalationLevel ?? 0);

  if (status === 'resolved' || resSt === 'resolved') return 'resolved';
  if (resSt === 'approved') return 'approved';
  if (resSt === 'rejected') return 'rejected';
  if (escLevel > 0)         return 'escalated';
  if (resSt === 'in-progress' || resSt === 'in_progress') return 'resolving';
  if (severity === 'critical') return 'critical';
  if (severity === 'high')     return 'high';
  if (severity === 'medium')   return 'active';
  if (isStale) return 'stale';
  return 'nominal';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ScheduleStatusBadge({
  conflict    = null,
  isLoading   = false,
  isStale     = false,
  size        = 'md',
  showLabel   = true,
  onClick     = null,
}) {
  const displayState = deriveState(conflict, isLoading, isStale);
  const cfg          = STATUS_DISPLAY[displayState] ?? STATUS_DISPLAY.nominal;
  const isClickable  = typeof onClick === 'function';

  return (
    <span
      className={[
        'schedule-status-badge',
        `schedule-status-badge--${cfg.cssModifier}`,
        `schedule-status-badge--${size}`,
        isClickable ? 'schedule-status-badge--clickable' : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'status'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={cfg.ariaLabel}
      onClick={isClickable ? () => onClick(conflict) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(conflict); } } : undefined}
    >
      <span className="schedule-status-badge__icon" aria-hidden="true">{cfg.icon}</span>
      {showLabel && <span className="schedule-status-badge__label">{cfg.label}</span>}
    </span>
  );
});

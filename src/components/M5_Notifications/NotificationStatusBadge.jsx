import React, { memo } from 'react';
import useUiStore from '../../store/uiStore';

/**
 * Purpose:
 * NotificationStatusBadge — canonical inline badge for M5 Notification status.
 * Maps `priority`, `status`, and `deliveryStatus` to a single deterministic
 * display state with consistent colour encoding across all M5 components.
 *
 * Priority × Status matrix → display state:
 *   Critical + unread          → URGENT
 *   Critical + read/acked      → CRITICAL
 *   High + unread              → ALERT
 *   High + read/acked          → HIGH
 *   Medium + unread            → ACTIVE
 *   Medium + read/acked        → NOMINAL
 *   Low + any                  → NOMINAL
 *   any  + dismissed           → DISMISSED
 *   deliveryStatus: 'failed'   → FAILED (overrides priority)
 *   deliveryStatus: 'retrying' → RETRYING
 *
 * System states:
 *   loading                    → LOADING
 *   stale                      → STALE
 *
 * Dependencies:
 * - React (memo)
 * - `src/store/uiStore` (Zustand — read-only; notificationCenterOpen)
 *
 * Props:
 * - `notification`   (object|null)  — Notification entity (default: null)
 * - `isLoading`      (boolean)      (default: false)
 * - `isStale`        (boolean)      (default: false)
 * - `size`           ('sm'|'md'|'lg') (default: 'md')
 * - `showLabel`      (boolean)      (default: true)
 * - `onClick`        (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

const STATUS_DISPLAY = {
  urgent:    { label: 'Urgent',    cssModifier: 'urgent',    icon: '✕', ariaLabel: 'Urgent — critical unread notification'   },
  critical:  { label: 'Critical',  cssModifier: 'critical',  icon: '▲', ariaLabel: 'Critical priority notification'          },
  alert:     { label: 'Alert',     cssModifier: 'alert',     icon: '▲', ariaLabel: 'High priority unread notification'       },
  high:      { label: 'High',      cssModifier: 'high',      icon: '◉', ariaLabel: 'High priority notification'              },
  active:    { label: 'Active',    cssModifier: 'active',    icon: '◉', ariaLabel: 'Active unread notification'              },
  nominal:   { label: 'Nominal',   cssModifier: 'nominal',   icon: '✓', ariaLabel: 'Notification read or low priority'       },
  dismissed: { label: 'Dismissed', cssModifier: 'dismissed', icon: '—', ariaLabel: 'Notification dismissed'                 },
  failed:    { label: 'Failed',    cssModifier: 'failed',    icon: '!', ariaLabel: 'Notification delivery failed'            },
  retrying:  { label: 'Retrying',  cssModifier: 'retrying',  icon: '↺', ariaLabel: 'Notification delivery retrying'         },
  loading:   { label: 'Loading',   cssModifier: 'loading',   icon: '…', ariaLabel: 'Loading notification status'            },
  stale:     { label: 'Stale',     cssModifier: 'stale',     icon: '⧗', ariaLabel: 'Notification data may be stale'         },
};

function deriveDisplayState(notification, isLoading, isStale) {
  if (isLoading) return 'loading';
  if (!notification) return 'nominal';

  const delivery = String(notification.deliveryStatus ?? '').toLowerCase();
  if (delivery === 'failed')   return 'failed';
  if (delivery === 'retrying') return 'retrying';

  const status   = String(notification.status ?? 'unread').toLowerCase();
  const priority = String(notification.priority ?? 'low').toLowerCase();

  if (status === 'dismissed') return 'dismissed';

  if (priority === 'critical') return status === 'unread' ? 'urgent' : 'critical';
  if (priority === 'high')     return status === 'unread' ? 'alert'  : 'high';
  if (priority === 'medium')   return status === 'unread' ? 'active' : 'nominal';

  if (isStale) return 'stale';
  return 'nominal';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationStatusBadge({
  notification = null,
  isLoading    = false,
  isStale      = false,
  size         = 'md',
  showLabel    = true,
  onClick      = null,
}) {
  const displayState = deriveDisplayState(notification, isLoading, isStale);
  const cfg          = STATUS_DISPLAY[displayState] ?? STATUS_DISPLAY.nominal;
  const isClickable  = typeof onClick === 'function';

  return (
    <span
      className={[
        'notification-status-badge',
        `notification-status-badge--${cfg.cssModifier}`,
        `notification-status-badge--${size}`,
        isClickable ? 'notification-status-badge--clickable' : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'status'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={cfg.ariaLabel}
      onClick={isClickable ? () => onClick(notification) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(notification); } } : undefined}
    >
      <span className="notification-status-badge__icon" aria-hidden="true">{cfg.icon}</span>
      {showLabel && <span className="notification-status-badge__label">{cfg.label}</span>}
    </span>
  );
});

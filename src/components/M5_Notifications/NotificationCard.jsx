import React, { memo, useMemo } from 'react';
import useUiStore from '../../store/uiStore';

/**
 * Purpose:
 * NotificationCard — compact summary card for a single M5 Notification entity.
 * Renders notification title, priority badge, delivery status, audience context,
 * channel, and relative timestamp in a self-contained card suitable for list
 * and grid placements.
 *
 * Since there is no dedicated notificationStore, M5 components own their
 * entity data through direct props or through the `notifications` prop list.
 * The card reads only `selectedNotificationId` from `uiStore` to apply the
 * active-selection highlight — no mutations are performed.
 *
 * Notification domain model (from notificationService + uiStore context):
 * - `id`               — unique notification identifier
 * - `title`            — notification headline
 * - `body`             — full notification body text
 * - `priority`         — 'low' | 'medium' | 'high' | 'critical'
 * - `status`           — 'unread' | 'read' | 'acknowledged' | 'dismissed'
 * - `deliveryStatus`   — 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying'
 * - `channel`          — 'push' | 'sms' | 'email' | 'in-app' | 'voice'
 * - `audience[]`       — recipient role / group descriptors
 * - `sentAt`           — ISO timestamp
 * - `readAt`           — ISO timestamp or null
 * - `acknowledgedAt`   — ISO timestamp or null
 * - `locale`           — 'en' | 'hi' | …
 * - `template`         — template name/ID
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/uiStore` (Zustand — read-only; selectedNotificationId)
 *
 * Props:
 * - `notification`     (object)    — Notification entity (required)
 * - `staleThreshold`   (number)    — ms before stale (default: 60000)
 * - `compact`          (boolean)   — compact single-line mode (default: false)
 * - `isLoading`        (boolean)   — loading state (default: false)
 * - `isStale`          (boolean)   — stale state override (default: false)
 * - `onOpen`           (fn|null)   — callback with Notification on click
 * - `onAcknowledge`    (fn|null)   — callback with Notification on ack action
 * - `onDismiss`        (fn|null)   — callback with Notification on dismiss
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG = {
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: '○' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
};

const STATUS_CONFIG = {
  unread:       { label: 'Unread',       cssModifier: 'unread'       },
  read:         { label: 'Read',         cssModifier: 'read'         },
  acknowledged: { label: 'Acknowledged', cssModifier: 'acknowledged' },
  dismissed:    { label: 'Dismissed',    cssModifier: 'dismissed'    },
};

const DELIVERY_CONFIG = {
  pending:   { label: 'Pending',   cssModifier: 'pending'   },
  sent:      { label: 'Sent',      cssModifier: 'sent'      },
  delivered: { label: 'Delivered', cssModifier: 'delivered' },
  failed:    { label: 'Failed',    cssModifier: 'failed'    },
  retrying:  { label: 'Retrying',  cssModifier: 'retrying'  },
};

const CHANNEL_ICON = {
  push:   '📲',
  sms:    '💬',
  email:  '✉',
  'in-app': '🔔',
  voice:  '🔊',
};

function priorityConfig(k) { return PRIORITY_CONFIG[String(k ?? 'low').toLowerCase()] ?? PRIORITY_CONFIG.low; }
function statusConfig(k)   { return STATUS_CONFIG[String(k ?? 'unread').toLowerCase()] ?? STATUS_CONFIG.unread; }
function deliveryConfig(k) { return DELIVERY_CONFIG[String(k ?? 'pending').toLowerCase()] ?? DELIVERY_CONFIG.pending; }

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function relativeTime(iso) {
  if (!iso) return null;
  try {
    const diff = Date.now() - Date.parse(iso);
    if (Number.isNaN(diff)) return null;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d >= 1)  return `${d}d ago`;
    if (h >= 1)  return `${h}h ago`;
    if (m >= 1)  return `${m}m ago`;
    return 'Just now';
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationCard({
  notification,
  staleThreshold  = 60000,
  compact         = false,
  isLoading       = false,
  isStale: isStaleOverride = false,
  onOpen          = null,
  onAcknowledge   = null,
  onDismiss       = null,
}) {
  // ── uiStore selector (read-only) ─────────────────────────────────────────
  const selectedNotificationId = useUiStore((s) => s.selectedNotificationId);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isSelected = notification?.id === selectedNotificationId;
  const isStale    = isStaleOverride;
  const isEmpty    = !notification;

  const priCfg     = priorityConfig(notification?.priority);
  const statusCfg  = statusConfig(notification?.status);
  const delivCfg   = deliveryConfig(notification?.deliveryStatus);
  const channelIcon = CHANNEL_ICON[String(notification?.channel ?? 'in-app').toLowerCase()] ?? '🔔';
  const timeAgo    = relativeTime(notification?.sentAt);
  const isUnread   = String(notification?.status ?? '').toLowerCase() === 'unread';
  const isClickable = typeof onOpen === 'function';

  const audienceLabel = useMemo(() => {
    const arr = Array.isArray(notification?.audience) ? notification.audience : [];
    if (arr.length === 0) return null;
    return arr.slice(0, 3).join(', ') + (arr.length > 3 ? ` +${arr.length - 3}` : '');
  }, [notification?.audience]);

  if (isEmpty) {
    return (
      <div className="notification-card notification-card--empty" role="status" aria-label="No notification">
        No notification data.
      </div>
    );
  }

  return (
    <article
      className={[
        'notification-card',
        `notification-card--${priCfg.cssModifier}`,
        isUnread    ? 'notification-card--unread'    : null,
        isSelected  ? 'notification-card--selected'  : null,
        compact     ? 'notification-card--compact'   : null,
        isStale     ? 'notification-card--stale'     : null,
        isLoading   ? 'notification-card--loading'   : null,
        isClickable ? 'notification-card--clickable' : null,
      ].filter(Boolean).join(' ')}
      aria-label={`${priCfg.label} priority notification: ${notification.title}`}
      aria-selected={isSelected}
      role={isClickable ? 'button' : 'article'}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onOpen(notification) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(notification); } } : undefined}
    >
      {/* Priority stripe */}
      <div className={`notification-card__stripe notification-card__stripe--${priCfg.cssModifier}`} aria-hidden="true" />

      {/* Header row */}
      <div className="notification-card__header">
        <span
          className={`notification-card__priority notification-card__priority--${priCfg.cssModifier}`}
          aria-label={`Priority: ${priCfg.label}`}
        >
          <span aria-hidden="true">{priCfg.icon}</span> {priCfg.label}
        </span>
        <span className="notification-card__channel" aria-label={`Channel: ${notification.channel ?? 'in-app'}`}>
          <span aria-hidden="true">{channelIcon}</span>
          {!compact && <span>{notification.channel ?? 'in-app'}</span>}
        </span>
        {isUnread && <span className="notification-card__unread-dot" role="status" aria-label="Unread" />}
        {timeAgo && <span className="notification-card__time">{timeAgo}</span>}
      </div>

      {/* Title */}
      <div className="notification-card__title">{notification.title}</div>

      {/* Body excerpt (non-compact) */}
      {!compact && notification.body && (
        <div className="notification-card__body">{notification.body}</div>
      )}

      {/* Status + Delivery row */}
      <div className="notification-card__status-row">
        <span className={`notification-card__status notification-card__status--${statusCfg.cssModifier}`}
          aria-label={`Status: ${statusCfg.label}`}>{statusCfg.label}</span>
        <span className={`notification-card__delivery notification-card__delivery--${delivCfg.cssModifier}`}
          aria-label={`Delivery: ${delivCfg.label}`}>{delivCfg.label}</span>
      </div>

      {/* Audience */}
      {audienceLabel && (
        <div className="notification-card__audience" aria-label={`Audience: ${audienceLabel}`}>
          <span aria-hidden="true">👥</span> {audienceLabel}
        </div>
      )}

      {/* Stale / loading pills */}
      {(isStale || isLoading) && (
        <div className="notification-card__pills">
          {isLoading && <span className="train-pill" role="status">Loading</span>}
          {isStale   && <span className="train-pill train-pill--stale" role="status">Stale</span>}
        </div>
      )}

      {/* Action bar (non-compact) */}
      {!compact && (typeof onAcknowledge === 'function' || typeof onDismiss === 'function') && (
        <div className="notification-card__actions" role="group" aria-label="Notification actions">
          {typeof onAcknowledge === 'function' && notification.status !== 'acknowledged' && (
            <button type="button" className="notification-card__btn notification-card__btn--ack"
              aria-label="Acknowledge notification"
              onClick={(e) => { e.stopPropagation(); onAcknowledge(notification); }}>
              Acknowledge
            </button>
          )}
          {typeof onDismiss === 'function' && notification.status !== 'dismissed' && (
            <button type="button" className="notification-card__btn notification-card__btn--dismiss"
              aria-label="Dismiss notification"
              onClick={(e) => { e.stopPropagation(); onDismiss(notification); }}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </article>
  );
});

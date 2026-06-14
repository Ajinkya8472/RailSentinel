import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * NotificationTimeline — chronological event log for M5 Notifications &
 * Communications. Synthesises a time-ordered event stream from the Notification
 * domain model fields:
 *
 *   1. Sent          — `sentAt` exists
 *   2. Delivered     — `deliveryStatus`: 'delivered' (uses `deliveredAt`)
 *   3. Read          — `status`: 'read' (uses `readAt`)
 *   4. Acknowledged  — `status`: 'acknowledged' (uses `acknowledgedAt`)
 *   5. Dismissed     — `status`: 'dismissed' (uses `dismissedAt`)
 *   6. Failed        — `deliveryStatus`: 'failed'
 *   7. Retrying      — `deliveryStatus`: 'retrying'
 *   8. Escalated     — `escalationLevel` > 0 (uses `escalatedAt`)
 *
 * Supports both single-notification and multi-notification modes.
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `notification`     (object|null)  — single anchor notification (default: null)
 * - `notifications`    (object[])     — list mode (default: [])
 * - `layout`           ('detail'|'split'|null) (default: null)
 * - `title`            (string|null)  (default: null)
 * - `loading`          (boolean)      (default: false)
 * - `syncing`          (boolean)      (default: false)
 * - `isStale`          (boolean)      (default: false)
 * - `error`            (any)          (default: null)
 * - `maxEvents`        (number)       (default: 50)
 * - `filter`           (string[])     — event type filter (default: [])
 * - `compact`          (boolean)      (default: false)
 * - `onRetry`          (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Event synthesis
// ---------------------------------------------------------------------------

const EVENT_TYPE_CONFIG = {
  sent:        { label: 'Sent',        icon: '→', cssModifier: 'sent'        },
  delivered:   { label: 'Delivered',   icon: '✓', cssModifier: 'delivered'   },
  read:        { label: 'Read',        icon: '👁', cssModifier: 'read'        },
  acknowledged:{ label: 'Acknowledged',icon: '✔', cssModifier: 'acknowledged'},
  dismissed:   { label: 'Dismissed',   icon: '—', cssModifier: 'dismissed'   },
  failed:      { label: 'Failed',      icon: '✕', cssModifier: 'failed'      },
  retrying:    { label: 'Retrying',    icon: '↺', cssModifier: 'retrying'    },
  escalated:   { label: 'Escalated',   icon: '▲', cssModifier: 'escalated'   },
};

function evtConfig(type) { return EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.sent; }

function extractEvents(n) {
  if (!n) return [];
  const events = [];

  if (n.sentAt)        events.push({ key: `sent-${n.id}`,        type: 'sent',         ts: n.sentAt,        notification: n });
  if (n.deliveredAt)   events.push({ key: `delivered-${n.id}`,   type: 'delivered',    ts: n.deliveredAt,   notification: n });
  if (n.readAt)        events.push({ key: `read-${n.id}`,        type: 'read',         ts: n.readAt,        notification: n });
  if (n.acknowledgedAt) events.push({ key: `acknowledged-${n.id}`,type: 'acknowledged', ts: n.acknowledgedAt,notification: n });
  if (n.dismissedAt)   events.push({ key: `dismissed-${n.id}`,   type: 'dismissed',    ts: n.dismissedAt,   notification: n });

  const delivery = String(n.deliveryStatus ?? '').toLowerCase();
  if (delivery === 'failed'   && !n.deliveredAt) events.push({ key: `failed-${n.id}`,   type: 'failed',   ts: n.sentAt ?? null, notification: n });
  if (delivery === 'retrying' && !n.deliveredAt) events.push({ key: `retrying-${n.id}`, type: 'retrying', ts: n.sentAt ?? null, notification: n });

  if (n.escalationLevel && n.escalationLevel > 0) {
    events.push({ key: `escalated-${n.id}`, type: 'escalated', ts: n.escalatedAt ?? n.sentAt ?? null, notification: n });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="notification-timeline__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing  && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale  && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error    && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EventRow({ event, compact, rowId }) {
  const cfg = evtConfig(event.type);
  const d   = event.ts ? new Date(event.ts) : null;
  const timeStr = d && !Number.isNaN(d.getTime())
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;
  const dateStr = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;

  return (
    <li
      id={rowId}
      className={[
        'notification-timeline__event',
        `notification-timeline__event--${cfg.cssModifier}`,
        compact ? 'notification-timeline__event--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${cfg.label}: ${event.notification?.title ?? event.key}`}
    >
      <div className="notification-timeline__event-time">
        {dateStr && <span className="notification-timeline__event-date">{dateStr}</span>}
        {timeStr && <span className="notification-timeline__event-clock">{timeStr}</span>}
      </div>
      <div className="notification-timeline__event-connector" aria-hidden="true">
        <span className={`notification-timeline__event-dot notification-timeline__event-dot--${cfg.cssModifier}`}>{cfg.icon}</span>
        <div className="notification-timeline__event-line" />
      </div>
      <div className="notification-timeline__event-body">
        <div className="notification-timeline__event-title">{event.notification?.title ?? event.key}</div>
        <div className="notification-timeline__event-type">{cfg.label}</div>
        {!compact && event.notification?.channel && (
          <div className="notification-timeline__event-channel">via {event.notification.channel}</div>
        )}
      </div>
    </li>
  );
}

function TypeSummaryRail({ events }) {
  const counts = {};
  for (const e of events) { counts[e.type] = (counts[e.type] ?? 0) + 1; }
  return (
    <div className="notification-timeline__rail" aria-label="Event type summary">
      {Object.entries(EVENT_TYPE_CONFIG).map(([type, cfg]) =>
        counts[type] ? (
          <div key={type} className={`notification-timeline__rail-row notification-timeline__rail-row--${cfg.cssModifier}`}>
            <span aria-hidden="true">{cfg.icon}</span>
            <span>{cfg.label}</span>
            <span className="notification-timeline__rail-count">{counts[type]}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationTimeline({
  notification     = null,
  notifications    = [],
  layout           = null,
  title            = null,
  loading          = false,
  syncing          = false,
  isStale          = false,
  error            = null,
  maxEvents        = 50,
  filter           = [],
  compact          = false,
  onRetry          = null,
}) {
  const source = useMemo(() => {
    if (notification) return [notification];
    return notifications;
  }, [notification, notifications]);

  const allEvents = useMemo(() =>
    source.flatMap(extractEvents)
      .sort((a, b) => String(b.ts ?? '').localeCompare(String(a.ts ?? ''))),
  [source]);

  const events = useMemo(() => {
    const active = Array.isArray(filter) ? filter.filter(Boolean) : [];
    const filtered = active.length > 0 ? allEvents.filter((e) => active.includes(e.type)) : allEvents;
    return filtered.slice(0, maxEvents);
  }, [allEvents, filter, maxEvents]);

  const isEmpty       = events.length === 0 && !loading;
  const resolvedTitle = title ?? (notification?.title ? `Timeline — ${notification.title}` : 'Notification Timeline');
  const listId        = useId();

  const eventList = (
    <div
      className={[
        'notification-timeline',
        compact ? 'notification-timeline--compact' : null,
        isStale ? 'notification-timeline--stale'   : null,
        error   ? 'notification-timeline--error'   : null,
        syncing ? 'notification-timeline--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-timeline__empty" role="status">No notification events.</div>
      ) : (
        <ol id={listId} className="notification-timeline__list"
          aria-label={`${events.length} notification event${events.length !== 1 ? 's' : ''}`}>
          {events.map((evt) => (
            <EventRow key={evt.key} rowId={`${listId}-${evt.key}`} event={evt} compact={compact} />
          ))}
        </ol>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div className="notification-timeline__detail-summary">{events.length} events<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={eventList}
        rail={<TypeSummaryRail events={allEvents} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && !isEmpty}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={eventList}
        right={<TypeSummaryRail events={allEvents} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return eventList;
});

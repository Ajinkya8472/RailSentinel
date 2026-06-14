import React, { memo, useMemo, useCallback } from 'react';
import useUiStore from '../../store/uiStore';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import NotificationKPIs from './NotificationKPIs';
import NotificationCard from './NotificationCard';

/**
 * Purpose:
 * NotificationDashboard — primary orchestration surface for M5 Notifications &
 * Communications. Assembles DashboardLayout with four coordinated sections:
 *
 *   1. KPI Strip          — NotificationKPIs aggregate tile bar
 *   2. Critical Board     — priority: 'critical' unread notifications
 *   3. High Board         — priority: 'high' unread notifications
 *   4. Delivery Failures  — deliveryStatus: 'failed' or 'retrying' notifications
 *
 * Caller is responsible for sourcing `notifications` from the notification
 * service layer. This component is strictly display-only — no service calls.
 *
 * The `useUiStore` integration: reads `selectedNotificationId` (passed to
 * NotificationCard for active highlight) and `notificationCenterOpen`.
 *
 * Dependencies:
 * - React (memo, useMemo, useCallback)
 * - `src/store/uiStore` (Zustand — read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./NotificationKPIs`
 * - `./NotificationCard`
 *
 * Props:
 * - `notifications`    (object[])  — Notification entity array (default: [])
 * - `loading`          (boolean)   (default: false)
 * - `refreshing`       (boolean)   (default: false)
 * - `syncing`          (boolean)   (default: false)
 * - `error`            (any)       (default: null)
 * - `isStale`          (boolean)   (default: false)
 * - `layout`           ('detail'|'split'|null) (default: null)
 * - `title`            (string|null) (default: null)
 * - `maxCritical`      (number)    (default: 6)
 * - `maxHigh`          (number)    (default: 6)
 * - `maxFailed`        (number)    (default: 6)
 * - `compact`          (boolean)   (default: false)
 * - `onNotificationOpen`   (fn|null) — card open callback
 * - `onNotificationAcknowledge` (fn|null)
 * - `onNotificationDismiss`     (fn|null)
 * - `onRetry`          (fn|null)   (default: null)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
function priRank(k) { return PRIORITY_RANK[String(k ?? 'low').toLowerCase()] ?? 0; }

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="notification-dashboard__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function NotificationBoard({ id, title, notifications, compact, onOpen, onAcknowledge, onDismiss, emptyMsg }) {
  if (notifications.length === 0) return (
    <section id={id} className="notification-dashboard__board notification-dashboard__board--empty" aria-label={title}>
      <h3 className="notification-dashboard__board-title">{title}</h3>
      <div className="notification-dashboard__board-empty" role="status">{emptyMsg ?? 'No notifications.'}</div>
    </section>
  );
  return (
    <section id={id} className="notification-dashboard__board" aria-label={title}>
      <h3 className="notification-dashboard__board-title">
        {title} <span className="notification-dashboard__board-count">{notifications.length}</span>
      </h3>
      <div className="notification-dashboard__card-grid" role="list">
        {notifications.map((n) => (
          <div key={n.id} role="listitem">
            <NotificationCard
              notification={n}
              compact={compact}
              onOpen={onOpen}
              onAcknowledge={onAcknowledge}
              onDismiss={onDismiss}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationDashboard({
  notifications          = [],
  loading                = false,
  refreshing             = false,
  syncing                = false,
  error                  = null,
  isStale                = false,
  layout                 = null,
  title                  = null,
  maxCritical            = 6,
  maxHigh                = 6,
  maxFailed              = 6,
  compact                = false,
  onNotificationOpen     = null,
  onNotificationAcknowledge = null,
  onNotificationDismiss  = null,
  onRetry                = null,
}) {
  const resolvedTitle = title ?? 'Notifications Dashboard';

  // ── uiStore (read-only) ───────────────────────────────────────────────────
  const notificationCenterOpen = useUiStore((s) => s.notificationCenterOpen);

  // ── Derived boards ────────────────────────────────────────────────────────
  const critical = useMemo(() =>
    notifications
      .filter((n) => String(n.priority ?? '').toLowerCase() === 'critical' && String(n.status ?? '').toLowerCase() === 'unread')
      .sort((a, b) => String(b.sentAt ?? '').localeCompare(String(a.sentAt ?? '')))
      .slice(0, maxCritical),
  [notifications, maxCritical]);

  const high = useMemo(() =>
    notifications
      .filter((n) => String(n.priority ?? '').toLowerCase() === 'high' && String(n.status ?? '').toLowerCase() === 'unread')
      .sort((a, b) => String(b.sentAt ?? '').localeCompare(String(a.sentAt ?? '')))
      .slice(0, maxHigh),
  [notifications, maxHigh]);

  const failed = useMemo(() =>
    notifications
      .filter((n) => ['failed', 'retrying'].includes(String(n.deliveryStatus ?? '').toLowerCase()))
      .sort((a, b) => String(b.sentAt ?? '').localeCompare(String(a.sentAt ?? '')))
      .slice(0, maxFailed),
  [notifications, maxFailed]);

  const isEmpty = notifications.length === 0 && !loading;

  const body = (
    <div
      className={[
        'notification-dashboard',
        compact ? 'notification-dashboard--compact' : null,
        isStale ? 'notification-dashboard--stale'   : null,
        error   ? 'notification-dashboard--error'   : null,
        syncing ? 'notification-dashboard--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-dashboard__empty" role="status">No notifications available.</div>
      ) : (
        <>
          <NotificationKPIs
            notifications={notifications}
            loading={loading}
            refreshing={refreshing}
            syncing={syncing}
            error={error}
            isStale={isStale}
            compact={compact}
          />
          <NotificationBoard
            id="notif-board-critical"
            title="Critical"
            notifications={critical}
            compact={compact}
            onOpen={onNotificationOpen}
            onAcknowledge={onNotificationAcknowledge}
            onDismiss={onNotificationDismiss}
            emptyMsg="No critical unread notifications."
          />
          <NotificationBoard
            id="notif-board-high"
            title="High Priority"
            notifications={high}
            compact={compact}
            onOpen={onNotificationOpen}
            onAcknowledge={onNotificationAcknowledge}
            onDismiss={onNotificationDismiss}
            emptyMsg="No high priority unread notifications."
          />
          <NotificationBoard
            id="notif-board-failed"
            title="Delivery Failures"
            notifications={failed}
            compact={compact}
            onOpen={onNotificationOpen}
            onAcknowledge={onNotificationAcknowledge}
            onDismiss={onNotificationDismiss}
            emptyMsg="No delivery failures."
          />
        </>
      )}
    </div>
  );

  const summarySlot = (
    <div className="notification-dashboard__detail-summary">
      <span>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</span>
      {critical.length > 0 && <span className="notification-dashboard__detail-critical">{critical.length} critical</span>}
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={summarySlot}
        body={body}
        rail={<NotificationKPIs notifications={notifications} compact={true} />}
        footer={null}
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
        header={null}
        left={body}
        right={<NotificationKPIs notifications={notifications} compact={true} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

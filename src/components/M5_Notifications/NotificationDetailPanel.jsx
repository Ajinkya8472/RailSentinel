import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import NotificationStatusBadge from './NotificationStatusBadge';

/**
 * Purpose:
 * NotificationDetailPanel — canonical single-entity deep-review surface for
 * Module-5 Notifications & Communications. Renders the complete operational
 * profile of one Notification entity across all DetailLayout slots.
 *
 * Content regions:
 *
 *   Header slot  — title, priority badge, channel icon, status badge,
 *                  live/stale pills.
 *
 *   Summary slot — delivery status, audience count, sentAt time, and locale.
 *
 *   Body         — four stacked sections:
 *     1. Content Detail     — title, body, locale, template
 *     2. Delivery Status    — deliveryStatus, channel, sentAt, deliveredAt,
 *                            failureReason, retryCount
 *     3. Recipient Status   — status, readAt, acknowledgedAt, dismissedAt,
 *                            escalationLevel
 *     4. Audience & Routing — audience[], targetRoles[], targetGroups[],
 *                            linkedEntityType / linkedEntityId
 *
 *   Rail slot    — notification metadata: ID, priority, template,
 *                  createdAt, sentAt, lastUpdatedAt.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./NotificationStatusBadge`
 *
 * Props:
 * - `notification`   (object|null)  (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `loading`        (boolean)      (default: false)
 * - `syncing`        (boolean)      (default: false)
 * - `isStale`        (boolean)      (default: false)
 * - `error`          (any)          (default: null)
 * - `compact`        (boolean)      (default: false)
 * - `onRetry`        (fn|null)      (default: null)
 * - `onAcknowledge`  (fn|null)      (default: null)
 * - `onDismiss`      (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG = {
  low:      { label: 'Low',      cssModifier: 'low',      icon: '○' },
  medium:   { label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { label: 'Critical', cssModifier: 'critical', icon: '✕' },
};

const CHANNEL_ICON = { push: '📲', sms: '💬', email: '✉', 'in-app': '🔔', voice: '🔊' };

function priConfig(k) { return PRIORITY_CONFIG[String(k ?? 'low').toLowerCase()] ?? PRIORITY_CONFIG.low; }

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
    <div className="notification-detail-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EntityHeader({ notification, syncing, isStale }) {
  const priCfg    = priConfig(notification?.priority);
  const chanIcon  = CHANNEL_ICON[String(notification?.channel ?? 'in-app').toLowerCase()] ?? '🔔';
  return (
    <div className="notification-detail-panel__entity-header" aria-label="Notification entity header">
      <span className={`notification-detail-panel__entity-priority notification-detail-panel__entity-priority--${priCfg.cssModifier}`}
        aria-label={`Priority: ${priCfg.label}`}>
        <span aria-hidden="true">{priCfg.icon}</span> {priCfg.label}
      </span>
      <span className="notification-detail-panel__entity-channel" aria-label={`Channel: ${notification?.channel ?? 'in-app'}`}>
        <span aria-hidden="true">{chanIcon}</span> {notification?.channel ?? 'in-app'}
      </span>
      <NotificationStatusBadge notification={notification} isStale={isStale} showLabel={true} />
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
    </div>
  );
}

function KeyMetricsSummary({ notification }) {
  const audience = Array.isArray(notification?.audience) ? notification.audience : [];
  return (
    <div className="notification-detail-panel__summary-grid" aria-label="Key notification metrics">
      <div className="notification-detail-panel__summary-metric"
        aria-label={`Delivery: ${notification?.deliveryStatus ?? '—'}`}>
        <span className="notification-detail-panel__summary-value">{notification?.deliveryStatus ?? '—'}</span>
        <span className="notification-detail-panel__summary-label">Delivery</span>
      </div>
      <div className="notification-detail-panel__summary-metric"
        aria-label={`Audience: ${audience.length} recipients`}>
        <span className="notification-detail-panel__summary-value">{audience.length}</span>
        <span className="notification-detail-panel__summary-label">Recipients</span>
      </div>
      <div className="notification-detail-panel__summary-metric"
        aria-label={`Sent: ${formatWhen(notification?.sentAt) ?? '—'}`}>
        <span className="notification-detail-panel__summary-value">{formatWhen(notification?.sentAt) ?? '—'}</span>
        <span className="notification-detail-panel__summary-label">Sent</span>
      </div>
      {notification?.locale && (
        <div className="notification-detail-panel__summary-metric" aria-label={`Locale: ${notification.locale}`}>
          <span className="notification-detail-panel__summary-value">{notification.locale}</span>
          <span className="notification-detail-panel__summary-label">Locale</span>
        </div>
      )}
    </div>
  );
}

function ContentDetailSection({ notification, compact }) {
  return (
    <section className="notification-detail-panel__section" aria-label="Content Detail">
      <h3 className="notification-detail-panel__section-title">Content</h3>
      <dl className="notification-detail-panel__field-list">
        <dt>Title</dt><dd>{notification?.title ?? '—'}</dd>
        {notification?.body && <><dt>Body</dt><dd>{notification.body}</dd></>}
        {notification?.locale && <><dt>Locale</dt><dd>{notification.locale}</dd></>}
        {notification?.template && <><dt>Template</dt><dd>{notification.template}</dd></>}
      </dl>
    </section>
  );
}

function DeliverySection({ notification, compact }) {
  return (
    <section className="notification-detail-panel__section" aria-label="Delivery Status">
      <h3 className="notification-detail-panel__section-title">Delivery</h3>
      <dl className="notification-detail-panel__field-list">
        <dt>Status</dt>
        <dd>
          <span className={`notification-detail-panel__delivery-chip notification-detail-panel__delivery-chip--${String(notification?.deliveryStatus ?? 'pending').toLowerCase()}`}>
            {notification?.deliveryStatus ?? 'pending'}
          </span>
        </dd>
        {notification?.channel && <><dt>Channel</dt><dd>{notification.channel}</dd></>}
        {notification?.sentAt && <><dt>Sent At</dt><dd>{formatWhen(notification.sentAt)}</dd></>}
        {notification?.deliveredAt && <><dt>Delivered At</dt><dd>{formatWhen(notification.deliveredAt)}</dd></>}
        {!compact && notification?.failureReason && <><dt>Failure Reason</dt><dd>{notification.failureReason}</dd></>}
        {!compact && notification?.retryCount != null && <><dt>Retry Count</dt><dd>{notification.retryCount}</dd></>}
      </dl>
    </section>
  );
}

function RecipientStatusSection({ notification, compact, onAcknowledge, onDismiss }) {
  return (
    <section className="notification-detail-panel__section" aria-label="Recipient Status">
      <h3 className="notification-detail-panel__section-title">Recipient Status</h3>
      <dl className="notification-detail-panel__field-list">
        <dt>Status</dt>
        <dd>
          <span className={`notification-detail-panel__status-chip notification-detail-panel__status-chip--${String(notification?.status ?? 'unread').toLowerCase()}`}>
            {notification?.status ?? 'unread'}
          </span>
        </dd>
        {notification?.readAt          && <><dt>Read At</dt><dd>{formatWhen(notification.readAt)}</dd></>}
        {notification?.acknowledgedAt  && <><dt>Acknowledged At</dt><dd>{formatWhen(notification.acknowledgedAt)}</dd></>}
        {notification?.dismissedAt     && <><dt>Dismissed At</dt><dd>{formatWhen(notification.dismissedAt)}</dd></>}
        {notification?.escalationLevel != null && notification.escalationLevel > 0 && (
          <><dt>Escalation Level</dt><dd>{notification.escalationLevel}</dd></>
        )}
      </dl>
      {(typeof onAcknowledge === 'function' || typeof onDismiss === 'function') && (
        <div className="notification-detail-panel__actions" role="group" aria-label="Notification actions">
          {typeof onAcknowledge === 'function' && notification?.status !== 'acknowledged' && (
            <button type="button" className="notification-detail-panel__btn notification-detail-panel__btn--ack"
              onClick={() => onAcknowledge(notification)}>Acknowledge</button>
          )}
          {typeof onDismiss === 'function' && notification?.status !== 'dismissed' && (
            <button type="button" className="notification-detail-panel__btn notification-detail-panel__btn--dismiss"
              onClick={() => onDismiss(notification)}>Dismiss</button>
          )}
        </div>
      )}
    </section>
  );
}

function AudienceSection({ notification, compact }) {
  const audience     = Array.isArray(notification?.audience)     ? notification.audience     : [];
  const targetRoles  = Array.isArray(notification?.targetRoles)  ? notification.targetRoles  : [];
  const targetGroups = Array.isArray(notification?.targetGroups) ? notification.targetGroups : [];

  return (
    <section className="notification-detail-panel__section" aria-label="Audience and Routing">
      <h3 className="notification-detail-panel__section-title">Audience & Routing</h3>

      {audience.length > 0 && (
        <div className="notification-detail-panel__audience-group">
          <div className="notification-detail-panel__field-label">Recipients ({audience.length})</div>
          <div className="notification-detail-panel__audience-chips" role="list">
            {audience.slice(0, 12).map((a, idx) => (
              <span key={idx} className="notification-detail-panel__audience-chip" role="listitem">{a}</span>
            ))}
            {audience.length > 12 && <span className="notification-detail-panel__audience-chip notification-detail-panel__audience-chip--overflow">+{audience.length - 12}</span>}
          </div>
        </div>
      )}
      {!compact && targetRoles.length > 0 && (
        <div className="notification-detail-panel__audience-group">
          <div className="notification-detail-panel__field-label">Target Roles</div>
          <div className="notification-detail-panel__audience-chips" role="list">
            {targetRoles.map((r, idx) => <span key={idx} className="notification-detail-panel__role-chip" role="listitem">{r}</span>)}
          </div>
        </div>
      )}
      {!compact && targetGroups.length > 0 && (
        <div className="notification-detail-panel__audience-group">
          <div className="notification-detail-panel__field-label">Target Groups</div>
          <div className="notification-detail-panel__audience-chips" role="list">
            {targetGroups.map((g, idx) => <span key={idx} className="notification-detail-panel__group-chip" role="listitem">{g}</span>)}
          </div>
        </div>
      )}
      {notification?.linkedEntityType && (
        <div className="notification-detail-panel__field-label">
          Linked: {notification.linkedEntityType} {notification.linkedEntityId ? `— ${notification.linkedEntityId}` : ''}
        </div>
      )}
    </section>
  );
}

function MetadataRail({ notification }) {
  return (
    <div className="notification-detail-panel__rail" aria-label="Notification metadata">
      <div className="notification-detail-panel__rail-title">Notification Metadata</div>
      <dl className="notification-detail-panel__rail-dl">
        {notification?.id        && <><dt>ID</dt><dd className="notification-detail-panel__rail-id">{notification.id}</dd></>}
        {notification?.priority  && <><dt>Priority</dt><dd>{notification.priority}</dd></>}
        {notification?.template  && <><dt>Template</dt><dd>{notification.template}</dd></>}
        {notification?.createdAt && <><dt>Created</dt><dd>{formatWhen(notification.createdAt)}</dd></>}
        {notification?.sentAt    && <><dt>Sent</dt><dd>{formatWhen(notification.sentAt)}</dd></>}
        {notification?.lastUpdatedAt && <><dt>Updated</dt><dd>{formatWhen(notification.lastUpdatedAt)}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationDetailPanel({
  notification   = null,
  layout         = null,
  title          = null,
  loading        = false,
  syncing        = false,
  isStale        = false,
  error          = null,
  compact        = false,
  onRetry        = null,
  onAcknowledge  = null,
  onDismiss      = null,
}) {
  const isEmpty       = !notification && !loading;
  const resolvedTitle = title ?? (notification?.title ?? 'Notification Detail');

  const headerSlot  = notification ? <EntityHeader notification={notification} syncing={syncing} isStale={isStale} /> : null;
  const summarySlot = notification ? <KeyMetricsSummary notification={notification} /> : null;
  const railSlot    = notification ? <MetadataRail notification={notification} /> : null;

  const body = (
    <div
      className={[
        'notification-detail-panel',
        compact ? 'notification-detail-panel--compact' : null,
        isStale ? 'notification-detail-panel--stale'   : null,
        error   ? 'notification-detail-panel--error'   : null,
        syncing ? 'notification-detail-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="notification-detail-panel__empty" role="status">No notification selected.</div>
      ) : (
        <>
          <ContentDetailSection  notification={notification} compact={compact} />
          <DeliverySection       notification={notification} compact={compact} />
          <RecipientStatusSection notification={notification} compact={compact} onAcknowledge={onAcknowledge} onDismiss={onDismiss} />
          <AudienceSection       notification={notification} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={headerSlot}
        summary={summarySlot}
        body={body}
        rail={railSlot}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(notification)}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={headerSlot}
        left={body}
        right={railSlot}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

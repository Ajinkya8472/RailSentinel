import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * NotificationDeliveryPanel — deep-review delivery analytics surface for M5.
 * Derives delivery funnel metrics across one or multiple Notification entities:
 *
 *   Funnel stages: pending → sent → delivered → read → acknowledged
 *   Failure track: sent → failed / retrying
 *
 * Sections:
 *   1. Delivery Funnel     — visual step funnel showing count and % at each stage
 *   2. Channel Breakdown   — per-channel delivery success / failure counts
 *   3. Failure Detail      — failed/retrying notifications with failureReason and
 *                           retryCount
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `notification`    (object|null)  — single notification (default: null)
 * - `notifications`   (object[])     — list mode (default: [])
 * - `layout`          ('detail'|'split'|null) (default: null)
 * - `title`           (string|null)  (default: null)
 * - `loading`         (boolean)      (default: false)
 * - `syncing`         (boolean)      (default: false)
 * - `isStale`         (boolean)      (default: false)
 * - `error`           (any)          (default: null)
 * - `compact`         (boolean)      (default: false)
 * - `onRetry`         (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const FUNNEL_STAGES = ['pending', 'sent', 'delivered', 'read', 'acknowledged'];
const CHANNEL_ORDER = ['in-app', 'push', 'sms', 'email', 'voice'];

function computeDeliveryStats(notifications) {
  const stageCounts = { pending: 0, sent: 0, delivered: 0, read: 0, acknowledged: 0, failed: 0, retrying: 0 };
  const channelMap  = {};
  const failures    = [];

  for (const n of notifications) {
    const delivery = String(n.deliveryStatus ?? 'pending').toLowerCase();
    const status   = String(n.status ?? 'unread').toLowerCase();
    const channel  = String(n.channel ?? 'in-app').toLowerCase();

    // Funnel: count each stage a notification has *passed through*
    if (['pending','sent','delivered','read','acknowledged','failed','retrying'].includes(delivery)) {
      if (delivery === 'failed')   { stageCounts.failed   += 1; stageCounts.sent += 1; }
      else if (delivery === 'retrying') { stageCounts.retrying += 1; stageCounts.sent += 1; }
      else {
        const dIdx = FUNNEL_STAGES.indexOf(delivery);
        for (let i = 0; i <= dIdx; i++) stageCounts[FUNNEL_STAGES[i]] += 1;
        // status-based overrides
        if (['read','acknowledged'].includes(status)) {
          stageCounts.read += 1;
          if (status === 'acknowledged') stageCounts.acknowledged += 1;
        }
      }
    } else {
      stageCounts.pending += 1;
    }

    // Channel
    if (!channelMap[channel]) channelMap[channel] = { sent: 0, delivered: 0, failed: 0 };
    channelMap[channel].sent += 1;
    if (delivery === 'delivered') channelMap[channel].delivered += 1;
    if (delivery === 'failed')    channelMap[channel].failed    += 1;

    if (delivery === 'failed' || delivery === 'retrying') failures.push(n);
  }

  return { stageCounts, channelMap, failures, total: notifications.length };
}

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
    <div className="notification-delivery-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function DeliveryFunnel({ stageCounts, total }) {
  const stages = [
    { key: 'pending',      label: 'Pending',      cssModifier: 'pending'      },
    { key: 'sent',         label: 'Sent',         cssModifier: 'sent'         },
    { key: 'delivered',    label: 'Delivered',    cssModifier: 'delivered'    },
    { key: 'read',         label: 'Read',         cssModifier: 'read'         },
    { key: 'acknowledged', label: 'Acknowledged', cssModifier: 'acknowledged' },
  ];
  return (
    <div className="notification-delivery-panel__funnel" aria-label="Delivery funnel">
      {stages.map((s) => {
        const count = stageCounts[s.key] ?? 0;
        const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={s.key} className={`notification-delivery-panel__funnel-stage notification-delivery-panel__funnel-stage--${s.cssModifier}`}
            aria-label={`${s.label}: ${count} (${pct}%)`}>
            <div className="notification-delivery-panel__funnel-bar"
              style={{ width: `${pct}%` }} aria-hidden="true" />
            <div className="notification-delivery-panel__funnel-label">{s.label}</div>
            <div className="notification-delivery-panel__funnel-count">{count}</div>
            <div className="notification-delivery-panel__funnel-pct">{pct}%</div>
          </div>
        );
      })}
      {(stageCounts.failed > 0 || stageCounts.retrying > 0) && (
        <div className="notification-delivery-panel__funnel-stage notification-delivery-panel__funnel-stage--failed"
          aria-label={`Failed: ${stageCounts.failed} | Retrying: ${stageCounts.retrying}`}>
          <div className="notification-delivery-panel__funnel-label">⚠ Failed / Retrying</div>
          <div className="notification-delivery-panel__funnel-count">{stageCounts.failed + stageCounts.retrying}</div>
        </div>
      )}
    </div>
  );
}

function ChannelBreakdown({ channelMap }) {
  const channels = Object.entries(channelMap).sort((a, b) => b[1].sent - a[1].sent);
  if (channels.length === 0) return null;
  return (
    <section className="notification-delivery-panel__section" aria-label="Channel Breakdown">
      <h3 className="notification-delivery-panel__section-title">Channel Breakdown</h3>
      <table className="notification-delivery-panel__channel-table" role="table">
        <thead>
          <tr>
            <th scope="col">Channel</th>
            <th scope="col">Sent</th>
            <th scope="col">Delivered</th>
            <th scope="col">Failed</th>
          </tr>
        </thead>
        <tbody>
          {channels.map(([channel, counts]) => (
            <tr key={channel} className={`notification-delivery-panel__channel-row ${counts.failed > 0 ? 'notification-delivery-panel__channel-row--has-failures' : ''}`}>
              <td>{channel}</td>
              <td>{counts.sent}</td>
              <td className={counts.delivered > 0 ? 'notification-delivery-panel__cell--ok' : ''}>{counts.delivered}</td>
              <td className={counts.failed > 0 ? 'notification-delivery-panel__cell--failed' : ''}>{counts.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FailureDetail({ failures, compact }) {
  if (failures.length === 0) return null;
  return (
    <section className="notification-delivery-panel__section" aria-label="Delivery Failures">
      <h3 className="notification-delivery-panel__section-title">
        Delivery Failures <span className="notification-delivery-panel__section-badge">{failures.length}</span>
      </h3>
      <ul className="notification-delivery-panel__failure-list">
        {failures.slice(0, 10).map((n) => (
          <li key={n.id} className="notification-delivery-panel__failure-row"
            aria-label={`${n.title}: ${n.deliveryStatus}${n.failureReason ? ` — ${n.failureReason}` : ''}`}>
            <span className={`notification-delivery-panel__failure-status notification-delivery-panel__failure-status--${String(n.deliveryStatus).toLowerCase()}`}>
              {n.deliveryStatus}
            </span>
            <span className="notification-delivery-panel__failure-title">{n.title}</span>
            {!compact && n.failureReason && (
              <span className="notification-delivery-panel__failure-reason">{n.failureReason}</span>
            )}
            {!compact && n.retryCount != null && (
              <span className="notification-delivery-panel__failure-retries">Retries: {n.retryCount}</span>
            )}
            {!compact && n.sentAt && <span className="notification-delivery-panel__failure-ts">{formatWhen(n.sentAt)}</span>}
          </li>
        ))}
        {failures.length > 10 && (
          <li className="notification-delivery-panel__failure-overflow">+{failures.length - 10} more</li>
        )}
      </ul>
    </section>
  );
}

function DeliveryRailSummary({ stats }) {
  const successRate = stats.total > 0
    ? Math.round((stats.stageCounts.delivered / stats.total) * 100) : 0;
  return (
    <div className="notification-delivery-panel__rail" aria-label="Delivery summary">
      <div className="notification-delivery-panel__rail-title">Delivery Summary</div>
      <dl className="notification-delivery-panel__rail-dl">
        <dt>Total</dt><dd>{stats.total}</dd>
        <dt>Delivered</dt><dd className="notification-delivery-panel__rail-val--ok">{stats.stageCounts.delivered}</dd>
        <dt>Failed</dt><dd className={stats.stageCounts.failed > 0 ? 'notification-delivery-panel__rail-val--failed' : ''}>{stats.stageCounts.failed}</dd>
        <dt>Success Rate</dt><dd>{successRate}%</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationDeliveryPanel({
  notification   = null,
  notifications  = [],
  layout         = null,
  title          = null,
  loading        = false,
  syncing        = false,
  isStale        = false,
  error          = null,
  compact        = false,
  onRetry        = null,
}) {
  const source = useMemo(() => {
    if (notification) return [notification];
    return notifications;
  }, [notification, notifications]);

  const stats   = useMemo(() => computeDeliveryStats(source), [source]);
  const isEmpty = source.length === 0 && !loading;
  const resolvedTitle = title ?? 'Delivery Status';

  const body = (
    <div
      className={[
        'notification-delivery-panel',
        compact ? 'notification-delivery-panel--compact' : null,
        isStale ? 'notification-delivery-panel--stale'   : null,
        error   ? 'notification-delivery-panel--error'   : null,
        syncing ? 'notification-delivery-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-delivery-panel__empty" role="status">No delivery data.</div>
      ) : (
        <>
          <section className="notification-delivery-panel__section" aria-label="Delivery Funnel">
            <h3 className="notification-delivery-panel__section-title">Delivery Funnel</h3>
            <DeliveryFunnel stageCounts={stats.stageCounts} total={stats.total} />
          </section>
          <ChannelBreakdown channelMap={stats.channelMap} />
          <FailureDetail failures={stats.failures} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{stats.total} notifications<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<DeliveryRailSummary stats={stats} />}
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
        left={body}
        right={<DeliveryRailSummary stats={stats} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

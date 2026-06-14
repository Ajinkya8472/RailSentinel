import React, { memo, useMemo, useId } from 'react';

/**
 * Purpose:
 * NotificationKPIs — aggregate KPI surface for Module-5 Notifications &
 * Communications. Derives and displays seven key performance indicators from
 * a provided `notifications` list:
 *
 *   1. Total Notifications — total count
 *   2. Unread              — status: 'unread' count
 *   3. Critical            — priority: 'critical' count
 *   4. Failed Deliveries   — deliveryStatus: 'failed' count
 *   5. Acknowledged        — status: 'acknowledged' count
 *   6. Channels Active     — unique channel count
 *   7. Audience Size       — total unique audience recipient identifiers
 *
 * Takes `notifications` as a direct prop — the caller sources data from
 * notificationService or an approved data prop. Read-only. No mutations.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 *
 * Props:
 * - `notifications`  (object[])  — Notification entity array (default: [])
 * - `loading`        (boolean)   (default: false)
 * - `refreshing`     (boolean)   (default: false)
 * - `syncing`        (boolean)   (default: false)
 * - `error`          (any)       (default: null)
 * - `isStale`        (boolean)   (default: false)
 * - `compact`        (boolean)   (default: false)
 *
 * State: all derived via useMemo from `notifications` prop — no store reads.
 */

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

function computeKPIs(notifications) {
  const channels   = new Set();
  const audienceIds = new Set();
  let unread = 0, critical = 0, failed = 0, acknowledged = 0;

  for (const n of notifications) {
    const status   = String(n.status ?? '').toLowerCase();
    const priority = String(n.priority ?? '').toLowerCase();
    const delivery = String(n.deliveryStatus ?? '').toLowerCase();
    const channel  = String(n.channel ?? 'in-app').toLowerCase();

    if (status   === 'unread')       unread       += 1;
    if (priority === 'critical')     critical     += 1;
    if (delivery === 'failed')       failed       += 1;
    if (status   === 'acknowledged') acknowledged += 1;

    channels.add(channel);

    for (const a of (Array.isArray(n.audience) ? n.audience : [])) {
      audienceIds.add(String(a));
    }
  }

  return {
    total:       notifications.length,
    unread,
    critical,
    failed,
    acknowledged,
    channelsActive: channels.size,
    audienceSize:   audienceIds.size,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="notification-kpis__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function KPITile({ id, label, value, cssModifier, ariaLabel }) {
  return (
    <div
      id={id}
      className={[
        'notification-kpis__tile',
        cssModifier ? `notification-kpis__tile--${cssModifier}` : null,
      ].filter(Boolean).join(' ')}
      aria-label={ariaLabel ?? `${label}: ${value}`}
      role="figure"
    >
      <div className="notification-kpis__tile-value">{value ?? '—'}</div>
      <div className="notification-kpis__tile-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationKPIs({
  notifications = [],
  loading       = false,
  refreshing    = false,
  syncing       = false,
  error         = null,
  isStale       = false,
  compact       = false,
}) {
  const kpis = useMemo(() => computeKPIs(notifications), [notifications]);

  return (
    <div
      className={[
        'notification-kpis',
        compact ? 'notification-kpis--compact' : null,
        isStale ? 'notification-kpis--stale'   : null,
        error   ? 'notification-kpis--error'   : null,
        syncing ? 'notification-kpis--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label="Notification KPIs"
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />

      <div className="notification-kpis__grid" role="list">
        <KPITile id="kpi-notif-total"    label="Total"        value={kpis.total}          />
        <KPITile id="kpi-notif-unread"   label="Unread"       value={kpis.unread}         cssModifier={kpis.unread > 0 ? 'unread' : null}    ariaLabel={`Unread: ${kpis.unread}`} />
        <KPITile id="kpi-notif-critical" label="Critical"     value={kpis.critical}       cssModifier={kpis.critical > 0 ? 'critical' : null} ariaLabel={`Critical priority: ${kpis.critical}`} />
        <KPITile id="kpi-notif-failed"   label="Failed"       value={kpis.failed}         cssModifier={kpis.failed > 0 ? 'failed' : null}     ariaLabel={`Failed deliveries: ${kpis.failed}`} />
        {!compact && (
          <KPITile id="kpi-notif-acked"    label="Acknowledged" value={kpis.acknowledged}   ariaLabel={`Acknowledged: ${kpis.acknowledged}`} />
        )}
        {!compact && (
          <KPITile id="kpi-notif-channels" label="Channels"     value={kpis.channelsActive} ariaLabel={`Active channels: ${kpis.channelsActive}`} />
        )}
        {!compact && (
          <KPITile id="kpi-notif-audience" label="Audience"     value={kpis.audienceSize}   ariaLabel={`Unique audience size: ${kpis.audienceSize}`} />
        )}
      </div>
    </div>
  );
});

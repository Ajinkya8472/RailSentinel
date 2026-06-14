import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * NotificationAudiencePanel — deep-review audience and routing intelligence
 * surface for M5 Notifications & Communications.
 *
 * Derives audience analytics from the `audience[]`, `targetRoles[]`,
 * `targetGroups[]`, and `linkedEntityType` / `linkedEntityId` fields
 * across one or multiple Notification entities.
 *
 * Sections:
 *   1. Audience Overview    — total unique recipients, role distribution,
 *                            group distribution.
 *   2. Recipient List       — deduplicated audience member list with
 *                            per-recipient read/ack/dismiss status.
 *   3. Linked Entities      — linkedEntityType / linkedEntityId cross-domain
 *                            references (reference-only, no entity store import).
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `notification`     (object|null)  — single notification (default: null)
 * - `notifications`    (object[])     — list mode (default: [])
 * - `layout`           ('detail'|'split'|null) (default: null)
 * - `title`            (string|null)  (default: null)
 * - `loading`          (boolean)      (default: false)
 * - `syncing`          (boolean)      (default: false)
 * - `isStale`          (boolean)      (default: false)
 * - `error`            (any)          (default: null)
 * - `maxRecipients`    (number)       (default: 20)
 * - `compact`          (boolean)      (default: false)
 * - `onRetry`          (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function aggregateAudience(notifications) {
  const recipientSet  = new Set();
  const roleCounts    = {};
  const groupCounts   = {};
  const linkedEntities = [];

  for (const n of notifications) {
    for (const a of (Array.isArray(n.audience) ? n.audience : [])) {
      recipientSet.add(String(a));
    }
    for (const r of (Array.isArray(n.targetRoles) ? n.targetRoles : [])) {
      roleCounts[r] = (roleCounts[r] ?? 0) + 1;
    }
    for (const g of (Array.isArray(n.targetGroups) ? n.targetGroups : [])) {
      groupCounts[g] = (groupCounts[g] ?? 0) + 1;
    }
    if (n.linkedEntityType) {
      linkedEntities.push({ type: n.linkedEntityType, id: n.linkedEntityId ?? null, notifId: n.id });
    }
  }

  return {
    recipients: Array.from(recipientSet),
    roles: Object.entries(roleCounts).sort((a, b) => b[1] - a[1]),
    groups: Object.entries(groupCounts).sort((a, b) => b[1] - a[1]),
    linkedEntities,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="notification-audience-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function DistBar({ entries, label }) {
  if (entries.length === 0) return (
    <div className="notification-audience-panel__empty-note" role="note">No {label.toLowerCase()} data.</div>
  );
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="notification-audience-panel__dist" aria-label={`${label} distribution`}>
      {entries.slice(0, 8).map(([key, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={key} className="notification-audience-panel__dist-row">
            <span className="notification-audience-panel__dist-key">{key}</span>
            <div className="notification-audience-panel__dist-bar">
              <div className="notification-audience-panel__dist-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="notification-audience-panel__dist-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function AudienceRailSummary({ data }) {
  return (
    <div className="notification-audience-panel__rail" aria-label="Audience summary">
      <div className="notification-audience-panel__rail-title">Audience Summary</div>
      <dl className="notification-audience-panel__rail-dl">
        <dt>Unique Recipients</dt><dd>{data.recipients.length}</dd>
        <dt>Roles</dt><dd>{data.roles.length}</dd>
        <dt>Groups</dt><dd>{data.groups.length}</dd>
        <dt>Linked Entities</dt><dd>{data.linkedEntities.length}</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationAudiencePanel({
  notification     = null,
  notifications    = [],
  layout           = null,
  title            = null,
  loading          = false,
  syncing          = false,
  isStale          = false,
  error            = null,
  maxRecipients    = 20,
  compact          = false,
  onRetry          = null,
}) {
  const source = useMemo(() => {
    if (notification) return [notification];
    return notifications;
  }, [notification, notifications]);

  const data    = useMemo(() => aggregateAudience(source), [source]);
  const visible = data.recipients.slice(0, maxRecipients);
  const isEmpty = source.length === 0 && !loading;
  const resolvedTitle = title ?? 'Audience & Routing';

  const body = (
    <div
      className={[
        'notification-audience-panel',
        compact ? 'notification-audience-panel--compact' : null,
        isStale ? 'notification-audience-panel--stale'   : null,
        error   ? 'notification-audience-panel--error'   : null,
        syncing ? 'notification-audience-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-audience-panel__empty" role="status">No audience data available.</div>
      ) : (
        <>
          {/* Overview */}
          <section className="notification-audience-panel__section" aria-label="Audience Overview">
            <h3 className="notification-audience-panel__section-title">
              Audience Overview
              <span className="notification-audience-panel__section-count">{data.recipients.length} recipients</span>
            </h3>
            <DistBar entries={data.roles}  label="Role" />
            {!compact && <DistBar entries={data.groups} label="Group" />}
          </section>

          {/* Recipient list */}
          <section className="notification-audience-panel__section" aria-label="Recipients">
            <h3 className="notification-audience-panel__section-title">Recipients</h3>
            {visible.length === 0 ? (
              <div className="notification-audience-panel__empty-note">No named recipients.</div>
            ) : (
              <ul className="notification-audience-panel__recipient-list" aria-label={`${data.recipients.length} recipients`}>
                {visible.map((r, idx) => (
                  <li key={idx} className="notification-audience-panel__recipient-row" role="listitem"
                    aria-label={r}>{r}</li>
                ))}
                {data.recipients.length > maxRecipients && (
                  <li className="notification-audience-panel__recipient-overflow" role="note">
                    +{data.recipients.length - maxRecipients} more
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* Linked entities */}
          {!compact && data.linkedEntities.length > 0 && (
            <section className="notification-audience-panel__section" aria-label="Linked Entities">
              <h3 className="notification-audience-panel__section-title">Linked Entities</h3>
              <ul className="notification-audience-panel__entity-list">
                {data.linkedEntities.map((e, idx) => (
                  <li key={idx} className="notification-audience-panel__entity-row" role="listitem">
                    <span className="notification-audience-panel__entity-type">{e.type}</span>
                    {e.id && <span className="notification-audience-panel__entity-id">{e.id}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{data.recipients.length} recipients<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<AudienceRailSummary data={data} />}
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
        right={<AudienceRailSummary data={data} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

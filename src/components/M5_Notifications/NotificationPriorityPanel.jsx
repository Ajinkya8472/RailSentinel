import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * NotificationPriorityPanel — priority intelligence surface for M5. Renders
 * priority distribution analytics and ranked notification lists across the
 * four priority levels: critical, high, medium, low.
 *
 * Sections:
 *   1. Priority Distribution  — count bar: critical / high / medium / low
 *   2. Priority Ranked List   — notifications sorted by priority desc then
 *                              sentAt desc with status/delivery context
 *   3. Critical Attention     — critical unread notifications requiring action
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `notifications`    (object[])     (default: [])
 * - `layout`           ('detail'|'split'|null) (default: null)
 * - `title`            (string|null)  (default: null)
 * - `loading`          (boolean)      (default: false)
 * - `syncing`          (boolean)      (default: false)
 * - `isStale`          (boolean)      (default: false)
 * - `error`            (any)          (default: null)
 * - `maxItems`         (number)       (default: 20)
 * - `compact`          (boolean)      (default: false)
 * - `onNotificationOpen` (fn|null)    (default: null)
 * - `onRetry`          (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG = {
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
};

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

function priConfig(k) { return PRIORITY_CONFIG[String(k ?? 'low').toLowerCase()] ?? PRIORITY_CONFIG.low; }
function priRank(k)   { return priConfig(k).rank; }

function relativeTime(iso) {
  if (!iso) return null;
  try {
    const diff = Date.now() - Date.parse(iso);
    if (Number.isNaN(diff)) return null;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d >= 1) return `${d}d ago`;
    if (h >= 1) return `${h}h ago`;
    if (m >= 1) return `${m}m ago`;
    return 'Just now';
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="notification-priority-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function PriorityBar({ counts, total }) {
  return (
    <div className="notification-priority-panel__bar-wrap" aria-label="Priority distribution">
      <div className="notification-priority-panel__bar">
        {PRIORITY_ORDER.map((k) => {
          const cfg = priConfig(k);
          const count = counts[k] ?? 0;
          if (count === 0) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={k}
              className={`notification-priority-panel__bar-seg notification-priority-panel__bar-seg--${cfg.cssModifier}`}
              style={{ width: `${pct}%` }}
              title={`${cfg.label}: ${count} (${pct}%)`}
              aria-label={`${cfg.label}: ${count} (${pct}%)`}
            />
          );
        })}
      </div>
      <div className="notification-priority-panel__bar-legend" role="list">
        {PRIORITY_ORDER.map((k) => {
          const cfg = priConfig(k);
          const count = counts[k] ?? 0;
          return (
            <span key={k} className={`notification-priority-panel__legend-item notification-priority-panel__legend-item--${cfg.cssModifier}`} role="listitem">
              <span aria-hidden="true">{cfg.icon}</span> {cfg.label}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PriorityRow({ n, compact, onOpen }) {
  const cfg       = priConfig(n.priority);
  const isUnread  = String(n.status ?? '').toLowerCase() === 'unread';
  const timeAgo   = relativeTime(n.sentAt);
  const isClick   = typeof onOpen === 'function';

  return (
    <li
      className={[
        'notification-priority-panel__row',
        `notification-priority-panel__row--${cfg.cssModifier}`,
        isUnread ? 'notification-priority-panel__row--unread' : null,
        isClick  ? 'notification-priority-panel__row--clickable' : null,
        compact  ? 'notification-priority-panel__row--compact' : null,
      ].filter(Boolean).join(' ')}
      role={isClick ? 'button' : 'listitem'}
      tabIndex={isClick ? 0 : undefined}
      aria-label={`${cfg.label}: ${n.title}`}
      onClick={isClick ? () => onOpen(n) : undefined}
      onKeyDown={isClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(n); } } : undefined}
    >
      <span className={`notification-priority-panel__row-icon notification-priority-panel__row-icon--${cfg.cssModifier}`} aria-hidden="true">{cfg.icon}</span>
      <div className="notification-priority-panel__row-body">
        <div className="notification-priority-panel__row-title">{n.title}</div>
        {!compact && n.body && <div className="notification-priority-panel__row-body-text">{n.body}</div>}
      </div>
      <div className="notification-priority-panel__row-meta">
        <span className={`notification-priority-panel__row-status notification-priority-panel__row-status--${String(n.status ?? 'unread').toLowerCase()}`}>{n.status ?? 'unread'}</span>
        {timeAgo && <span className="notification-priority-panel__row-time">{timeAgo}</span>}
      </div>
    </li>
  );
}

function PriorityRailSummary({ counts, total }) {
  return (
    <div className="notification-priority-panel__rail" aria-label="Priority summary">
      <div className="notification-priority-panel__rail-title">By Priority</div>
      <dl className="notification-priority-panel__rail-dl">
        {PRIORITY_ORDER.map((k) => {
          const cfg = priConfig(k);
          return (
            <React.Fragment key={k}>
              <dt className={`notification-priority-panel__rail-key--${cfg.cssModifier}`}>{cfg.label}</dt>
              <dd>{counts[k] ?? 0}</dd>
            </React.Fragment>
          );
        })}
        <dt>Total</dt><dd>{total}</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationPriorityPanel({
  notifications        = [],
  layout               = null,
  title                = null,
  loading              = false,
  syncing              = false,
  isStale              = false,
  error                = null,
  maxItems             = 20,
  compact              = false,
  onNotificationOpen   = null,
  onRetry              = null,
}) {
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const n of notifications) {
      const k = String(n.priority ?? 'low').toLowerCase();
      if (c[k] != null) c[k] += 1;
    }
    return c;
  }, [notifications]);

  const sorted = useMemo(() =>
    [...notifications]
      .sort((a, b) => priRank(b.priority) - priRank(a.priority) || String(b.sentAt ?? '').localeCompare(String(a.sentAt ?? '')))
      .slice(0, maxItems),
  [notifications, maxItems]);

  const critical = useMemo(() =>
    notifications.filter((n) =>
      String(n.priority ?? '').toLowerCase() === 'critical' &&
      String(n.status ?? '').toLowerCase() === 'unread'
    ),
  [notifications]);

  const total   = notifications.length;
  const isEmpty = total === 0 && !loading;
  const resolvedTitle = title ?? 'Priority Overview';

  const body = (
    <div
      className={[
        'notification-priority-panel',
        compact ? 'notification-priority-panel--compact' : null,
        isStale ? 'notification-priority-panel--stale'   : null,
        error   ? 'notification-priority-panel--error'   : null,
        syncing ? 'notification-priority-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-priority-panel__empty" role="status">No notifications.</div>
      ) : (
        <>
          <section className="notification-priority-panel__section" aria-label="Priority Distribution">
            <h3 className="notification-priority-panel__section-title">Distribution</h3>
            <PriorityBar counts={counts} total={total} />
          </section>

          {!compact && critical.length > 0 && (
            <section className="notification-priority-panel__section notification-priority-panel__section--critical" aria-label="Critical Attention Items">
              <h3 className="notification-priority-panel__section-title">
                Critical Attention <span className="notification-priority-panel__section-badge">{critical.length}</span>
              </h3>
              <ul className="notification-priority-panel__list">
                {critical.slice(0, 4).map((n) => (
                  <PriorityRow key={n.id} n={n} compact={compact} onOpen={onNotificationOpen} />
                ))}
              </ul>
            </section>
          )}

          <section className="notification-priority-panel__section" aria-label="All Notifications by Priority">
            <h3 className="notification-priority-panel__section-title">By Priority</h3>
            <ul className="notification-priority-panel__list">
              {sorted.map((n) => (
                <PriorityRow key={n.id} n={n} compact={compact} onOpen={onNotificationOpen} />
              ))}
            </ul>
            {notifications.length > maxItems && (
              <div className="notification-priority-panel__overflow">+{notifications.length - maxItems} more</div>
            )}
          </section>
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{total} notifications<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<PriorityRailSummary counts={counts} total={total} />}
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
        right={<PriorityRailSummary counts={counts} total={total} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * NotificationHistoryPanel — chronological notification history archive for M5.
 * Displays a time-ordered list of past notifications with rich filtering
 * by priority, status, channel, and date range.
 *
 * Derived entirely from the `notifications` prop — no store mutations.
 * Suitable as the canonical "All Notifications" view in the notification
 * center overlay or as a SplitPanelLayout / DetailLayout secondary panel.
 *
 * Sections:
 *   1. Filter Bar         — priority, status, channel, search query filters
 *                          applied locally (zero server round-trips)
 *   2. History List       — time-ordered notifications matching filters,
 *                          showing title, priority, status, delivery,
 *                          channel, and sentAt.
 *   3. Summary Footer     — total shown / total available, date range span.
 *
 * Dependencies:
 * - React (memo, useMemo, useState)
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
 * - `defaultPriority`  (string)       — initial filter (default: 'all')
 * - `defaultStatus`    (string)       — initial filter (default: 'all')
 * - `defaultChannel`   (string)       — initial filter (default: 'all')
 * - `maxItems`         (number)       (default: 50)
 * - `compact`          (boolean)      (default: false)
 * - `onNotificationOpen` (fn|null)    (default: null)
 * - `onRetry`          (fn|null)      (default: null)
 */

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG = {
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
};
const CHANNEL_ICON = { push: '📲', sms: '💬', email: '✉', 'in-app': '🔔', voice: '🔊' };

function priConfig(k) { return PRIORITY_CONFIG[String(k ?? 'low').toLowerCase()] ?? PRIORITY_CONFIG.low; }
function priRank(k)   { return priConfig(k).rank; }

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
    <div className="notification-history-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function FilterBar({ filters, setFilters, allChannels, allStatuses }) {
  const { priority, status, channel, query } = filters;
  return (
    <div className="notification-history-panel__filter-bar" role="search" aria-label="Filter notifications">
      <select
        id="nhp-filter-priority"
        className="notification-history-panel__filter-select"
        value={priority}
        onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
        aria-label="Filter by priority"
      >
        <option value="all">All Priorities</option>
        {['critical','high','medium','low'].map((p) => (
          <option key={p} value={p}>{priConfig(p).label}</option>
        ))}
      </select>

      <select
        id="nhp-filter-status"
        className="notification-history-panel__filter-select"
        value={status}
        onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        aria-label="Filter by status"
      >
        <option value="all">All Statuses</option>
        {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <select
        id="nhp-filter-channel"
        className="notification-history-panel__filter-select"
        value={channel}
        onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
        aria-label="Filter by channel"
      >
        <option value="all">All Channels</option>
        {allChannels.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <input
        id="nhp-filter-query"
        type="search"
        className="notification-history-panel__filter-input"
        value={query}
        onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        placeholder="Search title…"
        aria-label="Search notifications by title"
      />
    </div>
  );
}

function HistoryRow({ n, compact, onOpen }) {
  const priCfg   = priConfig(n.priority);
  const chanIcon  = CHANNEL_ICON[String(n.channel ?? 'in-app').toLowerCase()] ?? '🔔';
  const isUnread  = String(n.status ?? '').toLowerCase() === 'unread';
  const isClick   = typeof onOpen === 'function';

  return (
    <li
      className={[
        'notification-history-panel__row',
        `notification-history-panel__row--${priCfg.cssModifier}`,
        isUnread ? 'notification-history-panel__row--unread' : null,
        isClick  ? 'notification-history-panel__row--clickable' : null,
        compact  ? 'notification-history-panel__row--compact' : null,
      ].filter(Boolean).join(' ')}
      role={isClick ? 'button' : 'listitem'}
      tabIndex={isClick ? 0 : undefined}
      aria-label={`${priCfg.label}: ${n.title}`}
      onClick={isClick ? () => onOpen(n) : undefined}
      onKeyDown={isClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(n); } } : undefined}
    >
      <span className={`notification-history-panel__row-icon notification-history-panel__row-icon--${priCfg.cssModifier}`} aria-hidden="true">{priCfg.icon}</span>
      <div className="notification-history-panel__row-body">
        <span className="notification-history-panel__row-title">{n.title}</span>
        {!compact && n.body && <span className="notification-history-panel__row-excerpt">{n.body.slice(0, 80)}{n.body.length > 80 ? '…' : ''}</span>}
      </div>
      <div className="notification-history-panel__row-meta">
        <span className={`notification-history-panel__row-status notification-history-panel__row-status--${String(n.status ?? 'unread').toLowerCase()}`}>{n.status ?? 'unread'}</span>
        <span className="notification-history-panel__row-channel" aria-label={n.channel ?? 'in-app'}>{chanIcon}</span>
        {n.sentAt && <span className="notification-history-panel__row-ts">{formatWhen(n.sentAt)}</span>}
      </div>
    </li>
  );
}

function HistoryRailSummary({ total, shown, earliest, latest }) {
  return (
    <div className="notification-history-panel__rail" aria-label="History summary">
      <div className="notification-history-panel__rail-title">History</div>
      <dl className="notification-history-panel__rail-dl">
        <dt>Total</dt><dd>{total}</dd>
        <dt>Shown</dt><dd>{shown}</dd>
        {earliest && <><dt>Earliest</dt><dd>{formatWhen(earliest)}</dd></>}
        {latest && <><dt>Latest</dt><dd>{formatWhen(latest)}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationHistoryPanel({
  notifications        = [],
  layout               = null,
  title                = null,
  loading              = false,
  syncing              = false,
  isStale              = false,
  error                = null,
  defaultPriority      = 'all',
  defaultStatus        = 'all',
  defaultChannel       = 'all',
  maxItems             = 50,
  compact              = false,
  onNotificationOpen   = null,
  onRetry              = null,
}) {
  const [filters, setFilters] = useState({
    priority: defaultPriority,
    status:   defaultStatus,
    channel:  defaultChannel,
    query:    '',
  });

  const allChannels = useMemo(() => {
    const set = new Set();
    for (const n of notifications) set.add(String(n.channel ?? 'in-app').toLowerCase());
    return Array.from(set).sort();
  }, [notifications]);

  const allStatuses = useMemo(() => {
    const set = new Set();
    for (const n of notifications) set.add(String(n.status ?? 'unread').toLowerCase());
    return Array.from(set).sort();
  }, [notifications]);

  const sorted = useMemo(() =>
    [...notifications]
      .sort((a, b) =>
        priRank(b.priority) - priRank(a.priority) ||
        String(b.sentAt ?? '').localeCompare(String(a.sentAt ?? '')),
      ),
  [notifications]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (filters.priority !== 'all') list = list.filter((n) => String(n.priority ?? 'low').toLowerCase() === filters.priority);
    if (filters.status   !== 'all') list = list.filter((n) => String(n.status   ?? 'unread').toLowerCase() === filters.status);
    if (filters.channel  !== 'all') list = list.filter((n) => String(n.channel  ?? 'in-app').toLowerCase() === filters.channel);
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      list = list.filter((n) => String(n.title ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [sorted, filters]);

  const visible  = filtered.slice(0, maxItems);
  const earliest = sorted.length > 0 ? sorted[sorted.length - 1]?.sentAt : null;
  const latest   = sorted.length > 0 ? sorted[0]?.sentAt : null;
  const isEmpty  = notifications.length === 0 && !loading;
  const resolvedTitle = title ?? 'Notification History';

  const body = (
    <div
      className={[
        'notification-history-panel',
        compact ? 'notification-history-panel--compact' : null,
        isStale ? 'notification-history-panel--stale'   : null,
        error   ? 'notification-history-panel--error'   : null,
        syncing ? 'notification-history-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-history-panel__empty" role="status">No notification history.</div>
      ) : (
        <>
          {!compact && (
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              allChannels={allChannels}
              allStatuses={allStatuses}
            />
          )}

          <ul
            className="notification-history-panel__list"
            aria-label={`${visible.length} of ${filtered.length} notifications`}
          >
            {visible.map((n) => (
              <HistoryRow key={n.id} n={n} compact={compact} onOpen={onNotificationOpen} />
            ))}
          </ul>

          <div className="notification-history-panel__footer" role="status"
            aria-label={`Showing ${visible.length} of ${filtered.length} matching ${notifications.length} total`}>
            Showing {visible.length} of {filtered.length}
            {filtered.length < notifications.length && ` (filtered from ${notifications.length})`}
          </div>
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{notifications.length} notifications<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<HistoryRailSummary total={notifications.length} shown={visible.length} earliest={earliest} latest={latest} />}
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
        right={<HistoryRailSummary total={notifications.length} shown={visible.length} earliest={earliest} latest={latest} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

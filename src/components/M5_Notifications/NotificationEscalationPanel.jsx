import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * NotificationEscalationPanel — escalation intelligence surface for M5.
 * Derives and displays notification escalation chain data from the
 * `escalationLevel`, `escalatedAt`, `escalationHistory[]`, and
 * `escalationReason` fields of Notification entities.
 *
 * Sections:
 *   1. Escalation Status    — current escalation level, escalatedAt,
 *                            escalation reason.
 *   2. Escalation Chain     — ordered history of escalation steps (from
 *                            `escalationHistory[]` or inferred from level).
 *   3. Pending Escalations  — notifications with escalationLevel > 0 that
 *                            are still unacknowledged across the list.
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
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
 * - `compact`          (boolean)      (default: false)
 * - `onRetry`          (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

const ESCALATION_LEVEL_CONFIG = {
  0: { label: 'None',     cssModifier: 'none',     description: 'No escalation.' },
  1: { label: 'L1 — Ops', cssModifier: 'l1',       description: 'Escalated to operations team.' },
  2: { label: 'L2 — Mgr', cssModifier: 'l2',       description: 'Escalated to duty manager.' },
  3: { label: 'L3 — Exec',cssModifier: 'l3',       description: 'Escalated to executive on-call.' },
};

function escalationLevelConfig(level) {
  const n = Number(level ?? 0);
  return ESCALATION_LEVEL_CONFIG[n] ?? { label: `Level ${n}`, cssModifier: 'custom', description: `Escalation level ${n}.` };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="notification-escalation-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EscalationStatusSection({ notification, compact }) {
  const levelCfg = escalationLevelConfig(notification?.escalationLevel ?? 0);
  const isActive = (notification?.escalationLevel ?? 0) > 0;

  return (
    <section className="notification-escalation-panel__section" aria-label="Escalation Status">
      <h3 className="notification-escalation-panel__section-title">Escalation Status</h3>
      <div className={`notification-escalation-panel__status notification-escalation-panel__status--${levelCfg.cssModifier}`}
        aria-label={`Escalation level: ${levelCfg.label}`}>
        <span className="notification-escalation-panel__level-badge">{levelCfg.label}</span>
        {isActive && <span className="notification-escalation-panel__active-tag" role="status">Active</span>}
      </div>
      <div className="notification-escalation-panel__level-desc">{levelCfg.description}</div>
      {notification?.escalationReason && (
        <div className="notification-escalation-panel__reason">
          <strong>Reason:</strong> {notification.escalationReason}
        </div>
      )}
      {!compact && notification?.escalatedAt && (
        <div className="notification-escalation-panel__escalated-at">
          Escalated at: {formatWhen(notification.escalatedAt)}
        </div>
      )}
    </section>
  );
}

function EscalationChain({ notification, compact }) {
  const history = useMemo(() => {
    if (Array.isArray(notification?.escalationHistory)) return notification.escalationHistory;
    // Infer chain from escalation level
    const level = Number(notification?.escalationLevel ?? 0);
    if (level === 0) return [];
    return Array.from({ length: level }, (_, i) => ({
      level: i + 1,
      label: escalationLevelConfig(i + 1).label,
      timestamp: i === level - 1 ? notification.escalatedAt : null,
      inferred: true,
    }));
  }, [notification?.escalationHistory, notification?.escalationLevel, notification?.escalatedAt]);

  if (history.length === 0) return null;

  return (
    <section className="notification-escalation-panel__section" aria-label="Escalation Chain">
      <h3 className="notification-escalation-panel__section-title">Escalation Chain</h3>
      <ol className="notification-escalation-panel__chain" aria-label={`${history.length} escalation step${history.length !== 1 ? 's' : ''}`}>
        {history.map((step, idx) => {
          const cfg = typeof step.level === 'number' ? escalationLevelConfig(step.level) : { label: step.label ?? `Step ${idx + 1}`, cssModifier: 'custom' };
          return (
            <li key={idx}
              className={`notification-escalation-panel__chain-step notification-escalation-panel__chain-step--${cfg.cssModifier}`}
              aria-label={`Step ${idx + 1}: ${cfg.label}${step.timestamp ? ` at ${formatWhen(step.timestamp)}` : ''}`}>
              <span className="notification-escalation-panel__chain-dot" aria-hidden="true" />
              <div className="notification-escalation-panel__chain-body">
                <span className="notification-escalation-panel__chain-label">{step.label ?? cfg.label}</span>
                {!compact && step.timestamp && (
                  <span className="notification-escalation-panel__chain-time">{formatWhen(step.timestamp)}</span>
                )}
                {!compact && step.escalatedTo && (
                  <span className="notification-escalation-panel__chain-to">→ {step.escalatedTo}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PendingEscalations({ pending, compact }) {
  if (pending.length === 0) return null;
  return (
    <section className="notification-escalation-panel__section notification-escalation-panel__section--pending" aria-label="Pending Escalations">
      <h3 className="notification-escalation-panel__section-title">
        Pending Escalations <span className="notification-escalation-panel__section-badge">{pending.length}</span>
      </h3>
      <ul className="notification-escalation-panel__pending-list">
        {pending.slice(0, 10).map((n) => {
          const levelCfg = escalationLevelConfig(n.escalationLevel);
          return (
            <li key={n.id}
              className={`notification-escalation-panel__pending-row notification-escalation-panel__pending-row--${levelCfg.cssModifier}`}
              aria-label={`${n.title}: ${levelCfg.label}`}>
              <span className="notification-escalation-panel__pending-level">{levelCfg.label}</span>
              <span className="notification-escalation-panel__pending-title">{n.title}</span>
              {!compact && n.escalatedAt && <span className="notification-escalation-panel__pending-ts">{formatWhen(n.escalatedAt)}</span>}
            </li>
          );
        })}
        {pending.length > 10 && (
          <li className="notification-escalation-panel__pending-overflow">+{pending.length - 10} more</li>
        )}
      </ul>
    </section>
  );
}

function EscalationRailSummary({ pending, maxLevel }) {
  return (
    <div className="notification-escalation-panel__rail" aria-label="Escalation summary">
      <div className="notification-escalation-panel__rail-title">Escalation Summary</div>
      <dl className="notification-escalation-panel__rail-dl">
        <dt>Active Escalations</dt><dd>{pending.length}</dd>
        <dt>Highest Level</dt>
        <dd className={`notification-escalation-panel__rail-level--${escalationLevelConfig(maxLevel).cssModifier}`}>
          {escalationLevelConfig(maxLevel).label}
        </dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationEscalationPanel({
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

  const pending = useMemo(() =>
    source
      .filter((n) => (n.escalationLevel ?? 0) > 0 && String(n.status ?? '').toLowerCase() !== 'acknowledged')
      .sort((a, b) => (b.escalationLevel ?? 0) - (a.escalationLevel ?? 0)),
  [source]);

  const maxLevel = pending.length > 0 ? pending[0].escalationLevel ?? 0 : 0;
  const isEmpty  = source.length === 0 && !loading;
  const isSingleMode = Boolean(notification) && notifications.length === 0;
  const resolvedTitle = title ?? (notification?.title ? `Escalation — ${notification.title}` : 'Escalation Monitor');

  const body = (
    <div
      className={[
        'notification-escalation-panel',
        compact ? 'notification-escalation-panel--compact' : null,
        isStale ? 'notification-escalation-panel--stale'   : null,
        error   ? 'notification-escalation-panel--error'   : null,
        syncing ? 'notification-escalation-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-escalation-panel__empty" role="status">No escalation data.</div>
      ) : (
        <>
          {isSingleMode && notification && (
            <>
              <EscalationStatusSection notification={notification} compact={compact} />
              <EscalationChain notification={notification} compact={compact} />
            </>
          )}
          <PendingEscalations pending={pending} compact={compact} />
          {!isSingleMode && pending.length === 0 && (
            <div className="notification-escalation-panel__clear" role="status">
              No active escalations.
            </div>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{pending.length} active escalations<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<EscalationRailSummary pending={pending} maxLevel={maxLevel} />}
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
        right={<EscalationRailSummary pending={pending} maxLevel={maxLevel} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

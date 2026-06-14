import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * EscalationPanel — escalation intelligence surface for Module-6 Smart
 * Scheduling. Renders the escalation chain and status of one or multiple
 * ScheduleConflict entities.
 *
 * Sections:
 *   1. Escalation Status    — current escalationLevel, escalatedAt, reason
 *   2. Escalation Chain     — escalationHistory[] or inferred from level
 *   3. Active Escalations   — network-mode: all conflicts with escalationLevel > 0,
 *                            sorted by level desc
 *
 * Escalation level semantic (inferred from scheduling domain):
 *   0 — Not escalated
 *   1 — Supervisor
 *   2 — Operations Manager
 *   3 — Executive / Emergency Protocol
 *
 * DetailLayout is primary. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `conflict`    (object|null)  — single anchor conflict (default: null)
 * - `conflicts`   (object[])     — list mode (default: [])
 * - `layout`      ('detail'|'split'|null) (default: null)
 * - `title`       (string|null)  (default: null)
 * - `loading`     (boolean)      (default: false)
 * - `syncing`     (boolean)      (default: false)
 * - `isStale`     (boolean)      (default: false)
 * - `error`       (any)          (default: null)
 * - `compact`     (boolean)      (default: false)
 * - `onRetry`     (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVEL_CONFIG = {
  0: { label: 'None',        cssModifier: 'none',     description: 'No escalation active.' },
  1: { label: 'Supervisor',  cssModifier: 'l1',       description: 'Escalated to shift supervisor.' },
  2: { label: 'Ops Manager', cssModifier: 'l2',       description: 'Escalated to operations manager.' },
  3: { label: 'Executive',   cssModifier: 'l3',       description: 'Executive emergency protocol activated.' },
};

function levelConfig(level) {
  const n = Number(level ?? 0);
  return LEVEL_CONFIG[n] ?? { label: `Level ${n}`, cssModifier: 'custom', description: `Escalation level ${n} active.` };
}

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="escalation-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EscalationStatusSection({ conflict, compact }) {
  const level   = Number(conflict?.escalationLevel ?? 0);
  const cfg     = levelConfig(level);
  const isActive = level > 0;
  return (
    <section className="escalation-panel__section" aria-label="Escalation Status">
      <h3 className="escalation-panel__section-title">Escalation Status</h3>
      <div className={`escalation-panel__level escalation-panel__level--${cfg.cssModifier}`}
        aria-label={`Escalation level: ${cfg.label}`}>
        <span className="escalation-panel__level-badge">{cfg.label}</span>
        {isActive && <span className="escalation-panel__active-tag" role="status">Active</span>}
      </div>
      <div className="escalation-panel__level-desc">{cfg.description}</div>
      {conflict?.escalationReason && (
        <div className="escalation-panel__reason"><strong>Reason:</strong> {conflict.escalationReason}</div>
      )}
      {!compact && conflict?.escalatedAt && (
        <div className="escalation-panel__ts">Escalated at: {formatWhen(conflict.escalatedAt)}</div>
      )}
    </section>
  );
}

function EscalationChainSection({ conflict, compact }) {
  const history = useMemo(() => {
    if (Array.isArray(conflict?.escalationHistory)) return conflict.escalationHistory;
    const level = Number(conflict?.escalationLevel ?? 0);
    if (level === 0) return [];
    return Array.from({ length: level }, (_, i) => ({
      level: i + 1,
      label: levelConfig(i + 1).label,
      timestamp: i === level - 1 ? (conflict.escalatedAt ?? null) : null,
      inferred: true,
    }));
  }, [conflict?.escalationHistory, conflict?.escalationLevel, conflict?.escalatedAt]);

  if (history.length === 0) return null;

  return (
    <section className="escalation-panel__section" aria-label="Escalation Chain">
      <h3 className="escalation-panel__section-title">Escalation Chain</h3>
      <ol className="escalation-panel__chain">
        {history.map((step, idx) => {
          const cfg = levelConfig(step.level);
          return (
            <li key={idx}
              className={`escalation-panel__chain-step escalation-panel__chain-step--${cfg.cssModifier}`}
              aria-label={`Step ${idx + 1}: ${step.label ?? cfg.label}`}>
              <span className="escalation-panel__chain-dot" aria-hidden="true" />
              <div className="escalation-panel__chain-body">
                <span className="escalation-panel__chain-label">{step.label ?? cfg.label}</span>
                {!compact && step.timestamp && (
                  <span className="escalation-panel__chain-time">{formatWhen(step.timestamp)}</span>
                )}
                {!compact && step.escalatedTo && (
                  <span className="escalation-panel__chain-to">→ {step.escalatedTo}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ActiveEscalationsSection({ active, compact }) {
  return (
    <section className="escalation-panel__section" aria-label="Active Escalations">
      <h3 className="escalation-panel__section-title">
        Active Escalations
        <span className="escalation-panel__section-badge">{active.length}</span>
      </h3>
      {active.length === 0 ? (
        <div className="escalation-panel__clear" role="status">No active escalations.</div>
      ) : (
        <ul className="escalation-panel__active-list">
          {active.slice(0, 10).map((c) => {
            const cfg = levelConfig(c.escalationLevel);
            return (
              <li key={c.id}
                className={`escalation-panel__active-row escalation-panel__active-row--${cfg.cssModifier}`}
                aria-label={`${c.type ?? c.id}: ${cfg.label}`}>
                <span className="escalation-panel__active-level">{cfg.label}</span>
                <span className="escalation-panel__active-type">{c.type ?? c.id}</span>
                {!compact && c.escalatedAt && (
                  <span className="escalation-panel__active-ts">{formatWhen(c.escalatedAt)}</span>
                )}
              </li>
            );
          })}
          {active.length > 10 && <li className="escalation-panel__active-overflow">+{active.length - 10} more</li>}
        </ul>
      )}
    </section>
  );
}

function EscalationRailSummary({ active, maxLevel }) {
  return (
    <div className="escalation-panel__rail" aria-label="Escalation summary">
      <div className="escalation-panel__rail-title">Escalation</div>
      <dl className="escalation-panel__rail-dl">
        <dt>Active</dt><dd>{active.length}</dd>
        <dt>Highest Level</dt>
        <dd className={`escalation-panel__rail-level--${levelConfig(maxLevel).cssModifier}`}>
          {levelConfig(maxLevel).label}
        </dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EscalationPanel({
  conflict   = null,
  conflicts  = [],
  layout     = null,
  title      = null,
  loading    = false,
  syncing    = false,
  isStale    = false,
  error      = null,
  compact    = false,
  onRetry    = null,
}) {
  const source = useMemo(() => {
    if (conflict) return [conflict];
    return conflicts;
  }, [conflict, conflicts]);

  const isSingle = Boolean(conflict) && conflicts.length === 0;

  const active = useMemo(() =>
    source
      .filter((c) => (c.escalationLevel ?? 0) > 0 && String(c.status ?? '').toLowerCase() !== 'resolved')
      .sort((a, b) => (b.escalationLevel ?? 0) - (a.escalationLevel ?? 0)),
  [source]);

  const maxLevel   = active.length > 0 ? active[0].escalationLevel ?? 0 : 0;
  const isEmpty    = source.length === 0 && !loading;
  const resolvedTitle = title ?? (conflict ? `Escalation — ${conflict.type ?? conflict.id}` : 'Escalation Monitor');

  const body = (
    <div
      className={[
        'escalation-panel',
        compact ? 'escalation-panel--compact' : null,
        isStale ? 'escalation-panel--stale'   : null,
        error   ? 'escalation-panel--error'   : null,
        syncing ? 'escalation-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="escalation-panel__empty" role="status">No escalation data.</div>
      ) : (
        <>
          {isSingle && conflict && (
            <>
              <EscalationStatusSection conflict={conflict} compact={compact} />
              <EscalationChainSection  conflict={conflict} compact={compact} />
            </>
          )}
          <ActiveEscalationsSection active={active} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{active.length} active escalations<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<EscalationRailSummary active={active.length} maxLevel={maxLevel} />}
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
        right={<EscalationRailSummary active={active.length} maxLevel={maxLevel} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

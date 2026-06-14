import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * ServiceRecoveryPanel — service recovery plan surface for Module-6 Smart
 * Scheduling. Renders the `serviceRecoveryPlan` field of the ScheduleConflict
 * domain model and derives service recovery analytics across one or multiple
 * conflicts.
 *
 * The `serviceRecoveryPlan` is a structured object (or free-form string)
 * containing:
 *   - actions[]          — ordered recovery actions with status and owner
 *   - estimatedRecovery  — ISO timestamp for expected normalisation
 *   - recoveryScore      — 0–100 confidence in recovery timeline
 *   - contingencyPlan    — fallback if primary plan fails
 *   - notes              — operational notes
 *
 * Sections:
 *   1. Recovery Plan Overview — overall recovery status, estimated recovery
 *                              time, recoveryScore bar
 *   2. Recovery Actions       — ordered list of actions with status chips
 *   3. Contingency Plan       — fallback plan if primary fails
 *   4. Network Recovery Stats — list mode: count of conflicts with/without plans
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

function extractPlan(conflict) {
  const plan = conflict?.serviceRecoveryPlan;
  if (!plan) return null;
  if (typeof plan === 'string') {
    return { notes: plan, actions: [], estimatedRecovery: null, recoveryScore: null, contingencyPlan: null };
  }
  return plan;
}

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

const ACTION_STATUS_CONFIG = {
  pending:     { label: 'Pending',   cssModifier: 'pending'   },
  'in-progress':{ label: 'In Progress', cssModifier: 'progress' },
  completed:   { label: 'Completed', cssModifier: 'completed' },
  failed:      { label: 'Failed',    cssModifier: 'failed'    },
};
function actCfg(k) { return ACTION_STATUS_CONFIG[String(k ?? 'pending').toLowerCase()] ?? ACTION_STATUS_CONFIG.pending; }

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="service-recovery-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function PlanOverviewSection({ plan, compact }) {
  const recoveryScore = plan?.recoveryScore ?? null;
  return (
    <section className="service-recovery-panel__section" aria-label="Recovery Plan Overview">
      <h3 className="service-recovery-panel__section-title">Recovery Plan</h3>
      {recoveryScore != null && (
        <div className="service-recovery-panel__score" role="meter"
          aria-valuenow={recoveryScore} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Recovery confidence: ${recoveryScore}%`}>
          <div className="service-recovery-panel__score-bar">
            <div className="service-recovery-panel__score-fill"
              style={{ width: `${Math.min(100, recoveryScore)}%` }} aria-hidden="true" />
          </div>
          <span className="service-recovery-panel__score-value">{recoveryScore}% confidence</span>
        </div>
      )}
      <dl className="service-recovery-panel__field-list">
        {plan?.estimatedRecovery && <><dt>Estimated Recovery</dt><dd>{formatWhen(plan.estimatedRecovery)}</dd></>}
        {!compact && plan?.notes && <><dt>Notes</dt><dd>{plan.notes}</dd></>}
      </dl>
    </section>
  );
}

function RecoveryActionsSection({ actions, compact }) {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  return (
    <section className="service-recovery-panel__section" aria-label="Recovery Actions">
      <h3 className="service-recovery-panel__section-title">Actions ({actions.length})</h3>
      <ol className="service-recovery-panel__action-list">
        {actions.map((action, idx) => {
          const label  = typeof action === 'string' ? action : (action.label ?? action.action ?? `Action ${idx + 1}`);
          const owner  = typeof action === 'object' ? (action.owner ?? action.assignedTo ?? null) : null;
          const status = typeof action === 'object' ? (action.status ?? 'pending') : 'pending';
          const cfg    = actCfg(status);
          return (
            <li key={idx}
              className="service-recovery-panel__action-row"
              aria-label={`${label}: ${cfg.label}`}>
              <span className={`service-recovery-panel__action-status service-recovery-panel__action-status--${cfg.cssModifier}`}>{cfg.label}</span>
              <span className="service-recovery-panel__action-label">{label}</span>
              {!compact && owner && <span className="service-recovery-panel__action-owner">{owner}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ContingencySection({ plan, compact }) {
  const cp = plan?.contingencyPlan;
  if (!cp) return null;
  const text = typeof cp === 'string' ? cp : (cp.description ?? JSON.stringify(cp));
  return (
    <section className="service-recovery-panel__section service-recovery-panel__section--contingency" aria-label="Contingency Plan">
      <h3 className="service-recovery-panel__section-title">⚠ Contingency Plan</h3>
      <div className="service-recovery-panel__contingency-text">{text}</div>
    </section>
  );
}

function NetworkStatsSection({ conflicts }) {
  const withPlan    = conflicts.filter((c) => c.serviceRecoveryPlan != null).length;
  const withoutPlan = conflicts.length - withPlan;
  const avgScore    = (() => {
    const scores = conflicts
      .map((c) => (typeof c.serviceRecoveryPlan === 'object' && c.serviceRecoveryPlan?.recoveryScore != null)
        ? Number(c.serviceRecoveryPlan.recoveryScore) : null)
      .filter(Boolean);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  })();

  return (
    <section className="service-recovery-panel__section" aria-label="Network Recovery Stats">
      <h3 className="service-recovery-panel__section-title">Network Stats</h3>
      <dl className="service-recovery-panel__field-list">
        <dt>With Plan</dt><dd className="service-recovery-panel__val--ok">{withPlan}</dd>
        <dt>Without Plan</dt><dd className={withoutPlan > 0 ? 'service-recovery-panel__val--warn' : ''}>{withoutPlan}</dd>
        {avgScore != null && <><dt>Avg Confidence</dt><dd>{avgScore}%</dd></>}
      </dl>
    </section>
  );
}

function RecoveryRailSummary({ plan, hasPlan }) {
  return (
    <div className="service-recovery-panel__rail" aria-label="Recovery summary">
      <div className="service-recovery-panel__rail-title">Recovery</div>
      <dl className="service-recovery-panel__rail-dl">
        <dt>Plan</dt><dd>{hasPlan ? 'Available' : 'None'}</dd>
        {plan?.recoveryScore != null && <><dt>Confidence</dt><dd>{plan.recoveryScore}%</dd></>}
        {plan?.estimatedRecovery && <><dt>ETA</dt><dd>{formatWhen(plan.estimatedRecovery)}</dd></>}
        {Array.isArray(plan?.actions) && <><dt>Actions</dt><dd>{plan.actions.length}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ServiceRecoveryPanel({
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
  const source    = useMemo(() => { if (conflict) return [conflict]; return conflicts; }, [conflict, conflicts]);
  const isSingle  = Boolean(conflict) && conflicts.length === 0;
  const plan      = isSingle ? extractPlan(conflict) : null;
  const hasPlan   = plan != null;
  const isEmpty   = source.length === 0 && !loading;
  const resolvedTitle = title ?? (conflict ? `Recovery Plan — ${conflict.type ?? conflict.id}` : 'Service Recovery');

  const body = (
    <div
      className={[
        'service-recovery-panel',
        compact ? 'service-recovery-panel--compact' : null,
        isStale ? 'service-recovery-panel--stale'   : null,
        error   ? 'service-recovery-panel--error'   : null,
        syncing ? 'service-recovery-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="service-recovery-panel__empty" role="status">No conflict selected.</div>
      ) : isSingle ? (
        plan ? (
          <>
            <PlanOverviewSection    plan={plan}  compact={compact} />
            <RecoveryActionsSection actions={plan.actions} compact={compact} />
            <ContingencySection     plan={plan}  compact={compact} />
          </>
        ) : (
          <div className="service-recovery-panel__no-plan" role="status">No service recovery plan for this conflict.</div>
        )
      ) : (
        <NetworkStatsSection conflicts={source} />
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{hasPlan ? `${plan?.recoveryScore ?? '?'}% confidence` : 'No plan'}<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<RecoveryRailSummary plan={plan} hasPlan={hasPlan} />}
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
        right={<RecoveryRailSummary plan={plan} hasPlan={hasPlan} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

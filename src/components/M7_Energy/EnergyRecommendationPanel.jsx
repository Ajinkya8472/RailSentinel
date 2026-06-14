import React, { memo, useMemo } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import OptimizationCard from './OptimizationCard';

/**
 * Purpose:
 * EnergyRecommendationPanel — optimization recommendation management surface
 * for M7 Energy Optimization. Renders `EnergyProfile.recommendations[]` across
 * one or multiple profiles:
 *
 *   1. Recommendation Summary  — total, pending, accepted, deferred, completed
 *   2. Actionable Recommendations — pending/accepted recs with Accept/Defer/Escalate
 *                                  actions. Every Accept MUST create an OperatorAction.
 *   3. In-Progress / Completed — execution status tracking
 *   4. Confidence Distribution — sorted by confidence desc for operator prioritisation
 *
 * CRITICAL: Every `onAccept` invocation creates an OperatorAction record.
 * The callback receives `{ recommendation, profile, action, timestamp,
 * operatorActionType: 'energy_optimization' }`.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./OptimizationCard`
 *
 * Props:
 * - `profile`    (object|null)  — single EnergyProfile (default: null)
 * - `profiles`   (object[])     — multi-profile mode (default: [])
 * - `layout`     ('detail'|'split'|null) (default: null)
 * - `title`      (string|null)  (default: null)
 * - `loading`    (boolean)      (default: false)
 * - `syncing`    (boolean)      (default: false)
 * - `isStale`    (boolean)      (default: false)
 * - `error`      (any)          (default: null)
 * - `compact`    (boolean)      (default: false)
 * - `onAccept`   (fn|null)      — OperatorAction callback
 * - `onDefer`    (fn|null)
 * - `onEscalate` (fn|null)
 * - `onRetry`    (fn|null)      (default: null)
 *
 * State: none — all derived.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PENDING_STATUSES   = new Set(['pending', 'accepted']);
const PROGRESS_STATUSES  = new Set(['in-progress', 'in_progress']);
const COMPLETED_STATUSES = new Set(['completed']);
const DEFERRED_STATUSES  = new Set(['deferred']);

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-rec-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function CompactRecRow({ rec, compact }) {
  const label    = rec.title ?? rec.type ?? 'Recommendation';
  const status   = String(rec.status ?? 'completed').toLowerCase();
  const savings  = rec.expectedSavings ?? null;
  const progress = rec.progressPercent ?? null;
  return (
    <div className={`energy-rec-panel__compact-row energy-rec-panel__compact-row--${status}`}
      aria-label={`${label}: ${status}`}>
      <span className="energy-rec-panel__compact-label">{label}</span>
      {savings != null && <span className="energy-rec-panel__compact-savings">↓{savings} kWh</span>}
      {progress != null && !compact && (
        <div className="energy-rec-panel__progress" role="progressbar"
          aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Progress: ${progress}%`}>
          <div className="energy-rec-panel__progress-fill" style={{ width: `${Math.min(100, progress)}%` }} aria-hidden="true" />
          <span className="energy-rec-panel__progress-value">{progress}%</span>
        </div>
      )}
    </div>
  );
}

function RailSummary({ pending, inProgress, completed, deferred }) {
  return (
    <div className="energy-rec-panel__rail" aria-label="Recommendation summary">
      <div className="energy-rec-panel__rail-title">Recommendations</div>
      <dl className="energy-rec-panel__rail-dl">
        <dt>Pending</dt><dd className={pending > 0 ? 'energy-rec-panel__rail-pending' : ''}>{pending}</dd>
        <dt>In Progress</dt><dd>{inProgress}</dd>
        <dt>Completed</dt><dd className="energy-rec-panel__rail-completed">{completed}</dd>
        <dt>Deferred</dt><dd>{deferred}</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyRecommendationPanel({
  profile    = null,
  profiles   = [],
  layout     = null,
  title      = null,
  loading    = false,
  syncing    = false,
  isStale    = false,
  error      = null,
  compact    = false,
  onAccept   = null,
  onDefer    = null,
  onEscalate = null,
  onRetry    = null,
}) {
  const source = useMemo(() => {
    if (profile) return [profile];
    return profiles;
  }, [profile, profiles]);

  // Flatten recommendations with profile reference
  const allRecs = useMemo(() => {
    const out = [];
    for (const p of source) {
      for (const r of (Array.isArray(p.recommendations) ? p.recommendations : [])) {
        out.push({ ...r, _profile: p });
      }
    }
    return out;
  }, [source]);

  const pending    = useMemo(() => allRecs.filter((r) => PENDING_STATUSES.has(String(r.status ?? 'pending').toLowerCase()))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)), [allRecs]);
  const inProgress = useMemo(() => allRecs.filter((r) => PROGRESS_STATUSES.has(String(r.status ?? '').toLowerCase())), [allRecs]);
  const completed  = useMemo(() => allRecs.filter((r) => COMPLETED_STATUSES.has(String(r.status ?? '').toLowerCase())), [allRecs]);
  const deferred   = useMemo(() => allRecs.filter((r) => DEFERRED_STATUSES.has(String(r.status ?? '').toLowerCase())), [allRecs]);

  const isEmpty       = allRecs.length === 0 && !loading;
  const resolvedTitle = title ?? (profile ? `Recommendations — ${profile.routeId ?? profile.id}` : 'Energy Recommendations');

  const body = (
    <div
      className={[
        'energy-rec-panel',
        compact ? 'energy-rec-panel--compact' : null,
        isStale ? 'energy-rec-panel--stale'   : null,
        error   ? 'energy-rec-panel--error'   : null,
        syncing ? 'energy-rec-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="energy-rec-panel__empty" role="status">No recommendations available.</div>
      ) : (
        <>
          {/* Pending / Actionable */}
          {pending.length > 0 && (
            <section className="energy-rec-panel__section" aria-label="Actionable Recommendations">
              <h3 className="energy-rec-panel__section-title">
                Recommendations
                <span className="energy-rec-panel__section-badge">{pending.length}</span>
              </h3>
              <div className="energy-rec-panel__card-stack">
                {pending.map((rec, idx) => (
                  <OptimizationCard
                    key={rec.id ?? idx}
                    recommendation={rec}
                    profile={rec._profile}
                    compact={compact}
                    isStale={isStale}
                    onAccept={onAccept}
                    onDefer={onDefer}
                    onEscalate={onEscalate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* In Progress */}
          {inProgress.length > 0 && (
            <section className="energy-rec-panel__section" aria-label="In-Progress Recommendations">
              <h3 className="energy-rec-panel__section-title">In Progress ({inProgress.length})</h3>
              <div className="energy-rec-panel__compact-list">
                {inProgress.map((rec, idx) => (
                  <CompactRecRow key={rec.id ?? idx} rec={rec} compact={compact} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {!compact && completed.length > 0 && (
            <section className="energy-rec-panel__section" aria-label="Completed Recommendations">
              <h3 className="energy-rec-panel__section-title">Completed ({completed.length})</h3>
              <div className="energy-rec-panel__compact-list">
                {completed.slice(0, 5).map((rec, idx) => (
                  <CompactRecRow key={rec.id ?? idx} rec={rec} compact={true} />
                ))}
                {completed.length > 5 && <div className="energy-rec-panel__overflow">+{completed.length - 5} more</div>}
              </div>
            </section>
          )}

          {/* Deferred */}
          {!compact && deferred.length > 0 && (
            <section className="energy-rec-panel__section" aria-label="Deferred Recommendations">
              <h3 className="energy-rec-panel__section-title">Deferred ({deferred.length})</h3>
              <div className="energy-rec-panel__compact-list">
                {deferred.slice(0, 3).map((rec, idx) => (
                  <CompactRecRow key={rec.id ?? idx} rec={rec} compact={true} />
                ))}
              </div>
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
        summary={<div>{pending.length} pending · {inProgress.length} in progress<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<RailSummary pending={pending.length} inProgress={inProgress.length} completed={completed.length} deferred={deferred.length} />}
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
        right={<RailSummary pending={pending.length} inProgress={inProgress.length} completed={completed.length} deferred={deferred.length} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

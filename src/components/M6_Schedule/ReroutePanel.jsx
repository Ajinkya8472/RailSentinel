import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * ReroutePanel — reroute option analytics surface for Module-6 Smart
 * Scheduling. Renders reroute alternatives from the `rerouteOptions[]` field
 * of the ScheduleConflict domain model:
 *
 *   1. Reroute Options Grid — all `rerouteOptions[]` with:
 *                            route, score, delay impact, capacity impact,
 *                            affected trains, feasibility indicator.
 *   2. Train Path Impact    — per-train impact of each reroute option,
 *                            resolved via trainStore.
 *   3. Optimal Route        — highest-scoring option highlighted.
 *
 * DetailLayout is primary. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/trainStore` (read-only — getTrainById)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `conflict`      (object|null)  — ScheduleConflict entity (default: null)
 * - `layout`        ('detail'|'split'|null) (default: null)
 * - `title`         (string|null)  (default: null)
 * - `loading`       (boolean)      (default: false)
 * - `syncing`       (boolean)      (default: false)
 * - `isStale`       (boolean)      (default: false)
 * - `error`         (any)          (default: null)
 * - `compact`       (boolean)      (default: false)
 * - `onSelectReroute` (fn|null)    — callback(conflict, option)
 * - `onRetry`       (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="reroute-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function RerouteOptionCard({ option, idx, isOptimal, compact, conflict, onSelectReroute }) {
  const label     = typeof option === 'string' ? option : (option.label ?? option.route ?? option.action ?? `Option ${idx + 1}`);
  const detail    = typeof option === 'object' ? (option.detail ?? option.description ?? null) : null;
  const score     = typeof option === 'object' ? (option.score ?? option.feasibilityScore ?? null) : null;
  const delay     = typeof option === 'object' ? (option.delayMinutes ?? option.delay ?? null) : null;
  const capacity  = typeof option === 'object' ? (option.capacityImpact ?? null) : null;
  const trainIds  = typeof option === 'object' ? (Array.isArray(option.trainIds) ? option.trainIds : []) : [];
  const feasible  = typeof option === 'object' ? (option.feasible ?? option.viable ?? null) : null;

  const isClickable = typeof onSelectReroute === 'function';

  return (
    <li
      className={[
        'reroute-panel__option',
        isOptimal  ? 'reroute-panel__option--optimal'   : null,
        compact    ? 'reroute-panel__option--compact'   : null,
        isClickable? 'reroute-panel__option--clickable' : null,
        feasible === false ? 'reroute-panel__option--infeasible' : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'listitem'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`Reroute option ${idx + 1}: ${label}${isOptimal ? ' (optimal)' : ''}`}
      onClick={isClickable ? () => onSelectReroute(conflict, option) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectReroute(conflict, option); } } : undefined}
    >
      {isOptimal && (
        <span className="reroute-panel__option-optimal-badge" aria-label="Recommended option">★ Optimal</span>
      )}
      <div className="reroute-panel__option-header">
        <span className="reroute-panel__option-rank">#{idx + 1}</span>
        <span className="reroute-panel__option-label">{label}</span>
        {score != null && (
          <span className="reroute-panel__option-score" aria-label={`Score: ${score}`}>{score}</span>
        )}
        {feasible === false && <span className="reroute-panel__option-infeasible-tag">Infeasible</span>}
      </div>
      {!compact && detail && <div className="reroute-panel__option-detail">{detail}</div>}
      {!compact && (delay != null || capacity != null) && (
        <div className="reroute-panel__option-metrics">
          {delay != null && (
            <span className="reroute-panel__option-delay" aria-label={`Delay: ${delay} min`}>
              {delay > 0 ? `+${delay}` : delay}m delay
            </span>
          )}
          {capacity != null && (
            <span className="reroute-panel__option-capacity" aria-label={`Capacity impact: ${capacity}`}>
              Cap: {capacity}
            </span>
          )}
        </div>
      )}
      {!compact && trainIds.length > 0 && (
        <div className="reroute-panel__option-trains">
          {trainIds.slice(0, 3).map((id, i) => <span key={i} className="reroute-panel__option-train-chip">{id}</span>)}
          {trainIds.length > 3 && <span className="reroute-panel__option-train-chip reroute-panel__option-train-chip--overflow">+{trainIds.length - 3}</span>}
        </div>
      )}
    </li>
  );
}

function RerouteRailSummary({ options, optimal }) {
  return (
    <div className="reroute-panel__rail" aria-label="Reroute summary">
      <div className="reroute-panel__rail-title">Reroute Summary</div>
      <dl className="reroute-panel__rail-dl">
        <dt>Options</dt><dd>{options.length}</dd>
        <dt>Feasible</dt><dd>{options.filter((o) => typeof o === 'object' && o.feasible !== false).length}</dd>
        {optimal && <><dt>Optimal</dt><dd className="reroute-panel__rail-optimal">{optimal.label ?? optimal.route ?? 'Option 1'}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ReroutePanel({
  conflict        = null,
  layout          = null,
  title           = null,
  loading         = false,
  syncing         = false,
  isStale         = false,
  error           = null,
  compact         = false,
  onSelectReroute = null,
  onRetry         = null,
}) {
  const getTrainById = useTrainStore((s) => s.getTrainById);

  const options = useMemo(() => {
    if (Array.isArray(conflict?.rerouteOptions))    return conflict.rerouteOptions;
    if (Array.isArray(conflict?.resolutionOptions)) return conflict.resolutionOptions;
    return [];
  }, [conflict?.rerouteOptions, conflict?.resolutionOptions]);

  const optimal = useMemo(() => {
    const scored = options.filter((o) => typeof o === 'object' && o.score != null);
    if (scored.length === 0) return options[0] ?? null;
    return scored.reduce((best, cur) => (cur.score > best.score ? cur : best), scored[0]);
  }, [options]);

  const isEmpty       = !conflict && !loading;
  const resolvedTitle = title ?? (conflict?.type ? `Reroute Options — ${conflict.type}` : 'Reroute Options');

  const body = (
    <div
      className={[
        'reroute-panel',
        compact ? 'reroute-panel--compact' : null,
        isStale ? 'reroute-panel--stale'   : null,
        error   ? 'reroute-panel--error'   : null,
        syncing ? 'reroute-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="reroute-panel__empty" role="status">No conflict selected.</div>
      ) : options.length === 0 ? (
        <div className="reroute-panel__no-options" role="status">No reroute options available.</div>
      ) : (
        <ol className="reroute-panel__options-list"
          aria-label={`${options.length} reroute option${options.length !== 1 ? 's' : ''}`}>
          {options.map((opt, idx) => (
            <RerouteOptionCard
              key={idx}
              option={opt}
              idx={idx}
              isOptimal={opt === optimal}
              compact={compact}
              conflict={conflict}
              onSelectReroute={onSelectReroute}
            />
          ))}
        </ol>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{options.length} reroute option{options.length !== 1 ? 's' : ''}<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<RerouteRailSummary options={options} optimal={optimal} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(conflict)}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={body}
        right={<RerouteRailSummary options={options} optimal={optimal} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

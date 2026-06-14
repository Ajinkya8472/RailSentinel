import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * ResolutionPanel — deep-review resolution workflow surface for Module-6
 * Smart Scheduling. Renders the complete resolution state of a ScheduleConflict:
 *
 *   1. Resolution Status    — current resolutionStatus, approvedBy,
 *                            resolutionAction, resolutionNotes.
 *   2. Resolution Options   — `resolutionOptions[]` or `rerouteOptions[]`
 *                            as ranked action items: reroute, delay,
 *                            cancel, merge.
 *   3. Optimization Output  — `optimizationResult` / `optimizationScore`
 *                            if available from the `/optimize` endpoint.
 *   4. Approval Chain       — approver name, approved/rejected at timestamps.
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/trainStore` (read-only — resolves train names)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `conflict`     (object|null)  — ScheduleConflict entity (default: null)
 * - `layout`       ('detail'|'split'|null) (default: null)
 * - `title`        (string|null)  (default: null)
 * - `loading`      (boolean)      (default: false)
 * - `syncing`      (boolean)      (default: false)
 * - `isStale`      (boolean)      (default: false)
 * - `error`        (any)          (default: null)
 * - `compact`      (boolean)      (default: false)
 * - `onResolve`    (fn|null)      — callback with conflict + selectedOption
 * - `onRetry`      (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RES_STATUS_CONFIG = {
  pending:     { label: 'Pending',     cssModifier: 'pending'     },
  'in-progress':{ label: 'In Progress', cssModifier: 'in-progress' },
  resolved:    { label: 'Resolved',    cssModifier: 'resolved'    },
  approved:    { label: 'Approved',    cssModifier: 'approved'    },
  rejected:    { label: 'Rejected',    cssModifier: 'rejected'    },
};

function resStatusConfig(k) { return RES_STATUS_CONFIG[String(k ?? 'pending').toLowerCase()] ?? RES_STATUS_CONFIG.pending; }

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="resolution-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function ResolutionStatusSection({ conflict, compact }) {
  const rsCfg = resStatusConfig(conflict?.resolutionStatus);
  return (
    <section className="resolution-panel__section" aria-label="Resolution Status">
      <h3 className="resolution-panel__section-title">Resolution Status</h3>
      <div className={`resolution-panel__status resolution-panel__status--${rsCfg.cssModifier}`}
        aria-label={`Resolution status: ${rsCfg.label}`}>
        {rsCfg.label}
      </div>
      <dl className="resolution-panel__field-list">
        {conflict?.resolutionAction && <><dt>Action</dt><dd>{conflict.resolutionAction}</dd></>}
        {conflict?.resolutionNotes  && <><dt>Notes</dt><dd>{conflict.resolutionNotes}</dd></>}
        {conflict?.approvedBy       && <><dt>Approved By</dt><dd>{conflict.approvedBy}</dd></>}
        {conflict?.resolvedAt       && <><dt>Resolved At</dt><dd>{formatWhen(conflict.resolvedAt)}</dd></>}
        {conflict?.rejectedAt       && <><dt>Rejected At</dt><dd>{formatWhen(conflict.rejectedAt)}</dd></>}
      </dl>
    </section>
  );
}

function ResolutionOptionsSection({ conflict, compact, onResolve }) {
  const options = useMemo(() => {
    if (Array.isArray(conflict?.resolutionOptions)) return conflict.resolutionOptions;
    if (Array.isArray(conflict?.rerouteOptions))    return conflict.rerouteOptions;
    return [];
  }, [conflict?.resolutionOptions, conflict?.rerouteOptions]);

  return (
    <section className="resolution-panel__section" aria-label="Resolution Options">
      <h3 className="resolution-panel__section-title">Resolution Options</h3>
      {options.length === 0 ? (
        <div className="resolution-panel__empty-note" role="note">No resolution options available.</div>
      ) : (
        <ol className="resolution-panel__options-list">
          {options.map((opt, idx) => {
            const label  = typeof opt === 'string' ? opt : (opt.label ?? opt.action ?? opt.type ?? `Option ${idx + 1}`);
            const detail = typeof opt === 'object' ? (opt.detail ?? opt.description ?? null) : null;
            const score  = typeof opt === 'object' ? (opt.score ?? opt.impactScore ?? null) : null;
            return (
              <li key={idx} className="resolution-panel__option-row"
                aria-label={`Option ${idx + 1}: ${label}`}>
                <div className="resolution-panel__option-body">
                  <span className="resolution-panel__option-label">{label}</span>
                  {!compact && detail && <span className="resolution-panel__option-detail">{detail}</span>}
                  {score != null && <span className="resolution-panel__option-score">Score: {score}</span>}
                </div>
                {typeof onResolve === 'function' && String(conflict?.status ?? '').toLowerCase() !== 'resolved' && (
                  <button type="button" className="resolution-panel__option-btn"
                    aria-label={`Apply: ${label}`}
                    onClick={() => onResolve(conflict, opt)}>Apply</button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function OptimizationSection({ conflict, compact }) {
  const result = conflict?.optimizationResult ?? null;
  const score  = conflict?.optimizationScore  ?? null;
  if (result == null && score == null) return null;
  return (
    <section className="resolution-panel__section" aria-label="Optimization Output">
      <h3 className="resolution-panel__section-title">Optimization</h3>
      {score != null && (
        <div className="resolution-panel__opt-score"
          role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Optimization score: ${score}`}>
          <div className="resolution-panel__opt-bar"
            style={{ width: `${Math.min(100, score)}%` }} aria-hidden="true" />
          <span className="resolution-panel__opt-value">{score}/100</span>
        </div>
      )}
      {!compact && result && (
        <div className="resolution-panel__opt-result">
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </div>
      )}
    </section>
  );
}

function ResolutionRailSummary({ conflict }) {
  const rsCfg = resStatusConfig(conflict?.resolutionStatus);
  return (
    <div className="resolution-panel__rail" aria-label="Resolution summary">
      <div className="resolution-panel__rail-title">Resolution</div>
      <dl className="resolution-panel__rail-dl">
        <dt>Status</dt>
        <dd className={`resolution-panel__rail-status--${rsCfg.cssModifier}`}>{rsCfg.label}</dd>
        {conflict?.resolutionAction && <><dt>Action</dt><dd>{conflict.resolutionAction}</dd></>}
        {conflict?.approvedBy       && <><dt>Approver</dt><dd>{conflict.approvedBy}</dd></>}
        {conflict?.resolvedAt       && <><dt>Resolved</dt><dd>{formatWhen(conflict.resolvedAt)}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ResolutionPanel({
  conflict   = null,
  layout     = null,
  title      = null,
  loading    = false,
  syncing    = false,
  isStale    = false,
  error      = null,
  compact    = false,
  onResolve  = null,
  onRetry    = null,
}) {
  const isEmpty       = !conflict && !loading;
  const resolvedTitle = title ?? (conflict ? `Resolution — ${conflict.type ?? conflict.id}` : 'Conflict Resolution');

  const body = (
    <div
      className={[
        'resolution-panel',
        compact ? 'resolution-panel--compact' : null,
        isStale ? 'resolution-panel--stale'   : null,
        error   ? 'resolution-panel--error'   : null,
        syncing ? 'resolution-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="resolution-panel__empty" role="status">No conflict selected.</div>
      ) : (
        <>
          <ResolutionStatusSection conflict={conflict} compact={compact} />
          <ResolutionOptionsSection conflict={conflict} compact={compact} onResolve={onResolve} />
          <OptimizationSection conflict={conflict} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={conflict && <div className="resolution-panel__detail-summary">{resStatusConfig(conflict.resolutionStatus).label}<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={conflict ? <ResolutionRailSummary conflict={conflict} /> : null}
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
        right={conflict ? <ResolutionRailSummary conflict={conflict} /> : null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

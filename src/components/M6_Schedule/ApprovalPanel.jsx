import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * ApprovalPanel — approval workflow surface for Module-6 Smart Scheduling.
 * Renders the approval status, approver identity, decision audit trail, and
 * pending approvals requiring action across one or multiple ScheduleConflict
 * entities.
 *
 * Sections:
 *   1. Approval Status     — resolutionStatus: 'approved'|'rejected'|'pending'
 *                           with approvedBy, approvedAt, rejectedAt, rejectionReason
 *   2. Pending Approvals   — conflicts with resolutionStatus: 'pending', sorted
 *                           by severity desc. Supports optional approve/reject
 *                           callbacks.
 *   3. Approval History    — approved/rejected conflicts with decision timestamps
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `conflict`          (object|null)  — single anchor conflict (default: null)
 * - `conflicts`         (object[])     — list mode (default: [])
 * - `layout`            ('detail'|'split'|null) (default: null)
 * - `title`             (string|null)  (default: null)
 * - `loading`           (boolean)      (default: false)
 * - `syncing`           (boolean)      (default: false)
 * - `isStale`           (boolean)      (default: false)
 * - `error`             (any)          (default: null)
 * - `compact`           (boolean)      (default: false)
 * - `onApprove`         (fn|null)      — callback(conflict)
 * - `onReject`          (fn|null)      — callback(conflict, reason)
 * - `onRetry`           (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPROVAL_CONFIG = {
  pending:      { label: 'Pending Approval', cssModifier: 'pending',  icon: '…' },
  'in-progress':{ label: 'In Progress',      cssModifier: 'progress', icon: '↺' },
  approved:     { label: 'Approved',         cssModifier: 'approved', icon: '✔' },
  rejected:     { label: 'Rejected',         cssModifier: 'rejected', icon: '✗' },
  resolved:     { label: 'Resolved',         cssModifier: 'resolved', icon: '✓' },
};

function appCfg(k) { return APPROVAL_CONFIG[String(k ?? 'pending').toLowerCase()] ?? APPROVAL_CONFIG.pending; }
function sevRank(k) { return ['low','medium','high','critical'].indexOf(String(k ?? 'low').toLowerCase()); }

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="approval-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function SingleApprovalStatus({ conflict, compact, onApprove, onReject }) {
  const cfg     = appCfg(conflict?.resolutionStatus);
  const isOpen  = !['approved','rejected','resolved'].includes(String(conflict?.resolutionStatus ?? '').toLowerCase());
  return (
    <section className="approval-panel__section" aria-label="Approval Status">
      <h3 className="approval-panel__section-title">Approval Status</h3>
      <div className={`approval-panel__status approval-panel__status--${cfg.cssModifier}`} aria-label={cfg.label}>
        <span aria-hidden="true">{cfg.icon}</span> {cfg.label}
      </div>
      <dl className="approval-panel__field-list">
        {conflict?.approvedBy    && <><dt>Approved By</dt><dd>{conflict.approvedBy}</dd></>}
        {conflict?.approvedAt    && <><dt>Approved At</dt><dd>{formatWhen(conflict.approvedAt)}</dd></>}
        {conflict?.rejectedAt    && <><dt>Rejected At</dt><dd>{formatWhen(conflict.rejectedAt)}</dd></>}
        {conflict?.rejectionReason && <><dt>Rejection Reason</dt><dd>{conflict.rejectionReason}</dd></>}
        {conflict?.resolutionAction && <><dt>Proposed Action</dt><dd>{conflict.resolutionAction}</dd></>}
      </dl>
      {isOpen && (typeof onApprove === 'function' || typeof onReject === 'function') && (
        <div className="approval-panel__actions" role="group" aria-label="Approval actions">
          {typeof onApprove === 'function' && (
            <button type="button" className="approval-panel__btn approval-panel__btn--approve"
              aria-label="Approve resolution"
              onClick={() => onApprove(conflict)}>Approve</button>
          )}
          {typeof onReject === 'function' && (
            <button type="button" className="approval-panel__btn approval-panel__btn--reject"
              aria-label="Reject resolution"
              onClick={() => onReject(conflict, null)}>Reject</button>
          )}
        </div>
      )}
    </section>
  );
}

function PendingApprovalsSection({ pending, compact, onApprove, onReject }) {
  return (
    <section className="approval-panel__section" aria-label="Pending Approvals">
      <h3 className="approval-panel__section-title">
        Pending Approvals
        <span className="approval-panel__section-badge">{pending.length}</span>
      </h3>
      {pending.length === 0 ? (
        <div className="approval-panel__empty-note" role="note">No pending approvals.</div>
      ) : (
        <ul className="approval-panel__pending-list">
          {pending.map((c) => (
            <li key={c.id}
              className={`approval-panel__pending-row approval-panel__pending-row--${String(c.severity ?? 'low').toLowerCase()}`}
              aria-label={`${c.type ?? c.id}: pending approval`}>
              <div className="approval-panel__pending-body">
                <span className="approval-panel__pending-type">{c.type ?? c.id}</span>
                {c.resolutionAction && !compact && (
                  <span className="approval-panel__pending-action">{c.resolutionAction}</span>
                )}
                <span className={`approval-panel__pending-sev approval-panel__pending-sev--${String(c.severity ?? 'low').toLowerCase()}`}>
                  {c.severity ?? 'low'}
                </span>
              </div>
              <div className="approval-panel__pending-actions" role="group">
                {typeof onApprove === 'function' && (
                  <button type="button" className="approval-panel__btn approval-panel__btn--approve approval-panel__btn--sm"
                    aria-label={`Approve: ${c.type ?? c.id}`}
                    onClick={() => onApprove(c)}>✔</button>
                )}
                {typeof onReject === 'function' && (
                  <button type="button" className="approval-panel__btn approval-panel__btn--reject approval-panel__btn--sm"
                    aria-label={`Reject: ${c.type ?? c.id}`}
                    onClick={() => onReject(c, null)}>✗</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApprovalHistorySection({ history, compact }) {
  if (history.length === 0) return null;
  return (
    <section className="approval-panel__section" aria-label="Approval History">
      <h3 className="approval-panel__section-title">History</h3>
      <ul className="approval-panel__history-list">
        {history.slice(0, 10).map((c) => {
          const resSt = String(c.resolutionStatus ?? '').toLowerCase();
          const cfg   = appCfg(resSt);
          return (
            <li key={c.id}
              className={`approval-panel__history-row approval-panel__history-row--${cfg.cssModifier}`}
              aria-label={`${c.type ?? c.id}: ${cfg.label}`}>
              <span className="approval-panel__history-icon" aria-hidden="true">{cfg.icon}</span>
              <span className="approval-panel__history-type">{c.type ?? c.id}</span>
              {!compact && (
                <span className="approval-panel__history-ts">
                  {formatWhen(c.approvedAt ?? c.rejectedAt ?? c.resolvedAt)}
                </span>
              )}
              {c.approvedBy && !compact && <span className="approval-panel__history-approver">{c.approvedBy}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ApprovalRailSummary({ pending, approved, rejected }) {
  return (
    <div className="approval-panel__rail" aria-label="Approval summary">
      <div className="approval-panel__rail-title">Approvals</div>
      <dl className="approval-panel__rail-dl">
        <dt>Pending</dt><dd className={pending > 0 ? 'approval-panel__rail-val--pending' : ''}>{pending}</dd>
        <dt>Approved</dt><dd className="approval-panel__rail-val--approved">{approved}</dd>
        <dt>Rejected</dt><dd className={rejected > 0 ? 'approval-panel__rail-val--rejected' : ''}>{rejected}</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ApprovalPanel({
  conflict    = null,
  conflicts   = [],
  layout      = null,
  title       = null,
  loading     = false,
  syncing     = false,
  isStale     = false,
  error       = null,
  compact     = false,
  onApprove   = null,
  onReject    = null,
  onRetry     = null,
}) {
  const source = useMemo(() => {
    if (conflict) return [conflict];
    return conflicts;
  }, [conflict, conflicts]);

  const isSingle  = Boolean(conflict) && conflicts.length === 0;

  const pending  = useMemo(() =>
    source
      .filter((c) => String(c.resolutionStatus ?? '').toLowerCase() === 'pending')
      .sort((a, b) => sevRank(b.severity) - sevRank(a.severity)),
  [source]);

  const approved = useMemo(() =>
    source.filter((c) => String(c.resolutionStatus ?? '').toLowerCase() === 'approved'),
  [source]);

  const rejected = useMemo(() =>
    source.filter((c) => String(c.resolutionStatus ?? '').toLowerCase() === 'rejected'),
  [source]);

  const history = useMemo(() => [...approved, ...rejected]
    .sort((a, b) => String(b.approvedAt ?? b.rejectedAt ?? '').localeCompare(String(a.approvedAt ?? a.rejectedAt ?? ''))),
  [approved, rejected]);

  const isEmpty       = source.length === 0 && !loading;
  const resolvedTitle = title ?? 'Approval Workflow';

  const body = (
    <div
      className={[
        'approval-panel',
        compact ? 'approval-panel--compact' : null,
        isStale ? 'approval-panel--stale'   : null,
        error   ? 'approval-panel--error'   : null,
        syncing ? 'approval-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="approval-panel__empty" role="status">No conflicts to approve.</div>
      ) : (
        <>
          {isSingle && <SingleApprovalStatus conflict={conflict} compact={compact} onApprove={onApprove} onReject={onReject} />}
          {!isSingle && <PendingApprovalsSection pending={pending} compact={compact} onApprove={onApprove} onReject={onReject} />}
          <ApprovalHistorySection history={history} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{pending.length} pending<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<ApprovalRailSummary pending={pending.length} approved={approved.length} rejected={rejected.length} />}
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
        right={<ApprovalRailSummary pending={pending.length} approved={approved.length} rejected={rejected.length} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

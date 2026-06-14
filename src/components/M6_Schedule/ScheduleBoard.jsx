import React, { memo, useMemo, useState, useId } from 'react';
import useUiStore from '../../store/uiStore';
import useTrainStore from '../../store/trainStore';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import ConflictCard from './ConflictCard';
import ScheduleKPIs from './ScheduleKPIs';
import ScheduleFilters from './ScheduleFilters';

/**
 * Purpose:
 * ScheduleBoard — primary orchestration surface for Module-6 Smart Scheduling.
 * Renders a DashboardLayout conflict board with three swim lanes:
 *
 *   1. Critical / Unresolved — severity: 'critical' + status ≠ 'resolved'
 *   2. Pending Resolution    — resolutionStatus: 'pending' | 'in-progress'
 *   3. Escalated             — escalationLevel > 0
 *
 * Also composes ScheduleKPIs and ScheduleFilters. Caller sources
 * `conflicts` from scheduleService — this component is strictly display-only.
 *
 * Store integrations (read-only):
 * - uiStore: `selectedScheduleConflictId` for active-card highlight
 * - trainStore: `getTrainById` for resolving conflicting train names
 *
 * Dependencies:
 * - React (memo, useMemo, useState, useId)
 * - `src/store/uiStore`  (read-only)
 * - `src/store/trainStore` (read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./ConflictCard`
 * - `./ScheduleKPIs`
 * - `./ScheduleFilters`
 *
 * Props:
 * - `conflicts`         (object[])  — ScheduleConflict array (default: [])
 * - `loading`           (boolean)   (default: false)
 * - `refreshing`        (boolean)   (default: false)
 * - `syncing`           (boolean)   (default: false)
 * - `error`             (any)       (default: null)
 * - `isStale`           (boolean)   (default: false)
 * - `layout`            ('detail'|'split'|null) (default: null)
 * - `title`             (string|null) (default: null)
 * - `maxCritical`       (number)    (default: 8)
 * - `maxPending`        (number)    (default: 8)
 * - `maxEscalated`      (number)    (default: 8)
 * - `compact`           (boolean)   (default: false)
 * - `onConflictOpen`    (fn|null)   — card click callback
 * - `onConflictResolve` (fn|null)   — resolve callback
 * - `onRetry`           (fn|null)   (default: null)
 *
 * State (derived only — zero store mutations):
 * - Local filter state via ScheduleFilters
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
function sevRank(k) { return SEVERITY_RANK[String(k ?? 'low').toLowerCase()] ?? 0; }

const DEFAULT_FILTERS = { severity: 'all', status: 'all', type: 'all', query: '' };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="schedule-board__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function SwimLane({ id, title, conflicts, compact, onOpen, onResolve, emptyMsg }) {
  return (
    <section id={id} className="schedule-board__swim-lane" aria-label={title}>
      <h3 className="schedule-board__lane-title">
        {title}
        <span className="schedule-board__lane-count">{conflicts.length}</span>
      </h3>
      {conflicts.length === 0 ? (
        <div className="schedule-board__lane-empty" role="status">{emptyMsg ?? 'No conflicts.'}</div>
      ) : (
        <div className="schedule-board__card-stack" role="list">
          {conflicts.map((c) => (
            <div key={c.id} role="listitem">
              <ConflictCard
                conflict={c}
                compact={compact}
                onOpen={onOpen}
                onResolve={onResolve}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ScheduleBoard({
  conflicts           = [],
  loading             = false,
  refreshing          = false,
  syncing             = false,
  error               = null,
  isStale             = false,
  layout              = null,
  title               = null,
  maxCritical         = 8,
  maxPending          = 8,
  maxEscalated        = 8,
  compact             = false,
  onConflictOpen      = null,
  onConflictResolve   = null,
  onRetry             = null,
}) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

  // ── Store (read-only) ─────────────────────────────────────────────────────
  const selectedScheduleConflictId = useUiStore((s) => s.selectedScheduleConflictId);

  // ── Filtered set ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = conflicts;
    if (filters.severity !== 'all')
      list = list.filter((c) => String(c.severity ?? '').toLowerCase() === filters.severity);
    if (filters.status !== 'all')
      list = list.filter((c) => String(c.status ?? '').toLowerCase() === filters.status);
    if (filters.type !== 'all')
      list = list.filter((c) => String(c.type ?? '').toLowerCase() === filters.type);
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      list = list.filter((c) =>
        String(c.id ?? '').toLowerCase().includes(q) ||
        String(c.type ?? '').toLowerCase().includes(q) ||
        (Array.isArray(c.affectedRouteSegments) && c.affectedRouteSegments.some((s) => String(s).toLowerCase().includes(q))),
      );
    }
    return list;
  }, [conflicts, filters]);

  // ── Swim lanes ────────────────────────────────────────────────────────────
  const critical = useMemo(() =>
    filtered
      .filter((c) => String(c.severity ?? '').toLowerCase() === 'critical' && String(c.status ?? '').toLowerCase() !== 'resolved')
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, maxCritical),
  [filtered, maxCritical]);

  const pending = useMemo(() =>
    filtered
      .filter((c) => ['pending', 'in-progress', 'in_progress'].includes(String(c.resolutionStatus ?? '').toLowerCase()))
      .sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, maxPending),
  [filtered, maxPending]);

  const escalated = useMemo(() =>
    filtered
      .filter((c) => (c.escalationLevel ?? 0) > 0 && String(c.status ?? '').toLowerCase() !== 'resolved')
      .sort((a, b) => (b.escalationLevel ?? 0) - (a.escalationLevel ?? 0))
      .slice(0, maxEscalated),
  [filtered, maxEscalated]);

  const isEmpty       = conflicts.length === 0 && !loading;
  const resolvedTitle = title ?? 'Schedule Conflict Board';

  const body = (
    <div
      className={[
        'schedule-board',
        compact ? 'schedule-board--compact' : null,
        isStale ? 'schedule-board--stale'   : null,
        error   ? 'schedule-board--error'   : null,
        syncing ? 'schedule-board--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      <ScheduleKPIs
        conflicts={conflicts}
        loading={loading}
        refreshing={refreshing}
        syncing={syncing}
        error={error}
        isStale={isStale}
        compact={compact}
      />

      {!compact && (
        <ScheduleFilters
          conflicts={conflicts}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      {isEmpty ? (
        <div className="schedule-board__empty" role="status">No schedule conflicts.</div>
      ) : (
        <div className="schedule-board__lanes">
          <SwimLane
            id="sb-lane-critical"
            title="Critical"
            conflicts={critical}
            compact={compact}
            onOpen={onConflictOpen}
            onResolve={onConflictResolve}
            emptyMsg="No critical unresolved conflicts."
          />
          <SwimLane
            id="sb-lane-pending"
            title="Pending Resolution"
            conflicts={pending}
            compact={compact}
            onOpen={onConflictOpen}
            onResolve={onConflictResolve}
            emptyMsg="No pending conflicts."
          />
          <SwimLane
            id="sb-lane-escalated"
            title="Escalated"
            conflicts={escalated}
            compact={compact}
            onOpen={onConflictOpen}
            onResolve={onConflictResolve}
            emptyMsg="No escalated conflicts."
          />
        </div>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={
          <div className="schedule-board__detail-summary">
            {filtered.length} conflict{filtered.length !== 1 ? 's' : ''}
            {critical.length > 0 && <span className="schedule-board__detail-critical">{critical.length} critical</span>}
            <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
          </div>
        }
        body={body}
        rail={<ScheduleKPIs conflicts={conflicts} compact={true} />}
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
        right={<ScheduleKPIs conflicts={conflicts} compact={true} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

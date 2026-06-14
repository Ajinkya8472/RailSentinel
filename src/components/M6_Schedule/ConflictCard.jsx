import React, { memo, useMemo } from 'react';
import useUiStore from '../../store/uiStore';
import useTrainStore from '../../store/trainStore';
import ScheduleStatusBadge from './ScheduleStatusBadge';

/**
 * Purpose:
 * ConflictCard — compact summary card for a single M6 ScheduleConflict entity.
 * Renders conflict type, severity badge, resolution status, affected route
 * segments, train path summary, timing window, and impact score.
 *
 * Store integrations (read-only):
 * - uiStore:    `selectedScheduleConflictId` for active-selection highlight
 * - trainStore: `getTrainById` to resolve `conflictingTrainIds[]` to names
 *
 * ScheduleConflict domain model fields rendered:
 * - `id`, `type`, `severity`, `status`, `resolutionStatus`
 * - `conflictingTrainIds[]`
 * - `affectedRouteSegments[]`
 * - `windowStart`, `windowEnd`
 * - `impactScore`
 * - `escalationLevel`
 * - `createdAt`, `updatedAt`
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/uiStore`    (read-only)
 * - `src/store/trainStore` (read-only)
 * - `./ScheduleStatusBadge`
 *
 * Props:
 * - `conflict`      (object)    — ScheduleConflict entity (required)
 * - `isLoading`     (boolean)   (default: false)
 * - `isStale`       (boolean)   (default: false)
 * - `compact`       (boolean)   (default: false)
 * - `onOpen`        (fn|null)   — card click callback
 * - `onResolve`     (fn|null)   — quick-resolve callback
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
  medium:   { label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { label: 'Critical', cssModifier: 'critical', icon: '✕' },
};

function sevConfig(k) { return SEVERITY_CONFIG[String(k ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low; }

function formatTime(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

function formatDate(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return null; }
}

function relativeTime(iso) {
  if (!iso) return null;
  try {
    const diff = Date.now() - Date.parse(iso);
    if (Number.isNaN(diff)) return null;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    if (h >= 24) return `${Math.floor(h / 24)}d ago`;
    if (h >= 1)  return `${h}h ago`;
    if (m >= 1)  return `${m}m ago`;
    return 'Just now';
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ConflictCard({
  conflict     = null,
  isLoading    = false,
  isStale      = false,
  compact      = false,
  onOpen       = null,
  onResolve    = null,
}) {
  // ── Store (read-only) ─────────────────────────────────────────────────────
  const selectedScheduleConflictId = useUiStore((s) => s.selectedScheduleConflictId);
  const getTrainById               = useTrainStore((s) => s.getTrainById);

  // ── Derived values ────────────────────────────────────────────────────────
  const isSelected = conflict?.id === selectedScheduleConflictId;
  const sevCfg     = sevConfig(conflict?.severity);
  const isOpen     = String(conflict?.status ?? '').toLowerCase() !== 'resolved';
  const isClick    = typeof onOpen === 'function';
  const timeAgo    = relativeTime(conflict?.updatedAt ?? conflict?.createdAt);

  const trainNames = useMemo(() => {
    const ids = Array.isArray(conflict?.conflictingTrainIds) ? conflict.conflictingTrainIds : [];
    return ids.slice(0, 3).map((id) => {
      const train = typeof getTrainById === 'function' ? getTrainById(id) : null;
      return train?.name ?? train?.number ?? String(id);
    });
  }, [conflict?.conflictingTrainIds, getTrainById]);

  const routeSegs = useMemo(() => {
    const arr = Array.isArray(conflict?.affectedRouteSegments) ? conflict.affectedRouteSegments : [];
    return arr.slice(0, 3);
  }, [conflict?.affectedRouteSegments]);

  const windowStart = formatTime(conflict?.windowStart);
  const windowEnd   = formatTime(conflict?.windowEnd);
  const windowDate  = formatDate(conflict?.windowStart);

  if (!conflict) {
    return (
      <div className="conflict-card conflict-card--empty" role="status">No conflict data.</div>
    );
  }

  return (
    <article
      className={[
        'conflict-card',
        `conflict-card--${sevCfg.cssModifier}`,
        isOpen     ? 'conflict-card--open'     : 'conflict-card--resolved',
        isSelected ? 'conflict-card--selected' : null,
        compact    ? 'conflict-card--compact'  : null,
        isStale    ? 'conflict-card--stale'    : null,
        isLoading  ? 'conflict-card--loading'  : null,
        isClick    ? 'conflict-card--clickable': null,
      ].filter(Boolean).join(' ')}
      aria-label={`${sevCfg.label} conflict: ${conflict.type ?? conflict.id}`}
      aria-selected={isSelected}
      role={isClick ? 'button' : 'article'}
      tabIndex={isClick ? 0 : undefined}
      onClick={isClick ? () => onOpen(conflict) : undefined}
      onKeyDown={isClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(conflict); } } : undefined}
    >
      {/* Severity stripe */}
      <div className={`conflict-card__stripe conflict-card__stripe--${sevCfg.cssModifier}`} aria-hidden="true" />

      {/* Header */}
      <div className="conflict-card__header">
        <ScheduleStatusBadge conflict={conflict} isLoading={isLoading} isStale={isStale} size="sm" />
        <span className="conflict-card__type">{conflict.type ?? 'Conflict'}</span>
        {conflict.escalationLevel > 0 && (
          <span className="conflict-card__escalation-badge" aria-label={`Escalation level ${conflict.escalationLevel}`}>
            L{conflict.escalationLevel}
          </span>
        )}
        {timeAgo && <span className="conflict-card__time">{timeAgo}</span>}
      </div>

      {/* Route segments */}
      {routeSegs.length > 0 && (
        <div className="conflict-card__routes" aria-label={`Affected route segments: ${routeSegs.join(', ')}`}>
          <span aria-hidden="true">🛤</span>
          {routeSegs.map((seg, idx) => (
            <span key={idx} className="conflict-card__route-chip">{seg}</span>
          ))}
          {(conflict.affectedRouteSegments?.length ?? 0) > 3 && (
            <span className="conflict-card__route-chip conflict-card__route-chip--overflow">
              +{(conflict.affectedRouteSegments?.length ?? 0) - 3}
            </span>
          )}
        </div>
      )}

      {/* Train path summary */}
      {trainNames.length > 0 && (
        <div className="conflict-card__trains" aria-label={`Conflicting trains: ${trainNames.join(', ')}`}>
          <span aria-hidden="true">🚆</span>
          {trainNames.map((name, idx) => (
            <span key={idx} className="conflict-card__train-chip">{name}</span>
          ))}
          {(conflict.conflictingTrainIds?.length ?? 0) > 3 && (
            <span className="conflict-card__train-chip conflict-card__train-chip--overflow">
              +{(conflict.conflictingTrainIds?.length ?? 0) - 3}
            </span>
          )}
        </div>
      )}

      {/* Timing window */}
      {(windowStart || windowEnd) && (
        <div className="conflict-card__window" aria-label={`Conflict window: ${windowDate ?? ''} ${windowStart ?? ''} — ${windowEnd ?? ''}`}>
          <span aria-hidden="true">🕐</span>
          {windowDate && <span className="conflict-card__window-date">{windowDate}</span>}
          {windowStart && <span className="conflict-card__window-time">{windowStart}</span>}
          {windowEnd   && <><span aria-hidden="true">→</span><span className="conflict-card__window-time">{windowEnd}</span></>}
        </div>
      )}

      {/* Impact score */}
      {!compact && conflict.impactScore != null && (
        <div className="conflict-card__impact" aria-label={`Impact score: ${conflict.impactScore}`}>
          <span className="conflict-card__impact-label">Impact</span>
          <div className="conflict-card__impact-bar"
            role="meter" aria-valuenow={conflict.impactScore} aria-valuemin={0} aria-valuemax={100}>
            <div className={`conflict-card__impact-fill conflict-card__impact-fill--${sevCfg.cssModifier}`}
              style={{ width: `${Math.min(100, conflict.impactScore)}%` }} aria-hidden="true" />
          </div>
          <span className="conflict-card__impact-value">{conflict.impactScore}</span>
        </div>
      )}

      {/* Stale/loading pills */}
      {(isStale || isLoading) && (
        <div className="conflict-card__pills">
          {isLoading && <span className="train-pill" role="status">Loading</span>}
          {isStale   && <span className="train-pill train-pill--stale" role="status">Stale</span>}
        </div>
      )}

      {/* Resolve action */}
      {!compact && isOpen && typeof onResolve === 'function' && (
        <div className="conflict-card__actions" role="group" aria-label="Conflict actions">
          <button type="button" className="conflict-card__btn conflict-card__btn--resolve"
            aria-label="Resolve this conflict"
            onClick={(e) => { e.stopPropagation(); onResolve(conflict); }}>
            Resolve
          </button>
        </div>
      )}
    </article>
  );
});

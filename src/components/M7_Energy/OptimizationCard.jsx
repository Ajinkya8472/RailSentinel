import React, { memo, useMemo } from 'react';
import EnergyStatusBadge from './EnergyStatusBadge';

/**
 * Purpose:
 * OptimizationCard — compact M7 optimization recommendation card. Renders one
 * recommendation item from `EnergyProfile.recommendations[]` with:
 *
 *   - Title / type of optimization
 *   - Expected savings (kWh / %)
 *   - Confidence score
 *   - Operational impact (delay / disruption)
 *   - Current execution status
 *   - Three action affordances: Accept / Defer / Escalate
 *
 * CRITICAL: Every `onAccept` invocation MUST create an OperatorAction record.
 * The parent caller is responsible for this; this component fires the callback
 * with `{ recommendation, profile, action: 'accept', timestamp: ISO }` context.
 * Similarly, `onDefer` and `onEscalate` pass their own action context.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `./EnergyStatusBadge`
 *
 * Props:
 * - `recommendation` (object)      — single recommendation object (required)
 * - `profile`        (object|null) — parent EnergyProfile entity (default: null)
 * - `isLoading`      (boolean)     (default: false)
 * - `isStale`        (boolean)     (default: false)
 * - `compact`        (boolean)     (default: false)
 * - `onAccept`       (fn|null)     — callback({ recommendation, profile, action, timestamp })
 * - `onDefer`        (fn|null)     — callback({ recommendation, profile, action, timestamp })
 * - `onEscalate`     (fn|null)     — callback({ recommendation, profile, action, timestamp })
 * - `onOpen`         (fn|null)     — card open/detail callback
 *
 * State: none — all display derived from props.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  pending:      { label: 'Pending',     cssModifier: 'pending'    },
  accepted:     { label: 'Accepted',    cssModifier: 'accepted'   },
  'in-progress':{ label: 'In Progress', cssModifier: 'in-progress'},
  deferred:     { label: 'Deferred',    cssModifier: 'deferred'   },
  completed:    { label: 'Completed',   cssModifier: 'completed'  },
  escalated:    { label: 'Escalated',   cssModifier: 'escalated'  },
  rejected:     { label: 'Rejected',    cssModifier: 'rejected'   },
};

function statusConfig(k) { return STATUS_CONFIG[String(k ?? 'pending').toLowerCase()] ?? STATUS_CONFIG.pending; }

function buildActionContext(recommendation, profile, action) {
  return {
    recommendation,
    profile,
    action,
    timestamp: new Date().toISOString(),
    operatorActionType: 'energy_optimization',
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function OptimizationCard({
  recommendation = null,
  profile        = null,
  isLoading      = false,
  isStale        = false,
  compact        = false,
  onAccept       = null,
  onDefer        = null,
  onEscalate     = null,
  onOpen         = null,
}) {
  if (!recommendation) {
    return <div className="optimization-card optimization-card--empty" role="status">No recommendation.</div>;
  }

  const stCfg       = statusConfig(recommendation.status);
  const isOpen      = !['completed', 'rejected', 'deferred'].includes(String(recommendation.status ?? 'pending').toLowerCase());
  const isClickable = typeof onOpen === 'function';

  const confidence  = recommendation.confidence ?? null;
  const savings     = recommendation.expectedSavings ?? recommendation.savingsKWh ?? null;
  const savingsPct  = recommendation.savingsPercent  ?? recommendation.savingsPct  ?? null;
  const impact      = recommendation.operationalImpact ?? recommendation.impact ?? null;
  const title       = recommendation.title ?? recommendation.type ?? recommendation.action ?? 'Optimization Recommendation';
  const detail      = recommendation.description ?? recommendation.detail ?? null;

  return (
    <article
      className={[
        'optimization-card',
        `optimization-card--${stCfg.cssModifier}`,
        isOpen     ? 'optimization-card--open'     : 'optimization-card--closed',
        compact    ? 'optimization-card--compact'  : null,
        isStale    ? 'optimization-card--stale'    : null,
        isLoading  ? 'optimization-card--loading'  : null,
        isClickable? 'optimization-card--clickable': null,
      ].filter(Boolean).join(' ')}
      aria-label={`Optimization: ${title}`}
      role={isClickable ? 'button' : 'article'}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onOpen(recommendation, profile) : undefined}
      onKeyDown={isClickable
        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(recommendation, profile); } }
        : undefined}
    >
      {/* Header */}
      <div className="optimization-card__header">
        <span className={`optimization-card__status optimization-card__status--${stCfg.cssModifier}`}>{stCfg.label}</span>
        <EnergyStatusBadge profile={profile} isLoading={isLoading} isStale={isStale} size="sm" showLabel={false} />
      </div>

      {/* Title */}
      <div className="optimization-card__title">{title}</div>
      {!compact && detail && <div className="optimization-card__detail">{detail}</div>}

      {/* Metrics row */}
      <div className="optimization-card__metrics">
        {savings != null && (
          <div className="optimization-card__metric" aria-label={`Expected savings: ${savings} kWh`}>
            <span className="optimization-card__metric-value">↓{savings}</span>
            <span className="optimization-card__metric-unit">kWh</span>
            {savingsPct != null && <span className="optimization-card__metric-pct">({savingsPct}%)</span>}
          </div>
        )}
        {confidence != null && (
          <div className="optimization-card__confidence" aria-label={`Confidence: ${confidence}%`}>
            <div className="optimization-card__confidence-bar" role="meter"
              aria-valuenow={confidence} aria-valuemin={0} aria-valuemax={100}>
              <div className="optimization-card__confidence-fill"
                style={{ width: `${Math.min(100, confidence)}%` }} aria-hidden="true" />
            </div>
            <span className="optimization-card__confidence-value">{confidence}%</span>
          </div>
        )}
      </div>

      {/* Operational impact */}
      {!compact && impact && (
        <div className="optimization-card__impact" aria-label={`Operational impact: ${typeof impact === 'string' ? impact : JSON.stringify(impact)}`}>
          <span className="optimization-card__impact-label">Impact:</span>
          <span className="optimization-card__impact-value">{typeof impact === 'string' ? impact : JSON.stringify(impact)}</span>
        </div>
      )}

      {/* Action buttons — only shown when recommendation is actionable */}
      {isOpen && (typeof onAccept === 'function' || typeof onDefer === 'function' || typeof onEscalate === 'function') && (
        <div className="optimization-card__actions" role="group" aria-label="Optimization actions">
          {typeof onAccept === 'function' && (
            <button type="button"
              className="optimization-card__btn optimization-card__btn--accept"
              aria-label={`Accept: ${title}`}
              onClick={(e) => { e.stopPropagation(); onAccept(buildActionContext(recommendation, profile, 'accept')); }}>
              ✔ Accept
            </button>
          )}
          {typeof onDefer === 'function' && (
            <button type="button"
              className="optimization-card__btn optimization-card__btn--defer"
              aria-label={`Defer: ${title}`}
              onClick={(e) => { e.stopPropagation(); onDefer(buildActionContext(recommendation, profile, 'defer')); }}>
              ⏸ Defer
            </button>
          )}
          {typeof onEscalate === 'function' && (
            <button type="button"
              className="optimization-card__btn optimization-card__btn--escalate"
              aria-label={`Escalate: ${title}`}
              onClick={(e) => { e.stopPropagation(); onEscalate(buildActionContext(recommendation, profile, 'escalate')); }}>
              ▲ Escalate
            </button>
          )}
        </div>
      )}

      {/* State pills */}
      {(isStale || isLoading) && (
        <div className="optimization-card__pills">
          {isLoading && <span className="train-pill" role="status">Loading</span>}
          {isStale   && <span className="train-pill train-pill--stale" role="status">Stale</span>}
        </div>
      )}
    </article>
  );
});

import React, { memo, useMemo } from 'react';
import useRiskStore from '../../store/riskStore';
import RiskSeverityBadge from './RiskSeverityBadge';
import RiskConfidenceIndicator from './RiskConfidenceIndicator';

/**
 * Purpose:
 * RiskInsightCard — compact single-entity summary card for Module-8 Risk
 * Intelligence. Renders one RiskScore entity as a pressable card for
 * use in list views, the RiskMatrix, and the RiskPrioritySummary.
 *
 * Content:
 *   - Severity badge + score
 *   - Name / title / category
 *   - Source and domain labels
 *   - Confidence indicator (compact)
 *   - Priority rank (if present)
 *   - computedAt timestamp
 *   - Selected / focused ring
 *
 * Selection integration:
 *   Clicking the card fires `riskStore.selectRiskScore(id)` if no `onSelect`
 *   prop is supplied. If `onSelect` is supplied it takes precedence.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore` (selectRiskScore, selectedRiskScoreId)
 * - `./RiskSeverityBadge`
 * - `./RiskConfidenceIndicator`
 *
 * Props:
 * - `riskScore`    (object)       — RiskScore entity (required)
 * - `isSelected`   (boolean)      (default: false) — override from parent
 * - `isFocused`    (boolean)      (default: false)
 * - `isLoading`    (boolean)      (default: false)
 * - `isStale`      (boolean)      (default: false)
 * - `compact`      (boolean)      (default: false)
 * - `showPriority` (boolean)      (default: true)
 * - `onSelect`     (fn|null)      — override selection handler
 *
 * State: derives isSelected from riskStore if not overridden by prop.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskInsightCard({
  riskScore    = null,
  isSelected   = false,
  isFocused    = false,
  isLoading    = false,
  isStale      = false,
  compact      = false,
  showPriority = true,
  onSelect     = null,
}) {
  // Store-backed selection
  const storeSelectedId  = useRiskStore((s) => s.selectedRiskScoreId);
  const selectRiskScore  = useRiskStore((s) => s.selectRiskScore);

  const effectiveSelected = isSelected || storeSelectedId === riskScore?.id;

  function handleSelect() {
    if (!riskScore) return;
    if (typeof onSelect === 'function') { onSelect(riskScore); return; }
    selectRiskScore(riskScore.id);
  }

  if (!riskScore) {
    return <div className="risk-insight-card risk-insight-card--empty" role="status">No risk data.</div>;
  }

  const band     = String(riskScore.severityBand ?? '').toLowerCase();
  const name     = riskScore.name ?? riskScore.title ?? riskScore.id;
  const category = riskScore.category ?? null;
  const source   = riskScore.source   ?? null;
  const domain   = riskScore.domain   ?? riskScore.domainArea ?? null;
  const priority = riskScore.priority ?? riskScore.priorityRank ?? null;
  const computedAt = formatWhen(riskScore.computedAt ?? riskScore.lastUpdatedAt);

  return (
    <article
      className={[
        'risk-insight-card',
        `risk-insight-card--${band || 'unknown'}`,
        effectiveSelected ? 'risk-insight-card--selected'  : null,
        isFocused         ? 'risk-insight-card--focused'   : null,
        isLoading         ? 'risk-insight-card--loading'   : null,
        isStale           ? 'risk-insight-card--stale'     : null,
        compact           ? 'risk-insight-card--compact'   : null,
      ].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      aria-pressed={effectiveSelected}
      aria-label={`Risk: ${name}${category ? ` — ${category}` : ''}`}
      onClick={handleSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(); } }}
    >
      {/* Card header */}
      <div className="risk-insight-card__header">
        <RiskSeverityBadge
          riskScore={riskScore}
          isLoading={isLoading}
          isStale={isStale}
          size="sm"
          showLabel={!compact}
          showScore={!compact}
        />
        {showPriority && priority != null && (
          <span className="risk-insight-card__priority" aria-label={`Priority: ${priority}`}>
            #{priority}
          </span>
        )}
      </div>

      {/* Title and category */}
      <div className="risk-insight-card__name" title={name}>{name}</div>

      {!compact && (
        <div className="risk-insight-card__meta">
          {category && <span className="risk-insight-card__category">{category}</span>}
          {source   && <span className="risk-insight-card__source">{source}</span>}
          {domain   && <span className="risk-insight-card__domain">{domain}</span>}
        </div>
      )}

      {/* Confidence */}
      <div className="risk-insight-card__confidence">
        <RiskConfidenceIndicator
          confidence={riskScore.confidence ?? null}
          size="sm"
          showLabel={!compact}
          showPct={!compact}
          compact={compact}
        />
      </div>

      {/* Computed at */}
      {computedAt && !compact && (
        <time
          className="risk-insight-card__computed-at"
          dateTime={riskScore.computedAt ?? riskScore.lastUpdatedAt}
          aria-label={`Computed: ${computedAt}`}
        >
          {computedAt}
        </time>
      )}

      {/* Stale / live pills */}
      {(isStale || isLoading) && (
        <div className="risk-insight-card__pills">
          {isLoading && <span className="train-pill" role="status">Loading</span>}
          {isStale   && <span className="train-pill train-pill--stale" role="status">Stale</span>}
        </div>
      )}
    </article>
  );
});

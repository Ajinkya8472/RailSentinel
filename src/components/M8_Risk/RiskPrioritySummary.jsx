import React, { memo, useMemo, useState, useId } from 'react';
import useRiskStore from '../../store/riskStore';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import RiskSeverityBadge from './RiskSeverityBadge';
import RiskInsightCard from './RiskInsightCard';
import RiskConfidenceIndicator from './RiskConfidenceIndicator';

/**
 * Purpose:
 * RiskPrioritySummary — ranked risk priority board for Module-8 Risk
 * Intelligence. The canonical operator-facing triage surface: combines
 * severity × confidence × priority fields into a single decision queue.
 *
 * Content:
 *   1. Triage Queue      — top N risks sorted by composite priority score
 *                         (severity × confidence × explicit priority)
 *   2. Domain Clusters   — risks grouped by domain / category for situational
 *                         awareness
 *   3. Filter Bar        — severity, confidence, domain, priority number
 *   4. Selection binding — clicking a row updates riskStore.selectedRiskScoreId
 *
 * Composite priority formula (locally derived, no mutations):
 *   priorityScore = (severityScore ?? 50) * (confidence ?? 50 / 100) * (priority ?? 1)^-1
 *   Higher = more urgent. Ties broken by computedAt desc.
 *
 * Store integration (read-only):
 *   - `getVisibleRiskScores()`  — post-filter/sort list
 *   - `getRiskCounts()`         — aggregate counts for rail
 *   - `selectedRiskScoreId`     — highlight selected row
 *   - `selectRiskScore()`       — on row select
 *   - `setFilters()`            — propagates severity/source filter changes
 *   - `loading`, `syncing`, `error`, `refreshing`
 *
 * Dependencies:
 * - React (memo, useMemo, useState, useId)
 * - `src/store/riskStore` (approved selectors only)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./RiskSeverityBadge`
 * - `./RiskInsightCard`
 * - `./RiskConfidenceIndicator`
 *
 * Props:
 * - `layout`        ('split'|null) (default: null)
 * - `title`         (string|null)  (default: null)
 * - `compact`       (boolean)      (default: false)
 * - `maxItems`      (number)       (default: 20)
 * - `showClusters`  (boolean)      (default: true)
 * - `onRetry`       (fn|null)      (default: null)
 *
 * State:
 * - `localFilters` — { severity, confidence, domain, priority } — layered on store filters
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BAND_RANK = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

function bandRank(rs) {
  return BAND_RANK[String(rs.severityBand ?? '').toLowerCase()] ??
    (Number(rs.severityScore ?? 0) >= 85 ? 4 : Number(rs.severityScore ?? 0) >= 60 ? 3 : Number(rs.severityScore ?? 0) >= 30 ? 2 : 1);
}

function compositePriority(rs) {
  const sev  = Number(rs.severityScore ?? 50);
  const conf = Number(rs.confidence ?? 50) / 100;
  const prank = Number(rs.priority ?? rs.priorityRank ?? 99);
  return (sev * conf) / prank;
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Default local filters
// ---------------------------------------------------------------------------

const DEFAULT_LOCAL_FILTERS = { severity: 'all', confidence: 'all', domain: 'all', priority: 'all' };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, error }) {
  if (!loading && !refreshing && !syncing && !error) return null;
  return (
    <div className="risk-priority-summary__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function LocalFilterBar({ visible, localFilters, onChange, filterId }) {
  const domains    = useMemo(() => uniqueSorted(visible.map((r) => String(r.domain ?? r.domainArea ?? r.category ?? '').toLowerCase()).filter(Boolean)), [visible]);
  const categories = useMemo(() => uniqueSorted(visible.map((r) => String(r.category ?? '').toLowerCase()).filter(Boolean)), [visible]);

  function patch(key, val) { onChange({ ...localFilters, [key]: val }); }

  const hasActive = Object.entries(localFilters).some(([, v]) => v !== 'all');

  return (
    <div className="risk-priority-summary__filters" role="group" aria-label="Priority filter bar">
      {/* Severity */}
      <select id={`${filterId}-sev`} className="risk-priority-summary__filter-select"
        value={localFilters.severity} onChange={(e) => patch('severity', e.target.value)}
        aria-label="Filter by severity">
        <option value="all">All Severities</option>
        {['critical','high','medium','low'].map((b) => (
          <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
        ))}
      </select>

      {/* Confidence */}
      <select id={`${filterId}-conf`} className="risk-priority-summary__filter-select"
        value={localFilters.confidence} onChange={(e) => patch('confidence', e.target.value)}
        aria-label="Filter by confidence tier">
        <option value="all">All Confidence</option>
        {[['very-high','Very High'],['high','High'],['moderate','Moderate'],['low','Low'],['very-low','Very Low']].map(([k,l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>

      {/* Domain */}
      {domains.length > 0 && (
        <select id={`${filterId}-domain`} className="risk-priority-summary__filter-select"
          value={localFilters.domain} onChange={(e) => patch('domain', e.target.value)}
          aria-label="Filter by domain">
          <option value="all">All Domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}

      {/* Priority number */}
      <select id={`${filterId}-prank`} className="risk-priority-summary__filter-select"
        value={localFilters.priority} onChange={(e) => patch('priority', e.target.value)}
        aria-label="Filter by priority rank">
        <option value="all">All Priorities</option>
        {['1','2','3','4','5'].map((p) => <option key={p} value={p}>Priority {p}</option>)}
      </select>

      {hasActive && (
        <button type="button" className="risk-priority-summary__filter-clear"
          onClick={() => onChange({ ...DEFAULT_LOCAL_FILTERS })}>✕ Clear</button>
      )}
    </div>
  );
}

function TriageRow({ rs, rank, compact, isSelected, onSelect }) {
  const band     = String(rs.severityBand ?? '').toLowerCase();
  const name     = rs.name ?? rs.title ?? rs.id;
  const category = rs.category ?? null;
  const computedAt = formatWhen(rs.computedAt ?? rs.lastUpdatedAt);

  return (
    <tr
      className={[
        'risk-priority-summary__triage-row',
        `risk-priority-summary__triage-row--${band || 'unknown'}`,
        isSelected ? 'risk-priority-summary__triage-row--selected' : null,
        compact    ? 'risk-priority-summary__triage-row--compact'  : null,
      ].filter(Boolean).join(' ')}
      role="row"
      aria-selected={isSelected}
      aria-label={`Rank ${rank}: ${name}`}
      tabIndex={0}
      onClick={() => onSelect(rs)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(rs); } }}
    >
      <td className="risk-priority-summary__rank" role="cell" aria-label={`Rank ${rank}`}>
        <span className="risk-priority-summary__rank-number">{rank}</span>
      </td>
      <td className="risk-priority-summary__severity" role="cell">
        <RiskSeverityBadge riskScore={rs} size="sm" showLabel={!compact} showScore={!compact} />
      </td>
      <td className="risk-priority-summary__name" role="cell">
        <div className="risk-priority-summary__name-text" title={name}>{name}</div>
        {!compact && category && <div className="risk-priority-summary__category">{category}</div>}
      </td>
      {!compact && (
        <td className="risk-priority-summary__confidence" role="cell">
          <RiskConfidenceIndicator confidence={rs.confidence} size="sm" compact showPct={false} showLabel={false} />
        </td>
      )}
      {!compact && (
        <td className="risk-priority-summary__computed" role="cell">
          <time dateTime={rs.computedAt ?? rs.lastUpdatedAt}>{computedAt ?? '—'}</time>
        </td>
      )}
    </tr>
  );
}

function DomainCluster({ domain, items, compact, selectedId, onSelect }) {
  if (items.length === 0) return null;
  return (
    <section className="risk-priority-summary__cluster" aria-label={`Domain: ${domain}`}>
      <h4 className="risk-priority-summary__cluster-title">
        {domain}
        <span className="risk-priority-summary__cluster-count">{items.length}</span>
      </h4>
      <div className="risk-priority-summary__cluster-cards">
        {items.slice(0, 4).map((rs) => (
          <RiskInsightCard key={rs.id} riskScore={rs} compact={true}
            isSelected={rs.id === selectedId} onSelect={onSelect} />
        ))}
        {items.length > 4 && (
          <div className="risk-priority-summary__cluster-overflow">+{items.length - 4} more</div>
        )}
      </div>
    </section>
  );
}

function PrioritySummaryRail({ counts, topRisk }) {
  return (
    <div className="risk-priority-summary__rail" aria-label="Priority summary">
      <div className="risk-priority-summary__rail-title">Priority Board</div>
      <dl className="risk-priority-summary__rail-dl">
        <dt>Total</dt><dd>{counts.total}</dd>
        {counts.bySeverityBand?.critical > 0 && <><dt>Critical</dt><dd className="risk-priority-summary__rail-critical">{counts.bySeverityBand.critical}</dd></>}
        {counts.bySeverityBand?.high     > 0 && <><dt>High</dt><dd className="risk-priority-summary__rail-high">{counts.bySeverityBand.high}</dd></>}
      </dl>
      {topRisk && (
        <div className="risk-priority-summary__rail-top">
          <div className="risk-priority-summary__rail-top-label">Top Risk</div>
          <div className="risk-priority-summary__rail-top-name">{topRisk.name ?? topRisk.title ?? topRisk.id}</div>
          <RiskSeverityBadge riskScore={topRisk} size="sm" showScore />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskPrioritySummary({
  layout       = null,
  title        = null,
  compact      = false,
  maxItems     = 20,
  showClusters = true,
  onRetry      = null,
}) {
  const filterId = useId();

  // ── Store reads ──────────────────────────────────────────────────────────────
  const loading              = useRiskStore((s) => s.loading);
  const refreshing           = useRiskStore((s) => s.refreshing);
  const syncing              = useRiskStore((s) => s.syncing);
  const error                = useRiskStore((s) => s.error);
  const selectedId           = useRiskStore((s) => s.selectedRiskScoreId);
  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);
  const getRiskCounts        = useRiskStore((s) => s.getRiskCounts);
  const selectRiskScore      = useRiskStore((s) => s.selectRiskScore);

  const visible = useMemo(() => getVisibleRiskScores(), [getVisibleRiskScores]);
  const counts  = useMemo(() => getRiskCounts(),        [getRiskCounts]);

  // ── Local filter state ───────────────────────────────────────────────────────
  const [localFilters, setLocalFilters] = useState({ ...DEFAULT_LOCAL_FILTERS });

  // ── Local filtering ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = visible;
    if (localFilters.severity !== 'all') {
      list = list.filter((r) => String(r.severityBand ?? '').toLowerCase() === localFilters.severity);
    }
    if (localFilters.confidence !== 'all') {
      const confRange = {
        'very-high': [80,100], 'high': [60,79], 'moderate': [40,59], 'low': [20,39], 'very-low': [0,19],
      }[localFilters.confidence];
      if (confRange) {
        list = list.filter((r) => {
          const c = Number(r.confidence ?? 50);
          return c >= confRange[0] && c <= confRange[1];
        });
      }
    }
    if (localFilters.domain !== 'all') {
      list = list.filter((r) =>
        String(r.domain ?? r.domainArea ?? r.category ?? '').toLowerCase() === localFilters.domain,
      );
    }
    if (localFilters.priority !== 'all') {
      list = list.filter((r) => String(r.priority ?? r.priorityRank ?? '') === localFilters.priority);
    }
    return list;
  }, [visible, localFilters]);

  // ── Sorted triage queue ──────────────────────────────────────────────────────
  const triageQueue = useMemo(() =>
    [...filtered]
      .sort((a, b) => compositePriority(b) - compositePriority(a) || bandRank(b) - bandRank(a))
      .slice(0, maxItems),
  [filtered, maxItems]);

  // ── Domain clusters ──────────────────────────────────────────────────────────
  const domainClusters = useMemo(() => {
    const map = new Map();
    for (const rs of filtered) {
      const key = rs.domain ?? rs.domainArea ?? rs.category ?? 'Uncategorised';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(rs);
    }
    return Array.from(map.entries())
      .map(([domain, items]) => ({ domain, items: items.sort((a, b) => compositePriority(b) - compositePriority(a)) }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [filtered]);

  function handleSelect(rs) { if (rs?.id) selectRiskScore(rs.id); }

  const isEmpty       = filtered.length === 0 && !loading;
  const topRisk       = triageQueue[0] ?? null;
  const resolvedTitle = title ?? 'Risk Priority Board';

  const body = (
    <div
      className={[
        'risk-priority-summary',
        compact ? 'risk-priority-summary--compact' : null,
        error   ? 'risk-priority-summary--error'   : null,
        syncing ? 'risk-priority-summary--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} error={error} />}

      {/* Filter bar */}
      <LocalFilterBar visible={visible} localFilters={localFilters} onChange={setLocalFilters} filterId={filterId} />

      {isEmpty ? (
        <div className="risk-priority-summary__empty" role="status">No risks match current filters.</div>
      ) : (
        <>
          {/* Triage queue table */}
          <section className="risk-priority-summary__triage" aria-label="Risk triage queue">
            <h3 className="risk-priority-summary__section-title">
              Triage Queue
              <span className="risk-priority-summary__section-count">{triageQueue.length}</span>
            </h3>
            <div className="risk-priority-summary__table-wrap">
              <table className="risk-priority-summary__table" role="grid"
                aria-label={`${triageQueue.length} prioritised risks`}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Risk</th>
                    {!compact && <th scope="col">Confidence</th>}
                    {!compact && <th scope="col">Computed</th>}
                  </tr>
                </thead>
                <tbody>
                  {triageQueue.map((rs, idx) => (
                    <TriageRow
                      key={rs.id}
                      rs={rs}
                      rank={idx + 1}
                      compact={compact}
                      isSelected={rs.id === selectedId}
                      onSelect={handleSelect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Domain clusters */}
          {showClusters && !compact && domainClusters.length > 0 && (
            <section className="risk-priority-summary__clusters" aria-label="Risk domain clusters">
              <h3 className="risk-priority-summary__section-title">Domain Clusters</h3>
              {domainClusters.map(({ domain, items }) => (
                <DomainCluster
                  key={domain}
                  domain={domain}
                  items={items}
                  compact={compact}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={body}
        right={<PrioritySummaryRail counts={counts} topRisk={topRisk} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

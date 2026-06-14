import React, { memo, useMemo, useState, useId } from 'react';
import useRiskStore from '../../store/riskStore';
import RiskSeverityBadge from './RiskSeverityBadge';
import RiskInsightCard from './RiskInsightCard';
import RiskKPIs from './RiskKPIs';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';

/**
 * Purpose:
 * RiskMatrix — 2-D severity × confidence positioning matrix for Module-8
 * Risk Intelligence. The primary visualisation surface for the risk posture
 * of the entire system.
 *
 * Layout:
 *   Columns (X axis) — Confidence bands: Very Low | Low | Moderate | High | Very High
 *   Rows    (Y axis) — Severity bands:  Critical | High | Medium | Low   (top → bottom)
 *
 *   Each cell contains dots / count chips representing RiskScore entities
 *   that fall into that severity × confidence bucket.
 *
 * Interactions:
 *   - Click a cell → filters card panel to that bucket
 *   - Click a RiskInsightCard → riskStore.selectRiskScore(id)
 *   - Click X to clear cell selection
 *
 * Store integration:
 *   - `getVisibleRiskScores()` — post-filter/sort list (respects store filters)
 *   - `getRiskCounts()`        — aggregate counts for KPI rail
 *   - `selectedRiskScoreId`    — highlight selected card
 *   - `selectRiskScore()`      — on card select
 *   - `setFilters()`           — update severity/confidence filters
 *   - `loading`, `syncing`, `refreshing`, `error` — state indicators
 *
 * Local filtering (additional, layered on top of store filters):
 *   - domain   — riskScore.domain / domainArea
 *   - priority — riskScore.priority / priorityRank
 *
 * Dependencies:
 * - React (memo, useMemo, useState, useId)
 * - `src/store/riskStore` (approved selectors only)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./RiskSeverityBadge`
 * - `./RiskInsightCard`
 * - `./RiskKPIs`
 *
 * Props:
 * - `layout`      ('split'|null) (default: null)
 * - `title`       (string|null)  (default: null)
 * - `compact`     (boolean)      (default: false)
 * - `maxPerCell`  (number)       — max dots shown per cell (default: 6)
 * - `onRetry`     (fn|null)      (default: null)
 *
 * State:
 * - `localFilters` — { domain, priority } for additional local filtering
 * - `selectedCell` — { severity, confidenceTier } | null for cell focus
 */

// ---------------------------------------------------------------------------
// Axis definitions
// ---------------------------------------------------------------------------

const SEVERITY_ROWS = [
  { key: 'critical', label: 'Critical', cssModifier: 'critical' },
  { key: 'high',     label: 'High',     cssModifier: 'high'     },
  { key: 'medium',   label: 'Medium',   cssModifier: 'medium'   },
  { key: 'low',      label: 'Low',      cssModifier: 'low'      },
];

const CONFIDENCE_COLS = [
  { key: 'very-low', label: 'Very Low',  minConf: 0,  maxConf: 19  },
  { key: 'low',      label: 'Low',       minConf: 20, maxConf: 39  },
  { key: 'moderate', label: 'Moderate',  minConf: 40, maxConf: 59  },
  { key: 'high',     label: 'High',      minConf: 60, maxConf: 79  },
  { key: 'very-high',label: 'Very High', minConf: 80, maxConf: 100 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBandKey(riskScore) {
  const b = String(riskScore.severityBand ?? '').toLowerCase();
  if (SEVERITY_ROWS.some((r) => r.key === b)) return b;
  const s = Number(riskScore.severityScore ?? riskScore.score ?? 0);
  if (s >= 85) return 'critical';
  if (s >= 60) return 'high';
  if (s >= 30) return 'medium';
  return 'low';
}

function toConfidenceCol(riskScore) {
  const c = Number(riskScore.confidence ?? 50);
  return CONFIDENCE_COLS.find((col) => c >= col.minConf && c <= col.maxConf) ?? CONFIDENCE_COLS[2];
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, error }) {
  if (!loading && !refreshing && !syncing && !error) return null;
  return (
    <div className="risk-matrix__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function MatrixCell({ sevKey, colKey, items, maxPerCell, compact, selectedId }) {
  const shown    = items.slice(0, maxPerCell);
  const overflow = items.length - shown.length;
  const cellId   = `risk-matrix-cell-${sevKey}-${colKey}`;
  if (items.length === 0) {
    return (
      <td id={cellId} className={`risk-matrix__cell risk-matrix__cell--empty risk-matrix__cell--row-${sevKey}`}
        aria-label="No risks" />
    );
  }

  return (
    <td id={cellId}
      className={`risk-matrix__cell risk-matrix__cell--row-${sevKey} risk-matrix__cell--col-${colKey}`}
      aria-label={`${items.length} risk${items.length !== 1 ? 's' : ''} at ${sevKey} severity, ${colKey} confidence`}>
      <div className="risk-matrix__cell-content">
        {shown.map((rs) => (
          <RiskInsightCard
            key={rs.id}
            riskScore={rs}
            compact={true}
            showPriority={false}
            isSelected={rs.id === selectedId}
          />
        ))}
        {overflow > 0 && (
          <span className={`risk-matrix__cell-overflow risk-matrix__cell-overflow--${sevKey}`}
            aria-label={`${overflow} more`}>
            +{overflow}
          </span>
        )}
      </div>
    </td>
  );
}

function LocalFilters({ visible, localFilters, onChange }) {
  const domains    = useMemo(() => uniqueSorted(visible.map((r) => r.domain ?? r.domainArea)), [visible]);
  const priorities = useMemo(() => uniqueSorted(visible.map((r) => r.priority ?? r.priorityRank).filter((v) => v != null).map(String)), [visible]);

  function patch(key, val) { onChange({ ...localFilters, [key]: val }); }

  return (
    <div className="risk-matrix__local-filters" role="group" aria-label="Additional matrix filters">
      {domains.length > 0 && (
        <select className="risk-matrix__filter-select"
          value={localFilters.domain ?? 'all'}
          onChange={(e) => patch('domain', e.target.value)}
          aria-label="Filter by domain">
          <option value="all">All Domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
      {priorities.length > 0 && (
        <select className="risk-matrix__filter-select"
          value={localFilters.priority ?? 'all'}
          onChange={(e) => patch('priority', e.target.value)}
          aria-label="Filter by priority">
          <option value="all">All Priorities</option>
          {priorities.map((p) => <option key={p} value={p}>Priority {p}</option>)}
        </select>
      )}
      {(localFilters.domain !== 'all' || localFilters.priority !== 'all') && (
        <button type="button" className="risk-matrix__filter-clear"
          onClick={() => onChange({ domain: 'all', priority: 'all' })}>✕ Clear</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskMatrix({
  layout     = null,
  title      = null,
  compact    = false,
  maxPerCell = 6,
  onRetry    = null,
}) {
  const matrixId = useId();

  // ── Store reads ─────────────────────────────────────────────────────────────
  const loading            = useRiskStore((s) => s.loading);
  const refreshing         = useRiskStore((s) => s.refreshing);
  const syncing            = useRiskStore((s) => s.syncing);
  const error              = useRiskStore((s) => s.error);
  const selectedId         = useRiskStore((s) => s.selectedRiskScoreId);
  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);
  const setFilters         = useRiskStore((s) => s.setFilters);

  // ── Local state ─────────────────────────────────────────────────────────────
  const [localFilters, setLocalFilters] = useState({ domain: 'all', priority: 'all' });

  // ── Data ────────────────────────────────────────────────────────────────────
  const visible = useMemo(() => getVisibleRiskScores(), [getVisibleRiskScores]);

  const filtered = useMemo(() => {
    let list = visible;
    if (localFilters.domain !== 'all') {
      list = list.filter((r) => String(r.domain ?? r.domainArea ?? '').toLowerCase() === localFilters.domain.toLowerCase());
    }
    if (localFilters.priority !== 'all') {
      list = list.filter((r) => String(r.priority ?? r.priorityRank ?? '') === localFilters.priority);
    }
    return list;
  }, [visible, localFilters]);

  // ── Matrix bucket map: sevKey → colKey → RiskScore[] ─────────────────────
  const matrix = useMemo(() => {
    const m = {};
    for (const row of SEVERITY_ROWS) {
      m[row.key] = {};
      for (const col of CONFIDENCE_COLS) { m[row.key][col.key] = []; }
    }
    for (const rs of filtered) {
      const sev = toBandKey(rs);
      const col = toConfidenceCol(rs);
      if (m[sev]?.[col.key]) m[sev][col.key].push(rs);
    }
    return m;
  }, [filtered]);

  const isEmpty       = filtered.length === 0 && !loading;
  const resolvedTitle = title ?? 'Risk Matrix';

  const matrixTable = (
    <div
      className={[
        'risk-matrix',
        compact ? 'risk-matrix--compact' : null,
        error   ? 'risk-matrix--error'   : null,
        syncing ? 'risk-matrix--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} error={error} />}

      {/* Local filters */}
      {!compact && <LocalFilters visible={visible} localFilters={localFilters} onChange={setLocalFilters} />}

      {/* KPI bar */}
      <RiskKPIs compact={compact} showBars={!compact} />

      {isEmpty ? (
        <div className="risk-matrix__empty" role="status">No risk scores match current filters.</div>
      ) : (
        <div className="risk-matrix__table-wrap" role="region" aria-label="Risk severity × confidence matrix">
          <table
            id={matrixId}
            className="risk-matrix__table"
            role="grid"
            aria-label="Risk matrix: rows are severity bands, columns are confidence tiers"
          >
            {/* Column headers */}
            <thead>
              <tr>
                <th scope="col" className="risk-matrix__corner-header" aria-label="Severity / Confidence">
                  <span className="risk-matrix__axis-label risk-matrix__axis-label--row">Severity</span>
                  <span className="risk-matrix__axis-label risk-matrix__axis-label--col">Confidence →</span>
                </th>
                {CONFIDENCE_COLS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`risk-matrix__col-header risk-matrix__col-header--${col.key}`}
                    aria-label={`Confidence: ${col.label} (${col.minConf}–${col.maxConf}%)`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Matrix body */}
            <tbody>
              {SEVERITY_ROWS.map((row) => (
                <tr key={row.key} className={`risk-matrix__row risk-matrix__row--${row.key}`}>
                  <th
                    scope="row"
                    className={`risk-matrix__row-header risk-matrix__row-header--${row.key}`}
                  >
                    <RiskSeverityBadge
                      riskScore={{ severityBand: row.key }}
                      size="sm"
                      showLabel={true}
                    />
                  </th>
                  {CONFIDENCE_COLS.map((col) => (
                    <MatrixCell
                      key={col.key}
                      sevKey={row.key}
                      colKey={col.key}
                      items={matrix[row.key]?.[col.key] ?? []}
                      maxPerCell={maxPerCell}
                      compact={compact}
                      selectedId={selectedId}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={matrixTable}
        right={<RiskKPIs compact={true} showBars={false} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return matrixTable;
});

import React, { memo, useMemo, useId } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';

/**
 * Purpose:
 * ConsumptionChart — visual baseline vs actual consumption chart for M7
 * Energy Optimization. Renders:
 *
 *   1. Baseline vs Actual Bar-Chart  — side-by-side bars per time bucket
 *                                     using only CSS and SVG (no external chart lib)
 *   2. Threshold Bands               — warning and critical horizontal threshold lines
 *   3. Deviation Indicator           — % deviation from baseline per period
 *   4. Time-Window Comparison Legend — labels: 'today', 'week', 'month', 'custom'
 *
 * Data contract (from energyService.getConsumption or EnergyProfile fields):
 *   `consumptionData` — array of { period, baseline, actual, timestamp? }
 *   `thresholds`      — { warning: number, critical: number } in kWh units
 *   `timeWindow`      — 'today' | 'week' | 'month' | 'custom'
 *
 * No chart library dependencies — pure SVG + CSS for SSR compatibility.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `profile`         (object|null)  — EnergyProfile entity for labels (default: null)
 * - `consumptionData` (object[])     — [{ period, baseline, actual }] (default: [])
 * - `thresholds`      (object|null)  — { warning, critical } (default: null)
 * - `timeWindow`      (string)       — (default: 'today')
 * - `layout`          ('detail'|'split'|null) (default: null)
 * - `title`           (string|null)  (default: null)
 * - `loading`         (boolean)      (default: false)
 * - `syncing`         (boolean)      (default: false)
 * - `isStale`         (boolean)      (default: false)
 * - `error`           (any)          (default: null)
 * - `compact`         (boolean)      (default: false)
 * - `onRetry`         (fn|null)      (default: null)
 *
 * State: none — all derived.
 */

// ---------------------------------------------------------------------------
// Chart constants
// ---------------------------------------------------------------------------

const CHART_HEIGHT  = 160;
const BAR_GAP       = 2;
const CHART_PADDING = { top: 20, bottom: 32, left: 48, right: 16 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriod(period) {
  if (!period) return '';
  try {
    const d = new Date(period);
    if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { /* ignore */ }
  return String(period).slice(0, 8);
}

function pctDeviation(baseline, actual) {
  if (!baseline) return null;
  return Math.round(((actual - baseline) / baseline) * 100);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="consumption-chart__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function SVGChart({ data, thresholds, chartId }) {
  const maxVal = useMemo(() => {
    let m = 0;
    for (const d of data) {
      m = Math.max(m, Number(d.baseline ?? 0), Number(d.actual ?? 0));
    }
    if (thresholds?.critical) m = Math.max(m, thresholds.critical);
    return m === 0 ? 100 : m * 1.15;
  }, [data, thresholds]);

  const innerW = useMemo(() => {
    const buckets = data.length;
    return Math.max(300, buckets * 32);
  }, [data]);

  const innerH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const totalW = innerW + CHART_PADDING.left + CHART_PADDING.right;
  const totalH = CHART_HEIGHT;

  const barWidth = useMemo(() => {
    if (data.length === 0) return 12;
    return Math.max(6, Math.floor((innerW / data.length) / 2) - BAR_GAP);
  }, [data, innerW]);

  function yPos(val) { return CHART_PADDING.top + innerH - (Number(val ?? 0) / maxVal) * innerH; }
  function xPos(idx) { return CHART_PADDING.left + idx * (innerW / Math.max(1, data.length)); }

  return (
    <svg
      className="consumption-chart__svg"
      viewBox={`0 0 ${totalW} ${totalH}`}
      role="img"
      aria-label="Consumption chart: baseline vs actual"
      width="100%"
      style={{ maxHeight: CHART_HEIGHT + 32 }}
    >
      <title id={chartId}>Baseline vs actual energy consumption</title>
      {/* Y-axis grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = CHART_PADDING.top + innerH * (1 - frac);
        const val = Math.round(maxVal * frac);
        return (
          <g key={frac}>
            <line x1={CHART_PADDING.left} x2={totalW - CHART_PADDING.right} y1={y} y2={y}
              className="consumption-chart__grid-line" />
            <text x={CHART_PADDING.left - 4} y={y + 4}
              className="consumption-chart__y-label" textAnchor="end" fontSize="10">
              {val}
            </text>
          </g>
        );
      })}

      {/* Threshold lines */}
      {thresholds?.warning && (
        <line x1={CHART_PADDING.left} x2={totalW - CHART_PADDING.right}
          y1={yPos(thresholds.warning)} y2={yPos(thresholds.warning)}
          className="consumption-chart__threshold-warning"
          aria-label={`Warning threshold: ${thresholds.warning} kWh`} />
      )}
      {thresholds?.critical && (
        <line x1={CHART_PADDING.left} x2={totalW - CHART_PADDING.right}
          y1={yPos(thresholds.critical)} y2={yPos(thresholds.critical)}
          className="consumption-chart__threshold-critical"
          aria-label={`Critical threshold: ${thresholds.critical} kWh`} />
      )}

      {/* Bars */}
      {data.map((d, idx) => {
        const x          = xPos(idx);
        const baselineH  = (Number(d.baseline ?? 0) / maxVal) * innerH;
        const actualH    = (Number(d.actual  ?? 0) / maxVal) * innerH;
        const dev        = pctDeviation(d.baseline, d.actual);
        const isOver     = (d.actual ?? 0) > (d.baseline ?? 0);
        return (
          <g key={idx} aria-label={`Period ${formatPeriod(d.period)}: baseline ${d.baseline}, actual ${d.actual}`}>
            {/* Baseline bar */}
            <rect
              x={x}
              y={yPos(d.baseline ?? 0)}
              width={barWidth}
              height={baselineH}
              className="consumption-chart__bar consumption-chart__bar--baseline"
            />
            {/* Actual bar */}
            <rect
              x={x + barWidth + BAR_GAP}
              y={yPos(d.actual ?? 0)}
              width={barWidth}
              height={actualH}
              className={`consumption-chart__bar consumption-chart__bar--actual ${isOver ? 'consumption-chart__bar--over' : 'consumption-chart__bar--under'}`}
            />
            {/* X-axis label */}
            <text x={x + barWidth} y={CHART_HEIGHT - 8}
              textAnchor="middle" fontSize="9" className="consumption-chart__x-label">
              {formatPeriod(d.period)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DeviationTable({ data, compact }) {
  if (compact || data.length === 0) return null;
  return (
    <div className="consumption-chart__deviation-table" aria-label="Period deviation summary">
      <table role="table">
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Baseline</th>
            <th scope="col">Actual</th>
            <th scope="col">Deviation</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((d, idx) => {
            const dev = pctDeviation(d.baseline, d.actual);
            return (
              <tr key={idx} className={dev != null && dev > 0 ? 'consumption-chart__row--over' : 'consumption-chart__row--under'}>
                <td>{formatPeriod(d.period)}</td>
                <td>{d.baseline ?? '—'} kWh</td>
                <td>{d.actual   ?? '—'} kWh</td>
                <td className={dev != null && dev > 10 ? 'consumption-chart__dev--warn' : ''}>
                  {dev != null ? `${dev > 0 ? '+' : ''}${dev}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChartLegend({ thresholds }) {
  return (
    <div className="consumption-chart__legend" role="list" aria-label="Chart legend">
      <span className="consumption-chart__legend-item" role="listitem">
        <span className="consumption-chart__legend-swatch consumption-chart__legend-swatch--baseline" aria-hidden="true" />
        Baseline
      </span>
      <span className="consumption-chart__legend-item" role="listitem">
        <span className="consumption-chart__legend-swatch consumption-chart__legend-swatch--actual" aria-hidden="true" />
        Actual
      </span>
      {thresholds?.warning  && <span className="consumption-chart__legend-item consumption-chart__legend-item--warning"  role="listitem">— Warning</span>}
      {thresholds?.critical && <span className="consumption-chart__legend-item consumption-chart__legend-item--critical" role="listitem">— Critical</span>}
    </div>
  );
}

function RailSummary({ data, thresholds }) {
  const totalBaseline = data.reduce((s, d) => s + Number(d.baseline ?? 0), 0);
  const totalActual   = data.reduce((s, d) => s + Number(d.actual   ?? 0), 0);
  const totalDev      = pctDeviation(totalBaseline, totalActual);
  return (
    <div className="consumption-chart__rail" aria-label="Consumption summary">
      <div className="consumption-chart__rail-title">Consumption</div>
      <dl className="consumption-chart__rail-dl">
        <dt>Total Baseline</dt><dd>{Math.round(totalBaseline)} kWh</dd>
        <dt>Total Actual</dt><dd className={totalDev != null && totalDev > 10 ? 'consumption-chart__rail-over' : ''}>{Math.round(totalActual)} kWh</dd>
        <dt>Deviation</dt><dd>{totalDev != null ? `${totalDev > 0 ? '+' : ''}${totalDev}%` : '—'}</dd>
        {thresholds?.warning  && <><dt>Warning</dt><dd>{thresholds.warning} kWh</dd></>}
        {thresholds?.critical && <><dt>Critical</dt><dd>{thresholds.critical} kWh</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ConsumptionChart({
  profile         = null,
  consumptionData = [],
  thresholds      = null,
  timeWindow      = 'today',
  layout          = null,
  title           = null,
  loading         = false,
  syncing         = false,
  isStale         = false,
  error           = null,
  compact         = false,
  onRetry         = null,
}) {
  const chartId       = useId();
  const isEmpty       = consumptionData.length === 0 && !loading;
  const resolvedTitle = title ?? (profile ? `Consumption — ${profile.routeId ?? profile.id}` : 'Energy Consumption');

  const body = (
    <div
      className={[
        'consumption-chart',
        compact ? 'consumption-chart--compact' : null,
        isStale ? 'consumption-chart--stale'   : null,
        error   ? 'consumption-chart--error'   : null,
        syncing ? 'consumption-chart--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      <div className="consumption-chart__header">
        <span className="consumption-chart__window-label">{timeWindow}</span>
        {profile && <span className="consumption-chart__profile-id">{profile.routeId ?? profile.id}</span>}
      </div>

      {isEmpty ? (
        <div className="consumption-chart__empty" role="status">No consumption data.</div>
      ) : (
        <>
          <div className="consumption-chart__chart-wrap" aria-describedby={chartId}>
            <SVGChart data={consumptionData} thresholds={thresholds} chartId={chartId} />
          </div>
          <ChartLegend thresholds={thresholds} />
          <DeviationTable data={consumptionData} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{consumptionData.length} periods · {timeWindow}<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<RailSummary data={consumptionData} thresholds={thresholds} />}
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
        right={<RailSummary data={consumptionData} thresholds={thresholds} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

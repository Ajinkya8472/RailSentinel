import React, { memo, useMemo, useId } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';

/**
 * Purpose:
 * EnergyTrendPanel — long-term trend and pattern drift analysis for M7
 * Energy Optimization. Renders:
 *
 *   1. Trend Direction Summary — current trend: improving / stable / degrading
 *   2. Baseline Deviation      — per-period deviation % from historical baseline
 *   3. Pattern Drift Indicator — rolling mean deviation alerting operator to
 *                               sustained drift above threshold
 *   4. Score History Chart     — sparkline of efficiencyScore over time
 *                               (from `scoreHistory[]` or `trendData[]`)
 *   5. Anomaly Overlay         — anomaly timestamps marked on the trend line
 *
 * Data contract:
 *   `trendData`   — array of { period, score, baseline, actual, anomaly? }
 *   `profile`     — EnergyProfile (for routeId / trainId context)
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `profile`      (object|null)  — EnergyProfile entity (default: null)
 * - `trendData`    (object[])     — [{ period, score, baseline, actual }] (default: [])
 * - `layout`       ('detail'|'split'|null) (default: null)
 * - `title`        (string|null)  (default: null)
 * - `loading`      (boolean)      (default: false)
 * - `syncing`      (boolean)      (default: false)
 * - `isStale`      (boolean)      (default: false)
 * - `error`        (any)          (default: null)
 * - `compact`      (boolean)      (default: false)
 * - `driftThreshold` (number)     — % deviation triggering drift alert (default: 10)
 * - `onRetry`      (fn|null)      (default: null)
 *
 * State: none — all derived.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPARKLINE_H = 80;
const SPARKLINE_P = { top: 12, bottom: 20, left: 8, right: 8 };

function pctDeviation(baseline, actual) {
  if (!baseline) return null;
  return Math.round(((actual - baseline) / baseline) * 100);
}

function rollingMean(arr, window = 3) {
  if (arr.length < window) return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const slice = arr.slice(-window);
  return slice.reduce((s, v) => s + v, 0) / window;
}

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-trend-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline SVG
// ---------------------------------------------------------------------------

function ScoreSparkline({ data, anomalyIndices, chartId }) {
  const scores = data.map((d) => Number(d.score ?? d.efficiencyScore ?? 0));
  const minS   = Math.min(...scores, 0);
  const maxS   = Math.max(...scores, 100);
  const range  = maxS - minS || 1;
  const innerW = Math.max(200, data.length * 20);
  const innerH = SPARKLINE_H - SPARKLINE_P.top - SPARKLINE_P.bottom;

  function xPos(idx) { return SPARKLINE_P.left + (idx / Math.max(1, data.length - 1)) * innerW; }
  function yPos(score) { return SPARKLINE_P.top + innerH - ((score - minS) / range) * innerH; }

  const polyPoints = scores.map((s, i) => `${xPos(i)},${yPos(s)}`).join(' ');

  return (
    <svg
      className="energy-trend-panel__sparkline"
      viewBox={`0 0 ${innerW + SPARKLINE_P.left + SPARKLINE_P.right} ${SPARKLINE_H}`}
      width="100%"
      style={{ maxHeight: SPARKLINE_H + 16 }}
      role="img"
      aria-label="Efficiency score trend sparkline"
    >
      <title id={chartId}>Efficiency score trend over time</title>
      {/* 70% efficiency reference line */}
      <line x1={SPARKLINE_P.left} x2={innerW + SPARKLINE_P.left}
        y1={yPos(70)} y2={yPos(70)}
        className="energy-trend-panel__ref-line" />
      {/* Score line */}
      <polyline points={polyPoints} className="energy-trend-panel__score-line" fill="none" />
      {/* Data points */}
      {scores.map((s, i) => (
        <circle key={i} cx={xPos(i)} cy={yPos(s)} r="3"
          className={anomalyIndices.has(i) ? 'energy-trend-panel__point energy-trend-panel__point--anomaly' : 'energy-trend-panel__point'}
          aria-label={`Period ${i}: score ${s}`} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyTrendPanel({
  profile        = null,
  trendData      = [],
  layout         = null,
  title          = null,
  loading        = false,
  syncing        = false,
  isStale        = false,
  error          = null,
  compact        = false,
  driftThreshold = 10,
  onRetry        = null,
}) {
  const chartId = useId();

  const deviations = useMemo(() =>
    trendData.map((d) => pctDeviation(d.baseline, d.actual)),
  [trendData]);

  const scores = useMemo(() =>
    trendData.map((d) => Number(d.score ?? d.efficiencyScore ?? 0)),
  [trendData]);

  const anomalyIndices = useMemo(() => {
    const s = new Set();
    trendData.forEach((d, i) => { if (d.anomaly) s.add(i); });
    return s;
  }, [trendData]);

  const driftValue = useMemo(() => {
    const validDevs = deviations.filter((d) => d != null);
    return validDevs.length > 0 ? rollingMean(validDevs) : null;
  }, [deviations]);

  const trendDir = useMemo(() => {
    if (scores.length < 2) return profile?.trendDirection ?? 'stable';
    const last  = scores[scores.length - 1];
    const first = scores[0];
    if (last > first + 3) return 'improving';
    if (last < first - 3) return 'degrading';
    return 'stable';
  }, [scores, profile?.trendDirection]);

  const isDrift  = driftValue != null && Math.abs(driftValue) > driftThreshold;
  const isEmpty  = trendData.length === 0 && !loading;
  const resolvedTitle = title ?? (profile ? `Trend — ${profile.routeId ?? profile.id}` : 'Energy Trend');

  const body = (
    <div
      className={[
        'energy-trend-panel',
        compact   ? 'energy-trend-panel--compact'   : null,
        isStale   ? 'energy-trend-panel--stale'     : null,
        error     ? 'energy-trend-panel--error'     : null,
        syncing   ? 'energy-trend-panel--live'      : null,
        isDrift   ? 'energy-trend-panel--drifting'  : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="energy-trend-panel__empty" role="status">No trend data.</div>
      ) : (
        <>
          {/* Trend direction */}
          <section className="energy-trend-panel__section" aria-label="Trend Direction">
            <h3 className="energy-trend-panel__section-title">Trend</h3>
            <div className={`energy-trend-panel__direction energy-trend-panel__direction--${trendDir}`}
              aria-label={`Trend: ${trendDir}`}>
              {trendDir === 'improving' ? '↑ Improving' : trendDir === 'degrading' ? '↓ Degrading' : '→ Stable'}
            </div>
            {isDrift && (
              <div className="energy-trend-panel__drift-alert" role="alert">
                ⚠ Pattern drift detected: {Math.round(driftValue)}% avg baseline deviation (threshold: {driftThreshold}%)
              </div>
            )}
          </section>

          {/* Score sparkline */}
          <section className="energy-trend-panel__section" aria-label="Score History">
            <h3 className="energy-trend-panel__section-title">Score History</h3>
            <div aria-describedby={chartId}>
              <ScoreSparkline data={trendData} anomalyIndices={anomalyIndices} chartId={chartId} />
            </div>
          </section>

          {/* Deviation table */}
          {!compact && (
            <section className="energy-trend-panel__section" aria-label="Baseline Deviation">
              <h3 className="energy-trend-panel__section-title">Baseline Deviation</h3>
              <div className="energy-trend-panel__dev-list">
                {trendData.slice(-8).map((d, idx) => {
                  const dev = pctDeviation(d.baseline, d.actual);
                  return (
                    <div key={idx} className={`energy-trend-panel__dev-row ${dev != null && Math.abs(dev) > driftThreshold ? 'energy-trend-panel__dev-row--alert' : ''}`}
                      aria-label={`Period ${idx}: deviation ${dev ?? '—'}%`}>
                      <span className="energy-trend-panel__dev-period">{String(d.period ?? idx)}</span>
                      <span className={`energy-trend-panel__dev-value ${dev != null && dev > 0 ? 'energy-trend-panel__dev-value--over' : 'energy-trend-panel__dev-value--under'}`}>
                        {dev != null ? `${dev > 0 ? '+' : ''}${dev}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );

  const railSummary = (
    <div className="energy-trend-panel__rail" aria-label="Trend summary">
      <div className="energy-trend-panel__rail-title">Trend Summary</div>
      <dl className="energy-trend-panel__rail-dl">
        <dt>Direction</dt><dd className={`energy-trend-panel__rail-dir--${trendDir}`}>{trendDir}</dd>
        <dt>Periods</dt><dd>{trendData.length}</dd>
        {driftValue != null && <><dt>Avg Deviation</dt><dd className={isDrift ? 'energy-trend-panel__rail-drift' : ''}>{Math.round(driftValue)}%</dd></>}
        {isDrift && <><dt>Drift</dt><dd className="energy-trend-panel__rail-drift">⚠ Alert</dd></>}
      </dl>
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{trendDir} · {trendData.length} periods<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={railSummary}
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
        right={railSummary}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

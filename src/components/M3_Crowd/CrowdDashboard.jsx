import React, { memo, useMemo, useId } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdDashboard — canonical crowd intelligence overview page for Module-3.
 * Orchestrates four coordinated sections into a `DashboardLayout` surface,
 * giving operations personnel a complete, at-a-glance picture of crowd
 * conditions across the entire monitored network:
 *
 *   1. Crowd Overview       — forecast count distribution by crowd level
 *                            (light / moderate / heavy / severe) rendered as
 *                            a proportional level-bar with station counts.
 *
 *   2. Hotspot Summary      — deduped, severity-ranked hotspot zone list
 *                            synthesised from `hotspots[]` arrays across all
 *                            visible CrowdForecast entities.
 *
 *   3. Forecast Pressure    — per-station occupancy pressure ranking; shows
 *                            the highest-pressure stations first with their
 *                            crowd level, occupancy %, and forecast horizon.
 *
 *   4. Threshold Status     — traffic-light view of every monitored station:
 *                            Breach / Near / Clear relative to `thresholdLevel`.
 *
 * All data is derived exclusively from `useCrowdStore` selectors across the
 * visible `CrowdForecast` collection. No mutations, no cross-domain imports.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `layout`           ('dashboard'|'split'|null) — layout wrapper; null
 *                      renders bare content. `'dashboard'` is the primary
 *                      intended usage (default: 'dashboard')
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before `lastUpdatedAt` is stale
 *                      (default: 60000)
 * - `thresholdLevel`   ('moderate'|'heavy'|'severe') — crowd level at which
 *                      a station is considered a breach (default: 'heavy')
 * - `maxHotspots`      (number)       — max hotspot rows in Hotspot Summary
 *                      (default: 8)
 * - `maxPressure`      (number)       — max station rows in Forecast Pressure
 *                      (default: 10)
 * - `maxThreshold`     (number)       — max station rows in Threshold Status
 *                      (default: 12)
 * - `onForecastSelect` (fn|null)      — callback fired with a CrowdForecast
 *                      when a pressure or threshold row is clicked; no
 *                      store writes (default: null)
 * - `compact`          (boolean)      — compact section mode (default: false)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`          — initial fetch in progress
 * - `refreshing`       — background refresh in progress
 * - `syncing`          — live WebSocket update in progress
 * - `error`            — last store error
 * - `lastUpdatedAt`    — ISO timestamp of last store write
 * - `getVisibleCrowdForecasts` — filtered + sorted forecast collection
 * - `getCrowdSummary`          — aggregate summary selector
 */

// ---------------------------------------------------------------------------
// Crowd level configuration
// ---------------------------------------------------------------------------

const CROWD_LEVEL_CONFIG = {
  light:    { rank: 0, label: 'Light',    cssModifier: 'light',    icon: '○' },
  moderate: { rank: 1, label: 'Moderate', cssModifier: 'moderate', icon: '◔' },
  heavy:    { rank: 2, label: 'Heavy',    cssModifier: 'heavy',    icon: '◑' },
  severe:   { rank: 3, label: 'Severe',   cssModifier: 'severe',   icon: '●' },
};

const LEVEL_ORDER = ['light', 'moderate', 'heavy', 'severe'];

function levelConfig(key) {
  return CROWD_LEVEL_CONFIG[String(key ?? 'light').toLowerCase()] ?? CROWD_LEVEL_CONFIG.light;
}

function levelRank(key) {
  return levelConfig(key).rank;
}

// ---------------------------------------------------------------------------
// Hotspot severity rank
// ---------------------------------------------------------------------------

const HOTSPOT_SEVERITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 };
function hotspotRank(severity) {
  return HOTSPOT_SEVERITY_RANK[String(severity ?? 'low').toLowerCase()] ?? 0;
}

// ---------------------------------------------------------------------------
// Occupancy derivation (shared across all M3 components)
// ---------------------------------------------------------------------------

function deriveOccupancyPct(forecast) {
  if (!forecast) return null;
  if (typeof forecast.occupancy === 'number') {
    return forecast.occupancy <= 1
      ? Math.round(forecast.occupancy * 100)
      : Math.min(100, Math.round(forecast.occupancy));
  }
  if (forecast.occupancy && typeof forecast.occupancy === 'object') {
    if (forecast.occupancy.pct   != null) return Math.min(100, Math.round(forecast.occupancy.pct));
    if (forecast.occupancy.ratio != null) return Math.round(forecast.occupancy.ratio * 100);
  }
  if (forecast.currentOccupancy != null && forecast.capacity != null) {
    return Math.min(
      100,
      Math.round((Number(forecast.currentOccupancy) / Number(forecast.capacity)) * 100),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aggregate computation (single pass over visible forecasts)
// ---------------------------------------------------------------------------

function computeAggregates(forecasts, thresholdLevel) {
  const thresholdRank = levelRank(thresholdLevel);
  const nearRank      = Math.max(0, thresholdRank - 1);

  // Distribution by level
  const byLevel = { light: [], moderate: [], heavy: [], severe: [] };

  // Hotspots — deduped by zoneId, enriched with station context
  const hotspotMap = {}; // zoneId → { zoneId, zoneName, severity, stationName, count }

  // Pressure list — one entry per forecast, sorted later
  const pressureList = [];

  // Threshold status — one entry per unique station, worst level
  const stationWorst = {}; // stationKey → { stationName, level, levelRank, occupancyPct, forecast }

  for (const f of forecasts) {
    const rawLevel  = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
    const cfg       = levelConfig(rawLevel);
    const stationKey = f.stationId ?? f.stationName ?? f.station ?? f.id;
    const stationName = f.stationName ?? f.station ?? f.stationId ?? '—';
    const occupancyPct = deriveOccupancyPct(f);

    // Distribution
    if (byLevel[rawLevel]) byLevel[rawLevel].push(f);
    else byLevel.light.push(f);

    // Hotspots
    if (Array.isArray(f.hotspots)) {
      for (const h of f.hotspots) {
        const zid = h.zoneId ?? h.id ?? `${stationKey}-${h.zoneName ?? 'zone'}`;
        if (!hotspotMap[zid]) {
          hotspotMap[zid] = {
            zoneId:      zid,
            zoneName:    h.zoneName ?? h.name ?? zid,
            severity:    h.severity ?? 'low',
            stationName,
            count:       1,
          };
        } else {
          hotspotMap[zid].count += 1;
          // Escalate severity if this occurrence is worse
          if (hotspotRank(h.severity) > hotspotRank(hotspotMap[zid].severity)) {
            hotspotMap[zid].severity = h.severity;
          }
        }
      }
    }

    // Pressure
    pressureList.push({
      forecast: f,
      stationName,
      level:       rawLevel,
      levelRank:   cfg.rank,
      occupancyPct,
      horizon:     f.horizon ?? null,
      confidenceBand: f.confidenceBand ?? null,
    });

    // Threshold — keep worst level per station
    if (!stationWorst[stationKey] || cfg.rank > stationWorst[stationKey].levelRank) {
      stationWorst[stationKey] = {
        stationKey,
        stationName,
        level:       rawLevel,
        levelRank:   cfg.rank,
        occupancyPct,
        forecast: f,
      };
    }
  }

  // Sort pressure descending by levelRank, then occupancy desc
  pressureList.sort((a, b) => {
    const rankDiff = b.levelRank - a.levelRank;
    if (rankDiff !== 0) return rankDiff;
    return (b.occupancyPct ?? 0) - (a.occupancyPct ?? 0);
  });

  // Sort hotspots descending by severity, then by count desc
  const hotspots = Object.values(hotspotMap).sort((a, b) => {
    const sevDiff = hotspotRank(b.severity) - hotspotRank(a.severity);
    return sevDiff !== 0 ? sevDiff : b.count - a.count;
  });

  // Threshold status — classify each station
  const thresholdRows = Object.values(stationWorst).map((s) => ({
    ...s,
    status:
      s.levelRank >= thresholdRank ? 'breach' :
      s.levelRank >= nearRank      ? 'near'   : 'clear',
  })).sort((a, b) => b.levelRank - a.levelRank);

  // KPI summary values
  const total           = forecasts.length;
  const severeCount     = byLevel.severe.length;
  const heavyCount      = byLevel.heavy.length;
  const totalHotspots   = hotspots.length;
  const breachCount     = thresholdRows.filter((r) => r.status === 'breach').length;
  const occupancyValues = pressureList.map((p) => p.occupancyPct).filter((v) => v != null);
  const avgDensity      = occupancyValues.length > 0
    ? Math.round(occupancyValues.reduce((s, v) => s + v, 0) / occupancyValues.length)
    : null;

  return {
    byLevel,
    hotspots,
    pressureList,
    thresholdRows,
    total,
    severeCount,
    heavyCount,
    totalHotspots,
    breachCount,
    avgDensity,
  };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="crowd-dashboard__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI strip — 5 headline metrics
// ---------------------------------------------------------------------------

function KpiStrip({ agg }) {
  const { total, severeCount, heavyCount, totalHotspots, breachCount, avgDensity } = agg;
  const densityMod =
    avgDensity == null ? null :
    avgDensity >= 90   ? 'danger'  :
    avgDensity >= 75   ? 'warning' :
    avgDensity >= 50   ? 'watch'   : 'good';

  return (
    <div className="crowd-dashboard__kpi-strip" aria-label="Crowd KPI summary">
      <div className="crowd-dashboard__kpi">
        <span className="crowd-dashboard__kpi-value">{total}</span>
        <span className="crowd-dashboard__kpi-label">Forecasts</span>
      </div>
      <div className={`crowd-dashboard__kpi ${severeCount > 0 ? 'crowd-dashboard__kpi--danger' : 'crowd-dashboard__kpi--good'}`}>
        <span className="crowd-dashboard__kpi-value">{severeCount}</span>
        <span className="crowd-dashboard__kpi-label">Severe</span>
      </div>
      <div className={`crowd-dashboard__kpi ${heavyCount > 0 ? 'crowd-dashboard__kpi--warning' : 'crowd-dashboard__kpi--good'}`}>
        <span className="crowd-dashboard__kpi-value">{heavyCount}</span>
        <span className="crowd-dashboard__kpi-label">Heavy</span>
      </div>
      <div className={`crowd-dashboard__kpi ${totalHotspots > 0 ? 'crowd-dashboard__kpi--warning' : 'crowd-dashboard__kpi--good'}`}>
        <span className="crowd-dashboard__kpi-value">{totalHotspots}</span>
        <span className="crowd-dashboard__kpi-label">Hotspots</span>
      </div>
      <div className={`crowd-dashboard__kpi ${breachCount > 0 ? 'crowd-dashboard__kpi--danger' : 'crowd-dashboard__kpi--good'}`}>
        <span className="crowd-dashboard__kpi-value">{breachCount}</span>
        <span className="crowd-dashboard__kpi-label">Breaches</span>
      </div>
      {avgDensity != null && (
        <div className={`crowd-dashboard__kpi ${densityMod ? `crowd-dashboard__kpi--${densityMod}` : ''}`}>
          <span className="crowd-dashboard__kpi-value">{avgDensity}%</span>
          <span className="crowd-dashboard__kpi-label">Avg Density</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Crowd Overview — level distribution bar
// ---------------------------------------------------------------------------

function CrowdOverviewSection({ byLevel, total, compact }) {
  if (total === 0) {
    return (
      <section className="crowd-dashboard__section crowd-dashboard__section--overview" aria-label="Crowd Overview">
        <h2 className="crowd-dashboard__section-title">Crowd Overview</h2>
        <div className="crowd-dashboard__empty" role="status">No forecast data.</div>
      </section>
    );
  }

  return (
    <section className="crowd-dashboard__section crowd-dashboard__section--overview" aria-label="Crowd Overview">
      <h2 className="crowd-dashboard__section-title">Crowd Overview</h2>

      {/* Level distribution bar */}
      <div
        className="crowd-dashboard__level-bar"
        role="img"
        aria-label="Crowd level distribution"
      >
        {LEVEL_ORDER.map((key) => {
          const count = byLevel[key]?.length ?? 0;
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
          const cfg   = levelConfig(key);
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className={`crowd-dashboard__level-segment crowd-dashboard__level-segment--${cfg.cssModifier}`}
              style={{ width: `${pct}%` }}
              title={`${cfg.label}: ${count} (${pct}%)`}
              aria-label={`${cfg.label}: ${count} forecasts, ${pct}%`}
            />
          );
        })}
      </div>

      {/* Level legend with counts */}
      <div className="crowd-dashboard__level-legend" role="list">
        {LEVEL_ORDER.map((key) => {
          const count = byLevel[key]?.length ?? 0;
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
          const cfg   = levelConfig(key);
          return (
            <div
              key={key}
              className={`crowd-dashboard__level-legend-item crowd-dashboard__level-legend-item--${cfg.cssModifier} ${count === 0 ? 'crowd-dashboard__level-legend-item--zero' : ''}`}
              role="listitem"
              aria-label={`${cfg.label}: ${count} forecasts (${pct}%)`}
            >
              <span className="crowd-dashboard__level-icon" aria-hidden="true">{cfg.icon}</span>
              <span className="crowd-dashboard__level-name">{cfg.label}</span>
              <span className="crowd-dashboard__level-count">{count}</span>
              {!compact && (
                <span className="crowd-dashboard__level-pct" aria-hidden="true">{pct}%</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Hotspot Summary — severity-ranked hotspot zone list
// ---------------------------------------------------------------------------

function HotspotSummarySection({ hotspots, maxHotspots, compact }) {
  const visible = hotspots.slice(0, maxHotspots);
  const overflow = hotspots.length - visible.length;

  return (
    <section className="crowd-dashboard__section crowd-dashboard__section--hotspots" aria-label="Hotspot Summary">
      <h2 className="crowd-dashboard__section-title">
        Hotspot Summary
        {hotspots.length > 0 && (
          <span className="crowd-dashboard__section-count" aria-label={`${hotspots.length} hotspots`}>
            {hotspots.length}
          </span>
        )}
      </h2>

      {visible.length === 0 ? (
        <div className="crowd-dashboard__empty crowd-dashboard__empty--good" role="status">
          <span aria-hidden="true">✓</span> No active hotspots.
        </div>
      ) : (
        <ol className="crowd-dashboard__hotspot-list" aria-label="Hotspot zones by severity">
          {visible.map((h, idx) => {
            const sevKey = String(h.severity ?? 'low').toLowerCase();
            return (
              <li
                key={h.zoneId ?? idx}
                className={`crowd-dashboard__hotspot-row crowd-dashboard__hotspot-row--${sevKey}`}
                aria-label={`${h.zoneName} at ${h.stationName}: ${h.severity} severity`}
              >
                <span
                  className={`crowd-dashboard__hotspot-severity crowd-dashboard__hotspot-severity--${sevKey}`}
                  aria-label={h.severity}
                >
                  {sevKey === 'critical' ? '✕' : sevKey === 'high' ? '▲' : sevKey === 'medium' ? '◉' : 'ℹ'}
                </span>
                <span className="crowd-dashboard__hotspot-zone">{h.zoneName}</span>
                {!compact && (
                  <span className="crowd-dashboard__hotspot-station">{h.stationName}</span>
                )}
                <span
                  className={`crowd-dashboard__hotspot-badge crowd-dashboard__hotspot-badge--${sevKey}`}
                >
                  {h.severity ?? 'low'}
                </span>
                {!compact && h.count > 1 && (
                  <span className="crowd-dashboard__hotspot-count" aria-label={`${h.count} occurrences`}>
                    ×{h.count}
                  </span>
                )}
              </li>
            );
          })}
          {overflow > 0 && (
            <li className="crowd-dashboard__hotspot-overflow" aria-label={`${overflow} more hotspots not shown`}>
              +{overflow} more
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Forecast Pressure — per-station pressure ranking
// ---------------------------------------------------------------------------

function PressureBar({ pct, levelKey }) {
  const cfg = levelConfig(levelKey);
  return (
    <div
      className={`crowd-dashboard__pressure-bar crowd-dashboard__pressure-bar--${cfg.cssModifier}`}
      role="meter"
      aria-valuenow={pct ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct ?? 0}% occupied`}
    >
      <div
        className="crowd-dashboard__pressure-fill"
        style={{ width: `${pct ?? levelConfig(levelKey).rank * 25}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function ForecastPressureSection({ pressureList, maxPressure, compact, onForecastSelect }) {
  const visible  = pressureList.slice(0, maxPressure);
  const isClickable = typeof onForecastSelect === 'function';

  return (
    <section className="crowd-dashboard__section crowd-dashboard__section--pressure" aria-label="Forecast Pressure">
      <h2 className="crowd-dashboard__section-title">
        Forecast Pressure
        {pressureList.length > 0 && (
          <span className="crowd-dashboard__section-count">{pressureList.length}</span>
        )}
      </h2>

      {visible.length === 0 ? (
        <div className="crowd-dashboard__empty" role="status">No forecast pressure data.</div>
      ) : (
        <ol className="crowd-dashboard__pressure-list" aria-label="Stations by forecast pressure">
          {visible.map((entry, idx) => {
            const cfg = levelConfig(entry.level);
            const pct = entry.occupancyPct;
            const sid = entry.forecast?.id ?? idx;

            return (
              <li
                key={`${sid}-${idx}`}
                className={[
                  'crowd-dashboard__pressure-row',
                  `crowd-dashboard__pressure-row--${cfg.cssModifier}`,
                  isClickable ? 'crowd-dashboard__pressure-row--clickable' : null,
                ].filter(Boolean).join(' ')}
                role={isClickable ? 'button' : 'listitem'}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={`${entry.stationName}: ${cfg.label}${pct != null ? `, ${pct}% occupancy` : ''}`}
                onClick={isClickable ? () => onForecastSelect(entry.forecast) : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onForecastSelect(entry.forecast); } }
                    : undefined
                }
              >
                <span
                  className={`crowd-dashboard__pressure-icon crowd-dashboard__pressure-icon--${cfg.cssModifier}`}
                  aria-hidden="true"
                >
                  {cfg.icon}
                </span>
                <span className="crowd-dashboard__pressure-station">{entry.stationName}</span>
                {!compact && entry.horizon && (
                  <span className="crowd-dashboard__pressure-horizon">{entry.horizon}</span>
                )}
                <PressureBar pct={pct} levelKey={entry.level} />
                <span
                  className={`crowd-dashboard__pressure-level crowd-dashboard__pressure-level--${cfg.cssModifier}`}
                >
                  {cfg.label}
                </span>
                {pct != null && (
                  <span className="crowd-dashboard__pressure-pct">{pct}%</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Threshold Status — breach / near / clear per station
// ---------------------------------------------------------------------------

const THRESHOLD_STATUS_CONFIG = {
  breach: { label: 'Breach', cssModifier: 'breach', icon: '✕' },
  near:   { label: 'Near',   cssModifier: 'near',   icon: '▲' },
  clear:  { label: 'Clear',  cssModifier: 'clear',  icon: '✓' },
};

function ThresholdStatusSection({ thresholdRows, maxThreshold, thresholdLevel, compact, onForecastSelect }) {
  const visible     = thresholdRows.slice(0, maxThreshold);
  const breachCount = thresholdRows.filter((r) => r.status === 'breach').length;
  const nearCount   = thresholdRows.filter((r) => r.status === 'near').length;
  const clearCount  = thresholdRows.filter((r) => r.status === 'clear').length;
  const isClickable = typeof onForecastSelect === 'function';

  return (
    <section className="crowd-dashboard__section crowd-dashboard__section--threshold" aria-label="Threshold Status">
      <h2 className="crowd-dashboard__section-title">
        Threshold Status
        <span className="crowd-dashboard__section-sub">≥ {levelConfig(thresholdLevel).label}</span>
      </h2>

      {/* Summary row */}
      {!compact && (
        <div className="crowd-dashboard__threshold-summary">
          <span className="crowd-dashboard__threshold-count crowd-dashboard__threshold-count--breach">
            {breachCount} Breach
          </span>
          <span className="crowd-dashboard__threshold-count crowd-dashboard__threshold-count--near">
            {nearCount} Near
          </span>
          <span className="crowd-dashboard__threshold-count crowd-dashboard__threshold-count--clear">
            {clearCount} Clear
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="crowd-dashboard__empty" role="status">No threshold data.</div>
      ) : (
        <ul className="crowd-dashboard__threshold-list" aria-label="Station threshold status">
          {visible.map((row, idx) => {
            const statusCfg  = THRESHOLD_STATUS_CONFIG[row.status] ?? THRESHOLD_STATUS_CONFIG.clear;
            const levelCfg   = levelConfig(row.level);
            const sid        = row.forecast?.id ?? row.stationKey ?? idx;

            return (
              <li
                key={`${sid}-${idx}`}
                className={[
                  'crowd-dashboard__threshold-row',
                  `crowd-dashboard__threshold-row--${statusCfg.cssModifier}`,
                  isClickable ? 'crowd-dashboard__threshold-row--clickable' : null,
                ].filter(Boolean).join(' ')}
                role={isClickable ? 'button' : 'listitem'}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={`${row.stationName}: ${statusCfg.label} — ${levelCfg.label} crowd level`}
                onClick={isClickable ? () => onForecastSelect(row.forecast) : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onForecastSelect(row.forecast); } }
                    : undefined
                }
              >
                <span
                  className={`crowd-dashboard__threshold-icon crowd-dashboard__threshold-icon--${statusCfg.cssModifier}`}
                  aria-hidden="true"
                >
                  {statusCfg.icon}
                </span>
                <span className="crowd-dashboard__threshold-station">{row.stationName}</span>
                <span
                  className={`crowd-dashboard__threshold-level crowd-dashboard__threshold-level--${levelCfg.cssModifier}`}
                >
                  {levelCfg.label}
                </span>
                {row.occupancyPct != null && (
                  <span className="crowd-dashboard__threshold-pct">{row.occupancyPct}%</span>
                )}
                <span
                  className={`crowd-dashboard__threshold-badge crowd-dashboard__threshold-badge--${statusCfg.cssModifier}`}
                >
                  {statusCfg.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdDashboard({
  layout            = 'dashboard',
  title             = null,
  staleThreshold    = 60000,
  thresholdLevel    = 'heavy',
  maxHotspots       = 8,
  maxPressure       = 10,
  maxThreshold      = 12,
  onForecastSelect  = null,
  compact           = false,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useCrowdStore((s) => s.loading);
  const refreshing    = useCrowdStore((s) => s.refreshing);
  const syncing       = useCrowdStore((s) => s.syncing);
  const error         = useCrowdStore((s) => s.error);
  const lastUpdatedAt = useCrowdStore((s) => s.lastUpdatedAt);

  const getVisibleCrowdForecasts = useCrowdStore((s) =>
    typeof s.getVisibleCrowdForecasts === 'function' ? s.getVisibleCrowdForecasts : null,
  );

  // ── Visible forecasts ────────────────────────────────────────────────────
  const forecasts = useMemo(() => {
    try { return getVisibleCrowdForecasts ? getVisibleCrowdForecasts() : []; }
    catch { return []; }
  }, [getVisibleCrowdForecasts]);

  // ── Aggregates (single pass) ─────────────────────────────────────────────
  const agg = useMemo(
    () => computeAggregates(forecasts, thresholdLevel),
    [forecasts, thresholdLevel],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = forecasts.length === 0 && !loading;
  const resolvedTitle = title ?? 'Crowd Intelligence';
  const lastUpdated   = formatWhen(lastUpdatedAt);

  // ── KPI strip ────────────────────────────────────────────────────────────
  const kpiStrip = useMemo(() => <KpiStrip agg={agg} />, [agg]);

  // ── Primary region — Overview + Hotspots + Pressure ──────────────────────
  const primary = (
    <div className="crowd-dashboard__primary">
      <CrowdOverviewSection
        byLevel={agg.byLevel}
        total={agg.total}
        compact={compact}
      />
      <HotspotSummarySection
        hotspots={agg.hotspots}
        maxHotspots={maxHotspots}
        compact={compact}
      />
      <ForecastPressureSection
        pressureList={agg.pressureList}
        maxPressure={maxPressure}
        compact={compact}
        onForecastSelect={onForecastSelect}
      />
    </div>
  );

  // ── Secondary region — Threshold Status ──────────────────────────────────
  const secondary = (
    <ThresholdStatusSection
      thresholdRows={agg.thresholdRows}
      maxThreshold={maxThreshold}
      thresholdLevel={thresholdLevel}
      compact={compact}
      onForecastSelect={onForecastSelect}
    />
  );

  // ── Core wrapper ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'crowd-dashboard',
        compact ? 'crowd-dashboard--compact' : null,
        isStale ? 'crowd-dashboard--stale'   : null,
        error   ? 'crowd-dashboard--error'   : null,
        syncing ? 'crowd-dashboard--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <StatusPills
        loading={loading}
        refreshing={refreshing}
        syncing={syncing}
        isStale={isStale}
        error={error}
      />

      {isEmpty ? (
        <div className="crowd-dashboard__empty crowd-dashboard__empty--full" role="status">
          No crowd forecast data available for the current scope.
        </div>
      ) : (
        <>
          {primary}
          {secondary}
          {!compact && lastUpdated && (
            <div className="crowd-dashboard__footer-updated" aria-label={`Last updated: ${lastUpdated}`}>
              Updated {lastUpdated}
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Layout wrappers ───────────────────────────────────────────────────────
  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={null}
        left={content}
        right={null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={resolvedTitle}
        kpiStrip={kpiStrip}
        primary={primary}
        secondary={secondary}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return content;
});

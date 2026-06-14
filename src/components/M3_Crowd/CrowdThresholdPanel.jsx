import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdThresholdPanel — canonical threshold management surface for Module-3
 * Crowd Intelligence. Displays threshold bands, warning zones, breach status,
 * and operational pressure across the visible CrowdForecast collection.
 *
 * Four coordinated sections:
 *
 *   1. Threshold Gauge      — a four-band visual ruler (light / moderate /
 *                            heavy / severe) with a configurable threshold
 *                            marker and a warning band highlight. Each band
 *                            shows the count of stations currently at that
 *                            level.
 *
 *   2. Warning Band         — stations at the level immediately below
 *                            `thresholdLevel` (one step away from breach);
 *                            annotated with occupancy and the horizon at which
 *                            they are projected to breach.
 *
 *   3. Breach Status        — ranked list of all stations at or above
 *                            `thresholdLevel`, sorted by worst crowd level
 *                            then occupancy descending.
 *
 *   4. Operational Pressure — aggregate network pressure score (0–100%)
 *                            computed as a weighted average of crowd level
 *                            ranks across all visible forecasts, plus per-band
 *                            percentage breakdown.
 *
 * Operates in two modes:
 *   - Single-station (forecastId / forecast prop supplied): scopes all
 *     sections to the anchor station's visible forecast set.
 *   - Network (neither prop supplied): uses all visible forecasts.
 *
 * All data is derived exclusively from `useCrowdStore` selectors. No
 * mutations. No cross-domain imports.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `src/layouts/DetailLayout.jsx`
 *
 * Props:
 * - `forecastId`       (string|null)  — store key; activates single-station
 *                      mode. Falls back to `getSelectedCrowdForecast()` when
 *                      null (default: null)
 * - `forecast`         (object|null)  — direct CrowdForecast override
 *                      (default: null)
 * - `layout`           ('detail'|'split'|null) — optional layout wrapper;
 *                      `'detail'` is the primary usage (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before stale (default: 60000)
 * - `thresholdLevel`   ('moderate'|'heavy'|'severe') — the crowd level that
 *                      triggers a breach; determines the threshold marker
 *                      position on the gauge (default: 'heavy')
 * - `maxBreachRows`    (number)       — max stations in breach list (default: 12)
 * - `maxWarningRows`   (number)       — max stations in warning list (default: 8)
 * - `compact`          (boolean)      — compact mode (default: false)
 * - `onForecastSelect` (fn|null)      — callback with CrowdForecast on row
 *                      click (default: null)
 * - `onRetry`          (fn|null)      — error retry for DetailLayout (default: null)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getCrowdForecastById`, `getSelectedCrowdForecast`, `getVisibleCrowdForecasts`
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CROWD_LEVEL_CONFIG = {
  light:    { rank: 0, label: 'Light',    cssModifier: 'light',    pressureWeight: 0   },
  moderate: { rank: 1, label: 'Moderate', cssModifier: 'moderate', pressureWeight: 33  },
  heavy:    { rank: 2, label: 'Heavy',    cssModifier: 'heavy',    pressureWeight: 66  },
  severe:   { rank: 3, label: 'Severe',   cssModifier: 'severe',   pressureWeight: 100 },
};

const LEVEL_ORDER = ['light', 'moderate', 'heavy', 'severe'];

function levelConfig(key) {
  return CROWD_LEVEL_CONFIG[String(key ?? 'light').toLowerCase()] ?? CROWD_LEVEL_CONFIG.light;
}

function levelRank(key) { return levelConfig(key).rank; }

// Warning level = one rank below threshold (floor at 0)
function warningLevel(thresholdLevel) {
  const thresholdRank = levelRank(thresholdLevel);
  return LEVEL_ORDER[Math.max(0, thresholdRank - 1)];
}

// ---------------------------------------------------------------------------
// Occupancy derivation
// ---------------------------------------------------------------------------

function deriveOccupancyPct(f) {
  if (!f) return null;
  if (typeof f.occupancy === 'number')
    return f.occupancy <= 1 ? Math.round(f.occupancy * 100) : Math.min(100, Math.round(f.occupancy));
  if (f.occupancy && typeof f.occupancy === 'object') {
    if (f.occupancy.pct   != null) return Math.min(100, Math.round(f.occupancy.pct));
    if (f.occupancy.ratio != null) return Math.round(f.occupancy.ratio * 100);
  }
  if (f.currentOccupancy != null && f.capacity != null)
    return Math.min(100, Math.round((Number(f.currentOccupancy) / Number(f.capacity)) * 100));
  return null;
}

// ---------------------------------------------------------------------------
// Aggregate computation
// ---------------------------------------------------------------------------

function computeThresholdData(forecasts, thresholdLevel) {
  const thresholdRank = levelRank(thresholdLevel);
  const warnLevel     = warningLevel(thresholdLevel);
  const warnRank      = levelRank(warnLevel);

  // Per-level buckets
  const byLevel = { light: [], moderate: [], heavy: [], severe: [] };

  // Per-station: keep worst forecast per station
  const stationWorst = {};

  for (const f of forecasts) {
    const rawLevel = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
    const key      = rawLevel in byLevel ? rawLevel : 'light';
    byLevel[key].push(f);

    const stationKey  = f.stationId ?? f.stationName ?? f.station ?? f.id ?? 'unknown';
    const stationName = f.stationName ?? f.station ?? f.stationId ?? '—';
    const cfg         = levelConfig(rawLevel);
    const occPct      = deriveOccupancyPct(f);

    if (!stationWorst[stationKey] || cfg.rank > levelRank(stationWorst[stationKey].level)) {
      stationWorst[stationKey] = {
        stationKey,
        stationName,
        level:     rawLevel,
        levelRank: cfg.rank,
        occPct,
        horizon:   f.horizon ?? null,
        forecast:  f,
      };
    }
  }

  const stationList = Object.values(stationWorst);

  // Breach stations: at or above threshold
  const breachStations = stationList
    .filter((s) => s.levelRank >= thresholdRank)
    .sort((a, b) => {
      const rDiff = b.levelRank - a.levelRank;
      return rDiff !== 0 ? rDiff : (b.occPct ?? 0) - (a.occPct ?? 0);
    });

  // Warning stations: exactly one level below threshold
  const warningStations = stationList
    .filter((s) => s.levelRank === warnRank && warnRank < thresholdRank)
    .sort((a, b) => (b.occPct ?? 0) - (a.occPct ?? 0));

  // Clear stations: below warning level
  const clearCount = stationList.filter((s) => s.levelRank < warnRank).length;

  // Operational pressure score (0–100)
  const total         = forecasts.length;
  const pressureScore = total > 0
    ? Math.round(
        forecasts.reduce((sum, f) => {
          const cfg = levelConfig(String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase());
          return sum + cfg.pressureWeight;
        }, 0) / total,
      )
    : 0;

  // Per-band percentages for pressure breakdown
  const bandPcts = {};
  for (const level of LEVEL_ORDER) {
    bandPcts[level] = total > 0 ? Math.round((byLevel[level].length / total) * 100) : 0;
  }

  return {
    byLevel,
    byLevelCounts: Object.fromEntries(LEVEL_ORDER.map((l) => [l, byLevel[l].length])),
    stationList,
    breachStations,
    warningStations,
    clearCount,
    pressureScore,
    bandPcts,
    total,
    thresholdRank,
    warnLevel,
    warnRank,
  };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="crowd-threshold-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Threshold Gauge
// ---------------------------------------------------------------------------

function ThresholdGauge({ byLevelCounts, thresholdLevel, warnLevel, total }) {
  const thresholdRank = levelRank(thresholdLevel);
  const warnRank      = levelRank(warnLevel);

  return (
    <section
      className="crowd-threshold-panel__section crowd-threshold-panel__section--gauge"
      aria-label="Crowd level threshold gauge"
    >
      <h3 className="crowd-threshold-panel__section-title">Threshold Bands</h3>

      {/* Gauge bands */}
      <div className="crowd-threshold-panel__gauge" role="img" aria-label="Threshold gauge showing crowd level bands">
        {LEVEL_ORDER.map((level, idx) => {
          const cfg      = levelConfig(level);
          const count    = byLevelCounts[level] ?? 0;
          const pct      = total > 0 ? Math.round((count / total) * 100) : 0;
          const isAbove  = cfg.rank >= thresholdRank;
          const isWarn   = cfg.rank === warnRank && warnRank < thresholdRank;
          const isThresh = cfg.rank === thresholdRank;

          return (
            <div
              key={level}
              className={[
                'crowd-threshold-panel__gauge-band',
                `crowd-threshold-panel__gauge-band--${cfg.cssModifier}`,
                isAbove  ? 'crowd-threshold-panel__gauge-band--breach' : null,
                isWarn   ? 'crowd-threshold-panel__gauge-band--warning' : null,
              ].filter(Boolean).join(' ')}
              aria-label={`${cfg.label}: ${count} station${count !== 1 ? 's' : ''}${isAbove ? ' (breach)' : isWarn ? ' (warning)' : ''}`}
            >
              {/* Threshold marker at the bottom edge of the threshold band */}
              {isThresh && (
                <div
                  className="crowd-threshold-panel__gauge-marker"
                  aria-label={`Threshold at ${cfg.label}`}
                  role="presentation"
                >
                  <span className="crowd-threshold-panel__gauge-marker-label">Threshold</span>
                </div>
              )}

              <div className="crowd-threshold-panel__gauge-band-content">
                <span className="crowd-threshold-panel__gauge-level">{cfg.label}</span>
                <span className="crowd-threshold-panel__gauge-count"
                  aria-label={`${count} station${count !== 1 ? 's' : ''}`}>
                  {count}
                </span>
                {pct > 0 && (
                  <div
                    className="crowd-threshold-panel__gauge-fill"
                    style={{ width: `${pct}%` }}
                    role="meter"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${pct}% of forecasts at ${cfg.label}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Warning Band
// ---------------------------------------------------------------------------

function WarningBandSection({ warningStations, warnLevel, thresholdLevel, maxWarningRows, compact, onForecastSelect }) {
  const warnCfg    = levelConfig(warnLevel);
  const isClickable = typeof onForecastSelect === 'function';

  return (
    <section className="crowd-threshold-panel__section crowd-threshold-panel__section--warning" aria-label="Warning Band">
      <h3 className="crowd-threshold-panel__section-title">
        Warning Band
        <span
          className={`crowd-threshold-panel__section-badge crowd-threshold-panel__section-badge--${warnCfg.cssModifier}`}
        >
          {warnCfg.label} → {levelConfig(thresholdLevel).label}
        </span>
      </h3>

      {warningStations.length === 0 ? (
        <div className="crowd-threshold-panel__empty-section" role="status">
          No stations in warning band.
        </div>
      ) : (
        <ol
          className="crowd-threshold-panel__station-list"
          aria-label={`${warningStations.length} station${warningStations.length !== 1 ? 's' : ''} in warning band`}
        >
          {warningStations.slice(0, maxWarningRows).map((s, idx) => (
            <li
              key={s.stationKey ?? idx}
              className={[
                'crowd-threshold-panel__station-row',
                `crowd-threshold-panel__station-row--${warnCfg.cssModifier}`,
                `crowd-threshold-panel__station-row--warning`,
                isClickable ? 'crowd-threshold-panel__station-row--clickable' : null,
              ].filter(Boolean).join(' ')}
              role={isClickable ? 'button' : 'listitem'}
              tabIndex={isClickable ? 0 : undefined}
              aria-label={`${s.stationName}: warning${s.occPct != null ? `, ${s.occPct}% occupied` : ''}`}
              onClick={isClickable ? () => onForecastSelect(s.forecast) : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onForecastSelect(s.forecast); } } : undefined}
            >
              <span className="crowd-threshold-panel__station-icon" aria-hidden="true">▲</span>
              <span className="crowd-threshold-panel__station-name">{s.stationName}</span>
              {!compact && s.horizon && (
                <span className="crowd-threshold-panel__station-horizon">{s.horizon}</span>
              )}
              {s.occPct != null && (
                <span className="crowd-threshold-panel__station-occ">{s.occPct}%</span>
              )}
              <span className={`crowd-threshold-panel__station-badge crowd-threshold-panel__station-badge--${warnCfg.cssModifier}`}>
                Warning
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Breach Status
// ---------------------------------------------------------------------------

function BreachStatusSection({ breachStations, thresholdLevel, maxBreachRows, compact, onForecastSelect }) {
  const thresholdCfg = levelConfig(thresholdLevel);
  const isClickable  = typeof onForecastSelect === 'function';

  return (
    <section className="crowd-threshold-panel__section crowd-threshold-panel__section--breach" aria-label="Breach Status">
      <h3 className="crowd-threshold-panel__section-title">
        Breach Status
        {breachStations.length > 0 && (
          <span
            className="crowd-threshold-panel__section-badge crowd-threshold-panel__section-badge--breach"
            aria-label={`${breachStations.length} station${breachStations.length !== 1 ? 's' : ''} in breach`}
          >
            {breachStations.length}
          </span>
        )}
      </h3>

      {breachStations.length === 0 ? (
        <div
          className="crowd-threshold-panel__clear-state"
          role="status"
          aria-label="No breach — all stations below threshold"
        >
          <span className="crowd-threshold-panel__clear-icon" aria-hidden="true">✓</span>
          <span>All stations below {thresholdCfg.label} threshold</span>
        </div>
      ) : (
        <ol
          className="crowd-threshold-panel__station-list crowd-threshold-panel__station-list--breach"
          aria-label={`${breachStations.length} breached station${breachStations.length !== 1 ? 's' : ''}`}
        >
          {breachStations.slice(0, maxBreachRows).map((s, idx) => {
            const cfg = levelConfig(s.level);
            return (
              <li
                key={s.stationKey ?? idx}
                className={[
                  'crowd-threshold-panel__station-row',
                  `crowd-threshold-panel__station-row--${cfg.cssModifier}`,
                  `crowd-threshold-panel__station-row--breach`,
                  isClickable ? 'crowd-threshold-panel__station-row--clickable' : null,
                ].filter(Boolean).join(' ')}
                role={isClickable ? 'button' : 'listitem'}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={`${s.stationName}: ${cfg.label} breach${s.occPct != null ? `, ${s.occPct}% occupied` : ''}`}
                onClick={isClickable ? () => onForecastSelect(s.forecast) : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onForecastSelect(s.forecast); } } : undefined}
              >
                <span
                  className={`crowd-threshold-panel__station-icon crowd-threshold-panel__station-icon--${cfg.cssModifier}`}
                  aria-hidden="true"
                >
                  {cfg.rank === 3 ? '●' : '◑'}
                </span>
                <span className="crowd-threshold-panel__station-name">{s.stationName}</span>
                {!compact && s.horizon && (
                  <span className="crowd-threshold-panel__station-horizon">{s.horizon}</span>
                )}
                {s.occPct != null && (
                  <span className="crowd-threshold-panel__station-occ">{s.occPct}%</span>
                )}
                <span className={`crowd-threshold-panel__station-badge crowd-threshold-panel__station-badge--${cfg.cssModifier}`}>
                  {cfg.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Operational Pressure
// ---------------------------------------------------------------------------

function OperationalPressureSection({ pressureScore, bandPcts, byLevelCounts, clearCount, compact }) {
  const pressureMod =
    pressureScore >= 75 ? 'critical' :
    pressureScore >= 50 ? 'high'     :
    pressureScore >= 25 ? 'medium'   : 'low';

  return (
    <section className="crowd-threshold-panel__section crowd-threshold-panel__section--pressure" aria-label="Operational Pressure">
      <h3 className="crowd-threshold-panel__section-title">Operational Pressure</h3>

      {/* Pressure score gauge */}
      <div
        className={`crowd-threshold-panel__pressure-gauge crowd-threshold-panel__pressure-gauge--${pressureMod}`}
        role="meter"
        aria-valuenow={pressureScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Network pressure: ${pressureScore}%`}
      >
        <div
          className="crowd-threshold-panel__pressure-fill"
          style={{ width: `${pressureScore}%` }}
          aria-hidden="true"
        />
        <span className="crowd-threshold-panel__pressure-score">{pressureScore}%</span>
      </div>
      <div className="crowd-threshold-panel__pressure-label">Network Pressure</div>

      {/* Per-band breakdown */}
      {!compact && (
        <div className="crowd-threshold-panel__pressure-breakdown" role="list">
          {LEVEL_ORDER.map((level) => {
            const cfg   = levelConfig(level);
            const pct   = bandPcts[level] ?? 0;
            const count = byLevelCounts[level] ?? 0;
            return (
              <div
                key={level}
                className={`crowd-threshold-panel__pressure-band crowd-threshold-panel__pressure-band--${cfg.cssModifier}`}
                role="listitem"
                aria-label={`${cfg.label}: ${count} stations, ${pct}%`}
              >
                <span className="crowd-threshold-panel__pressure-band-name">{cfg.label}</span>
                <span className="crowd-threshold-panel__pressure-band-count">{count}</span>
                <div
                  className={`crowd-threshold-panel__pressure-band-bar crowd-threshold-panel__pressure-band-bar--${cfg.cssModifier}`}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
                <span className="crowd-threshold-panel__pressure-band-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdThresholdPanel({
  forecastId         = null,
  forecast: fProp    = null,
  layout             = null,
  title              = null,
  staleThreshold     = 60000,
  thresholdLevel     = 'heavy',
  maxBreachRows      = 12,
  maxWarningRows     = 8,
  compact            = false,
  onForecastSelect   = null,
  onRetry            = null,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useCrowdStore((s) => s.loading);
  const refreshing    = useCrowdStore((s) => s.refreshing);
  const syncing       = useCrowdStore((s) => s.syncing);
  const error         = useCrowdStore((s) => s.error);
  const lastUpdatedAt = useCrowdStore((s) => s.lastUpdatedAt);

  const forecastFromStore = useCrowdStore((s) =>
    forecastId ? s.getCrowdForecastById(forecastId) : s.getSelectedCrowdForecast(),
  );

  const getVisibleCrowdForecasts = useCrowdStore((s) =>
    typeof s.getVisibleCrowdForecasts === 'function' ? s.getVisibleCrowdForecasts : null,
  );

  // ── Resolved anchor forecast ─────────────────────────────────────────────
  const anchorForecast = useMemo(
    () => fProp ?? forecastFromStore ?? null,
    [fProp, forecastFromStore],
  );

  // ── All visible forecasts ────────────────────────────────────────────────
  const allForecasts = useMemo(() => {
    try { return getVisibleCrowdForecasts ? getVisibleCrowdForecasts() : []; }
    catch { return []; }
  }, [getVisibleCrowdForecasts]);

  // ── Scoped forecasts ─────────────────────────────────────────────────────
  const isNetworkMode = !forecastId && !fProp;
  const scopedForecasts = useMemo(() => {
    if (isNetworkMode) return allForecasts;
    const sk = anchorForecast?.stationId ?? anchorForecast?.stationName ?? anchorForecast?.station;
    if (!sk) return anchorForecast ? [anchorForecast] : [];
    return allForecasts.filter((f) => (f.stationId ?? f.stationName ?? f.station) === sk);
  }, [isNetworkMode, allForecasts, anchorForecast]);

  // ── Threshold computation ────────────────────────────────────────────────
  const data = useMemo(
    () => computeThresholdData(scopedForecasts, thresholdLevel),
    [scopedForecasts, thresholdLevel],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchorForecast?.lastUpdatedAt ? Date.parse(anchorForecast.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchorForecast, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = scopedForecasts.length === 0 && !loading;
  const stationName   = anchorForecast?.stationName ?? anchorForecast?.station ?? null;
  const resolvedTitle = title ?? (isNetworkMode
    ? `Threshold Status — Network`
    : stationName ? `Threshold — ${stationName}` : 'Crowd Threshold');

  // ── Detail summary slot ──────────────────────────────────────────────────
  const detailSummary = (
    <div className="crowd-threshold-panel__summary">
      {stationName && <div className="crowd-threshold-panel__summary-station">{stationName}</div>}
      <div className="crowd-threshold-panel__summary-stats">
        <span className={`crowd-threshold-panel__summary-stat crowd-threshold-panel__summary-stat--${data.breachStations.length > 0 ? 'breach' : 'clear'}`}>
          {data.breachStations.length} breach{data.breachStations.length !== 1 ? 'es' : ''}
        </span>
        <span className="crowd-threshold-panel__summary-stat crowd-threshold-panel__summary-stat--warning">
          {data.warningStations.length} warning
        </span>
        <span className="crowd-threshold-panel__summary-stat">
          {data.pressureScore}% pressure
        </span>
      </div>
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
    </div>
  );

  // ── Core body ────────────────────────────────────────────────────────────
  const body = (
    <div
      className={[
        'crowd-threshold-panel',
        compact ? 'crowd-threshold-panel--compact' : null,
        isStale ? 'crowd-threshold-panel--stale'   : null,
        error   ? 'crowd-threshold-panel--error'   : null,
        syncing ? 'crowd-threshold-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="crowd-threshold-panel__empty" role="status">
          No crowd forecast data available.
        </div>
      ) : (
        <>
          <ThresholdGauge
            byLevelCounts={data.byLevelCounts}
            thresholdLevel={thresholdLevel}
            warnLevel={data.warnLevel}
            total={data.total}
          />
          <WarningBandSection
            warningStations={data.warningStations}
            warnLevel={data.warnLevel}
            thresholdLevel={thresholdLevel}
            maxWarningRows={maxWarningRows}
            compact={compact}
            onForecastSelect={onForecastSelect}
          />
          <BreachStatusSection
            breachStations={data.breachStations}
            thresholdLevel={thresholdLevel}
            maxBreachRows={maxBreachRows}
            compact={compact}
            onForecastSelect={onForecastSelect}
          />
          <OperationalPressureSection
            pressureScore={data.pressureScore}
            bandPcts={data.bandPcts}
            byLevelCounts={data.byLevelCounts}
            clearCount={data.clearCount}
            compact={compact}
          />
        </>
      )}
    </div>
  );

  // ── Layout wrappers ───────────────────────────────────────────────────────
  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={detailSummary}
        body={body}
        rail={<OperationalPressureSection pressureScore={data.pressureScore} bandPcts={data.bandPcts} byLevelCounts={data.byLevelCounts} clearCount={data.clearCount} compact={false} />}
        footer={null}
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
        header={null}
        left={body}
        right={<OperationalPressureSection pressureScore={data.pressureScore} bandPcts={data.bandPcts} byLevelCounts={data.byLevelCounts} clearCount={data.clearCount} compact={false} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

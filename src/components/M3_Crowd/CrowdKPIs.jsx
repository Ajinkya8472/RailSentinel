import React, { memo, useMemo } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdKPIs — canonical aggregate KPI surface for Module-3 Crowd Intelligence.
 * Computes and renders five mission-critical crowd metrics across the full set
 * of visible `CrowdForecast` entities from `useCrowdStore`:
 *
 *   1. Monitored Locations — unique station count being tracked
 *   2. Active Hotspots    — total hotspot zone count across all forecasts
 *   3. Threshold Breaches — forecast count at 'heavy' or 'severe' crowd level
 *   4. Forecast Risks     — forecast count at 'severe' level (Critical + Surge)
 *   5. Average Density    — mean occupancy percentage across all forecasts
 *                           that carry occupancy data
 *
 * This component always operates in fleet/aggregate mode — it reads the full
 * `getVisibleCrowdForecasts()` collection from the store rather than a single
 * forecast. It is the primary KPI entry point for the Crowd Intelligence
 * module dashboard.
 *
 * All presentation state is derived exclusively from `useCrowdStore` selectors.
 * No mutations are performed. No cross-domain store is imported.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `layout`           ('dashboard'|'split'|null) — optional layout wrapper;
 *                      null renders bare content. DashboardLayout is the
 *                      primary intended usage (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before `lastUpdatedAt` is considered
 *                      stale (default: 60000)
 * - `compact`          (boolean)      — compact tile mode; reduces padding and
 *                      hides secondary metadata on each KPI tile (default: false)
 * - `thresholdLevel`   ('moderate'|'heavy'|'severe') — minimum crowd level
 *                      considered a threshold breach for the Breaches KPI
 *                      (default: 'heavy')
 * - `showLastUpdated`  (boolean)      — render the last-updated timestamp
 *                      below the KPI grid (default: true)
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
// Threshold level rank map (for breach detection)
// ---------------------------------------------------------------------------

const CROWD_LEVEL_RANK = {
  light:    0,
  moderate: 1,
  heavy:    2,
  severe:   3,
};

function crowdLevelRank(level) {
  return CROWD_LEVEL_RANK[String(level ?? 'light').toLowerCase()] ?? 0;
}

// ---------------------------------------------------------------------------
// Occupancy derivation — identical to CrowdCard / CrowdStatusBadge
// ---------------------------------------------------------------------------

function deriveOccupancyPct(forecast) {
  if (!forecast) return null;

  if (typeof forecast.occupancy === 'number') {
    return forecast.occupancy <= 1
      ? Math.round(forecast.occupancy * 100)
      : Math.min(100, Math.round(forecast.occupancy));
  }
  if (forecast.occupancy && typeof forecast.occupancy === 'object') {
    if (forecast.occupancy.pct != null)   return Math.min(100, Math.round(forecast.occupancy.pct));
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
// KPI computation — all derived from visible CrowdForecast collection
// ---------------------------------------------------------------------------

function computeKpis(forecasts, thresholdLevel) {
  if (!Array.isArray(forecasts) || forecasts.length === 0) {
    return {
      monitoredLocations: 0,
      activeHotspots:     0,
      thresholdBreaches:  0,
      forecastRisks:      0,
      avgDensityPct:      null,
      surgeCount:         0,
    };
  }

  const thresholdRank = crowdLevelRank(thresholdLevel);

  // 1. Monitored Locations — unique stations in the visible set
  const stationKeys = new Set();
  for (const f of forecasts) {
    const key = f.stationId ?? f.stationName ?? f.station ?? f.id;
    if (key) stationKeys.add(key);
  }
  const monitoredLocations = stationKeys.size;

  // 2. Active Hotspots — total hotspot zone entries across all forecasts
  let activeHotspots = 0;
  for (const f of forecasts) {
    if (Array.isArray(f.hotspots)) activeHotspots += f.hotspots.length;
  }

  // 3. Threshold Breaches — forecasts at or above the configured threshold level
  let thresholdBreaches = 0;
  for (const f of forecasts) {
    const level = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
    if (crowdLevelRank(level) >= thresholdRank) thresholdBreaches += 1;
  }

  // 4. Forecast Risks — severe-level forecasts (maps to Critical + Surge states)
  let forecastRisks = 0;
  let surgeCount    = 0;
  for (const f of forecasts) {
    const level = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
    if (level === 'severe') {
      forecastRisks += 1;
      // Surge sub-count: severe + high occupancy or explicit surge flag
      const occ = deriveOccupancyPct(f);
      if (Boolean(f.surgeFlag ?? f.isSurge) || (occ != null && occ >= 90)) {
        surgeCount += 1;
      }
    }
  }

  // 5. Average Density — mean occupancy pct across forecasts with occupancy data
  const occupancyValues = forecasts
    .map(deriveOccupancyPct)
    .filter((v) => v != null);
  const avgDensityPct =
    occupancyValues.length > 0
      ? Math.round(
          occupancyValues.reduce((sum, v) => sum + v, 0) / occupancyValues.length,
        )
      : null;

  return {
    monitoredLocations,
    activeHotspots,
    thresholdBreaches,
    forecastRisks,
    avgDensityPct,
    surgeCount,
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
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="crowd-kpis__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

/**
 * KpiTile — individual metric tile used in the CrowdKPIs grid.
 *
 * Props:
 * - label        (string)       — metric name shown below the value
 * - value        (string|number) — primary display value
 * - sub          (string|null)  — secondary sub-value (e.g. "2 surge")
 * - modifier     (string|null)  — CSS BEM modifier for colour tone
 *                                 ('danger'|'warning'|'watch'|'good'|null)
 * - compact      (boolean)      — compact tile mode
 * - description  (string|null)  — accessible description for screen readers
 */
function KpiTile({ label, value, sub = null, modifier = null, compact = false, description = null }) {
  return (
    <div
      className={[
        'crowd-kpi-tile',
        modifier ? `crowd-kpi-tile--${modifier}` : null,
        compact  ? 'crowd-kpi-tile--compact'     : null,
      ].filter(Boolean).join(' ')}
      role="figure"
      aria-label={description ?? `${label}: ${value}`}
    >
      <div className="crowd-kpi-tile__value" aria-hidden={Boolean(description)}>
        {value ?? '—'}
      </div>
      <div className="crowd-kpi-tile__label">{label}</div>
      {sub && !compact && (
        <div className="crowd-kpi-tile__sub" aria-hidden="true">
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * DensityMeter — compact horizontal occupancy gauge for the Avg Density tile.
 */
function DensityMeter({ pct }) {
  if (pct == null) return null;

  const modifier =
    pct >= 90 ? 'surge'    :
    pct >= 75 ? 'critical' :
    pct >= 50 ? 'heavy'    :
    pct >= 25 ? 'moderate' : 'light';

  return (
    <div
      className={`crowd-kpis__density-meter crowd-kpis__density-meter--${modifier}`}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Average density ${pct}%`}
    >
      <div
        className="crowd-kpis__density-fill"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * KpiGrid — renders the 5 crowd KPI tiles and the density meter.
 */
function KpiGrid({ kpis, total, compact, thresholdLevel }) {
  const {
    monitoredLocations,
    activeHotspots,
    thresholdBreaches,
    forecastRisks,
    avgDensityPct,
    surgeCount,
  } = kpis;

  // Tile tone modifiers
  const breachModifier =
    thresholdBreaches === 0   ? 'good'    :
    thresholdBreaches <= 2    ? 'watch'   :
    thresholdBreaches <= 5    ? 'warning' : 'danger';

  const riskModifier =
    forecastRisks === 0  ? 'good'    :
    forecastRisks <= 2   ? 'warning' : 'danger';

  const hotspotModifier =
    activeHotspots === 0  ? 'good'    :
    activeHotspots <= 5   ? 'watch'   :
    activeHotspots <= 10  ? 'warning' : 'danger';

  const densityModifier =
    avgDensityPct == null    ? null      :
    avgDensityPct >= 90      ? 'danger'  :
    avgDensityPct >= 75      ? 'warning' :
    avgDensityPct >= 50      ? 'watch'   : 'good';

  return (
    <div
      className={`crowd-kpis__grid ${compact ? 'crowd-kpis__grid--compact' : ''}`}
      role="region"
      aria-label="Crowd Intelligence KPIs"
    >
      {/* 1. Monitored Locations */}
      <KpiTile
        label="Monitored Locations"
        value={monitoredLocations}
        sub={total > monitoredLocations ? `${total} forecasts` : null}
        modifier={null}
        compact={compact}
        description={`${monitoredLocations} unique station${monitoredLocations !== 1 ? 's' : ''} monitored`}
      />

      {/* 2. Active Hotspots */}
      <KpiTile
        label="Active Hotspots"
        value={activeHotspots}
        modifier={hotspotModifier}
        compact={compact}
        description={`${activeHotspots} active hotspot zone${activeHotspots !== 1 ? 's' : ''}`}
      />

      {/* 3. Threshold Breaches */}
      <KpiTile
        label="Threshold Breaches"
        value={thresholdBreaches}
        sub={thresholdBreaches > 0 ? `≥ ${thresholdLevel}` : 'None'}
        modifier={breachModifier}
        compact={compact}
        description={`${thresholdBreaches} forecast${thresholdBreaches !== 1 ? 's' : ''} at or above ${thresholdLevel} crowd level`}
      />

      {/* 4. Forecast Risks */}
      <KpiTile
        label="Forecast Risks"
        value={forecastRisks}
        sub={surgeCount > 0 ? `${surgeCount} surge` : null}
        modifier={riskModifier}
        compact={compact}
        description={`${forecastRisks} critical or surge forecast${forecastRisks !== 1 ? 's' : ''}${surgeCount > 0 ? `, ${surgeCount} surge` : ''}`}
      />

      {/* 5. Average Density */}
      <div
        className={[
          'crowd-kpi-tile',
          densityModifier ? `crowd-kpi-tile--${densityModifier}` : null,
          compact ? 'crowd-kpi-tile--compact' : null,
          'crowd-kpi-tile--density',
        ].filter(Boolean).join(' ')}
        role="figure"
        aria-label={
          avgDensityPct != null
            ? `Average density: ${avgDensityPct}%`
            : 'Average density: no data'
        }
      >
        <div className="crowd-kpi-tile__value" aria-hidden="true">
          {avgDensityPct != null ? `${avgDensityPct}%` : '—'}
        </div>
        <div className="crowd-kpi-tile__label">Avg Density</div>
        {!compact && <DensityMeter pct={avgDensityPct} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdKPIs({
  layout           = null,
  title            = null,
  staleThreshold   = 60000,
  compact          = false,
  thresholdLevel   = 'heavy',
  showLastUpdated  = true,
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

  const getCrowdSummary = useCrowdStore((s) =>
    typeof s.getCrowdSummary === 'function' ? s.getCrowdSummary : null,
  );

  // ── Visible forecasts ────────────────────────────────────────────────────
  const forecasts = useMemo(() => {
    try {
      return getVisibleCrowdForecasts ? getVisibleCrowdForecasts() : [];
    } catch {
      return [];
    }
  }, [getVisibleCrowdForecasts]);

  // ── Summary (total count from store, pre-filter) ─────────────────────────
  const summary = useMemo(() => {
    try {
      return getCrowdSummary ? getCrowdSummary() : null;
    } catch {
      return null;
    }
  }, [getCrowdSummary]);

  const totalForecasts = summary?.total ?? forecasts.length;

  // ── KPI computation ──────────────────────────────────────────────────────
  const kpis = useMemo(
    () => computeKpis(forecasts, thresholdLevel),
    [forecasts, thresholdLevel],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty          = forecasts.length === 0 && !loading;
  const resolvedTitle    = title ?? 'Crowd Intelligence KPIs';
  const lastUpdatedLabel = formatWhen(lastUpdatedAt ?? summary?.latestUpdatedAt ?? null);

  // ── Core content ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'crowd-kpis',
        compact ? 'crowd-kpis--compact'  : null,
        isStale ? 'crowd-kpis--stale'   : null,
        error   ? 'crowd-kpis--error'   : null,
        syncing ? 'crowd-kpis--live'    : null,
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
        <div className="crowd-kpis__empty" role="status">
          No crowd forecast data available.
        </div>
      ) : (
        <KpiGrid
          kpis={kpis}
          total={totalForecasts}
          compact={compact}
          thresholdLevel={thresholdLevel}
        />
      )}

      {showLastUpdated && !compact && lastUpdatedLabel && (
        <div className="crowd-kpis__updated" aria-label={`Last updated: ${lastUpdatedLabel}`}>
          <span className="crowd-kpis__updated-label">Updated</span>
          <span className="crowd-kpis__updated-value">{lastUpdatedLabel}</span>
        </div>
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
        kpiStrip={content}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return content;
});

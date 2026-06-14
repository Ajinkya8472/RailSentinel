import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdHotspotPanel — canonical hotspot zone deep-review surface for Module-3
 * Crowd Intelligence. Synthesises and renders hotspot zone intelligence from
 * the `hotspots[]` field of the approved `CrowdForecast` domain model.
 *
 * Operates in two complementary modes:
 *
 *   1. Single-station mode (when `forecastId` or `forecast` prop is supplied):
 *      Aggregates all `hotspots[]` entries across every visible CrowdForecast
 *      for the anchor station. Provides zone-level severity, recurrence count,
 *      contributing forecast horizons, and total hotspot count for the station.
 *
 *   2. Network mode (when neither prop is supplied):
 *      Reads `getVisibleCrowdForecasts()` across all stations, deduplicates
 *      hotspot zones by `zoneId`, and renders a network-wide ranked hotspot
 *      board — critical zones first.
 *
 * Each hotspot row exposes:
 *   - Zone identity (zoneName, zoneId)
 *   - Station context (stationName) in network mode
 *   - Severity classification (critical / high / medium / low)
 *   - Recurrence count (how many forecasts flag this zone)
 *   - Contributing horizons (which forecast windows flag this zone)
 *   - Mapped crowd level (severity → crowd level for colour consistency)
 *
 * DetailLayout is the primary intended usage (zone deep-review).
 * SplitPanelLayout is the secondary usage.
 *
 * All data is derived exclusively from `useCrowdStore` selectors. No mutations
 * are performed. No cross-domain store is imported.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `src/layouts/DetailLayout.jsx`
 *
 * Props:
 * - `forecastId`       (string|null)  — store key; falls back to
 *                      `getSelectedCrowdForecast()`. When absent, network
 *                      mode activates (default: null)
 * - `forecast`         (object|null)  — direct CrowdForecast override
 *                      (default: null)
 * - `layout`           ('detail'|'split'|null) — optional layout wrapper;
 *                      `'detail'` is the primary usage (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before stale (default: 60000)
 * - `maxZones`         (number)       — max hotspot zone rows (default: 20)
 * - `compact`          (boolean)      — compact display mode (default: false)
 * - `onZoneSelect`     (fn|null)      — callback fired with the source
 *                      CrowdForecast when a zone row is clicked (default: null)
 * - `onRetry`          (fn|null)      — error retry callback for DetailLayout
 *                      (default: null)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getCrowdForecastById`, `getSelectedCrowdForecast`
 * - `getVisibleCrowdForecasts`
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕', crowdLevel: 'severe'   },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲', crowdLevel: 'heavy'    },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉', crowdLevel: 'moderate' },
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ', crowdLevel: 'light'    },
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

function severityConfig(key) {
  return SEVERITY_CONFIG[String(key ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low;
}

function severityRank(key) {
  return severityConfig(key).rank;
}

// ---------------------------------------------------------------------------
// Hotspot aggregation
//
// ZoneRecord = {
//   zoneKey:     string,       -- unique dedup key (stationKey::zoneId)
//   zoneId:      string,
//   zoneName:    string,
//   stationName: string,
//   stationKey:  string,
//   severity:    string,       -- worst severity seen
//   count:       number,       -- how many forecasts flag this zone
//   horizons:    string[],     -- unique horizons that flag this zone
//   sourceForecast: object,    -- representative forecast for callbacks
// }
// ---------------------------------------------------------------------------

function aggregateHotspots(forecasts) {
  const zoneMap = {};

  for (const f of forecasts) {
    if (!Array.isArray(f.hotspots) || f.hotspots.length === 0) continue;

    const stationKey  = f.stationId ?? f.stationName ?? f.station ?? f.id ?? 'unknown';
    const stationName = f.stationName ?? f.station ?? f.stationId ?? '—';
    const horizon     = f.horizon ?? null;

    for (const h of f.hotspots) {
      const zoneId  = h.zoneId ?? h.id ?? `${stationKey}-${h.zoneName ?? 'zone'}`;
      const zoneKey = `${stationKey}::${zoneId}`;

      if (!zoneMap[zoneKey]) {
        zoneMap[zoneKey] = {
          zoneKey,
          zoneId,
          zoneName:       h.zoneName ?? h.name ?? zoneId,
          stationName,
          stationKey,
          severity:       String(h.severity ?? 'low').toLowerCase(),
          count:          1,
          horizons:       horizon ? [horizon] : [],
          sourceForecast: f,
        };
      } else {
        const existing = zoneMap[zoneKey];
        existing.count += 1;

        // Escalate to worst severity
        if (severityRank(h.severity) > severityRank(existing.severity)) {
          existing.severity = String(h.severity).toLowerCase();
        }

        // Collect unique horizons
        if (horizon && !existing.horizons.includes(horizon)) {
          existing.horizons.push(horizon);
        }
      }
    }
  }

  // Sort: severity rank desc, then count desc, then name asc
  return Object.values(zoneMap).sort((a, b) => {
    const sevDiff = severityRank(b.severity) - severityRank(a.severity);
    if (sevDiff !== 0) return sevDiff;
    const cntDiff = b.count - a.count;
    if (cntDiff !== 0) return cntDiff;
    return a.zoneName.localeCompare(b.zoneName);
  });
}

// ---------------------------------------------------------------------------
// Severity distribution summary
// ---------------------------------------------------------------------------

function severityDistribution(zones) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const z of zones) {
    const key = String(z.severity ?? 'low').toLowerCase();
    if (counts[key] != null) counts[key] += 1;
  }
  return counts;
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
    <div className="crowd-hotspot-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

/**
 * SeverityDistributionBar — proportional severity breakdown bar.
 */
function SeverityDistributionBar({ distribution, total }) {
  if (total === 0) return null;

  return (
    <div
      className="crowd-hotspot-panel__dist-bar"
      role="img"
      aria-label="Hotspot severity distribution"
    >
      {SEVERITY_ORDER.map((key) => {
        const count = distribution[key] ?? 0;
        const pct   = Math.round((count / total) * 100);
        if (pct === 0) return null;
        const cfg   = severityConfig(key);
        return (
          <div
            key={key}
            className={`crowd-hotspot-panel__dist-segment crowd-hotspot-panel__dist-segment--${cfg.cssModifier}`}
            style={{ width: `${pct}%` }}
            title={`${cfg.label}: ${count} (${pct}%)`}
            aria-label={`${cfg.label}: ${count} zones (${pct}%)`}
          />
        );
      })}
    </div>
  );
}

/**
 * SeverityLegend — distribution counts below the bar.
 */
function SeverityLegend({ distribution, compact }) {
  return (
    <div className="crowd-hotspot-panel__dist-legend" role="list">
      {SEVERITY_ORDER.map((key) => {
        const count = distribution[key] ?? 0;
        const cfg   = severityConfig(key);
        return (
          <span
            key={key}
            className={`crowd-hotspot-panel__dist-item crowd-hotspot-panel__dist-item--${cfg.cssModifier} ${count === 0 ? 'crowd-hotspot-panel__dist-item--zero' : ''}`}
            role="listitem"
            aria-label={`${cfg.label}: ${count}`}
          >
            <span aria-hidden="true">{cfg.icon}</span>
            {!compact && <span>{cfg.label}</span>}
            <span>{count}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * ZoneRow — individual hotspot zone list item.
 */
function ZoneRow({ zone, isNetworkMode, compact, onZoneSelect, rowId }) {
  const sevCfg = severityConfig(zone.severity);
  const isClickable = typeof onZoneSelect === 'function' && Boolean(zone.sourceForecast);

  const handleClick = () => {
    if (isClickable) onZoneSelect(zone.sourceForecast);
  };

  return (
    <li
      id={rowId}
      className={[
        'crowd-hotspot-panel__zone',
        `crowd-hotspot-panel__zone--${sevCfg.cssModifier}`,
        compact     ? 'crowd-hotspot-panel__zone--compact'   : null,
        isClickable ? 'crowd-hotspot-panel__zone--clickable'  : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'listitem'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`${zone.zoneName}${isNetworkMode ? ` at ${zone.stationName}` : ''}: ${sevCfg.label} severity, ${zone.count} occurrence${zone.count !== 1 ? 's' : ''}`}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }
          : undefined
      }
    >
      {/* Severity indicator */}
      <span
        className={`crowd-hotspot-panel__zone-icon crowd-hotspot-panel__zone-icon--${sevCfg.cssModifier}`}
        aria-label={sevCfg.label}
        role="img"
      >
        {sevCfg.icon}
      </span>

      {/* Zone identity */}
      <div className="crowd-hotspot-panel__zone-identity">
        <span className="crowd-hotspot-panel__zone-name">{zone.zoneName}</span>
        {isNetworkMode && (
          <span className="crowd-hotspot-panel__zone-station">{zone.stationName}</span>
        )}
      </div>

      {/* Horizons (non-compact) */}
      {!compact && zone.horizons.length > 0 && (
        <div
          className="crowd-hotspot-panel__zone-horizons"
          aria-label={`Active at: ${zone.horizons.join(', ')}`}
        >
          {zone.horizons.slice(0, 3).map((h) => (
            <span key={h} className="crowd-hotspot-panel__zone-horizon">{h}</span>
          ))}
          {zone.horizons.length > 3 && (
            <span className="crowd-hotspot-panel__zone-horizon crowd-hotspot-panel__zone-horizon--overflow">
              +{zone.horizons.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Recurrence count */}
      {zone.count > 1 && (
        <span
          className="crowd-hotspot-panel__zone-count"
          aria-label={`${zone.count} occurrences`}
        >
          ×{zone.count}
        </span>
      )}

      {/* Severity badge */}
      <span
        className={`crowd-hotspot-panel__zone-badge crowd-hotspot-panel__zone-badge--${sevCfg.cssModifier}`}
      >
        {sevCfg.label}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Rail slot: severity summary for DetailLayout / SplitPanelLayout
// ---------------------------------------------------------------------------

function HotspotRailSummary({ zones, distribution, stationName, isNetworkMode }) {
  const total = zones.length;

  return (
    <div className="crowd-hotspot-panel__rail" aria-label="Hotspot summary">
      {/* Station context */}
      {!isNetworkMode && stationName && (
        <div className="crowd-hotspot-panel__rail-station">{stationName}</div>
      )}

      {/* Total count */}
      <div className="crowd-hotspot-panel__rail-total" aria-label={`${total} total hotspot zones`}>
        <span className="crowd-hotspot-panel__rail-total-value">{total}</span>
        <span className="crowd-hotspot-panel__rail-total-label">
          Zone{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Severity breakdown */}
      <SeverityDistributionBar distribution={distribution} total={total} />
      <SeverityLegend distribution={distribution} compact={false} />

      {/* Critical zones callout */}
      {distribution.critical > 0 && (
        <div
          className="crowd-hotspot-panel__rail-critical"
          role="alert"
          aria-label={`${distribution.critical} critical hotspot zone${distribution.critical !== 1 ? 's' : ''} require immediate attention`}
        >
          <span className="crowd-hotspot-panel__rail-critical-icon" aria-hidden="true">✕</span>
          <span>
            {distribution.critical} critical zone{distribution.critical !== 1 ? 's' : ''} — immediate attention required
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdHotspotPanel({
  forecastId       = null,
  forecast: fProp  = null,
  layout           = null,
  title            = null,
  staleThreshold   = 60000,
  maxZones         = 20,
  compact          = false,
  onZoneSelect     = null,
  onRetry          = null,
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

  // ── Mode determination ───────────────────────────────────────────────────
  const isNetworkMode = !forecastId && !fProp;

  // ── Scoped forecasts ─────────────────────────────────────────────────────
  const scopedForecasts = useMemo(() => {
    if (isNetworkMode) return allForecasts;
    const stationKey = anchorForecast?.stationId ?? anchorForecast?.stationName ?? anchorForecast?.station;
    if (!stationKey) return anchorForecast ? [anchorForecast] : [];
    return allForecasts.filter((f) => {
      const fk = f.stationId ?? f.stationName ?? f.station;
      return fk === stationKey;
    });
  }, [isNetworkMode, allForecasts, anchorForecast]);

  // ── Hotspot aggregation ──────────────────────────────────────────────────
  const zones = useMemo(() => aggregateHotspots(scopedForecasts), [scopedForecasts]);

  const distribution = useMemo(() => severityDistribution(zones), [zones]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt
      ? Date.parse(lastUpdatedAt)
      : anchorForecast?.lastUpdatedAt ? Date.parse(anchorForecast.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchorForecast, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = zones.length === 0 && !loading;
  const stationName   = anchorForecast?.stationName ?? anchorForecast?.station ?? null;
  const resolvedTitle = title ?? (
    isNetworkMode
      ? 'Network Hotspots'
      : stationName ? `Hotspots — ${stationName}` : 'Crowd Hotspots'
  );

  // ── Stable IDs ───────────────────────────────────────────────────────────
  const listId = useId();

  // ── Visible zones ────────────────────────────────────────────────────────
  const visibleZones = zones.slice(0, maxZones);
  const overflow     = zones.length - visibleZones.length;

  // ── Rail slot ─────────────────────────────────────────────────────────────
  const rail = (
    <HotspotRailSummary
      zones={zones}
      distribution={distribution}
      stationName={stationName}
      isNetworkMode={isNetworkMode}
    />
  );

  // ── Core content ─────────────────────────────────────────────────────────
  const body = (
    <div
      className={[
        'crowd-hotspot-panel',
        isNetworkMode ? 'crowd-hotspot-panel--network'  : 'crowd-hotspot-panel--station',
        compact       ? 'crowd-hotspot-panel--compact'  : null,
        isStale       ? 'crowd-hotspot-panel--stale'    : null,
        error         ? 'crowd-hotspot-panel--error'    : null,
        syncing       ? 'crowd-hotspot-panel--live'     : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && (
        <StatusPills
          loading={loading}
          refreshing={refreshing}
          syncing={syncing}
          isStale={isStale}
          error={error}
        />
      )}

      {/* Distribution overview */}
      {!compact && zones.length > 0 && (
        <>
          <SeverityDistributionBar distribution={distribution} total={zones.length} />
          <SeverityLegend distribution={distribution} compact={compact} />
        </>
      )}

      {/* Zone list */}
      {isEmpty ? (
        <div className="crowd-hotspot-panel__empty" role="status">
          {scopedForecasts.length > 0
            ? 'No hotspot zone data in current forecasts.'
            : 'No crowd forecast data available.'}
        </div>
      ) : (
        <>
          <ol
            id={listId}
            className="crowd-hotspot-panel__zone-list"
            aria-label={`${visibleZones.length} hotspot zone${visibleZones.length !== 1 ? 's' : ''}`}
          >
            {visibleZones.map((zone, idx) => (
              <ZoneRow
                key={zone.zoneKey ?? idx}
                rowId={`${listId}-zone-${zone.zoneKey ?? idx}`}
                zone={zone}
                isNetworkMode={isNetworkMode}
                compact={compact}
                onZoneSelect={onZoneSelect}
              />
            ))}
          </ol>

          {overflow > 0 && (
            <div
              className="crowd-hotspot-panel__overflow"
              role="note"
              aria-label={`${overflow} more hotspot zones not shown`}
            >
              +{overflow} more zones
            </div>
          )}
        </>
      )}

      {/* Last updated */}
      {!compact && formatWhen(lastUpdatedAt) && (
        <div className="crowd-hotspot-panel__updated" aria-label={`Last updated: ${formatWhen(lastUpdatedAt)}`}>
          Updated {formatWhen(lastUpdatedAt)}
        </div>
      )}
    </div>
  );

  // ── Layout wrappers ───────────────────────────────────────────────────────
  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={
          <div className="crowd-hotspot-panel__detail-summary">
            {stationName && <div className="crowd-hotspot-panel__summary-station">{stationName}</div>}
            <div className="crowd-hotspot-panel__summary-counts">
              <span>{zones.length} zone{zones.length !== 1 ? 's' : ''}</span>
              {distribution.critical > 0 && (
                <span className="crowd-hotspot-panel__summary-critical">{distribution.critical} critical</span>
              )}
            </div>
            <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
          </div>
        }
        body={body}
        rail={rail}
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
        right={rail}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

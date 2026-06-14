import React, { memo, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdStatusBadge — canonical operational crowd-status indicator for
 * Module-3 Crowd Intelligence. Renders a compact, embeddable badge showing
 * one of five approved crowd-status states — Normal, Elevated, High, Critical,
 * Surge — derived from the `CrowdForecast` domain model.
 *
 * The five operational states map to CrowdForecast fields as follows:
 *
 *   Normal   → predictedCrowdLevel: 'light'
 *              occupancy < 50 % AND no hotspots
 *
 *   Elevated → predictedCrowdLevel: 'moderate'
 *              OR (predictedCrowdLevel: 'light' WITH hotspots present)
 *
 *   High     → predictedCrowdLevel: 'heavy'
 *              OR occupancy ≥ 75 %
 *
 *   Critical → predictedCrowdLevel: 'severe' AND occupancy < SURGE_THRESHOLD
 *              OR hotspot severity: 'critical' present
 *
 *   Surge    → predictedCrowdLevel: 'severe' AND occupancy ≥ SURGE_THRESHOLD (90%)
 *              OR explicit `surgeFlag: true` on the forecast
 *
 * This mapping elevates the raw crowd level into an actionable operational
 * status that station managers can act on directly. The badge is designed to
 * be embedded in lists, headers, KPI strips, map overlays, and detail panels.
 * All presentation state is derived exclusively from `useCrowdStore`
 * selectors. No mutations are performed.
 *
 * Dependencies:
 * - React (memo, useMemo, useCallback)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `forecastId`      (string|null)  — store key for lookup; falls back to
 *                     `getSelectedCrowdForecast()` when null (default: null)
 * - `forecast`        (object|null)  — direct CrowdForecast override; takes
 *                     precedence over store lookup (default: null)
 * - `layout`          ('dashboard'|'split'|null) — optional layout wrapper;
 *                     null renders the bare badge (default: null)
 * - `title`           (string|null)  — layout title override (default: null)
 * - `staleThreshold`  (number)       — ms before `lastUpdatedAt` is considered
 *                     stale (default: 60000)
 * - `size`            ('sm'|'md'|'lg') — badge size variant (default: 'md')
 * - `showIcon`        (boolean)      — render the status icon (default: true)
 * - `showStation`     (boolean)      — render the station name as a secondary
 *                     label on the badge (default: false)
 * - `showOccupancy`   (boolean)      — render the occupancy percentage inline
 *                     on md/lg badges (default: false)
 * - `onClick`         (fn|null)      — optional click callback fired with the
 *                     resolved CrowdForecast; no store writes (default: null)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`         — initial fetch in progress
 * - `refreshing`      — background refresh in progress
 * - `syncing`         — live WebSocket update in progress
 * - `error`           — last store error
 * - `lastUpdatedAt`   — ISO timestamp of last store write
 * - `getCrowdForecastById`      — id-keyed lookup selector
 * - `getSelectedCrowdForecast`  — current-selection fallback selector
 */

// ---------------------------------------------------------------------------
// Surge occupancy threshold
// ---------------------------------------------------------------------------

const SURGE_OCCUPANCY_THRESHOLD = 90; // percentage

// ---------------------------------------------------------------------------
// Operational status definitions (5 approved states)
// ---------------------------------------------------------------------------

const STATUS = {
  normal:   {
    key: 'normal',
    label: 'Normal',
    cssModifier: 'normal',
    icon: '○',
    ariaLabel: 'Normal crowd level',
    priority: 0,
  },
  elevated: {
    key: 'elevated',
    label: 'Elevated',
    cssModifier: 'elevated',
    icon: '◔',
    ariaLabel: 'Elevated crowd level',
    priority: 1,
  },
  high: {
    key: 'high',
    label: 'High',
    cssModifier: 'high',
    icon: '◑',
    ariaLabel: 'High crowd level',
    priority: 2,
  },
  critical: {
    key: 'critical',
    label: 'Critical',
    cssModifier: 'critical',
    icon: '◕',
    ariaLabel: 'Critical crowd level',
    priority: 3,
  },
  surge: {
    key: 'surge',
    label: 'Surge',
    cssModifier: 'surge',
    icon: '●',
    ariaLabel: 'Surge crowd level — immediate action required',
    priority: 4,
  },
};

// ---------------------------------------------------------------------------
// Status derivation — maps CrowdForecast domain model fields to 5 states
// ---------------------------------------------------------------------------

/**
 * Derives a 0–100 occupancy percentage from the CrowdForecast model.
 * Handles float ratio (0-1), integer percentage, object shape, and
 * currentOccupancy/capacity pair.
 */
function deriveOccupancyPct(forecast) {
  if (!forecast) return 0;

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

  return 0;
}

/**
 * Resolves the operational crowd status from the CrowdForecast domain model.
 * Returns one of the five STATUS objects.
 */
function resolveCrowdStatus(forecast) {
  if (!forecast) return STATUS.normal;

  const rawLevel   = String(forecast.predictedCrowdLevel ?? forecast.crowdLevel ?? 'light').toLowerCase();
  const occupancyPct = deriveOccupancyPct(forecast);
  const hotspots   = Array.isArray(forecast.hotspots) ? forecast.hotspots : [];
  const surgeFlag  = Boolean(forecast.surgeFlag ?? forecast.isSurge ?? false);
  const hasCriticalHotspot = hotspots.some(
    (h) => String(h.severity ?? '').toLowerCase() === 'critical',
  );
  const hasHotspots = hotspots.length > 0;

  // ── Surge: severe level AND (high occupancy OR explicit surge flag) ──────
  if (
    surgeFlag ||
    (rawLevel === 'severe' && occupancyPct >= SURGE_OCCUPANCY_THRESHOLD)
  ) {
    return STATUS.surge;
  }

  // ── Critical: severe level OR critical hotspot ───────────────────────────
  if (rawLevel === 'severe' || hasCriticalHotspot) {
    return STATUS.critical;
  }

  // ── High: heavy level OR occupancy ≥ 75% ────────────────────────────────
  if (rawLevel === 'heavy' || occupancyPct >= 75) {
    return STATUS.high;
  }

  // ── Elevated: moderate level OR light level with hotspots ────────────────
  if (rawLevel === 'moderate' || (rawLevel === 'light' && hasHotspots)) {
    return STATUS.elevated;
  }

  // ── Normal: light level with no hotspots ─────────────────────────────────
  return STATUS.normal;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatOccupancyPct(pct) {
  return `${pct}%`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * StatusIcon — renders the approved SVG-less icon for each status state.
 * Kept as text characters so no asset dependency is introduced.
 */
function StatusIcon({ status, size }) {
  return (
    <span
      className={`crowd-status-badge__icon crowd-status-badge__icon--${status.cssModifier} crowd-status-badge__icon--${size}`}
      aria-hidden="true"
      role="presentation"
    >
      {status.icon}
    </span>
  );
}

/**
 * InlinePills — loading / stale / error sub-indicators rendered inline
 * inside the badge in the meta row, matching the TrainStatusBadge pattern.
 */
function InlinePills({ loading, isStale, syncing, error }) {
  if (!loading && !isStale && !syncing && !error) return null;
  return (
    <span className="crowd-status-badge__meta" aria-live="polite" aria-atomic="true">
      {loading  && <span className="crowd-status-badge__pill"                   role="status">Loading</span>}
      {syncing  && <span className="crowd-status-badge__pill crowd-status-badge__pill--live"  role="status">Live</span>}
      {isStale  && <span className="crowd-status-badge__pill crowd-status-badge__pill--stale" role="status">Stale</span>}
      {error    && <span className="crowd-status-badge__pill crowd-status-badge__pill--error" role="alert">Error</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdStatusBadge({
  forecastId       = null,
  forecast: fProp  = null,
  layout           = null,
  title            = null,
  staleThreshold   = 60000,
  size             = 'md',
  showIcon         = true,
  showStation      = false,
  showOccupancy    = false,
  onClick          = null,
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

  // ── Resolved forecast ────────────────────────────────────────────────────
  const forecast = useMemo(
    () => fProp ?? forecastFromStore ?? null,
    [fProp, forecastFromStore],
  );

  // ── Derived status ───────────────────────────────────────────────────────
  const status = useMemo(() => resolveCrowdStatus(forecast), [forecast]);

  // ── Occupancy (optional display) ─────────────────────────────────────────
  const occupancyPct = useMemo(
    () => (showOccupancy ? deriveOccupancyPct(forecast) : null),
    [showOccupancy, forecast],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt
      ? Date.parse(lastUpdatedAt)
      : forecast?.lastUpdatedAt
        ? Date.parse(forecast.lastUpdatedAt)
        : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, forecast, staleThreshold]);

  // ── Station label ────────────────────────────────────────────────────────
  const stationName = useMemo(() => {
    if (!showStation || !forecast) return null;
    return forecast.stationName ?? forecast.station ?? null;
  }, [showStation, forecast]);

  // ── Click handler ────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e) => {
      if (typeof onClick === 'function') onClick(forecast, e);
    },
    [onClick, forecast],
  );

  const isInteractive = typeof onClick === 'function';

  // ── Resolved title ───────────────────────────────────────────────────────
  const resolvedTitle = title ?? (
    forecast
      ? `${forecast.stationName ?? forecast.station ?? 'Station'} — Crowd Status`
      : 'Crowd Status'
  );

  // ── Badge ARIA label ──────────────────────────────────────────────────────
  const badgeAriaLabel = [
    status.ariaLabel,
    stationName ? `at ${stationName}` : null,
    occupancyPct != null ? `— ${formatOccupancyPct(occupancyPct)} occupied` : null,
    isStale ? '(stale data)' : null,
    error   ? '(data error)' : null,
  ].filter(Boolean).join(' ');

  // ── Core badge ────────────────────────────────────────────────────────────
  const badge = (
    <div
      className={[
        'crowd-status-badge',
        `crowd-status-badge--${status.cssModifier}`,
        `crowd-status-badge--${size}`,
        isStale       ? 'crowd-status-badge--stale'       : null,
        error         ? 'crowd-status-badge--error'       : null,
        syncing       ? 'crowd-status-badge--live'        : null,
        isInteractive ? 'crowd-status-badge--interactive' : null,
      ].filter(Boolean).join(' ')}
      role={isInteractive ? 'button' : 'status'}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={badgeAriaLabel}
      aria-live={isInteractive ? undefined : 'polite'}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(e);
              }
            }
          : undefined
      }
    >
      {/* Primary row: icon + label */}
      <div className="crowd-status-badge__main">
        {showIcon && <StatusIcon status={status} size={size} />}
        <span className="crowd-status-badge__label">{status.label}</span>

        {/* Occupancy inline (md/lg only, opt-in) */}
        {occupancyPct != null && size !== 'sm' && (
          <span
            className="crowd-status-badge__occupancy"
            aria-label={`${formatOccupancyPct(occupancyPct)} occupied`}
          >
            {formatOccupancyPct(occupancyPct)}
          </span>
        )}
      </div>

      {/* Secondary row: station name (opt-in) */}
      {stationName && (
        <div className="crowd-status-badge__station" aria-label={`Station: ${stationName}`}>
          {stationName}
        </div>
      )}

      {/* Meta: loading / live / stale / error pills */}
      <InlinePills
        loading={loading || refreshing}
        isStale={isStale}
        syncing={syncing}
        error={error}
      />
    </div>
  );

  // ── Layout wrappers ───────────────────────────────────────────────────────
  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={null}
        left={badge}
        right={null}
        loading={loading}
        empty={!forecast}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={resolvedTitle}
        kpiStrip={badge}
        loading={loading}
        empty={!forecast}
        error={Boolean(error)}
      />
    );
  }

  return badge;
});

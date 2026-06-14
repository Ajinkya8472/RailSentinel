import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdAlertPanel — canonical crowd alert surface for Module-3 Crowd
 * Intelligence. Synthesises actionable alert conditions exclusively from
 * approved `CrowdForecast` domain model fields — `predictedCrowdLevel`,
 * `occupancy`, `hotspots[]`, `confidenceBand`, `surgeFlag`, `capacity` —
 * and renders them as a ranked, severity-ordered alert list.
 *
 * No external alert store or cross-domain import is used. Every alert is
 * derived deterministically from what is already present on the
 * CrowdForecast entity.
 *
 * Six alert conditions are synthesised:
 *
 *   1. Surge Active         — occupancy ≥ 90% OR surgeFlag/isSurge = true
 *                            AND predictedCrowdLevel: 'severe'  → critical
 *
 *   2. Severe Crowd         — predictedCrowdLevel: 'severe' (below surge)
 *                            → critical
 *
 *   3. Critical Hotspot     — any hotspot zone with severity: 'critical'
 *                            → high
 *
 *   4. Heavy Crowd          — predictedCrowdLevel: 'heavy'  → high
 *
 *   5. Overcapacity         — occupancy > 100% (when capacity data present)
 *                            → critical (takes priority over severe)
 *
 *   6. Low Confidence       — confidenceBand: 'low' on a high-level forecast
 *                            → medium (informational, non-actionable alone)
 *
 *   7. Moderate Crowd       — predictedCrowdLevel: 'moderate'  → low
 *
 * Operates in two complementary modes:
 *
 *   Single-station mode (forecastId / forecast supplied):
 *     Derives and renders all active alert conditions for the anchor
 *     station's visible forecasts. A "station clear" confirmation is shown
 *     when no alerts above `minSeverity` exist.
 *
 *   Network mode (neither prop supplied):
 *     Reads `getVisibleCrowdForecasts()`, derives the worst alert per station,
 *     filters to stations with at least one condition, and renders a ranked
 *     network-alert board.
 *
 * DetailLayout is the primary intended usage. SplitPanelLayout is secondary.
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
 * - `forecastId`       (string|null)  — store key; falls back to
 *                      `getSelectedCrowdForecast()`. Absent → network mode
 *                      (default: null)
 * - `forecast`         (object|null)  — direct CrowdForecast override
 *                      (default: null)
 * - `layout`           ('detail'|'split'|null) — optional layout wrapper
 *                      (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before stale (default: 60000)
 * - `thresholdLevel`   ('moderate'|'heavy'|'severe') — generates threshold-
 *                      breach alerts above this crowd level (default: 'heavy')
 * - `minSeverity`      ('low'|'medium'|'high'|'critical') — minimum severity
 *                      to surface; lower-severity alerts are suppressed
 *                      (default: 'low')
 * - `maxRows`          (number)       — max station rows in network mode
 *                      (default: 20)
 * - `maxAlerts`        (number)       — max alert rows in single-station mode
 *                      (default: 20)
 * - `compact`          (boolean)      — compact alert row mode (default: false)
 * - `showClearState`   (boolean)      — show "no alerts" confirmation in
 *                      single-station mode (default: true)
 * - `onAlertDismiss`   (fn|null)      — callback with alert object on dismiss;
 *                      no store writes (default: null)
 * - `onStationSelect`  (fn|null)      — callback with CrowdForecast on network
 *                      mode row click (default: null)
 * - `onRetry`          (fn|null)      — error retry for DetailLayout (default: null)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getCrowdForecastById`, `getSelectedCrowdForecast`, `getVisibleCrowdForecasts`
 */

// ---------------------------------------------------------------------------
// Severity configuration
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

function severityConfig(key) {
  return SEVERITY_CONFIG[String(key ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low;
}

function severityRank(key) { return severityConfig(key).rank; }

// Minimum severity rank for threshold-breach alert category
const CROWD_LEVEL_RANK = { light: 0, moderate: 1, heavy: 2, severe: 3 };
function levelRank(key) { return CROWD_LEVEL_RANK[String(key ?? 'light').toLowerCase()] ?? 0; }

const SURGE_THRESHOLD_PCT = 90;

// ---------------------------------------------------------------------------
// Occupancy derivation
// ---------------------------------------------------------------------------

function deriveOccupancyPct(f) {
  if (!f) return null;
  if (typeof f.occupancy === 'number')
    return f.occupancy <= 1 ? Math.round(f.occupancy * 100) : Math.min(150, Math.round(f.occupancy));
  if (f.occupancy && typeof f.occupancy === 'object') {
    if (f.occupancy.pct   != null) return Math.min(150, Math.round(f.occupancy.pct));
    if (f.occupancy.ratio != null) return Math.round(f.occupancy.ratio * 100);
  }
  if (f.currentOccupancy != null && f.capacity != null)
    return Math.round((Number(f.currentOccupancy) / Number(f.capacity)) * 100);
  return null;
}

// ---------------------------------------------------------------------------
// Alert synthesis — derives alerts from CrowdForecast fields only
// ---------------------------------------------------------------------------

/**
 * Derives all active alert conditions for a single CrowdForecast entity.
 * Returns an array sorted by severity descending.
 */
function deriveAlertsForForecast(f, thresholdLevel) {
  if (!f) return [];
  const alerts = [];
  const rawLevel     = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
  const fLevelRank   = levelRank(rawLevel);
  const occPct       = deriveOccupancyPct(f);
  const isSurge      = Boolean(f.surgeFlag ?? f.isSurge) || (occPct != null && occPct >= SURGE_THRESHOLD_PCT);
  const confidBand   = String(f.confidenceBand ?? '').toLowerCase();
  const hotspots     = Array.isArray(f.hotspots) ? f.hotspots : [];
  const hasCriticalHotspot = hotspots.some((h) => String(h.severity ?? '').toLowerCase() === 'critical');
  const threshRank   = levelRank(thresholdLevel);
  const stationName  = f.stationName ?? f.station ?? '—';

  // 1. Overcapacity (> 100%) — highest priority
  if (occPct != null && occPct > 100) {
    alerts.push({
      key:        `overcapacity-${f.id}`,
      severity:   'critical',
      category:   'capacity',
      title:      'Overcapacity',
      detail:     `Station at ${occPct}% capacity — exceeds design limit.`,
      stationName,
      forecast:   f,
    });
  }

  // 2. Surge active
  if (isSurge && rawLevel === 'severe') {
    alerts.push({
      key:        `surge-${f.id}`,
      severity:   'critical',
      category:   'surge',
      title:      'Surge Active',
      detail:     `Crowd at severe level${occPct != null ? ` with ${occPct}% occupancy` : ''}. Immediate intervention required.`,
      stationName,
      forecast:   f,
    });
  }

  // 3. Severe crowd (non-surge)
  if (rawLevel === 'severe' && !isSurge) {
    alerts.push({
      key:        `severe-${f.id}`,
      severity:   'critical',
      category:   'crowd',
      title:      'Severe Crowd Level',
      detail:     `Crowd forecast at severe.${occPct != null ? ` Occupancy: ${occPct}%.` : ''}`,
      stationName,
      forecast:   f,
    });
  }

  // 4. Critical hotspot zones
  if (hasCriticalHotspot) {
    const criticalZones = hotspots
      .filter((h) => String(h.severity ?? '').toLowerCase() === 'critical')
      .map((h) => h.zoneName ?? h.zoneId ?? 'Zone')
      .slice(0, 3)
      .join(', ');
    alerts.push({
      key:        `hotspot-critical-${f.id}`,
      severity:   'high',
      category:   'hotspot',
      title:      'Critical Hotspot Zone',
      detail:     `Critical hotspot${criticalZones ? `: ${criticalZones}` : ''} at ${stationName}.`,
      stationName,
      forecast:   f,
    });
  }

  // 5. Heavy crowd
  if (rawLevel === 'heavy') {
    alerts.push({
      key:        `heavy-${f.id}`,
      severity:   'high',
      category:   'crowd',
      title:      'Heavy Crowd Level',
      detail:     `Crowd forecast at heavy.${occPct != null ? ` Occupancy: ${occPct}%.` : ''}`,
      stationName,
      forecast:   f,
    });
  }

  // 6. Threshold breach (if not already covered by severe/heavy alerts above)
  if (fLevelRank >= threshRank && rawLevel !== 'severe' && rawLevel !== 'heavy') {
    alerts.push({
      key:        `threshold-${f.id}`,
      severity:   'high',
      category:   'threshold',
      title:      `Threshold Breach — ${rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1)}`,
      detail:     `Crowd level meets or exceeds the configured threshold.`,
      stationName,
      forecast:   f,
    });
  }

  // 7. Low confidence on elevated forecast
  if (confidBand === 'low' && fLevelRank >= 1) {
    alerts.push({
      key:        `confidence-${f.id}`,
      severity:   'medium',
      category:   'confidence',
      title:      'Low Forecast Confidence',
      detail:     `Confidence is low for a ${rawLevel} crowd forecast. Exercise caution.`,
      stationName,
      forecast:   f,
    });
  }

  // 8. Moderate crowd
  if (rawLevel === 'moderate') {
    alerts.push({
      key:        `moderate-${f.id}`,
      severity:   'low',
      category:   'crowd',
      title:      'Moderate Crowd Level',
      detail:     `Crowd forecast at moderate.${occPct != null ? ` Occupancy: ${occPct}%.` : ''}`,
      stationName,
      forecast:   f,
    });
  }

  alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return alerts;
}

/** Worst single alert for a forecast (used for network mode board). */
function worstAlert(f, thresholdLevel) {
  const alerts = deriveAlertsForForecast(f, thresholdLevel);
  return alerts.length > 0 ? alerts[0] : null;
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
    <div className="crowd-alert-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const cfg = severityConfig(severity);
  return (
    <span
      className={`crowd-alert-panel__severity-badge crowd-alert-panel__severity-badge--${cfg.cssModifier}`}
      aria-label={`Severity: ${cfg.label}`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function ClearState({ stationName }) {
  return (
    <div className="crowd-alert-panel__clear" role="status" aria-label="Station clear — no alerts">
      <span className="crowd-alert-panel__clear-icon" aria-hidden="true">✓</span>
      <span className="crowd-alert-panel__clear-title">No Active Alerts</span>
      {stationName && (
        <span className="crowd-alert-panel__clear-detail">
          {stationName} is within normal operating parameters.
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-station alert list
// ---------------------------------------------------------------------------

function AlertRow({ alert, compact, onAlertDismiss, rowId }) {
  const cfg = severityConfig(alert.severity);
  const canDismiss = typeof onAlertDismiss === 'function';

  return (
    <li
      id={rowId}
      className={[
        'crowd-alert-panel__alert-row',
        `crowd-alert-panel__alert-row--${cfg.cssModifier}`,
        `crowd-alert-panel__alert-row--${alert.category}`,
        compact ? 'crowd-alert-panel__alert-row--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${cfg.label} alert: ${alert.title} at ${alert.stationName}`}
    >
      <div className="crowd-alert-panel__alert-lead">
        <span
          className={`crowd-alert-panel__alert-icon crowd-alert-panel__alert-icon--${cfg.cssModifier}`}
          aria-hidden="true"
        >
          {cfg.icon}
        </span>
      </div>

      <div className="crowd-alert-panel__alert-body">
        <div className="crowd-alert-panel__alert-header">
          <span className="crowd-alert-panel__alert-title">{alert.title}</span>
          <SeverityBadge severity={alert.severity} />
        </div>
        {!compact && alert.detail && (
          <div className="crowd-alert-panel__alert-detail">{alert.detail}</div>
        )}
        {!compact && (
          <div className="crowd-alert-panel__alert-category">
            {alert.category.charAt(0).toUpperCase() + alert.category.slice(1)}
          </div>
        )}
      </div>

      {canDismiss && (
        <button
          type="button"
          className="crowd-alert-panel__alert-dismiss"
          aria-label={`Dismiss: ${alert.title}`}
          onClick={() => onAlertDismiss(alert)}
        >
          ×
        </button>
      )}
    </li>
  );
}

function SingleStationAlerts({ alerts, stationName, showClearState, compact, onAlertDismiss, maxAlerts, listId }) {
  const visible  = alerts.slice(0, maxAlerts);
  const overflow = alerts.length - visible.length;

  return (
    <div className="crowd-alert-panel__single">
      {stationName && (
        <div className="crowd-alert-panel__station-header">{stationName}</div>
      )}

      {alerts.length > 0 && (
        <div className="crowd-alert-panel__count-summary" aria-live="polite">
          {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
        </div>
      )}

      {alerts.length === 0 ? (
        showClearState ? <ClearState stationName={stationName} /> : null
      ) : (
        <>
          <ul
            id={listId}
            className="crowd-alert-panel__alert-list"
            aria-label={`Alerts for ${stationName ?? 'station'}`}
          >
            {visible.map((alert, idx) => (
              <AlertRow
                key={alert.key ?? idx}
                rowId={`${listId}-alert-${alert.key ?? idx}`}
                alert={alert}
                compact={compact}
                onAlertDismiss={onAlertDismiss}
              />
            ))}
          </ul>
          {overflow > 0 && (
            <div className="crowd-alert-panel__overflow" role="note">
              +{overflow} more alerts
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Network alert board
// ---------------------------------------------------------------------------

function NetworkAlertRow({ entry, compact, onStationSelect, rowId }) {
  const { forecast, worst } = entry;
  const cfg = severityConfig(worst.severity);
  const isClickable = typeof onStationSelect === 'function';

  const handleClick = () => { if (isClickable) onStationSelect(forecast); };

  return (
    <li
      id={rowId}
      className={[
        'crowd-alert-panel__network-row',
        `crowd-alert-panel__network-row--${cfg.cssModifier}`,
        isClickable ? 'crowd-alert-panel__network-row--clickable' : null,
        compact     ? 'crowd-alert-panel__network-row--compact'   : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'listitem'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`${worst.stationName}: ${worst.title} — ${cfg.label} severity`}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
    >
      <span
        className={`crowd-alert-panel__network-icon crowd-alert-panel__network-icon--${cfg.cssModifier}`}
        aria-hidden="true"
      >
        {cfg.icon}
      </span>
      <span className="crowd-alert-panel__network-station">{worst.stationName}</span>
      <span className="crowd-alert-panel__network-alert-title">{worst.title}</span>
      <SeverityBadge severity={worst.severity} />
    </li>
  );
}

function NetworkAlertBoard({ alertedStations, maxRows, compact, onStationSelect, listId }) {
  if (alertedStations.length === 0) {
    return (
      <div className="crowd-alert-panel__clear crowd-alert-panel__clear--network" role="status">
        <span className="crowd-alert-panel__clear-icon" aria-hidden="true">✓</span>
        <span className="crowd-alert-panel__clear-title">Network Clear</span>
        <span className="crowd-alert-panel__clear-detail">No crowd alerts across monitored stations.</span>
      </div>
    );
  }

  const visible  = alertedStations.slice(0, maxRows);
  const overflow = alertedStations.length - visible.length;

  return (
    <>
      <ol
        id={listId}
        className="crowd-alert-panel__network-list"
        aria-label={`Network alerts — ${visible.length} station${visible.length !== 1 ? 's' : ''}`}
      >
        {visible.map((entry, idx) => {
          const sid = entry.forecast?.id ?? entry.forecast?.stationId ?? idx;
          return (
            <NetworkAlertRow
              key={`${sid}-${idx}`}
              rowId={`${listId}-net-${sid}`}
              entry={entry}
              compact={compact}
              onStationSelect={onStationSelect}
            />
          );
        })}
      </ol>
      {overflow > 0 && (
        <div className="crowd-alert-panel__overflow" role="note">+{overflow} more stations</div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Rail slot: alert type breakdown summary
// ---------------------------------------------------------------------------

function AlertTypeSummary({ alerts }) {
  const byCat = {};
  for (const a of alerts) {
    byCat[a.category] = (byCat[a.category] ?? 0) + 1;
  }
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of alerts) {
    if (bySev[a.severity] != null) bySev[a.severity] += 1;
  }

  return (
    <div className="crowd-alert-panel__rail" aria-label="Alert summary">
      <div className="crowd-alert-panel__rail-title">Alert Summary</div>
      <div className="crowd-alert-panel__rail-severity" role="list">
        {SEVERITY_ORDER.map((sev) => {
          const cfg = severityConfig(sev);
          return (
            <div key={sev}
              className={`crowd-alert-panel__rail-sev-row crowd-alert-panel__rail-sev-row--${cfg.cssModifier}`}
              role="listitem"
              aria-label={`${cfg.label}: ${bySev[sev]} alert${bySev[sev] !== 1 ? 's' : ''}`}
            >
              <span aria-hidden="true">{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span className="crowd-alert-panel__rail-sev-count">{bySev[sev]}</span>
            </div>
          );
        })}
      </div>
      {Object.keys(byCat).length > 0 && (
        <div className="crowd-alert-panel__rail-categories" role="list">
          {Object.entries(byCat).map(([cat, count]) => (
            <div key={cat} className="crowd-alert-panel__rail-cat-row" role="listitem"
              aria-label={`${cat}: ${count}`}>
              <span className="crowd-alert-panel__rail-cat-name">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              <span className="crowd-alert-panel__rail-cat-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdAlertPanel({
  forecastId        = null,
  forecast: fProp   = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  thresholdLevel    = 'heavy',
  minSeverity       = 'low',
  maxRows           = 20,
  maxAlerts         = 20,
  compact           = false,
  showClearState    = true,
  onAlertDismiss    = null,
  onStationSelect   = null,
  onRetry           = null,
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

  // ── Single-station alerts ─────────────────────────────────────────────────
  const singleAlerts = useMemo(() => {
    if (isNetworkMode) return [];
    const stationKey = anchorForecast?.stationId ?? anchorForecast?.stationName ?? anchorForecast?.station;
    const stationForecasts = stationKey
      ? allForecasts.filter((f) => (f.stationId ?? f.stationName ?? f.station) === stationKey)
      : anchorForecast ? [anchorForecast] : [];

    const minRank = severityRank(minSeverity);
    const all = stationForecasts.flatMap((f) => deriveAlertsForForecast(f, thresholdLevel));

    // Deduplicate by key, keep highest severity
    const seen = {};
    for (const a of all) {
      const baseKey = a.key.replace(/-[^-]+$/, ''); // strip forecast-specific suffix
      if (!seen[baseKey] || severityRank(a.severity) > severityRank(seen[baseKey].severity)) {
        seen[baseKey] = a;
      }
    }
    return Object.values(seen)
      .filter((a) => severityRank(a.severity) >= minRank)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  }, [isNetworkMode, anchorForecast, allForecasts, thresholdLevel, minSeverity]);

  // ── Network mode: worst alert per station ────────────────────────────────
  const alertedStations = useMemo(() => {
    if (!isNetworkMode) return [];
    const minRank = severityRank(minSeverity);

    // Group by station key, pick worst forecast per station
    const stationMap = {};
    for (const f of allForecasts) {
      const sk   = f.stationId ?? f.stationName ?? f.station ?? f.id ?? 'unknown';
      const worst = worstAlert(f, thresholdLevel);
      if (!worst || severityRank(worst.severity) < minRank) continue;
      if (!stationMap[sk] || severityRank(worst.severity) > severityRank(stationMap[sk].worst.severity)) {
        stationMap[sk] = { forecast: f, worst };
      }
    }

    return Object.values(stationMap).sort((a, b) =>
      severityRank(b.worst.severity) - severityRank(a.worst.severity),
    );
  }, [isNetworkMode, allForecasts, thresholdLevel, minSeverity]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchorForecast?.lastUpdatedAt ? Date.parse(anchorForecast.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchorForecast, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = (isNetworkMode ? alertedStations.length === 0 : !anchorForecast) && !loading;
  const stationName   = anchorForecast?.stationName ?? anchorForecast?.station ?? null;
  const resolvedTitle = title ?? (isNetworkMode
    ? 'Network Crowd Alerts'
    : stationName ? `Alerts — ${stationName}` : 'Crowd Alerts');

  // ── Alert counts for summary ──────────────────────────────────────────────
  const railAlerts = isNetworkMode
    ? alertedStations.map((e) => e.worst)
    : singleAlerts;

  // ── Stable IDs ───────────────────────────────────────────────────────────
  const listId = useId();

  // ── Detail summary slot ──────────────────────────────────────────────────
  const detailSummary = (
    <div className="crowd-alert-panel__summary">
      {stationName && <div className="crowd-alert-panel__summary-station">{stationName}</div>}
      <div className="crowd-alert-panel__summary-counts">
        <span>{isNetworkMode ? alertedStations.length : singleAlerts.length} alert{(isNetworkMode ? alertedStations.length : singleAlerts.length) !== 1 ? 's' : ''}</span>
        {!isNetworkMode && singleAlerts.filter((a) => a.severity === 'critical').length > 0 && (
          <span className="crowd-alert-panel__summary-critical">
            {singleAlerts.filter((a) => a.severity === 'critical').length} critical
          </span>
        )}
      </div>
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
    </div>
  );

  // ── Core content ─────────────────────────────────────────────────────────
  const body = (
    <div
      className={[
        'crowd-alert-panel',
        isNetworkMode ? 'crowd-alert-panel--network'  : 'crowd-alert-panel--single',
        compact       ? 'crowd-alert-panel--compact'  : null,
        isStale       ? 'crowd-alert-panel--stale'    : null,
        error         ? 'crowd-alert-panel--error'    : null,
        syncing       ? 'crowd-alert-panel--live'     : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="crowd-alert-panel__empty" role="status">
          No crowd forecast data available.
        </div>
      ) : isNetworkMode ? (
        <NetworkAlertBoard
          alertedStations={alertedStations}
          maxRows={maxRows}
          compact={compact}
          onStationSelect={onStationSelect}
          listId={listId}
        />
      ) : (
        <SingleStationAlerts
          alerts={singleAlerts}
          stationName={stationName}
          showClearState={showClearState}
          compact={compact}
          onAlertDismiss={onAlertDismiss}
          maxAlerts={maxAlerts}
          listId={listId}
        />
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
        rail={<AlertTypeSummary alerts={railAlerts} />}
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
        right={<AlertTypeSummary alerts={railAlerts} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

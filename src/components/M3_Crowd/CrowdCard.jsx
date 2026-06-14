import React, { memo, useMemo, useCallback, useId } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdCard — canonical compact crowd-forecast card for Module-3 Crowd
 * Intelligence. Presents a concise, at-a-glance snapshot of a single
 * `CrowdForecast` entity: station identity, predicted crowd level, occupancy
 * density, confidence band, forecast horizon, and hotspot indicators.
 *
 * Designed for use in tile grids, triage queues, KPI strips, and as a
 * selection trigger in SplitPanelLayout list columns. All live state is
 * derived exclusively from `useCrowdStore` selectors; no mutations are
 * performed by this component.
 *
 * Dependencies:
 * - React (memo, useMemo, useCallback, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `forecastId`       (string|null)  — store key for lookup; falls back to
 *                      `getSelectedCrowdForecast()` when null (default: null)
 * - `forecast`         (object|null)  — direct CrowdForecast object override;
 *                      takes precedence over store lookup when supplied
 *                      (default: null)
 * - `layout`           ('dashboard'|'split'|null) — optional layout wrapper;
 *                      null renders the bare card (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before `lastUpdatedAt` is
 *                      considered stale (default: 60000)
 * - `onOpen`           (fn|null)      — callback fired with the CrowdForecast
 *                      object when the card is activated via click or keyboard
 *                      Enter/Space; makes the card interactive (default: null)
 * - `compact`          (boolean)      — compact visual mode; reduces padding
 *                      and hides secondary metadata rows (default: true)
 * - `showHotspots`     (boolean)      — render hotspot zone indicators when
 *                      the forecast carries a `hotspots` array (default: true)
 * - `showMitigation`   (boolean)      — render the first mitigation suggestion
 *                      from `mitigationSuggestions` in non-compact mode
 *                      (default: false)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`          — initial fetch in progress
 * - `refreshing`       — background refresh in progress
 * - `syncing`          — live WebSocket update in progress
 * - `error`            — last store error
 * - `lastUpdatedAt`    — ISO timestamp of last store write
 * - `getCrowdForecastById`   — id-keyed lookup selector
 * - `getSelectedCrowdForecast` — current-selection fallback selector
 */

// ---------------------------------------------------------------------------
// Crowd level configuration — canonical CrowdForecast domain model enum
// ---------------------------------------------------------------------------

const CROWD_LEVEL_CONFIG = {
  light:    { label: 'Light',    cssModifier: 'light',    densityPct: 25,  icon: '○' },
  moderate: { label: 'Moderate', cssModifier: 'moderate', densityPct: 50,  icon: '◔' },
  heavy:    { label: 'Heavy',    cssModifier: 'heavy',    densityPct: 75,  icon: '◑' },
  severe:   { label: 'Severe',   cssModifier: 'severe',   densityPct: 100, icon: '●' },
};

const DEFAULT_CROWD_LEVEL = { label: 'Unknown', cssModifier: 'unknown', densityPct: 0, icon: '—' };

function resolveCrowdLevel(forecast) {
  if (!forecast) return DEFAULT_CROWD_LEVEL;
  const key = String(
    forecast.predictedCrowdLevel ?? forecast.crowdLevel ?? 'unknown',
  ).toLowerCase();
  return CROWD_LEVEL_CONFIG[key] ?? DEFAULT_CROWD_LEVEL;
}

// ---------------------------------------------------------------------------
// Confidence band configuration
// ---------------------------------------------------------------------------

const CONFIDENCE_CONFIG = {
  high:   { label: 'High',   cssModifier: 'high',   bars: 3 },
  medium: { label: 'Medium', cssModifier: 'medium', bars: 2 },
  low:    { label: 'Low',    cssModifier: 'low',    bars: 1 },
};

function resolveConfidence(forecast) {
  if (!forecast) return null;
  const key = String(forecast.confidenceBand ?? '').toLowerCase();
  return CONFIDENCE_CONFIG[key] ?? null;
}

// ---------------------------------------------------------------------------
// Occupancy helpers
// ---------------------------------------------------------------------------

/**
 * Derives a 0–100 occupancy percentage from whatever occupancy shape the
 * CrowdForecast carries, falling back to crowd-level density if absent.
 */
function deriveOccupancyPct(forecast, crowdLevel) {
  if (!forecast) return crowdLevel.densityPct;

  // Float ratio 0-1
  if (typeof forecast.occupancy === 'number' && forecast.occupancy <= 1) {
    return Math.round(forecast.occupancy * 100);
  }
  // Integer percentage
  if (typeof forecast.occupancy === 'number') {
    return Math.min(100, Math.round(forecast.occupancy));
  }
  // Object shape: { pct, ratio }
  if (forecast.occupancy && typeof forecast.occupancy === 'object') {
    if (forecast.occupancy.pct != null) return Math.min(100, Math.round(forecast.occupancy.pct));
    if (forecast.occupancy.ratio != null) return Math.round(forecast.occupancy.ratio * 100);
  }
  // Derive from capacity
  if (forecast.currentOccupancy != null && forecast.capacity != null) {
    return Math.min(
      100,
      Math.round((Number(forecast.currentOccupancy) / Number(forecast.capacity)) * 100),
    );
  }
  // Confidence score fallback (0-1 → 0-100)
  if (typeof forecast.confidenceScore === 'number') {
    return crowdLevel.densityPct; // use band as best estimate
  }
  return crowdLevel.densityPct;
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

function formatHorizon(horizon) {
  if (!horizon) return null;
  // Pass through human-readable strings like '15min', '30min', '1h', '2h'
  return String(horizon);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="crowd-card__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

/**
 * OccupancyBar — linear density gauge.
 * Uses role="meter" with proper ARIA value attributes.
 */
function OccupancyBar({ pct, crowdLevel }) {
  return (
    <div
      className={`crowd-card__occupancy-bar crowd-card__occupancy-bar--${crowdLevel.cssModifier}`}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Station occupancy ${pct}%`}
    >
      <div
        className="crowd-card__occupancy-fill"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * ConfidenceDots — 3-bar signal-strength style confidence indicator.
 */
function ConfidenceDots({ confidence }) {
  if (!confidence) return null;
  return (
    <div
      className={`crowd-card__confidence crowd-card__confidence--${confidence.cssModifier}`}
      aria-label={`Confidence: ${confidence.label}`}
      role="img"
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={[
            'crowd-card__confidence-bar',
            bar <= confidence.bars
              ? `crowd-card__confidence-bar--${confidence.cssModifier}`
              : 'crowd-card__confidence-bar--empty',
          ].join(' ')}
          aria-hidden="true"
        />
      ))}
      <span className="crowd-card__confidence-label">{confidence.label}</span>
    </div>
  );
}

/**
 * CrowdLevelBadge — primary severity indicator for the forecast.
 */
function CrowdLevelBadge({ crowdLevel }) {
  return (
    <div
      className={`crowd-card__level-badge crowd-card__level-badge--${crowdLevel.cssModifier}`}
      aria-label={`Crowd level: ${crowdLevel.label}`}
      role="img"
    >
      <span className="crowd-card__level-icon" aria-hidden="true">
        {crowdLevel.icon}
      </span>
      <span className="crowd-card__level-label">{crowdLevel.label}</span>
    </div>
  );
}

/**
 * HotspotIndicators — compact zone-level hotspot severity chips.
 * Reads the `hotspots` array from the CrowdForecast model:
 *   [{ zoneId, zoneName, severity }]
 */
function HotspotIndicators({ hotspots, compact }) {
  if (!Array.isArray(hotspots) || hotspots.length === 0) return null;
  const visible = compact ? hotspots.slice(0, 2) : hotspots;
  const overflow = hotspots.length - visible.length;

  return (
    <div className="crowd-card__hotspots" aria-label={`${hotspots.length} hotspot${hotspots.length !== 1 ? 's' : ''}`}>
      {visible.map((h, idx) => {
        const sevKey = String(h.severity ?? 'unknown').toLowerCase();
        const name   = h.zoneName ?? h.zoneId ?? `Zone ${idx + 1}`;
        return (
          <span
            key={h.zoneId ?? idx}
            className={`crowd-card__hotspot crowd-card__hotspot--${sevKey}`}
            title={`${name}: ${h.severity ?? 'unknown'} severity`}
            aria-label={`Hotspot ${name}: ${h.severity ?? 'unknown'} severity`}
          >
            {name}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="crowd-card__hotspot crowd-card__hotspot--overflow" aria-label={`${overflow} more hotspots`}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

/**
 * CardBody — renders the full card content for a resolved CrowdForecast.
 */
function CardBody({ forecast, crowdLevel, confidence, occupancyPct, compact, showHotspots, showMitigation, cardId }) {
  const stationName = forecast.stationName ?? forecast.station ?? '—';
  const lineName    = forecast.lineName ?? forecast.line ?? null;
  const horizon     = formatHorizon(forecast.horizon ?? null);
  const generatedAt = formatWhen(forecast.generatedAt ?? null);
  const hotspots    = forecast.hotspots ?? null;
  const mitigation  = Array.isArray(forecast.mitigationSuggestions)
    ? forecast.mitigationSuggestions[0] ?? null
    : null;

  return (
    <div className={`crowd-card__body ${compact ? 'crowd-card__body--compact' : ''}`}>

      {/* Header row: station + crowd level */}
      <div className="crowd-card__header">
        <div className="crowd-card__station">
          <span id={`${cardId}-name`} className="crowd-card__station-name">
            {stationName}
          </span>
          {lineName && (
            <span className="crowd-card__line">{lineName}</span>
          )}
        </div>
        <CrowdLevelBadge crowdLevel={crowdLevel} />
      </div>

      {/* Occupancy density bar */}
      <div className="crowd-card__density">
        <OccupancyBar pct={occupancyPct} crowdLevel={crowdLevel} />
        <span
          className="crowd-card__density-pct"
          aria-label={`${occupancyPct}% occupied`}
        >
          {occupancyPct}%
        </span>
      </div>

      {/* Meta row: horizon + confidence + timestamp */}
      <div className="crowd-card__meta">
        {horizon && (
          <span
            className="crowd-card__horizon"
            aria-label={`Forecast horizon: ${horizon}`}
          >
            {horizon}
          </span>
        )}
        <ConfidenceDots confidence={confidence} />
        {!compact && generatedAt && (
          <span className="crowd-card__generated" aria-label={`Generated at ${generatedAt}`}>
            {generatedAt}
          </span>
        )}
      </div>

      {/* Hotspot zone indicators */}
      {showHotspots && (
        <HotspotIndicators hotspots={hotspots} compact={compact} />
      )}

      {/* First mitigation suggestion (non-compact, opt-in) */}
      {showMitigation && !compact && mitigation && (
        <div className="crowd-card__mitigation" aria-label="Suggested mitigation">
          <span className="crowd-card__mitigation-icon" aria-hidden="true">→</span>
          <span className="crowd-card__mitigation-text">{mitigation}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdCard({
  forecastId        = null,
  forecast: fProp   = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  onOpen            = null,
  compact           = true,
  showHotspots      = true,
  showMitigation    = false,
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

  // ── Resolved forecast (prop wins over store) ─────────────────────────────
  const forecast = useMemo(
    () => fProp ?? forecastFromStore ?? null,
    [fProp, forecastFromStore],
  );

  // ── Derived presentation values ──────────────────────────────────────────
  const crowdLevel   = useMemo(() => resolveCrowdLevel(forecast), [forecast]);
  const confidence   = useMemo(() => resolveConfidence(forecast), [forecast]);
  const occupancyPct = useMemo(
    () => deriveOccupancyPct(forecast, crowdLevel),
    [forecast, crowdLevel],
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

  // ── Interaction handler ──────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    if (!forecast) return;
    if (typeof onOpen === 'function') onOpen(forecast);
  }, [forecast, onOpen]);

  const isInteractive = typeof onOpen === 'function';

  // ── Resolved title ───────────────────────────────────────────────────────
  const stationName = forecast?.stationName ?? forecast?.station ?? null;
  const resolvedTitle = title ?? (stationName ? `${stationName} — Crowd` : 'Crowd Forecast');

  // ── Stable card ID for ARIA label linkage ────────────────────────────────
  const cardId = useId();

  // ── Core card ─────────────────────────────────────────────────────────────
  const card = (
    <div
      id={cardId}
      className={[
        'crowd-card',
        `crowd-card--${crowdLevel.cssModifier}`,
        compact      ? 'crowd-card--compact'     : null,
        isStale      ? 'crowd-card--stale'       : null,
        error        ? 'crowd-card--error'       : null,
        syncing      ? 'crowd-card--live'        : null,
        isInteractive ? 'crowd-card--interactive' : null,
      ].filter(Boolean).join(' ')}
      role={isInteractive ? 'button' : 'article'}
      tabIndex={isInteractive ? 0 : undefined}
      aria-labelledby={`${cardId}-name`}
      aria-live="polite"
      onClick={isInteractive ? handleOpen : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpen();
              }
            }
          : undefined
      }
    >
      <StatusPills
        loading={loading}
        refreshing={refreshing}
        syncing={syncing}
        isStale={isStale}
        error={error}
      />

      {forecast ? (
        <CardBody
          forecast={forecast}
          crowdLevel={crowdLevel}
          confidence={confidence}
          occupancyPct={occupancyPct}
          compact={compact}
          showHotspots={showHotspots}
          showMitigation={showMitigation}
          cardId={cardId}
        />
      ) : (
        <div className="crowd-card__empty" role="status">
          {loading ? 'Loading forecast…' : 'No crowd forecast selected.'}
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
        left={card}
        right={null}
        loading={loading}
        empty={!forecast}
        error={Boolean(error)}
        success={!loading && !error && Boolean(forecast)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={resolvedTitle}
        kpiStrip={card}
        loading={loading}
        empty={!forecast}
        error={Boolean(error)}
        success={!loading && !error && Boolean(forecast)}
      />
    );
  }

  return card;
});

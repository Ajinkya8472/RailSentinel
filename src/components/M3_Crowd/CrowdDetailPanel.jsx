import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdDetailPanel — canonical single-entity deep-review surface for Module-3
 * Crowd Intelligence. Renders the complete operational profile of one
 * `CrowdForecast` entity across six coordinated content regions, using all
 * available `DetailLayout` slots.
 *
 * This is the "master detail" component — the terminal destination when an
 * operator drills into a specific crowd forecast from a list, map, or alert.
 * It assembles data from every field in the `CrowdForecast` domain model into
 * a coherent, read-only review surface.
 *
 * Content regions:
 *
 *   Header slot  — entity identity: station name, crowd level badge, horizon,
 *                  line context, and live-update / stale / error pills.
 *
 *   Summary slot — key at-a-glance metrics: occupancy %, capacity, current
 *                  load, crowd level, surge flag, confidence band, and
 *                  generated timestamp.
 *
 *   Body         — four stacked sections:
 *     1. Forecast Detail       — predictedCrowdLevel, all horizon variants
 *                               for this station, confidenceScore, generatedBy.
 *     2. Hotspot Zones         — synthesised from `hotspots[]`, ranked by severity.
 *     3. Mitigation Actions    — `mitigationSuggestions[]` as numbered checklist.
 *     4. Cross-Domain Links    — approved cross-domain references: affectedTrainIds,
 *                               incidentIds, scheduling impact, risk score.
 *
 *   Rail slot    — station context metadata: stationId, lineName, capacity,
 *                  generatedBy, generatedAt, lastUpdatedAt, forecast ID.
 *
 * DetailLayout is the primary intended usage. SplitPanelLayout is secondary.
 *
 * All data is derived exclusively from `useCrowdStore` selectors. No mutations.
 * No cross-domain store imports.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `src/layouts/DetailLayout.jsx`
 *
 * Props:
 * - `forecastId`       (string|null)  — store key; falls back to
 *                      `getSelectedCrowdForecast()` (default: null)
 * - `forecast`         (object|null)  — direct CrowdForecast override
 *                      (default: null)
 * - `layout`           ('detail'|'split'|null) — optional layout wrapper;
 *                      `'detail'` is the primary usage (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before stale (default: 60000)
 * - `thresholdLevel`   ('moderate'|'heavy'|'severe') — used for breach
 *                      annotation in forecast detail (default: 'heavy')
 * - `compact`          (boolean)      — compact display mode (default: false)
 * - `onRetry`          (fn|null)      — error retry for DetailLayout
 *                      (default: null)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getCrowdForecastById`, `getSelectedCrowdForecast`, `getVisibleCrowdForecasts`
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CROWD_LEVEL_CONFIG = {
  light:    { rank: 0, label: 'Light',    cssModifier: 'light',    icon: '○' },
  moderate: { rank: 1, label: 'Moderate', cssModifier: 'moderate', icon: '◔' },
  heavy:    { rank: 2, label: 'Heavy',    cssModifier: 'heavy',    icon: '◑' },
  severe:   { rank: 3, label: 'Severe',   cssModifier: 'severe',   icon: '●' },
};

const CONFIDENCE_CONFIG = {
  high:   { label: 'High',   cssModifier: 'high'   },
  medium: { label: 'Medium', cssModifier: 'medium' },
  low:    { label: 'Low',    cssModifier: 'low'    },
};

const HOTSPOT_SEVERITY_CONFIG = {
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
};

const HORIZON_ORDER = [
  '5min','10min','15min','20min','30min','45min',
  '1h','1.5h','2h','3h','4h','6h','12h','24h',
];

function levelConfig(key) {
  return CROWD_LEVEL_CONFIG[String(key ?? 'light').toLowerCase()] ?? CROWD_LEVEL_CONFIG.light;
}

function levelRank(key) { return levelConfig(key).rank; }

function confidenceConfig(key) {
  return CONFIDENCE_CONFIG[String(key ?? 'medium').toLowerCase()] ?? CONFIDENCE_CONFIG.medium;
}

function hotspotConfig(key) {
  return HOTSPOT_SEVERITY_CONFIG[String(key ?? 'low').toLowerCase()] ?? HOTSPOT_SEVERITY_CONFIG.low;
}

function horizonRank(h) {
  const idx = HORIZON_ORDER.indexOf(String(h ?? '').toLowerCase().replace(/\s/g, ''));
  return idx === -1 ? 999 : idx;
}

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
// Formatters
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

function formatDate(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="crowd-detail-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ── DetailLayout header slot ──────────────────────────────────────────────
function EntityHeader({ forecast, isStale, syncing }) {
  const rawLevel = String(forecast?.predictedCrowdLevel ?? forecast?.crowdLevel ?? 'light').toLowerCase();
  const cfg      = levelConfig(rawLevel);
  const isSurge  = Boolean(forecast?.surgeFlag ?? forecast?.isSurge);

  return (
    <div className="crowd-detail-panel__entity-header" aria-label="Forecast entity header">
      {/* Level badge */}
      <span
        className={`crowd-detail-panel__entity-level crowd-detail-panel__entity-level--${cfg.cssModifier}`}
        aria-label={`Crowd level: ${cfg.label}`}
      >
        <span aria-hidden="true">{cfg.icon}</span> {cfg.label}
      </span>

      {/* Surge indicator */}
      {isSurge && (
        <span
          className="crowd-detail-panel__entity-surge"
          role="status"
          aria-label="Surge active"
        >
          Surge
        </span>
      )}

      {/* Horizon */}
      {forecast?.horizon && (
        <span className="crowd-detail-panel__entity-horizon" aria-label={`Horizon: ${forecast.horizon}`}>
          {forecast.horizon}
        </span>
      )}

      {/* Line context */}
      {(forecast?.lineName ?? forecast?.line) && (
        <span className="crowd-detail-panel__entity-line">
          {forecast.lineName ?? forecast.line}
        </span>
      )}

      {/* Live / stale pills inline */}
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
    </div>
  );
}

// ── DetailLayout summary slot — key metrics ───────────────────────────────
function KeyMetricsSummary({ forecast }) {
  const occPct     = deriveOccupancyPct(forecast);
  const rawLevel   = String(forecast?.predictedCrowdLevel ?? forecast?.crowdLevel ?? 'light').toLowerCase();
  const cfg        = levelConfig(rawLevel);
  const confBand   = String(forecast?.confidenceBand ?? '').toLowerCase();
  const confCfg    = confidenceConfig(confBand);
  const capacity   = forecast?.capacity != null ? Number(forecast.capacity) : null;
  const current    = forecast?.currentOccupancy != null ? Number(forecast.currentOccupancy) : null;

  const occMod =
    occPct == null  ? null     :
    occPct >= 100   ? 'surge'  :
    occPct >= 90    ? 'surge'  :
    occPct >= 75    ? 'heavy'  :
    occPct >= 50    ? 'moderate' : 'light';

  return (
    <div className="crowd-detail-panel__summary-grid" aria-label="Key forecast metrics">
      {/* Crowd level */}
      <div
        className={`crowd-detail-panel__summary-metric crowd-detail-panel__summary-metric--level crowd-detail-panel__summary-metric--${cfg.cssModifier}`}
        aria-label={`Crowd level: ${cfg.label}`}
      >
        <span className="crowd-detail-panel__summary-value">{cfg.label}</span>
        <span className="crowd-detail-panel__summary-label">Crowd Level</span>
      </div>

      {/* Occupancy */}
      {occPct != null && (
        <div
          className={`crowd-detail-panel__summary-metric ${occMod ? `crowd-detail-panel__summary-metric--${occMod}` : ''}`}
          aria-label={`Occupancy: ${occPct}%`}
        >
          <span className="crowd-detail-panel__summary-value">{occPct}%</span>
          <span className="crowd-detail-panel__summary-label">Occupancy</span>
          <div
            className="crowd-detail-panel__summary-bar"
            role="meter"
            aria-valuenow={Math.min(100, occPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-hidden="true"
          >
            <div className="crowd-detail-panel__summary-bar-fill" style={{ width: `${Math.min(100, occPct)}%` }} />
          </div>
        </div>
      )}

      {/* Capacity */}
      {capacity != null && (
        <div className="crowd-detail-panel__summary-metric" aria-label={`Capacity: ${capacity.toLocaleString()}`}>
          <span className="crowd-detail-panel__summary-value">{capacity.toLocaleString()}</span>
          <span className="crowd-detail-panel__summary-label">Capacity</span>
        </div>
      )}

      {/* Current load */}
      {current != null && (
        <div className="crowd-detail-panel__summary-metric" aria-label={`Current load: ${current.toLocaleString()}`}>
          <span className="crowd-detail-panel__summary-value">{current.toLocaleString()}</span>
          <span className="crowd-detail-panel__summary-label">Current Load</span>
        </div>
      )}

      {/* Confidence */}
      {confBand && (
        <div
          className={`crowd-detail-panel__summary-metric crowd-detail-panel__summary-metric--confidence crowd-detail-panel__summary-metric--conf-${confCfg.cssModifier}`}
          aria-label={`Confidence: ${confCfg.label}`}
        >
          <span className="crowd-detail-panel__summary-value">{confCfg.label}</span>
          <span className="crowd-detail-panel__summary-label">Confidence</span>
        </div>
      )}
    </div>
  );
}

// ── Body Section 1: Forecast Detail ──────────────────────────────────────
function ForecastDetailSection({ forecast, stationForecasts, thresholdLevel, compact }) {
  const rawLevel     = String(forecast?.predictedCrowdLevel ?? forecast?.crowdLevel ?? 'light').toLowerCase();
  const cfg          = levelConfig(rawLevel);
  const threshRank   = levelRank(thresholdLevel);
  const isBreached   = cfg.rank >= threshRank;
  const confScore    = typeof forecast?.confidenceScore === 'number' ? Math.round(forecast.confidenceScore * 100) : null;
  const confBand     = String(forecast?.confidenceBand ?? '').toLowerCase();
  const confCfg      = confidenceConfig(confBand);

  // Sort all station forecasts by horizon for the horizon timeline
  const sortedHorizons = useMemo(() => {
    return [...stationForecasts].sort((a, b) =>
      horizonRank(a.horizon ?? 'now') - horizonRank(b.horizon ?? 'now'),
    );
  }, [stationForecasts]);

  return (
    <section className="crowd-detail-panel__section" aria-label="Forecast Detail">
      <h3 className="crowd-detail-panel__section-title">Forecast Detail</h3>

      <dl className="crowd-detail-panel__field-list">
        <dt>Crowd Level</dt>
        <dd>
          <span className={`crowd-detail-panel__level-chip crowd-detail-panel__level-chip--${cfg.cssModifier}`}>
            {cfg.icon} {cfg.label}
          </span>
          {isBreached && (
            <span className="crowd-detail-panel__breach-flag" role="status">Breach</span>
          )}
        </dd>

        {forecast?.horizon && <><dt>Horizon</dt><dd>{forecast.horizon}</dd></>}
        {forecast?.generatedBy && <><dt>Generated By</dt><dd>{forecast.generatedBy}</dd></>}
        {forecast?.generatedAt && <><dt>Generated</dt><dd>{formatWhen(forecast.generatedAt)}</dd></>}

        {confBand && (
          <>
            <dt>Confidence Band</dt>
            <dd>
              <span className={`crowd-detail-panel__conf-chip crowd-detail-panel__conf-chip--${confCfg.cssModifier}`}>
                {confCfg.label}
              </span>
            </dd>
          </>
        )}

        {confScore != null && <><dt>Confidence Score</dt><dd>{confScore}%</dd></>}
        {forecast?.description && <><dt>Description</dt><dd>{forecast.description}</dd></>}
      </dl>

      {/* Horizon timeline for this station */}
      {!compact && sortedHorizons.length > 1 && (
        <div className="crowd-detail-panel__horizon-timeline" aria-label="Horizon timeline for this station">
          <div className="crowd-detail-panel__horizon-title">All Horizons</div>
          <div className="crowd-detail-panel__horizon-row" role="list">
            {sortedHorizons.map((f, idx) => {
              const lvl  = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
              const lcfg = levelConfig(lvl);
              const isAnchor = f.id === forecast?.id;
              return (
                <div
                  key={f.id ?? idx}
                  className={[
                    'crowd-detail-panel__horizon-cell',
                    `crowd-detail-panel__horizon-cell--${lcfg.cssModifier}`,
                    isAnchor ? 'crowd-detail-panel__horizon-cell--anchor' : null,
                  ].filter(Boolean).join(' ')}
                  role="listitem"
                  aria-label={`${f.horizon ?? '—'}: ${lcfg.label}${isAnchor ? ' (current)' : ''}`}
                  aria-current={isAnchor ? 'true' : undefined}
                >
                  <span className="crowd-detail-panel__horizon-cell-h">{f.horizon ?? '?'}</span>
                  <span className="crowd-detail-panel__horizon-cell-l">{lcfg.short ?? lcfg.label[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Body Section 2: Hotspot Zones ─────────────────────────────────────────
function HotspotZonesSection({ forecast, compact }) {
  const hotspots = useMemo(() => {
    const raw = Array.isArray(forecast?.hotspots) ? forecast.hotspots : [];
    return [...raw].sort((a, b) => {
      return (hotspotConfig(b.severity).rank) - (hotspotConfig(a.severity).rank);
    });
  }, [forecast?.hotspots]);

  return (
    <section className="crowd-detail-panel__section" aria-label="Hotspot Zones">
      <h3 className="crowd-detail-panel__section-title">
        Hotspot Zones
        {hotspots.length > 0 && (
          <span className="crowd-detail-panel__section-count">{hotspots.length}</span>
        )}
      </h3>

      {hotspots.length === 0 ? (
        <div className="crowd-detail-panel__no-data" role="status">No hotspot zones reported.</div>
      ) : (
        <ul className="crowd-detail-panel__hotspot-list" aria-label={`${hotspots.length} hotspot zone${hotspots.length !== 1 ? 's' : ''}`}>
          {hotspots.map((h, idx) => {
            const hcfg = hotspotConfig(h.severity);
            const zid  = h.zoneId ?? h.id ?? `zone-${idx}`;
            return (
              <li
                key={zid}
                className={`crowd-detail-panel__hotspot-row crowd-detail-panel__hotspot-row--${hcfg.cssModifier}`}
                aria-label={`${h.zoneName ?? zid}: ${hcfg.label} severity`}
              >
                <span className="crowd-detail-panel__hotspot-icon" aria-hidden="true">{hcfg.icon}</span>
                <span className="crowd-detail-panel__hotspot-name">{h.zoneName ?? h.name ?? zid}</span>
                {!compact && h.description && (
                  <span className="crowd-detail-panel__hotspot-desc">{h.description}</span>
                )}
                <span className={`crowd-detail-panel__hotspot-badge crowd-detail-panel__hotspot-badge--${hcfg.cssModifier}`}>
                  {hcfg.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Body Section 3: Mitigation Actions ────────────────────────────────────
function MitigationActionsSection({ forecast }) {
  const suggestions = Array.isArray(forecast?.mitigationSuggestions)
    ? forecast.mitigationSuggestions : [];

  return (
    <section className="crowd-detail-panel__section" aria-label="Mitigation Actions">
      <h3 className="crowd-detail-panel__section-title">Mitigation Actions</h3>
      {suggestions.length === 0 ? (
        <div className="crowd-detail-panel__no-data" role="note">No mitigation suggestions provided.</div>
      ) : (
        <ol className="crowd-detail-panel__mitigation-list" aria-label="Recommended mitigation actions">
          {suggestions.map((s, idx) => (
            <li key={idx} className="crowd-detail-panel__mitigation-item">
              <span className="crowd-detail-panel__mitigation-num" aria-hidden="true">{idx + 1}</span>
              <span className="crowd-detail-panel__mitigation-text">{s}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Body Section 4: Cross-Domain Links ────────────────────────────────────
function CrossDomainLinksSection({ forecast, compact }) {
  const affectedTrainIds = Array.isArray(forecast?.affectedTrainIds) ? forecast.affectedTrainIds : [];
  const incidentIds      = Array.isArray(forecast?.incidentIds) ? forecast.incidentIds : [];
  const linkedIncidents  = Array.isArray(forecast?.linkedIncidents) ? forecast.linkedIncidents : [];
  const allIncidentIds   = useMemo(() => {
    const seen = new Set();
    const out  = [];
    for (const li of linkedIncidents) { const id = li.id ?? li; if (!seen.has(id)) { seen.add(id); out.push(id); } }
    for (const id of incidentIds)     { if (!seen.has(id))     { seen.add(id); out.push(id); } }
    return out;
  }, [incidentIds, linkedIncidents]);

  const schedulingImpact = forecast?.schedulingImpact ?? null;
  const riskScore        = forecast?.riskScore ?? null;

  const hasAny = affectedTrainIds.length > 0 || allIncidentIds.length > 0 || schedulingImpact != null || riskScore != null;

  if (!hasAny) return null;

  return (
    <section className="crowd-detail-panel__section crowd-detail-panel__section--crossdomain" aria-label="Cross-Domain References">
      <h3 className="crowd-detail-panel__section-title">Cross-Domain References</h3>

      {/* Affected trains */}
      {affectedTrainIds.length > 0 && (
        <div className="crowd-detail-panel__crossdomain-group" aria-label={`${affectedTrainIds.length} affected trains`}>
          <div className="crowd-detail-panel__crossdomain-label">
            Affected Trains ({affectedTrainIds.length})
          </div>
          <div className="crowd-detail-panel__crossdomain-ids" role="list">
            {affectedTrainIds.slice(0, 6).map((tid) => (
              <span key={tid} className="crowd-detail-panel__crossdomain-id" role="listitem">{tid}</span>
            ))}
            {affectedTrainIds.length > 6 && (
              <span className="crowd-detail-panel__crossdomain-id crowd-detail-panel__crossdomain-id--overflow">
                +{affectedTrainIds.length - 6}
              </span>
            )}
          </div>
          <div className="crowd-detail-panel__crossdomain-note" role="note">Resolve via Train Operations module.</div>
        </div>
      )}

      {/* Linked incidents */}
      {allIncidentIds.length > 0 && (
        <div className="crowd-detail-panel__crossdomain-group" aria-label={`${allIncidentIds.length} linked incidents`}>
          <div className="crowd-detail-panel__crossdomain-label">
            Linked Incidents ({allIncidentIds.length})
          </div>
          <div className="crowd-detail-panel__crossdomain-ids" role="list">
            {allIncidentIds.slice(0, 6).map((id) => (
              <span key={id} className="crowd-detail-panel__crossdomain-id" role="listitem">{id}</span>
            ))}
            {allIncidentIds.length > 6 && (
              <span className="crowd-detail-panel__crossdomain-id crowd-detail-panel__crossdomain-id--overflow">
                +{allIncidentIds.length - 6}
              </span>
            )}
          </div>
          <div className="crowd-detail-panel__crossdomain-note" role="note">Resolve via Incident Response module.</div>
        </div>
      )}

      {/* Scheduling impact reference */}
      {!compact && schedulingImpact != null && (
        <div className="crowd-detail-panel__crossdomain-group">
          <div className="crowd-detail-panel__crossdomain-label">Scheduling Impact</div>
          <div className="crowd-detail-panel__crossdomain-value">
            {typeof schedulingImpact === 'object'
              ? (schedulingImpact.description ?? schedulingImpact.level ?? JSON.stringify(schedulingImpact))
              : schedulingImpact}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Rail slot — station metadata ──────────────────────────────────────────
function StationMetadataRail({ forecast }) {
  return (
    <div className="crowd-detail-panel__rail" aria-label="Station metadata">
      <div className="crowd-detail-panel__rail-title">Station Metadata</div>
      <dl className="crowd-detail-panel__rail-dl">
        {(forecast?.stationId ?? forecast?.id) && (
          <><dt>Station ID</dt><dd>{forecast.stationId ?? forecast.id}</dd></>
        )}
        {(forecast?.lineName ?? forecast?.line) && (
          <><dt>Line</dt><dd>{forecast.lineName ?? forecast.line}</dd></>
        )}
        {forecast?.capacity != null && (
          <><dt>Capacity</dt><dd>{Number(forecast.capacity).toLocaleString()}</dd></>
        )}
        {forecast?.generatedBy && (
          <><dt>Generated By</dt><dd>{forecast.generatedBy}</dd></>
        )}
        {forecast?.generatedAt && (
          <><dt>Generated At</dt><dd>{formatWhen(forecast.generatedAt)}</dd></>
        )}
        {forecast?.lastUpdatedAt && (
          <><dt>Last Updated</dt><dd>{formatWhen(forecast.lastUpdatedAt)}</dd></>
        )}
        {forecast?.id && (
          <><dt>Forecast ID</dt><dd className="crowd-detail-panel__rail-id">{forecast.id}</dd></>
        )}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdDetailPanel({
  forecastId       = null,
  forecast: fProp  = null,
  layout           = null,
  title            = null,
  staleThreshold   = 60000,
  thresholdLevel   = 'heavy',
  compact          = false,
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
  const forecast = useMemo(
    () => fProp ?? forecastFromStore ?? null,
    [fProp, forecastFromStore],
  );

  // ── All forecasts for same station ───────────────────────────────────────
  const stationForecasts = useMemo(() => {
    try {
      const all = getVisibleCrowdForecasts ? getVisibleCrowdForecasts() : [];
      if (!forecast) return [];
      const sk = forecast.stationId ?? forecast.stationName ?? forecast.station;
      if (!sk) return [forecast];
      return all.filter((f) => (f.stationId ?? f.stationName ?? f.station) === sk);
    } catch { return forecast ? [forecast] : []; }
  }, [getVisibleCrowdForecasts, forecast]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : forecast?.lastUpdatedAt ? Date.parse(forecast.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, forecast, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = !forecast && !loading;
  const stationName   = forecast?.stationName ?? forecast?.station ?? null;
  const resolvedTitle = title ?? (stationName ? stationName : 'Crowd Forecast Detail');

  // ── Layout slots ─────────────────────────────────────────────────────────
  const headerSlot = forecast ? (
    <EntityHeader forecast={forecast} isStale={isStale} syncing={syncing} />
  ) : null;

  const summarySlot = forecast ? (
    <KeyMetricsSummary forecast={forecast} />
  ) : null;

  const railSlot = forecast ? <StationMetadataRail forecast={forecast} /> : null;

  // ── Core body ────────────────────────────────────────────────────────────
  const body = (
    <div
      className={[
        'crowd-detail-panel',
        compact ? 'crowd-detail-panel--compact' : null,
        isStale ? 'crowd-detail-panel--stale'   : null,
        error   ? 'crowd-detail-panel--error'   : null,
        syncing ? 'crowd-detail-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && (
        <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
      )}

      {isEmpty ? (
        <div className="crowd-detail-panel__empty" role="status">No crowd forecast selected.</div>
      ) : (
        <>
          <ForecastDetailSection
            forecast={forecast}
            stationForecasts={stationForecasts}
            thresholdLevel={thresholdLevel}
            compact={compact}
          />
          <HotspotZonesSection forecast={forecast} compact={compact} />
          <MitigationActionsSection forecast={forecast} />
          <CrossDomainLinksSection forecast={forecast} compact={compact} />
        </>
      )}
    </div>
  );

  // ── Layout wrappers ───────────────────────────────────────────────────────
  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={headerSlot}
        summary={summarySlot}
        body={body}
        rail={railSlot}
        footer={null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(forecast)}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={headerSlot}
        left={body}
        right={railSlot}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

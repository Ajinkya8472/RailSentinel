import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdForecastPanel — canonical deep-review forecast surface for Module-3
 * Crowd Intelligence. Renders a comprehensive breakdown of a station's crowd
 * forecast profile across four coordinated sections:
 *
 *   1. Forecast Bands       — crowd level distribution across all available
 *                            forecast horizons for the anchor station, rendered
 *                            as a proportional level timeline. Populates from
 *                            `getVisibleCrowdForecasts()` filtered to the
 *                            station key of the anchor forecast.
 *
 *   2. Breach Predictions   — derived view of which horizons are at or above
 *                            the configurable `thresholdLevel`, annotated with
 *                            the earliest predicted breach horizon and whether
 *                            the station is currently breached.
 *
 *   3. Event Impact         — `mitigationSuggestions` from the CrowdForecast
 *                            domain model rendered as an actionable checklist,
 *                            plus occupancy ratio and capacity data where
 *                            available.
 *
 *   4. Confidence Profile   — `confidenceScore`, `confidenceBand`,
 *                            `generatedBy`, and `generatedAt` rendered as a
 *                            trust-level indicator with a visual score gauge.
 *
 * DetailLayout is the primary intended usage (deep-review). SplitPanelLayout
 * is the secondary usage (split-screen triage).
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
 *                      `getSelectedCrowdForecast()` (default: null)
 * - `forecast`         (object|null)  — direct CrowdForecast override
 *                      (default: null)
 * - `layout`           ('detail'|'split'|null) — optional layout wrapper;
 *                      `'detail'` is the primary usage (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before stale (default: 60000)
 * - `thresholdLevel`   ('moderate'|'heavy'|'severe') — breach threshold
 *                      (default: 'heavy')
 * - `compact`          (boolean)      — compact display mode (default: false)
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

const CROWD_LEVEL_CONFIG = {
  light:    { rank: 0, label: 'Light',    cssModifier: 'light',    short: 'L' },
  moderate: { rank: 1, label: 'Moderate', cssModifier: 'moderate', short: 'M' },
  heavy:    { rank: 2, label: 'Heavy',    cssModifier: 'heavy',    short: 'H' },
  severe:   { rank: 3, label: 'Severe',   cssModifier: 'severe',   short: 'S' },
};

const CONFIDENCE_CONFIG = {
  high:   { label: 'High',   cssModifier: 'high',   score: 3 },
  medium: { label: 'Medium', cssModifier: 'medium', score: 2 },
  low:    { label: 'Low',    cssModifier: 'low',     score: 1 },
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

function horizonRank(h) {
  const idx = HORIZON_ORDER.indexOf(String(h ?? '').toLowerCase().replace(/\s/g,''));
  return idx === -1 ? 999 : idx;
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
    <div className="crowd-forecast-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Forecast Bands
// ---------------------------------------------------------------------------

function ForecastBandsSection({ stationForecasts, compact }) {
  const sorted = useMemo(() =>
    [...stationForecasts].sort((a, b) =>
      horizonRank(a.horizon ?? 'now') - horizonRank(b.horizon ?? 'now'),
    ),
  [stationForecasts]);

  if (sorted.length === 0) {
    return (
      <section className="crowd-forecast-panel__section" aria-label="Forecast Bands">
        <h3 className="crowd-forecast-panel__section-title">Forecast Bands</h3>
        <div className="crowd-forecast-panel__empty" role="status">No horizon data available.</div>
      </section>
    );
  }

  return (
    <section className="crowd-forecast-panel__section" aria-label="Forecast Bands">
      <h3 className="crowd-forecast-panel__section-title">Forecast Bands</h3>

      {/* Horizon timeline strip */}
      <div
        className="crowd-forecast-panel__bands"
        role="list"
        aria-label="Crowd level by forecast horizon"
      >
        {sorted.map((f, idx) => {
          const rawLevel = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
          const cfg      = levelConfig(rawLevel);
          const occ      = deriveOccupancyPct(f);
          const horizon  = f.horizon ?? `t+${idx}`;
          return (
            <div
              key={f.id ?? `${rawLevel}-${idx}`}
              className={`crowd-forecast-panel__band crowd-forecast-panel__band--${cfg.cssModifier}`}
              role="listitem"
              aria-label={`${horizon}: ${cfg.label} crowd${occ != null ? `, ${occ}% occupancy` : ''}`}
            >
              <span className="crowd-forecast-panel__band-horizon">{horizon}</span>
              <div
                className={`crowd-forecast-panel__band-fill crowd-forecast-panel__band-fill--${cfg.cssModifier}`}
                style={{ height: `${(cfg.rank + 1) * 20}%` }}
                aria-hidden="true"
              />
              <span className="crowd-forecast-panel__band-level">{compact ? cfg.short : cfg.label}</span>
              {!compact && occ != null && (
                <span className="crowd-forecast-panel__band-occ">{occ}%</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Breach Predictions
// ---------------------------------------------------------------------------

function BreachPredictionsSection({ stationForecasts, thresholdLevel, compact }) {
  const thresholdRank = levelRank(thresholdLevel);
  const thresholdCfg  = levelConfig(thresholdLevel);

  const sorted = useMemo(() =>
    [...stationForecasts].sort((a, b) =>
      horizonRank(a.horizon ?? 'now') - horizonRank(b.horizon ?? 'now'),
    ),
  [stationForecasts]);

  const breachedHorizons = sorted.filter((f) => {
    const level = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
    return levelRank(level) >= thresholdRank;
  });

  const earliest = breachedHorizons[0] ?? null;
  const currentlyBreached = sorted[0] && levelRank(
    String(sorted[0].predictedCrowdLevel ?? sorted[0].crowdLevel ?? 'light').toLowerCase()
  ) >= thresholdRank;

  return (
    <section className="crowd-forecast-panel__section" aria-label="Breach Predictions">
      <h3 className="crowd-forecast-panel__section-title">
        Breach Predictions
        <span className={`crowd-forecast-panel__section-badge ${breachedHorizons.length > 0 ? 'crowd-forecast-panel__section-badge--breach' : 'crowd-forecast-panel__section-badge--clear'}`}>
          {breachedHorizons.length > 0 ? `${breachedHorizons.length} horizon${breachedHorizons.length !== 1 ? 's' : ''}` : 'Clear'}
        </span>
      </h3>

      {/* Current status */}
      <div
        className={`crowd-forecast-panel__breach-status ${currentlyBreached ? 'crowd-forecast-panel__breach-status--active' : 'crowd-forecast-panel__breach-status--clear'}`}
        role="status"
        aria-live="polite"
        aria-label={currentlyBreached ? 'Currently breached' : 'Currently within threshold'}
      >
        <span className="crowd-forecast-panel__breach-status-icon" aria-hidden="true">
          {currentlyBreached ? '✕' : '✓'}
        </span>
        <span className="crowd-forecast-panel__breach-status-text">
          {currentlyBreached ? 'Currently breached' : 'Currently within threshold'}
        </span>
        <span className="crowd-forecast-panel__breach-threshold">
          Threshold: {thresholdCfg.label}
        </span>
      </div>

      {/* Earliest breach */}
      {earliest && (
        <div className="crowd-forecast-panel__earliest-breach" aria-label={`Earliest breach at ${earliest.horizon ?? 'now'}`}>
          <span className="crowd-forecast-panel__earliest-label">Earliest breach</span>
          <span className="crowd-forecast-panel__earliest-horizon">{earliest.horizon ?? 'now'}</span>
          <span className={`crowd-forecast-panel__earliest-level crowd-forecast-panel__earliest-level--${levelConfig(String(earliest.predictedCrowdLevel ?? 'severe').toLowerCase()).cssModifier}`}>
            {levelConfig(String(earliest.predictedCrowdLevel ?? earliest.crowdLevel ?? 'severe').toLowerCase()).label}
          </span>
        </div>
      )}

      {/* Breached horizon list */}
      {!compact && breachedHorizons.length > 0 && (
        <ul className="crowd-forecast-panel__breach-list" aria-label="Breached horizons">
          {breachedHorizons.map((f, idx) => {
            const level = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'severe').toLowerCase();
            const cfg   = levelConfig(level);
            const occ   = deriveOccupancyPct(f);
            return (
              <li
                key={f.id ?? idx}
                className={`crowd-forecast-panel__breach-row crowd-forecast-panel__breach-row--${cfg.cssModifier}`}
                aria-label={`${f.horizon ?? '—'}: ${cfg.label}${occ != null ? `, ${occ}%` : ''}`}
              >
                <span className="crowd-forecast-panel__breach-row-horizon">{f.horizon ?? '—'}</span>
                <span className={`crowd-forecast-panel__breach-row-level crowd-forecast-panel__breach-row-level--${cfg.cssModifier}`}>{cfg.label}</span>
                {occ != null && <span className="crowd-forecast-panel__breach-row-occ">{occ}%</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Event Impact
// ---------------------------------------------------------------------------

function EventImpactSection({ forecast, compact }) {
  const suggestions = Array.isArray(forecast?.mitigationSuggestions)
    ? forecast.mitigationSuggestions
    : [];
  const occPct   = deriveOccupancyPct(forecast);
  const capacity = forecast?.capacity ?? null;
  const current  = forecast?.currentOccupancy ?? null;

  return (
    <section className="crowd-forecast-panel__section" aria-label="Event Impact">
      <h3 className="crowd-forecast-panel__section-title">Event Impact</h3>

      {/* Occupancy detail */}
      {(occPct != null || capacity != null) && (
        <dl className="crowd-forecast-panel__impact-metrics">
          {occPct != null && (
            <>
              <dt className="crowd-forecast-panel__impact-label">Occupancy</dt>
              <dd className={`crowd-forecast-panel__impact-value crowd-forecast-panel__impact-value--${
                occPct >= 90 ? 'surge' : occPct >= 75 ? 'heavy' : occPct >= 50 ? 'moderate' : 'light'
              }`}>
                {occPct}%
                {/* Visual bar */}
                <div
                  className="crowd-forecast-panel__impact-bar"
                  role="meter"
                  aria-valuenow={occPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${occPct}% occupancy`}
                >
                  <div className="crowd-forecast-panel__impact-bar-fill" style={{ width: `${occPct}%` }} aria-hidden="true" />
                </div>
              </dd>
            </>
          )}
          {!compact && capacity != null && (
            <>
              <dt className="crowd-forecast-panel__impact-label">Capacity</dt>
              <dd className="crowd-forecast-panel__impact-value">{Number(capacity).toLocaleString()}</dd>
            </>
          )}
          {!compact && current != null && (
            <>
              <dt className="crowd-forecast-panel__impact-label">Current Load</dt>
              <dd className="crowd-forecast-panel__impact-value">{Number(current).toLocaleString()}</dd>
            </>
          )}
        </dl>
      )}

      {/* Mitigation suggestions */}
      {suggestions.length > 0 ? (
        <div className="crowd-forecast-panel__mitigations" aria-label="Mitigation suggestions">
          <div className="crowd-forecast-panel__mitigations-title">Mitigation Suggestions</div>
          <ol className="crowd-forecast-panel__mitigation-list">
            {suggestions.map((s, idx) => (
              <li key={idx} className="crowd-forecast-panel__mitigation-item">
                <span className="crowd-forecast-panel__mitigation-num" aria-hidden="true">{idx + 1}</span>
                <span className="crowd-forecast-panel__mitigation-text">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="crowd-forecast-panel__no-mitigation" role="note">
          No mitigation suggestions for this forecast.
        </div>
      )}

      {/* Description / summary */}
      {!compact && (forecast?.description ?? forecast?.summary) && (
        <div className="crowd-forecast-panel__impact-desc">
          {forecast.description ?? forecast.summary}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Confidence Profile
// ---------------------------------------------------------------------------

function ConfidenceGauge({ score }) {
  // score 0–1; render as 5-dot gauge
  const filled = Math.round((score ?? 0) * 5);
  return (
    <div
      className="crowd-forecast-panel__confidence-gauge"
      role="meter"
      aria-valuenow={Math.round((score ?? 0) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence score: ${Math.round((score ?? 0) * 100)}%`}
    >
      {[1, 2, 3, 4, 5].map((dot) => (
        <span
          key={dot}
          className={`crowd-forecast-panel__confidence-dot ${dot <= filled ? 'crowd-forecast-panel__confidence-dot--filled' : 'crowd-forecast-panel__confidence-dot--empty'}`}
          aria-hidden="true"
        />
      ))}
      <span className="crowd-forecast-panel__confidence-pct">
        {Math.round((score ?? 0) * 100)}%
      </span>
    </div>
  );
}

function ConfidenceProfileSection({ forecast, compact }) {
  if (!forecast) return null;

  const band       = String(forecast.confidenceBand ?? '').toLowerCase();
  const bandCfg    = confidenceConfig(band);
  const score      = typeof forecast.confidenceScore === 'number' ? forecast.confidenceScore : null;
  const generatedBy = forecast.generatedBy ?? null;
  const generatedAt = formatWhen(forecast.generatedAt ?? null);
  const horizon     = forecast.horizon ?? null;

  return (
    <section className="crowd-forecast-panel__section" aria-label="Confidence Profile">
      <h3 className="crowd-forecast-panel__section-title">Confidence</h3>

      <div
        className={`crowd-forecast-panel__confidence-band crowd-forecast-panel__confidence-band--${bandCfg.cssModifier}`}
        aria-label={`Confidence band: ${bandCfg.label}`}
      >
        {bandCfg.label}
      </div>

      {score != null && <ConfidenceGauge score={score} />}

      {!compact && (
        <dl className="crowd-forecast-panel__confidence-meta">
          {generatedAt && (
            <>
              <dt className="crowd-forecast-panel__confidence-label">Generated</dt>
              <dd className="crowd-forecast-panel__confidence-value">{generatedAt}</dd>
            </>
          )}
          {generatedBy && (
            <>
              <dt className="crowd-forecast-panel__confidence-label">Source</dt>
              <dd className="crowd-forecast-panel__confidence-value">{generatedBy}</dd>
            </>
          )}
          {horizon && (
            <>
              <dt className="crowd-forecast-panel__confidence-label">Horizon</dt>
              <dd className="crowd-forecast-panel__confidence-value">{horizon}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdForecastPanel({
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

  // ── All visible forecasts for same station ────────────────────────────────
  const stationForecasts = useMemo(() => {
    try {
      const all = getVisibleCrowdForecasts ? getVisibleCrowdForecasts() : [];
      if (!forecast) return all;
      const stationKey = forecast.stationId ?? forecast.stationName ?? forecast.station;
      if (!stationKey) return [forecast];
      return all.filter((f) => {
        const fk = f.stationId ?? f.stationName ?? f.station;
        return fk === stationKey;
      });
    } catch { return forecast ? [forecast] : []; }
  }, [getVisibleCrowdForecasts, forecast]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt
      ? Date.parse(lastUpdatedAt)
      : forecast?.lastUpdatedAt ? Date.parse(forecast.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, forecast, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = !forecast && !loading;
  const stationName   = forecast?.stationName ?? forecast?.station ?? null;
  const resolvedTitle = title ?? (stationName ? `Forecast — ${stationName}` : 'Crowd Forecast');

  // ── Sections ─────────────────────────────────────────────────────────────
  const forecastBands = forecast ? (
    <ForecastBandsSection stationForecasts={stationForecasts} compact={compact} />
  ) : null;

  const breachSection = forecast ? (
    <BreachPredictionsSection stationForecasts={stationForecasts} thresholdLevel={thresholdLevel} compact={compact} />
  ) : null;

  const impactSection = forecast ? (
    <EventImpactSection forecast={forecast} compact={compact} />
  ) : null;

  const confidenceSection = forecast ? (
    <ConfidenceProfileSection forecast={forecast} compact={compact} />
  ) : null;

  // ── DetailLayout summary slot ─────────────────────────────────────────────
  const detailSummary = forecast ? (
    <div className="crowd-forecast-panel__summary">
      {stationName && <div className="crowd-forecast-panel__summary-station">{stationName}</div>}
      <div className={`crowd-forecast-panel__summary-level crowd-forecast-panel__summary-level--${levelConfig(String(forecast.predictedCrowdLevel ?? forecast.crowdLevel ?? 'light').toLowerCase()).cssModifier}`}>
        {levelConfig(String(forecast.predictedCrowdLevel ?? forecast.crowdLevel ?? 'light').toLowerCase()).label}
      </div>
      {forecast.horizon && (
        <div className="crowd-forecast-panel__summary-horizon">{forecast.horizon}</div>
      )}
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
    </div>
  ) : null;

  // ── Primary body (four sections) ──────────────────────────────────────────
  const body = (
    <div
      className={[
        'crowd-forecast-panel',
        compact ? 'crowd-forecast-panel--compact' : null,
        isStale ? 'crowd-forecast-panel--stale'   : null,
        error   ? 'crowd-forecast-panel--error'   : null,
        syncing ? 'crowd-forecast-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && (
        <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
      )}

      {isEmpty ? (
        <div className="crowd-forecast-panel__empty" role="status">No crowd forecast selected.</div>
      ) : (
        <>
          {forecastBands}
          {breachSection}
          {impactSection}
          {confidenceSection}
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
        rail={confidenceSection}
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
        header={null}
        left={body}
        right={confidenceSection}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdImpactPanel — canonical cross-domain impact surface for Module-3 Crowd
 * Intelligence. Renders the operational consequences of crowd conditions on
 * four adjacent rail operational domains — reading exclusively from fields that
 * the CrowdForecast domain model carries as approved cross-domain references.
 *
 * The store normalises incoming API payloads with `{...crowdForecast}` spread,
 * preserving all cross-domain reference fields without this component
 * importing any other domain store. Impact sections are therefore derived
 * purely from `useCrowdStore` selectors.
 *
 * Four impact sections:
 *
 *   1. Train Impact         — derived from `affectedTrainIds[]`, `dwellTimeImpact`,
 *                            `platformDelays[]`, `crowdPressureOnDepartures`;
 *                            supplemented by a pressure grade inferred from
 *                            `predictedCrowdLevel` + occupancy when explicit
 *                            fields are absent.
 *
 *   2. Scheduling Impact    — derived from `schedulingImpact`, `peakConflict`,
 *                            `serviceReductionRisk`, `frequencyRecommendation`;
 *                            supplemented by a scheduling risk grade inferred
 *                            from crowd level and confidence band.
 *
 *   3. Incident Linkage     — derived from `incidentIds[]`, `linkedIncidents[]`,
 *                            `incidentRisk`; renders a reference-only list of
 *                            linked incident IDs — no incidentStore imported.
 *
 *   4. Risk Prioritization  — derived from `riskScore`, `riskLevel`,
 *                            `riskPriority`, `operationalRisk`; supplemented
 *                            by a composite risk score inferred from crowd
 *                            level + occupancy + hotspot count + surge flag
 *                            when explicit fields are absent.
 *
 * Operates in two modes:
 *   - Single-station (forecastId / forecast prop): shows impact for anchor
 *     station's CrowdForecast.
 *   - Network (neither prop supplied): aggregates impact signals across all
 *     visible forecasts, showing the highest-pressure entries.
 *
 * DetailLayout is the primary intended usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `src/layouts/DetailLayout.jsx`
 *
 * Props:
 * - `forecastId`         (string|null)  — store key; falls back to
 *                        `getSelectedCrowdForecast()`. Absent → network mode
 *                        (default: null)
 * - `forecast`           (object|null)  — direct CrowdForecast override
 *                        (default: null)
 * - `layout`             ('detail'|'split'|null) — optional layout wrapper;
 *                        `'detail'` is the primary usage (default: null)
 * - `title`              (string|null)  — layout title override (default: null)
 * - `staleThreshold`     (number)       — ms before stale (default: 60000)
 * - `maxAffectedTrains`  (number)       — max train IDs to display (default: 8)
 * - `maxIncidents`       (number)       — max incident IDs to display
 *                        (default: 8)
 * - `compact`            (boolean)      — compact display mode (default: false)
 * - `onRetry`            (fn|null)      — error retry for DetailLayout
 *                        (default: null)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getCrowdForecastById`, `getSelectedCrowdForecast`, `getVisibleCrowdForecasts`
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CROWD_LEVEL_RANK = { light: 0, moderate: 1, heavy: 2, severe: 3 };

function levelRank(key) {
  return CROWD_LEVEL_RANK[String(key ?? 'light').toLowerCase()] ?? 0;
}

const TRAIN_IMPACT_GRADE = {
  light:    { label: 'Minimal',      grade: 0, cssModifier: 'minimal',  description: 'Normal dwell times. No service adjustment expected.' },
  moderate: { label: 'Low',          grade: 1, cssModifier: 'low',      description: 'Minor boarding delays possible. Monitor dwell times.' },
  heavy:    { label: 'Significant',  grade: 2, cssModifier: 'high',     description: 'Extended dwell times likely. Crowd-controlled boarding required.' },
  severe:   { label: 'Critical',     grade: 3, cssModifier: 'critical', description: 'Major service disruption risk. Immediate capacity intervention required.' },
};

const SCHEDULE_RISK_GRADE = {
  light:    { label: 'Low Risk',     cssModifier: 'low',      description: 'Scheduling running to plan.' },
  moderate: { label: 'Watch',        cssModifier: 'watch',    description: 'Monitor peak-period headways.' },
  heavy:    { label: 'High Risk',    cssModifier: 'high',     description: 'Frequency review and supplementary services recommended.' },
  severe:   { label: 'Critical',     cssModifier: 'critical', description: 'Emergency scheduling intervention required. Deploy relief services.' },
};

const SURGE_OCC_THRESHOLD = 90;

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
// Risk score computation (composite inference from domain fields)
// ---------------------------------------------------------------------------

function computeRiskScore(f) {
  if (!f) return 0;

  // Prefer explicit riskScore (0–1 or 0–100)
  if (typeof f.riskScore === 'number') {
    return f.riskScore <= 1 ? Math.round(f.riskScore * 100) : Math.min(100, Math.round(f.riskScore));
  }

  // Infer from level rank, occupancy, hotspots, and surge
  const lvlRank  = levelRank(f.predictedCrowdLevel ?? f.crowdLevel);
  const occPct   = deriveOccupancyPct(f);
  const hotspots = Array.isArray(f.hotspots) ? f.hotspots.length : 0;
  const isSurge  = Boolean(f.surgeFlag ?? f.isSurge) || (occPct != null && occPct >= SURGE_OCC_THRESHOLD);

  let score = (lvlRank / 3) * 60;                           // level contributes 60%
  if (occPct != null) score += Math.min(25, occPct / 4);    // occupancy contributes up to 25%
  if (hotspots > 0)   score += Math.min(10, hotspots * 2);  // hotspots contribute up to 10%
  if (isSurge)        score += 5;                            // surge adds 5%
  return Math.min(100, Math.round(score));
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
    <div className="crowd-impact-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function ImpactGradeBadge({ label, cssModifier }) {
  return (
    <span
      className={`crowd-impact-panel__grade crowd-impact-panel__grade--${cssModifier}`}
      aria-label={`Impact grade: ${label}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Train Impact
// ---------------------------------------------------------------------------

function TrainImpactSection({ forecast, maxAffectedTrains, compact }) {
  const rawLevel    = String(forecast?.predictedCrowdLevel ?? forecast?.crowdLevel ?? 'light').toLowerCase();
  const gradeCfg    = TRAIN_IMPACT_GRADE[rawLevel] ?? TRAIN_IMPACT_GRADE.light;
  const occPct      = deriveOccupancyPct(forecast);
  const isSurge     = Boolean(forecast?.surgeFlag ?? forecast?.isSurge) || (occPct != null && occPct >= SURGE_OCC_THRESHOLD);

  // Cross-domain reference fields (pass-through from API via normalizeCrowdForecast spread)
  const affectedTrainIds    = Array.isArray(forecast?.affectedTrainIds) ? forecast.affectedTrainIds : [];
  const platformDelays      = Array.isArray(forecast?.platformDelays)   ? forecast.platformDelays   : [];
  const dwellTimeImpact     = forecast?.dwellTimeImpact ?? null;
  const crowdPressureOnDeps = forecast?.crowdPressureOnDepartures ?? null;

  const visibleTrains = affectedTrainIds.slice(0, maxAffectedTrains);
  const trainOverflow = affectedTrainIds.length - visibleTrains.length;

  return (
    <section className="crowd-impact-panel__section" aria-label="Train Impact">
      <h3 className="crowd-impact-panel__section-title">
        Train Impact
        <ImpactGradeBadge label={gradeCfg.label} cssModifier={gradeCfg.cssModifier} />
      </h3>

      {/* Grade description */}
      <p className="crowd-impact-panel__grade-desc">{gradeCfg.description}</p>

      {/* Surge flag */}
      {isSurge && (
        <div
          className="crowd-impact-panel__surge-flag"
          role="alert"
          aria-label="Surge active — immediate train capacity action required"
        >
          <span aria-hidden="true">●</span> Surge Active — Immediate Capacity Action Required
        </div>
      )}

      {/* Crowd pressure on departures */}
      {crowdPressureOnDeps != null && (
        <div className="crowd-impact-panel__field" aria-label={`Departure pressure: ${crowdPressureOnDeps}`}>
          <span className="crowd-impact-panel__field-label">Departure Pressure</span>
          <span className="crowd-impact-panel__field-value">{crowdPressureOnDeps}</span>
        </div>
      )}

      {/* Dwell time impact */}
      {dwellTimeImpact != null && (
        <div className="crowd-impact-panel__field" aria-label={`Dwell time impact: ${dwellTimeImpact}`}>
          <span className="crowd-impact-panel__field-label">Dwell Time Impact</span>
          <span className="crowd-impact-panel__field-value">{dwellTimeImpact}</span>
        </div>
      )}

      {/* Platform delays (reference data from forecast model) */}
      {!compact && platformDelays.length > 0 && (
        <div className="crowd-impact-panel__platform-delays" aria-label="Platform delays">
          <div className="crowd-impact-panel__sub-title">Platform Delays</div>
          <ul className="crowd-impact-panel__delay-list">
            {platformDelays.map((pd, idx) => (
              <li key={pd.platformId ?? idx} className="crowd-impact-panel__delay-row">
                <span className="crowd-impact-panel__delay-platform">
                  {pd.platformId ?? pd.platform ?? `Platform ${idx + 1}`}
                </span>
                {pd.delayMinutes != null && (
                  <span className="crowd-impact-panel__delay-value">
                    +{pd.delayMinutes} min
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Affected train IDs — approved cross-domain references, no store lookup */}
      {visibleTrains.length > 0 && (
        <div className="crowd-impact-panel__affected-trains" aria-label={`${affectedTrainIds.length} affected trains`}>
          <div className="crowd-impact-panel__sub-title">
            Affected Trains ({affectedTrainIds.length})
          </div>
          <div className="crowd-impact-panel__train-ids" role="list">
            {visibleTrains.map((tid) => (
              <span
                key={tid}
                className="crowd-impact-panel__train-id"
                role="listitem"
                aria-label={`Train ${tid}`}
              >
                {tid}
              </span>
            ))}
            {trainOverflow > 0 && (
              <span className="crowd-impact-panel__train-id crowd-impact-panel__train-id--overflow">
                +{trainOverflow} more
              </span>
            )}
          </div>
          <div className="crowd-impact-panel__ref-note" role="note">
            Train IDs from crowd forecast cross-domain reference. Resolve via Train Operations module.
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Scheduling Impact
// ---------------------------------------------------------------------------

function SchedulingImpactSection({ forecast, compact }) {
  const rawLevel   = String(forecast?.predictedCrowdLevel ?? forecast?.crowdLevel ?? 'light').toLowerCase();
  const gradeCfg   = SCHEDULE_RISK_GRADE[rawLevel] ?? SCHEDULE_RISK_GRADE.light;
  const confBand   = String(forecast?.confidenceBand ?? 'medium').toLowerCase();

  // Cross-domain reference fields
  const schedulingImpact       = forecast?.schedulingImpact ?? null;
  const peakConflict           = forecast?.peakConflict ?? null;
  const serviceReductionRisk   = forecast?.serviceReductionRisk ?? null;
  const frequencyRecommendation = forecast?.frequencyRecommendation ?? null;

  // Derived scheduling risk escalation from low confidence + high level
  const lowConfidence = confBand === 'low' && levelRank(rawLevel) >= 2;

  return (
    <section className="crowd-impact-panel__section" aria-label="Scheduling Impact">
      <h3 className="crowd-impact-panel__section-title">
        Scheduling Impact
        <ImpactGradeBadge label={gradeCfg.label} cssModifier={gradeCfg.cssModifier} />
      </h3>

      <p className="crowd-impact-panel__grade-desc">{gradeCfg.description}</p>

      {/* Low confidence warning on high-level forecast */}
      {lowConfidence && (
        <div className="crowd-impact-panel__confidence-warn" role="note">
          Low confidence on {rawLevel} forecast — scheduling decisions should include contingency margin.
        </div>
      )}

      {/* Explicit scheduling impact descriptor */}
      {schedulingImpact != null && (
        <div className="crowd-impact-panel__field" aria-label={`Scheduling impact: ${typeof schedulingImpact === 'object' ? JSON.stringify(schedulingImpact) : schedulingImpact}`}>
          <span className="crowd-impact-panel__field-label">Scheduling Impact</span>
          <span className="crowd-impact-panel__field-value">
            {typeof schedulingImpact === 'object'
              ? (schedulingImpact.description ?? schedulingImpact.level ?? JSON.stringify(schedulingImpact))
              : schedulingImpact}
          </span>
        </div>
      )}

      {/* Peak conflict flag */}
      {peakConflict != null && (
        <div
          className={`crowd-impact-panel__peak-conflict ${peakConflict ? 'crowd-impact-panel__peak-conflict--active' : 'crowd-impact-panel__peak-conflict--clear'}`}
          role="status"
          aria-label={peakConflict ? 'Peak conflict active' : 'No peak conflict'}
        >
          <span aria-hidden="true">{peakConflict ? '⚡' : '✓'}</span>
          {peakConflict ? 'Peak service conflict active' : 'No peak conflict detected'}
        </div>
      )}

      {/* Service reduction risk */}
      {!compact && serviceReductionRisk != null && (
        <div className="crowd-impact-panel__field">
          <span className="crowd-impact-panel__field-label">Service Reduction Risk</span>
          <span className="crowd-impact-panel__field-value">{serviceReductionRisk}</span>
        </div>
      )}

      {/* Frequency recommendation */}
      {!compact && frequencyRecommendation != null && (
        <div className="crowd-impact-panel__field">
          <span className="crowd-impact-panel__field-label">Frequency Recommendation</span>
          <span className="crowd-impact-panel__field-value">{frequencyRecommendation}</span>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Incident Linkage
// ---------------------------------------------------------------------------

function IncidentLinkageSection({ forecast, maxIncidents, compact }) {
  // Cross-domain reference fields — IDs only, no incidentStore import
  const incidentIds     = Array.isArray(forecast?.incidentIds)       ? forecast.incidentIds       : [];
  const linkedIncidents = Array.isArray(forecast?.linkedIncidents)   ? forecast.linkedIncidents   : [];
  const incidentRisk    = forecast?.incidentRisk ?? null;

  // Merge and deduplicate: prefer linkedIncidents (richer), supplement with incidentIds
  const mergedIncidents = useMemo(() => {
    const out = [];
    const seen = new Set();

    for (const li of linkedIncidents) {
      const id = li.id ?? li.incidentId ?? li;
      if (!seen.has(id)) { seen.add(id); out.push({ id, ...( typeof li === 'object' ? li : {}) }); }
    }
    for (const id of incidentIds) {
      if (!seen.has(id)) { seen.add(id); out.push({ id }); }
    }
    return out;
  }, [incidentIds, linkedIncidents]);

  const visible  = mergedIncidents.slice(0, maxIncidents);
  const overflow = mergedIncidents.length - visible.length;

  return (
    <section className="crowd-impact-panel__section" aria-label="Incident Linkage">
      <h3 className="crowd-impact-panel__section-title">
        Incident Linkage
        {mergedIncidents.length > 0 && (
          <span className="crowd-impact-panel__section-count">{mergedIncidents.length}</span>
        )}
      </h3>

      {incidentRisk != null && (
        <div className="crowd-impact-panel__field" aria-label={`Incident risk: ${incidentRisk}`}>
          <span className="crowd-impact-panel__field-label">Incident Risk</span>
          <span className="crowd-impact-panel__field-value">{incidentRisk}</span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="crowd-impact-panel__no-data" role="note">
          No linked incidents for this forecast.
        </div>
      ) : (
        <>
          <ul
            className="crowd-impact-panel__incident-list"
            aria-label={`${mergedIncidents.length} linked incident reference${mergedIncidents.length !== 1 ? 's' : ''}`}
          >
            {visible.map((inc, idx) => (
              <li key={inc.id ?? idx} className="crowd-impact-panel__incident-row">
                <span className="crowd-impact-panel__incident-icon" aria-hidden="true">⚠</span>
                <span className="crowd-impact-panel__incident-id">{inc.id}</span>
                {!compact && inc.description && (
                  <span className="crowd-impact-panel__incident-desc">{inc.description}</span>
                )}
                {!compact && inc.severity && (
                  <span className={`crowd-impact-panel__incident-severity crowd-impact-panel__incident-severity--${String(inc.severity).toLowerCase()}`}>
                    {inc.severity}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {overflow > 0 && (
            <div className="crowd-impact-panel__overflow" role="note">+{overflow} more incidents</div>
          )}
          <div className="crowd-impact-panel__ref-note" role="note">
            Incident references from crowd forecast linkage. Resolve via Incident Response module.
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Risk Prioritization
// ---------------------------------------------------------------------------

function RiskMeter({ score }) {
  const mod =
    score >= 75 ? 'critical' :
    score >= 50 ? 'high'     :
    score >= 25 ? 'medium'   : 'low';

  return (
    <div
      className={`crowd-impact-panel__risk-meter crowd-impact-panel__risk-meter--${mod}`}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Risk score: ${score}%`}
    >
      <div
        className="crowd-impact-panel__risk-fill"
        style={{ width: `${score}%` }}
        aria-hidden="true"
      />
      <span className="crowd-impact-panel__risk-score">{score}</span>
    </div>
  );
}

function RiskPrioritizationSection({ forecast, compact }) {
  const riskScore    = computeRiskScore(forecast);
  const riskLevel    = forecast?.riskLevel ?? null;
  const riskPriority = forecast?.riskPriority ?? null;
  const opRisk       = forecast?.operationalRisk ?? forecast?.operationalImpact ?? null;

  const riskLabel =
    riskScore >= 75 ? 'Critical' :
    riskScore >= 50 ? 'High'     :
    riskScore >= 25 ? 'Medium'   : 'Low';

  const riskMod = riskLabel.toLowerCase();

  return (
    <section className="crowd-impact-panel__section" aria-label="Risk Prioritization">
      <h3 className="crowd-impact-panel__section-title">Risk Prioritization</h3>

      {/* Composite risk score */}
      <div className="crowd-impact-panel__risk-header" aria-label={`Risk level: ${riskLevel ?? riskLabel}`}>
        <span className={`crowd-impact-panel__risk-level crowd-impact-panel__risk-level--${riskMod}`}>
          {riskLevel ?? riskLabel}
        </span>
        {riskPriority != null && (
          <span className="crowd-impact-panel__risk-priority">Priority #{riskPriority}</span>
        )}
      </div>

      <RiskMeter score={riskScore} />

      {/* Operational risk descriptor */}
      {opRisk != null && (
        <div className="crowd-impact-panel__field" aria-label={`Operational risk: ${opRisk}`}>
          <span className="crowd-impact-panel__field-label">Operational Risk</span>
          <span className="crowd-impact-panel__field-value">{opRisk}</span>
        </div>
      )}

      {/* Score breakdown note (non-compact) */}
      {!compact && (
        <div className="crowd-impact-panel__risk-breakdown" role="note">
          Score reflects crowd level severity, occupancy ratio, active hotspot zones, and surge status.
          {typeof forecast?.riskScore === 'number' ? ' Using explicit risk score from forecast.' : ' Score is inferred from crowd domain fields.'}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rail slot: impact summary
// ---------------------------------------------------------------------------

function ImpactRailSummary({ forecast }) {
  const riskScore  = computeRiskScore(forecast);
  const rawLevel   = String(forecast?.predictedCrowdLevel ?? forecast?.crowdLevel ?? 'light').toLowerCase();
  const gradeCfg   = TRAIN_IMPACT_GRADE[rawLevel] ?? TRAIN_IMPACT_GRADE.light;
  const schedCfg   = SCHEDULE_RISK_GRADE[rawLevel] ?? SCHEDULE_RISK_GRADE.light;
  const incCount   = (forecast?.incidentIds?.length ?? 0) + (forecast?.linkedIncidents?.length ?? 0);
  const trainCount = forecast?.affectedTrainIds?.length ?? 0;

  return (
    <div className="crowd-impact-panel__rail" aria-label="Impact summary">
      <div className="crowd-impact-panel__rail-title">Impact Summary</div>
      <dl className="crowd-impact-panel__rail-dl">
        <dt>Train Impact</dt>
        <dd className={`crowd-impact-panel__rail-val--${gradeCfg.cssModifier}`}>{gradeCfg.label}</dd>
        <dt>Schedule Risk</dt>
        <dd className={`crowd-impact-panel__rail-val--${schedCfg.cssModifier}`}>{schedCfg.label}</dd>
        <dt>Risk Score</dt>
        <dd>{riskScore}/100</dd>
        <dt>Affected Trains</dt>
        <dd>{trainCount > 0 ? trainCount : '—'}</dd>
        <dt>Linked Incidents</dt>
        <dd>{incCount > 0 ? incCount : '—'}</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdImpactPanel({
  forecastId        = null,
  forecast: fProp   = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  maxAffectedTrains = 8,
  maxIncidents      = 8,
  compact           = false,
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

  // ── Resolved forecast ────────────────────────────────────────────────────
  const forecast = useMemo(
    () => fProp ?? forecastFromStore ?? null,
    [fProp, forecastFromStore],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : forecast?.lastUpdatedAt ? Date.parse(forecast.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, forecast, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = !forecast && !loading;
  const stationName   = forecast?.stationName ?? forecast?.station ?? null;
  const resolvedTitle = title ?? (stationName
    ? `Impact Analysis — ${stationName}` : 'Crowd Impact Analysis');

  // ── Detail summary ────────────────────────────────────────────────────────
  const detailSummary = forecast ? (
    <div className="crowd-impact-panel__summary">
      {stationName && <div className="crowd-impact-panel__summary-station">{stationName}</div>}
      <div className="crowd-impact-panel__summary-score">
        Risk Score: <strong>{computeRiskScore(forecast)}</strong>/100
      </div>
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
    </div>
  ) : null;

  // ── Core body ────────────────────────────────────────────────────────────
  const body = (
    <div
      className={[
        'crowd-impact-panel',
        compact ? 'crowd-impact-panel--compact' : null,
        isStale ? 'crowd-impact-panel--stale'   : null,
        error   ? 'crowd-impact-panel--error'   : null,
        syncing ? 'crowd-impact-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="crowd-impact-panel__empty" role="status">No crowd forecast selected.</div>
      ) : (
        <>
          <TrainImpactSection forecast={forecast} maxAffectedTrains={maxAffectedTrains} compact={compact} />
          <SchedulingImpactSection forecast={forecast} compact={compact} />
          <IncidentLinkageSection forecast={forecast} maxIncidents={maxIncidents} compact={compact} />
          <RiskPrioritizationSection forecast={forecast} compact={compact} />
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
        rail={forecast ? <ImpactRailSummary forecast={forecast} /> : null}
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
        right={forecast ? <ImpactRailSummary forecast={forecast} /> : null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

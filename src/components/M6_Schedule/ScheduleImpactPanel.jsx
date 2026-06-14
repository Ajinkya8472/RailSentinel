import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useTrainStore from '../../store/trainStore';
import useIncidentStore from '../../store/incidentStore';
import useCrowdStore from '../../store/crowdStore';
import useRiskStore from '../../store/riskStore';

/**
 * Purpose:
 * ScheduleImpactPanel — cross-domain impact analysis surface for Module-6
 * Smart Scheduling. Synthesises impact data from multiple domain models
 * referenced by the ScheduleConflict entity:
 *
 *   Domain cross-references (all read-only):
 *   - trainStore:    resolve `conflictingTrainIds[]` → train names/routes/status
 *   - incidentStore: resolve `linkedIncidentIds[]`   → incident severity/status
 *   - crowdStore:    resolve `crowdForecastIds[]`     → crowd density/threshold
 *   - riskStore:     resolve `riskContext`            → risk band/score
 *
 * Sections:
 *   1. Overall Impact Score  — impactScore bar, severity band
 *   2. Train Impact          — per-train delay/status impact
 *   3. Crowd Impact          — crowd pressure from crowdForecastIds[]
 *   4. Incident Risk         — linked incidents and their severity
 *   5. Risk Profile          — riskContext / riskScore cross-domain summary
 *
 * DetailLayout is primary. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/trainStore`    (read-only)
 * - `src/store/incidentStore` (read-only)
 * - `src/store/crowdStore`    (read-only)
 * - `src/store/riskStore`     (read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `conflict`    (object|null)  — ScheduleConflict entity (default: null)
 * - `layout`      ('detail'|'split'|null) (default: null)
 * - `title`       (string|null)  (default: null)
 * - `loading`     (boolean)      (default: false)
 * - `syncing`     (boolean)      (default: false)
 * - `isStale`     (boolean)      (default: false)
 * - `error`       (any)          (default: null)
 * - `compact`     (boolean)      (default: false)
 * - `onRetry`     (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      cssModifier: 'low',      band: [0,  30]  },
  medium:   { label: 'Medium',   cssModifier: 'medium',   band: [30, 60]  },
  high:     { label: 'High',     cssModifier: 'high',     band: [60, 85]  },
  critical: { label: 'Critical', cssModifier: 'critical', band: [85, 100] },
};

function deriveScoreBand(score) {
  if (score == null) return null;
  if (score >= 85) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="schedule-impact-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function ImpactScoreSection({ conflict, compact }) {
  const score   = conflict?.impactScore ?? null;
  const band    = score != null ? deriveScoreBand(score) : (String(conflict?.severity ?? 'low').toLowerCase());
  const sevCfg  = SEVERITY_CONFIG[band] ?? SEVERITY_CONFIG.low;

  return (
    <section className="schedule-impact-panel__section" aria-label="Overall Impact Score">
      <h3 className="schedule-impact-panel__section-title">Overall Impact</h3>
      <div className={`schedule-impact-panel__impact schedule-impact-panel__impact--${sevCfg.cssModifier}`}>
        {score != null ? (
          <>
            <div className="schedule-impact-panel__score-bar"
              role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
              aria-label={`Impact score: ${score}/100`}>
              <div className={`schedule-impact-panel__score-fill schedule-impact-panel__score-fill--${sevCfg.cssModifier}`}
                style={{ width: `${Math.min(100, score)}%` }} aria-hidden="true" />
            </div>
            <div className="schedule-impact-panel__score-label">
              <span className="schedule-impact-panel__score-value">{score}/100</span>
              <span className="schedule-impact-panel__score-band">{sevCfg.label}</span>
            </div>
          </>
        ) : (
          <div className="schedule-impact-panel__score-band">{sevCfg.label} severity</div>
        )}
      </div>
    </section>
  );
}

function TrainImpactSection({ conflict, getTrainById, compact }) {
  const trainIds = Array.isArray(conflict?.conflictingTrainIds) ? conflict.conflictingTrainIds : [];
  if (trainIds.length === 0) return null;

  return (
    <section className="schedule-impact-panel__section" aria-label="Train Impact">
      <h3 className="schedule-impact-panel__section-title">Trains Affected ({trainIds.length})</h3>
      <ul className="schedule-impact-panel__train-list">
        {trainIds.slice(0, 8).map((id) => {
          const train = typeof getTrainById === 'function' ? getTrainById(id) : null;
          const name  = train?.name ?? train?.number ?? id;
          const route = train?.routeName ?? train?.route ?? null;
          const status = train?.status ?? null;
          return (
            <li key={id}
              className={`schedule-impact-panel__train-row ${status ? `schedule-impact-panel__train-row--${String(status).toLowerCase()}` : ''}`}
              aria-label={`Train ${name}${route ? ` — ${route}` : ''}: ${status ?? 'unknown status'}`}>
              <span className="schedule-impact-panel__train-name">🚆 {name}</span>
              {route  && <span className="schedule-impact-panel__train-route">{route}</span>}
              {status && <span className={`schedule-impact-panel__train-status schedule-impact-panel__train-status--${String(status).toLowerCase()}`}>{status}</span>}
            </li>
          );
        })}
        {trainIds.length > 8 && <li className="schedule-impact-panel__train-overflow">+{trainIds.length - 8} more</li>}
      </ul>
    </section>
  );
}

function CrowdImpactSection({ conflict, getCrowdById, compact }) {
  const crowdIds = Array.isArray(conflict?.crowdForecastIds) ? conflict.crowdForecastIds : [];
  if (crowdIds.length === 0) return null;

  return (
    <section className="schedule-impact-panel__section" aria-label="Crowd Pressure Impact">
      <h3 className="schedule-impact-panel__section-title">Crowd Impact ({crowdIds.length})</h3>
      <ul className="schedule-impact-panel__crowd-list">
        {crowdIds.slice(0, 6).map((id) => {
          const forecast = typeof getCrowdById === 'function' ? getCrowdById(id) : null;
          const loc  = forecast?.location ?? forecast?.stationId ?? id;
          const dens = forecast?.density  ?? forecast?.crowdLevel ?? null;
          const thrs = forecast?.thresholdStatus ?? null;
          return (
            <li key={id} className="schedule-impact-panel__crowd-row"
              aria-label={`Crowd at ${loc}${dens != null ? `: density ${dens}` : ''}`}>
              <span className="schedule-impact-panel__crowd-location">👥 {loc}</span>
              {dens != null && <span className="schedule-impact-panel__crowd-density">Density: {dens}</span>}
              {thrs && <span className={`schedule-impact-panel__crowd-threshold schedule-impact-panel__crowd-threshold--${String(thrs).toLowerCase()}`}>{thrs}</span>}
            </li>
          );
        })}
      </ul>
      <div className="schedule-impact-panel__context-note" role="note">Resolve details via Crowd Intelligence module.</div>
    </section>
  );
}

function IncidentRiskSection({ conflict, getIncidentById, compact }) {
  const incidentIds = useMemo(() => {
    const a = Array.isArray(conflict?.linkedIncidentIds) ? conflict.linkedIncidentIds : [];
    const b = Array.isArray(conflict?.incidentIds)       ? conflict.incidentIds       : [];
    return Array.from(new Set([...a, ...b]));
  }, [conflict?.linkedIncidentIds, conflict?.incidentIds]);

  if (incidentIds.length === 0) return null;

  return (
    <section className="schedule-impact-panel__section" aria-label="Incident Risk">
      <h3 className="schedule-impact-panel__section-title">Linked Incidents ({incidentIds.length})</h3>
      <ul className="schedule-impact-panel__incident-list">
        {incidentIds.slice(0, 6).map((id) => {
          const inc = typeof getIncidentById === 'function' ? getIncidentById(id) : null;
          const title = inc?.title ?? inc?.description ?? id;
          const sev   = inc?.severity ?? null;
          return (
            <li key={id} className="schedule-impact-panel__incident-row"
              aria-label={`Incident: ${title}${sev ? ` — ${sev}` : ''}`}>
              <span className="schedule-impact-panel__incident-title">⚠ {title}</span>
              {sev && <span className={`schedule-impact-panel__incident-sev schedule-impact-panel__incident-sev--${String(sev).toLowerCase()}`}>{sev}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RiskProfileSection({ conflict, getRiskById, compact }) {
  const riskCtx = conflict?.riskContext ?? conflict?.riskScore ?? null;
  if (!riskCtx) return null;

  const riskResolved = typeof getRiskById === 'function' && typeof riskCtx === 'string' ? getRiskById(riskCtx) : null;
  const band  = riskResolved?.severityBand ?? riskResolved?.band ?? (typeof riskCtx === 'object' ? (riskCtx.severityBand ?? null) : null);
  const score = riskResolved?.score ?? (typeof riskCtx === 'object' ? (riskCtx.score ?? null) : null);

  return (
    <section className="schedule-impact-panel__section" aria-label="Risk Profile">
      <h3 className="schedule-impact-panel__section-title">Risk Profile</h3>
      <div className="schedule-impact-panel__risk-context">
        {band  && <span className={`schedule-impact-panel__risk-band schedule-impact-panel__risk-band--${String(band).toLowerCase()}`}>{band}</span>}
        {score != null && <span className="schedule-impact-panel__risk-score">Risk Score: {score}</span>}
        {!band && !score && <span>{typeof riskCtx === 'string' ? riskCtx : JSON.stringify(riskCtx)}</span>}
      </div>
      <div className="schedule-impact-panel__context-note" role="note">Resolve details via Risk Intelligence module.</div>
    </section>
  );
}

function ImpactRailSummary({ conflict, trainCount, incidentCount, crowdCount }) {
  const score = conflict?.impactScore ?? null;
  const band  = score != null ? deriveScoreBand(score) : String(conflict?.severity ?? 'low').toLowerCase();
  const sevCfg = SEVERITY_CONFIG[band] ?? SEVERITY_CONFIG.low;
  return (
    <div className="schedule-impact-panel__rail" aria-label="Impact summary">
      <div className="schedule-impact-panel__rail-title">Impact</div>
      <dl className="schedule-impact-panel__rail-dl">
        <dt>Score</dt><dd className={`schedule-impact-panel__rail-val--${sevCfg.cssModifier}`}>{score ?? '—'}</dd>
        <dt>Band</dt><dd>{sevCfg.label}</dd>
        <dt>Trains</dt><dd>{trainCount}</dd>
        <dt>Incidents</dt><dd>{incidentCount}</dd>
        <dt>Crowd Zones</dt><dd>{crowdCount}</dd>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ScheduleImpactPanel({
  conflict   = null,
  layout     = null,
  title      = null,
  loading    = false,
  syncing    = false,
  isStale    = false,
  error      = null,
  compact    = false,
  onRetry    = null,
}) {
  const getTrainById    = useTrainStore((s)    => s.getTrainById);
  const getIncidentById = useIncidentStore((s) => s.getIncidentById);
  // crowdStore and riskStore may provide lookup selectors; use defensively
  const getCrowdById    = useCrowdStore   ? (useCrowdStore((s) => s.getCrowdForecastById ?? s.getForecastById ?? null)) : null;
  const getRiskById     = useRiskStore    ? (useRiskStore ((s) => s.getRiskById ?? s.getRiskScoreById ?? null)) : null;

  const trainCount    = (Array.isArray(conflict?.conflictingTrainIds) ? conflict.conflictingTrainIds : []).length;
  const incidentCount = (Array.isArray(conflict?.linkedIncidentIds)   ? conflict.linkedIncidentIds   : []).length;
  const crowdCount    = (Array.isArray(conflict?.crowdForecastIds)     ? conflict.crowdForecastIds    : []).length;

  const isEmpty       = !conflict && !loading;
  const resolvedTitle = title ?? (conflict?.type ? `Impact — ${conflict.type}` : 'Schedule Impact Analysis');

  const body = (
    <div
      className={[
        'schedule-impact-panel',
        compact ? 'schedule-impact-panel--compact' : null,
        isStale ? 'schedule-impact-panel--stale'   : null,
        error   ? 'schedule-impact-panel--error'   : null,
        syncing ? 'schedule-impact-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="schedule-impact-panel__empty" role="status">No conflict selected.</div>
      ) : (
        <>
          <ImpactScoreSection  conflict={conflict} compact={compact} />
          <TrainImpactSection  conflict={conflict} getTrainById={getTrainById}       compact={compact} />
          <CrowdImpactSection  conflict={conflict} getCrowdById={getCrowdById}        compact={compact} />
          <IncidentRiskSection conflict={conflict} getIncidentById={getIncidentById} compact={compact} />
          <RiskProfileSection  conflict={conflict} getRiskById={getRiskById}          compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{conflict?.impactScore != null ? `Impact: ${conflict.impactScore}/100` : 'Impact analysis'}<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<ImpactRailSummary conflict={conflict} trainCount={trainCount} incidentCount={incidentCount} crowdCount={crowdCount} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(conflict)}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={body}
        right={<ImpactRailSummary conflict={conflict} trainCount={trainCount} incidentCount={incidentCount} crowdCount={crowdCount} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

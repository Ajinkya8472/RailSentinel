import React, { memo, useMemo } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';
import useRiskStore from '../../store/riskStore';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * EnergyImpactPanel — cross-domain impact analysis surface for M7 Energy
 * Optimization. Quantifies the operational impact of energy inefficiency or
 * optimization actions across four domains:
 *
 *   1. Train Impact        — affected trains via `trainIds[]` or `profile.trainId`
 *                           resolved via trainStore.getTrainById
 *   2. Schedule Impact     — delay/disruption context from profile.scheduleImpact
 *   3. Operational Cost    — costImpact (monetary / kWh-equivalent)
 *   4. Service Reliability — reliabilityScore, MTTR, serviceLevel from profile
 *
 * All store reads are via approved selectors — zero mutations.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/trainStore`    (read-only — getTrainById)
 * - `src/store/riskStore`     (read-only — getRiskScoreById)
 * - `src/store/incidentStore` (read-only — getIncidentById)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `profile`    (object|null)  — EnergyProfile entity (default: null)
 * - `layout`     ('detail'|'split'|null) (default: null)
 * - `title`      (string|null)  (default: null)
 * - `loading`    (boolean)      (default: false)
 * - `syncing`    (boolean)      (default: false)
 * - `isStale`    (boolean)      (default: false)
 * - `error`      (any)          (default: null)
 * - `compact`    (boolean)      (default: false)
 * - `onRetry`    (fn|null)      (default: null)
 *
 * State: none — all derived.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-impact-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function TrainImpactSection({ profile, getTrainById, compact }) {
  const trainIds = useMemo(() => {
    const single = profile?.trainId;
    const multi  = Array.isArray(profile?.trainIds) ? profile.trainIds : [];
    return Array.from(new Set([...(single ? [single] : []), ...multi]));
  }, [profile?.trainId, profile?.trainIds]);

  if (trainIds.length === 0) return null;

  return (
    <section className="energy-impact-panel__section" aria-label="Train Impact">
      <h3 className="energy-impact-panel__section-title">Trains Affected ({trainIds.length})</h3>
      <ul className="energy-impact-panel__train-list">
        {trainIds.slice(0, 8).map((id) => {
          const train  = typeof getTrainById === 'function' ? getTrainById(id) : null;
          const name   = train?.name ?? train?.number ?? id;
          const route  = train?.routeName ?? train?.route ?? null;
          const status = train?.status ?? null;
          return (
            <li key={id} className="energy-impact-panel__train-row"
              aria-label={`Train ${name}${route ? ` on ${route}` : ''}`}>
              <span className="energy-impact-panel__train-name">🚆 {name}</span>
              {route  && <span className="energy-impact-panel__train-route">{route}</span>}
              {status && !compact && <span className={`energy-impact-panel__train-status energy-impact-panel__train-status--${String(status).toLowerCase()}`}>{status}</span>}
            </li>
          );
        })}
        {trainIds.length > 8 && <li className="energy-impact-panel__overflow">+{trainIds.length - 8} more</li>}
      </ul>
    </section>
  );
}

function ScheduleImpactSection({ profile, compact }) {
  const si = profile?.scheduleImpact;
  if (!si) return null;
  return (
    <section className="energy-impact-panel__section" aria-label="Schedule Impact">
      <h3 className="energy-impact-panel__section-title">Schedule Impact</h3>
      <dl className="energy-impact-panel__field-list">
        {si.delayMinutes    != null && <><dt>Delay</dt><dd>{si.delayMinutes} min</dd></>}
        {si.conflictCount   != null && <><dt>Conflicts</dt><dd>{si.conflictCount}</dd></>}
        {!compact && si.affectedRoutes && (
          <><dt>Routes</dt><dd>{Array.isArray(si.affectedRoutes) ? si.affectedRoutes.join(', ') : si.affectedRoutes}</dd></>
        )}
        {!compact && si.notes && <><dt>Notes</dt><dd>{si.notes}</dd></>}
      </dl>
      <div className="energy-impact-panel__context-note" role="note">Full details via Smart Scheduling module.</div>
    </section>
  );
}

function CostImpactSection({ profile, compact }) {
  const ci = profile?.costImpact ?? profile?.cost;
  if (!ci && profile?.savingsPotential == null) return null;
  return (
    <section className="energy-impact-panel__section" aria-label="Operational Cost">
      <h3 className="energy-impact-panel__section-title">Cost Impact</h3>
      <dl className="energy-impact-panel__field-list">
        {ci?.amount       != null && <><dt>Cost</dt><dd>{ci.currency ?? '₹'}{ci.amount}</dd></>}
        {ci?.perKwh       != null && <><dt>Cost/kWh</dt><dd>{ci.perKwh}</dd></>}
        {profile?.savingsPotential != null && (
          <><dt>Savings Potential</dt>
            <dd className="energy-impact-panel__savings">{profile.savingsPotential} kWh</dd>
          </>
        )}
        {!compact && ci?.notes && <><dt>Notes</dt><dd>{ci.notes}</dd></>}
      </dl>
    </section>
  );
}

function ReliabilitySection({ profile, compact }) {
  const rel = profile?.reliability ?? profile?.serviceReliability;
  const score = rel?.score ?? profile?.reliabilityScore ?? null;
  const mttr  = rel?.mttr  ?? profile?.mttr ?? null;
  const level = rel?.level ?? profile?.serviceLevel ?? null;
  if (score == null && mttr == null && level == null) return null;
  return (
    <section className="energy-impact-panel__section" aria-label="Service Reliability">
      <h3 className="energy-impact-panel__section-title">Service Reliability</h3>
      {score != null && (
        <div className="energy-impact-panel__reliability-bar"
          role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Reliability: ${score}%`}>
          <div className="energy-impact-panel__reliability-fill"
            style={{ width: `${Math.min(100, score)}%` }} aria-hidden="true" />
          <span className="energy-impact-panel__reliability-value">{score}%</span>
        </div>
      )}
      <dl className="energy-impact-panel__field-list">
        {mttr  != null && <><dt>MTTR</dt><dd>{mttr} min</dd></>}
        {level != null && !compact && <><dt>Service Level</dt><dd>{level}</dd></>}
      </dl>
    </section>
  );
}

function LinkedIncidentSection({ profile, getIncidentById, compact }) {
  const incidentIds = useMemo(() => {
    const a = Array.isArray(profile?.linkedIncidentIds) ? profile.linkedIncidentIds : [];
    const b = Array.isArray(profile?.incidentIds)       ? profile.incidentIds       : [];
    return Array.from(new Set([...a, ...b]));
  }, [profile?.linkedIncidentIds, profile?.incidentIds]);
  if (incidentIds.length === 0) return null;
  return (
    <section className="energy-impact-panel__section" aria-label="Linked Incidents">
      <h3 className="energy-impact-panel__section-title">Linked Incidents ({incidentIds.length})</h3>
      <ul className="energy-impact-panel__incident-list">
        {incidentIds.slice(0, 4).map((id) => {
          const inc  = typeof getIncidentById === 'function' ? getIncidentById(id) : null;
          const text = inc?.title ?? inc?.description ?? id;
          const sev  = inc?.severity ?? null;
          return (
            <li key={id} className="energy-impact-panel__incident-row" aria-label={text}>
              <span className="energy-impact-panel__incident-title">⚠ {text}</span>
              {sev && !compact && <span className={`energy-impact-panel__incident-sev energy-impact-panel__incident-sev--${String(sev).toLowerCase()}`}>{sev}</span>}
            </li>
          );
        })}
      </ul>
      <div className="energy-impact-panel__context-note" role="note">Details via Incident Response module.</div>
    </section>
  );
}

function ImpactRailSummary({ profile, trainCount }) {
  return (
    <div className="energy-impact-panel__rail" aria-label="Impact summary">
      <div className="energy-impact-panel__rail-title">Impact</div>
      <dl className="energy-impact-panel__rail-dl">
        <dt>Trains</dt><dd>{trainCount}</dd>
        {profile?.savingsPotential != null && <><dt>Savings</dt><dd>{profile.savingsPotential} kWh</dd></>}
        {profile?.scheduleImpact?.delayMinutes != null && <><dt>Delay</dt><dd>{profile.scheduleImpact.delayMinutes} min</dd></>}
        {profile?.reliabilityScore != null && <><dt>Reliability</dt><dd>{profile.reliabilityScore}%</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyImpactPanel({
  profile    = null,
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

  const trainIds = useMemo(() => {
    const single = profile?.trainId;
    const multi  = Array.isArray(profile?.trainIds) ? profile.trainIds : [];
    return Array.from(new Set([...(single ? [single] : []), ...multi]));
  }, [profile?.trainId, profile?.trainIds]);

  const isEmpty       = !profile && !loading;
  const resolvedTitle = title ?? (profile ? `Impact — ${profile.routeId ?? profile.id}` : 'Energy Impact Analysis');

  const body = (
    <div
      className={[
        'energy-impact-panel',
        compact ? 'energy-impact-panel--compact' : null,
        isStale ? 'energy-impact-panel--stale'   : null,
        error   ? 'energy-impact-panel--error'   : null,
        syncing ? 'energy-impact-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="energy-impact-panel__empty" role="status">No profile selected.</div>
      ) : (
        <>
          <TrainImpactSection      profile={profile} getTrainById={getTrainById}       compact={compact} />
          <ScheduleImpactSection   profile={profile} compact={compact} />
          <CostImpactSection       profile={profile} compact={compact} />
          <ReliabilitySection      profile={profile} compact={compact} />
          <LinkedIncidentSection   profile={profile} getIncidentById={getIncidentById} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{trainIds.length} trains · Impact analysis<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<ImpactRailSummary profile={profile} trainCount={trainIds.length} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(profile)}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={body}
        right={<ImpactRailSummary profile={profile} trainCount={trainIds.length} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

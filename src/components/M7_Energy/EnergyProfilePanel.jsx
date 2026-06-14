import React, { memo, useMemo } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';
import EnergyStatusBadge from './EnergyStatusBadge';

/**
 * Purpose:
 * EnergyProfilePanel — deep-review surface for a single EnergyProfile entity.
 * Renders the complete profile detail across six sections:
 *
 *   1. Core Profile     — id, routeId, trainId, stationId, efficiencyScore,
 *                        thresholdStatus, consumption, baseline, savingsPotential
 *   2. Train Context    — resolved train data via trainStore.getTrainById
 *   3. Consumption      — baseline vs actual comparison bars (mini inline)
 *   4. Efficiency Score — score gauge and trend direction
 *   5. Recommendations  — count and top pending recommendation summary
 *   6. Historical       — historicalBaseline, previousScore, comparison delta
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/trainStore` (read-only — getTrainById)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./EnergyStatusBadge`
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
 * State: none — all display derived.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-profile-panel__pills" aria-live="polite" aria-atomic="true">
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

function CoreProfileSection({ profile, compact }) {
  const score = Number(profile.efficiencyScore ?? 0);
  return (
    <section className="energy-profile-panel__section" aria-label="Core Profile">
      <h3 className="energy-profile-panel__section-title">Profile</h3>
      <dl className="energy-profile-panel__field-list">
        {profile.id         && <><dt>ID</dt><dd>{profile.id}</dd></>}
        {profile.routeId    && <><dt>Route</dt><dd>{profile.routeId}</dd></>}
        {profile.stationId  && <><dt>Station</dt><dd>{profile.stationId}</dd></>}
        {profile.thresholdStatus && <><dt>Threshold</dt><dd className={`energy-profile-panel__threshold--${String(profile.thresholdStatus).toLowerCase()}`}>{profile.thresholdStatus}</dd></>}
        {!compact && profile.consumption != null && <><dt>Actual Consumption</dt><dd>{profile.consumption} kWh</dd></>}
        {!compact && profile.baseline    != null && <><dt>Baseline</dt><dd>{profile.baseline} kWh</dd></>}
        {!compact && profile.savingsPotential != null && <><dt>Savings Potential</dt><dd className="energy-profile-panel__savings">{profile.savingsPotential} kWh</dd></>}
        {!compact && profile.updatedAt   && <><dt>Updated</dt><dd>{formatWhen(profile.updatedAt)}</dd></>}
      </dl>

      {/* Efficiency gauge */}
      <div className="energy-profile-panel__gauge-wrap" aria-label={`Efficiency: ${score}%`}>
        <div className="energy-profile-panel__gauge"
          role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
          <div className={`energy-profile-panel__gauge-fill energy-profile-panel__gauge-fill--${score >= 90 ? 'optimized' : score >= 70 ? 'normal' : score >= 50 ? 'medium' : 'low'}`}
            style={{ width: `${Math.min(100, score)}%` }} aria-hidden="true" />
        </div>
        <span className="energy-profile-panel__gauge-label">{score}% efficient</span>
        {profile.trendDirection && (
          <span className={`energy-profile-panel__trend energy-profile-panel__trend--${String(profile.trendDirection).toLowerCase()}`}>
            {profile.trendDirection === 'improving' ? '↑' : profile.trendDirection === 'degrading' ? '↓' : '→'} {profile.trendDirection}
          </span>
        )}
      </div>
    </section>
  );
}

function TrainContextSection({ profile, getTrainById, compact }) {
  const trainId = profile.trainId;
  if (!trainId) return null;
  const train = typeof getTrainById === 'function' ? getTrainById(trainId) : null;
  return (
    <section className="energy-profile-panel__section" aria-label="Train Context">
      <h3 className="energy-profile-panel__section-title">Train Context</h3>
      <dl className="energy-profile-panel__field-list">
        <dt>Train ID</dt><dd>{trainId}</dd>
        {train?.name   && <><dt>Name</dt><dd>{train.name}</dd></>}
        {train?.number && <><dt>Number</dt><dd>{train.number}</dd></>}
        {train?.routeName && <><dt>Route</dt><dd>{train.routeName}</dd></>}
        {!compact && train?.status && <><dt>Status</dt><dd>{train.status}</dd></>}
        {!compact && train?.serviceType && <><dt>Service Type</dt><dd>{train.serviceType}</dd></>}
      </dl>
    </section>
  );
}

function RecommendationSummarySection({ profile, compact }) {
  const recs = Array.isArray(profile.recommendations) ? profile.recommendations : [];
  const pending = recs.filter((r) => ['pending', 'accepted'].includes(String(r.status ?? 'pending').toLowerCase()));
  if (recs.length === 0) return null;
  return (
    <section className="energy-profile-panel__section" aria-label="Recommendations Summary">
      <h3 className="energy-profile-panel__section-title">Recommendations ({recs.length})</h3>
      {pending.length === 0 ? (
        <div className="energy-profile-panel__empty-note">No pending recommendations.</div>
      ) : (
        <ul className="energy-profile-panel__rec-list">
          {pending.slice(0, 3).map((r, idx) => (
            <li key={idx} className="energy-profile-panel__rec-row" aria-label={r.title ?? r.type ?? 'Recommendation'}>
              <span className="energy-profile-panel__rec-title">{r.title ?? r.type ?? 'Recommendation'}</span>
              {!compact && r.expectedSavings != null && (
                <span className="energy-profile-panel__rec-savings">↓{r.expectedSavings} kWh</span>
              )}
            </li>
          ))}
          {pending.length > 3 && <li className="energy-profile-panel__rec-overflow">+{pending.length - 3} more</li>}
        </ul>
      )}
    </section>
  );
}

function HistoricalSection({ profile, compact }) {
  const historical = profile.historicalBaseline ?? profile.previousBaseline ?? null;
  const prevScore  = profile.previousScore ?? null;
  const delta      = profile.efficiencyScore != null && prevScore != null
    ? Math.round(Number(profile.efficiencyScore) - Number(prevScore)) : null;
  if (!historical && prevScore == null) return null;
  return (
    <section className="energy-profile-panel__section" aria-label="Historical Comparison">
      <h3 className="energy-profile-panel__section-title">Historical</h3>
      <dl className="energy-profile-panel__field-list">
        {historical != null && <><dt>Historical Baseline</dt><dd>{historical} kWh</dd></>}
        {prevScore  != null && <><dt>Previous Score</dt><dd>{prevScore}%</dd></>}
        {delta != null && (
          <><dt>Score Change</dt>
            <dd className={`energy-profile-panel__delta energy-profile-panel__delta--${delta >= 0 ? 'positive' : 'negative'}`}>
              {delta >= 0 ? '+' : ''}{delta}%
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

function ProfileMetadataRail({ profile }) {
  const score = Number(profile.efficiencyScore ?? 0);
  return (
    <div className="energy-profile-panel__rail" aria-label="Profile metadata">
      <div className="energy-profile-panel__rail-title">Energy Profile</div>
      <dl className="energy-profile-panel__rail-dl">
        {profile.id         && <><dt>ID</dt><dd className="energy-profile-panel__rail-id">{profile.id}</dd></>}
        {profile.routeId    && <><dt>Route</dt><dd>{profile.routeId}</dd></>}
        <dt>Efficiency</dt><dd>{score}%</dd>
        {profile.savingsPotential != null && <><dt>Savings</dt><dd>{profile.savingsPotential} kWh</dd></>}
        {profile.thresholdStatus  && <><dt>Threshold</dt><dd>{profile.thresholdStatus}</dd></>}
        {profile.updatedAt        && <><dt>Updated</dt><dd>{formatWhen(profile.updatedAt)}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyProfilePanel({
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
  const getTrainById = useTrainStore((s) => s.getTrainById);

  const isEmpty       = !profile && !loading;
  const resolvedTitle = title ?? (profile ? `Energy Profile — ${profile.routeId ?? profile.id}` : 'Energy Profile');

  const headerSlot  = profile ? (
    <div className="energy-profile-panel__entity-header" aria-label="Profile header">
      <EnergyStatusBadge profile={profile} isStale={isStale} size="sm" />
      {profile.routeId && <span className="energy-profile-panel__route-label">{profile.routeId}</span>}
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
    </div>
  ) : null;

  const summarySlot = profile ? (
    <div className="energy-profile-panel__summary-grid" aria-label="Profile summary">
      <div className="energy-profile-panel__summary-metric">
        <span className="energy-profile-panel__summary-value">{profile.efficiencyScore ?? '—'}%</span>
        <span className="energy-profile-panel__summary-label">Efficiency</span>
      </div>
      <div className="energy-profile-panel__summary-metric">
        <span className="energy-profile-panel__summary-value">{profile.savingsPotential ?? '—'}</span>
        <span className="energy-profile-panel__summary-label">Savings kWh</span>
      </div>
      <div className="energy-profile-panel__summary-metric">
        <span className="energy-profile-panel__summary-value">
          {(Array.isArray(profile.anomalies) ? profile.anomalies : []).filter(
            (a) => !['resolved','closed'].includes(String(a.status ?? '').toLowerCase()),
          ).length}
        </span>
        <span className="energy-profile-panel__summary-label">Anomalies</span>
      </div>
    </div>
  ) : null;

  const body = (
    <div
      className={[
        'energy-profile-panel',
        compact ? 'energy-profile-panel--compact' : null,
        isStale ? 'energy-profile-panel--stale'   : null,
        error   ? 'energy-profile-panel--error'   : null,
        syncing ? 'energy-profile-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="energy-profile-panel__empty" role="status">No profile selected.</div>
      ) : (
        <>
          <CoreProfileSection profile={profile} compact={compact} />
          <TrainContextSection profile={profile} getTrainById={getTrainById} compact={compact} />
          <RecommendationSummarySection profile={profile} compact={compact} />
          <HistoricalSection profile={profile} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={headerSlot}
        summary={summarySlot}
        body={body}
        rail={profile ? <ProfileMetadataRail profile={profile} /> : null}
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
        header={headerSlot}
        left={body}
        right={profile ? <ProfileMetadataRail profile={profile} /> : null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

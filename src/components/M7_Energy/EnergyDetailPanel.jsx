import React, { memo, useMemo } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';
import useRiskStore from '../../store/riskStore';
import useIncidentStore from '../../store/incidentStore';
import EnergyStatusBadge from './EnergyStatusBadge';
import OptimizationCard from './OptimizationCard';

/**
 * Purpose:
 * EnergyDetailPanel — canonical single-entity deep-review surface for M7
 * Energy Optimization. Renders the complete operational profile of one
 * EnergyProfile across all DetailLayout slots.
 *
 * Content regions (DetailLayout slots):
 *
 *   Header slot   — entity identity bar: routeId, trainId, stationId,
 *                  status badge, live pill
 *
 *   Summary slot  — key metrics grid: efficiency %, consumption, savings,
 *                  anomaly count
 *
 *   Body sections:
 *     1. Core Fields          — all EnergyProfile scalar fields
 *     2. Consumption vs Baseline — inline comparison
 *     3. Recommendations      — full recommendation list with actions
 *     4. Anomalies            — active anomaly log
 *     5. Risk References      — riskScoreIds resolved via riskStore
 *     6. Related Entities     — linked trains, incidents, operator actions
 *     7. Operator Actions     — operatorActions[] history
 *
 *   Rail slot    — profile metadata: id, route, efficiency, threshold, updatedAt
 *
 * CRITICAL: Every `onRecommendationAccept` fires with OperatorAction context.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/trainStore`    (read-only — getTrainById)
 * - `src/store/riskStore`     (read-only — getRiskScoreById)
 * - `src/store/incidentStore` (read-only — getIncidentById)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./EnergyStatusBadge`
 * - `./OptimizationCard`
 *
 * Props:
 * - `profile`                   (object|null) (default: null)
 * - `layout`                    ('detail'|'split'|null) (default: null)
 * - `title`                     (string|null) (default: null)
 * - `loading`                   (boolean)     (default: false)
 * - `syncing`                   (boolean)     (default: false)
 * - `isStale`                   (boolean)     (default: false)
 * - `error`                     (any)         (default: null)
 * - `compact`                   (boolean)     (default: false)
 * - `onRetry`                   (fn|null)     (default: null)
 * - `onRecommendationAccept`    (fn|null)     — OperatorAction callback
 * - `onRecommendationDefer`     (fn|null)
 * - `onRecommendationEscalate`  (fn|null)
 *
 * State: none — all display derived.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

const BAND_RANK = { critical: 3, high: 2, medium: 1, low: 0 };
function bandCfg(k) {
  const bk = String(k ?? 'low').toLowerCase();
  const icon = { critical: '✕', high: '▲', medium: '◉', low: 'ℹ' }[bk] ?? '·';
  return { label: bk.charAt(0).toUpperCase() + bk.slice(1), cssModifier: bk, icon };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-detail-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function CoreFieldsSection({ profile, compact }) {
  const score = Number(profile.efficiencyScore ?? 0);
  return (
    <section className="energy-detail-panel__section" aria-label="Core Energy Profile Fields">
      <h3 className="energy-detail-panel__section-title">Core Profile</h3>
      <dl className="energy-detail-panel__field-list">
        {profile.id && <><dt>ID</dt><dd>{profile.id}</dd></>}
        {profile.routeId   && <><dt>Route</dt><dd>{profile.routeId}</dd></>}
        {profile.trainId   && <><dt>Train ID</dt><dd>{profile.trainId}</dd></>}
        {profile.stationId && <><dt>Station</dt><dd>{profile.stationId}</dd></>}
        {profile.thresholdStatus && <><dt>Threshold</dt><dd className={`energy-detail-panel__threshold--${String(profile.thresholdStatus).toLowerCase()}`}>{profile.thresholdStatus}</dd></>}
        {!compact && profile.consumption != null && <><dt>Consumption</dt><dd>{profile.consumption} kWh</dd></>}
        {!compact && profile.baseline    != null && <><dt>Baseline</dt><dd>{profile.baseline} kWh</dd></>}
        {!compact && profile.savingsPotential != null && <><dt>Savings Potential</dt><dd className="energy-detail-panel__savings">{profile.savingsPotential} kWh</dd></>}
        {!compact && profile.trendDirection && <><dt>Trend</dt><dd>{profile.trendDirection}</dd></>}
        {!compact && profile.createdAt && <><dt>Created</dt><dd>{formatWhen(profile.createdAt)}</dd></>}
        {!compact && profile.updatedAt && <><dt>Updated</dt><dd>{formatWhen(profile.updatedAt)}</dd></>}
      </dl>
      {/* Efficiency gauge */}
      <div className="energy-detail-panel__gauge" role="meter"
        aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
        aria-label={`Efficiency: ${score}%`}>
        <div className={`energy-detail-panel__gauge-fill energy-detail-panel__gauge-fill--${score >= 90 ? 'optimized' : score >= 70 ? 'normal' : score >= 50 ? 'medium' : 'low'}`}
          style={{ width: `${Math.min(100, score)}%` }} aria-hidden="true" />
        <span className="energy-detail-panel__gauge-label">{score}%</span>
      </div>
    </section>
  );
}

function RecommendationsSection({ profile, compact, onAccept, onDefer, onEscalate }) {
  const recs = useMemo(() => (Array.isArray(profile?.recommendations) ? profile.recommendations : [])
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)), [profile?.recommendations]);
  if (recs.length === 0) return null;
  const pending = recs.filter((r) => ['pending', 'accepted'].includes(String(r.status ?? 'pending').toLowerCase()));
  return (
    <section className="energy-detail-panel__section" aria-label="Recommendations">
      <h3 className="energy-detail-panel__section-title">Recommendations ({recs.length})</h3>
      {pending.length > 0 ? (
        <div className="energy-detail-panel__rec-stack">
          {pending.slice(0, 3).map((rec, idx) => (
            <OptimizationCard
              key={rec.id ?? idx}
              recommendation={rec}
              profile={profile}
              compact={compact}
              onAccept={onAccept}
              onDefer={onDefer}
              onEscalate={onEscalate}
            />
          ))}
          {pending.length > 3 && <div className="energy-detail-panel__overflow">+{pending.length - 3} more pending</div>}
        </div>
      ) : (
        <div className="energy-detail-panel__empty-note">No pending recommendations.</div>
      )}
    </section>
  );
}

function AnomaliesSection({ profile, compact }) {
  const anomalies = useMemo(() =>
    (Array.isArray(profile?.anomalies) ? profile.anomalies : [])
      .filter((a) => !['resolved', 'closed'].includes(String(a.status ?? 'active').toLowerCase()))
      .sort((a, b) => (BAND_RANK[String(b.severity ?? 'low').toLowerCase()] ?? 0) - (BAND_RANK[String(a.severity ?? 'low').toLowerCase()] ?? 0)),
  [profile?.anomalies]);
  if (anomalies.length === 0) return null;
  return (
    <section className="energy-detail-panel__section energy-detail-panel__section--anomaly" aria-label="Active Anomalies">
      <h3 className="energy-detail-panel__section-title">
        Active Anomalies
        <span className="energy-detail-panel__section-badge">{anomalies.length}</span>
      </h3>
      <ul className="energy-detail-panel__anomaly-list">
        {anomalies.map((a, idx) => (
          <li key={a.id ?? idx}
            className={`energy-detail-panel__anomaly-row energy-detail-panel__anomaly-row--${String(a.severity ?? 'low').toLowerCase()}`}
            aria-label={`${a.title ?? a.type ?? 'Anomaly'}: ${a.severity ?? 'low'}`}>
            <span className="energy-detail-panel__anomaly-icon">{bandCfg(a.severity).icon}</span>
            <span className="energy-detail-panel__anomaly-title">{a.title ?? a.type ?? 'Anomaly'}</span>
            {!compact && a.investigationNotes && (
              <span className="energy-detail-panel__anomaly-note">{a.investigationNotes}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RiskReferencesSection({ profile, getRiskScoreById, compact }) {
  const riskIds = Array.isArray(profile?.riskScoreIds) ? profile.riskScoreIds : [];
  if (riskIds.length === 0) return null;
  return (
    <section className="energy-detail-panel__section" aria-label="Risk References">
      <h3 className="energy-detail-panel__section-title">Risk References ({riskIds.length})</h3>
      <ul className="energy-detail-panel__risk-list">
        {riskIds.slice(0, 5).map((id) => {
          const rs  = typeof getRiskScoreById === 'function' ? getRiskScoreById(id) : null;
          const cfg = bandCfg(rs?.severityBand);
          return (
            <li key={id} className={`energy-detail-panel__risk-row energy-detail-panel__risk-row--${cfg.cssModifier}`}
              aria-label={`Risk ${id}: ${cfg.label}`}>
              <span className="energy-detail-panel__risk-band">{cfg.icon} {cfg.label}</span>
              {rs?.category && !compact && <span className="energy-detail-panel__risk-category">{rs.category}</span>}
              {rs?.score    != null && !compact && <span className="energy-detail-panel__risk-score">Score: {rs.score}</span>}
            </li>
          );
        })}
      </ul>
      <div className="energy-detail-panel__context-note" role="note">Full details via Risk Intelligence module.</div>
    </section>
  );
}

function OperatorActionsSection({ profile, compact }) {
  const actions = Array.isArray(profile?.operatorActions) ? profile.operatorActions : [];
  if (actions.length === 0) return null;
  return (
    <section className="energy-detail-panel__section" aria-label="Operator Action History">
      <h3 className="energy-detail-panel__section-title">Operator Actions ({actions.length})</h3>
      <ul className="energy-detail-panel__action-list">
        {actions.slice(0, 6).map((a, idx) => {
          const label  = typeof a === 'string' ? a : (a.action ?? a.type ?? a.label ?? 'Action');
          const actor  = typeof a === 'object' ? (a.performedBy ?? a.operator ?? null) : null;
          const ts     = typeof a === 'object' ? (a.timestamp ?? a.createdAt ?? null) : null;
          return (
            <li key={idx} className="energy-detail-panel__action-row"
              aria-label={`${label}${actor ? ` by ${actor}` : ''}`}>
              <span className="energy-detail-panel__action-label">{label}</span>
              {actor && !compact && <span className="energy-detail-panel__action-actor">{actor}</span>}
              {ts    && !compact && <span className="energy-detail-panel__action-ts">{formatWhen(ts)}</span>}
            </li>
          );
        })}
        {actions.length > 6 && <li className="energy-detail-panel__overflow">+{actions.length - 6} more</li>}
      </ul>
    </section>
  );
}

function MetadataRail({ profile }) {
  const score = Number(profile.efficiencyScore ?? 0);
  return (
    <div className="energy-detail-panel__rail" aria-label="Energy profile metadata">
      <div className="energy-detail-panel__rail-title">Energy Profile</div>
      <dl className="energy-detail-panel__rail-dl">
        {profile.id && <><dt>ID</dt><dd className="energy-detail-panel__rail-id">{profile.id}</dd></>}
        {profile.routeId   && <><dt>Route</dt><dd>{profile.routeId}</dd></>}
        {profile.trainId   && <><dt>Train</dt><dd>{profile.trainId}</dd></>}
        {profile.stationId && <><dt>Station</dt><dd>{profile.stationId}</dd></>}
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

export default memo(function EnergyDetailPanel({
  profile                  = null,
  layout                   = null,
  title                    = null,
  loading                  = false,
  syncing                  = false,
  isStale                  = false,
  error                    = null,
  compact                  = false,
  onRetry                  = null,
  onRecommendationAccept   = null,
  onRecommendationDefer    = null,
  onRecommendationEscalate = null,
}) {
  const getTrainById    = useTrainStore((s)    => s.getTrainById);
  const getRiskScoreById = useRiskStore((s)   => s.getRiskScoreById);
  const getIncidentById  = useIncidentStore((s) => s.getIncidentById);

  const isEmpty       = !profile && !loading;
  const resolvedTitle = title ?? (profile ? `${profile.routeId ?? profile.id} — Energy Detail` : 'Energy Profile Detail');

  const activeAnomalyCount = useMemo(() =>
    (Array.isArray(profile?.anomalies) ? profile.anomalies : [])
      .filter((a) => !['resolved', 'closed'].includes(String(a.status ?? 'active').toLowerCase())).length,
  [profile?.anomalies]);

  const headerSlot = profile ? (
    <div className="energy-detail-panel__entity-header">
      <EnergyStatusBadge profile={profile} isStale={isStale} size="sm" />
      {profile.routeId   && <span className="energy-detail-panel__route-label">{profile.routeId}</span>}
      {profile.trainId   && <span className="energy-detail-panel__train-label">🚆{profile.trainId}</span>}
      {profile.stationId && <span className="energy-detail-panel__station-label">🚉{profile.stationId}</span>}
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
    </div>
  ) : null;

  const summarySlot = profile ? (
    <div className="energy-detail-panel__summary-grid">
      <div className="energy-detail-panel__summary-metric">
        <span className="energy-detail-panel__summary-value">{profile.efficiencyScore ?? '—'}%</span>
        <span className="energy-detail-panel__summary-label">Efficiency</span>
      </div>
      <div className="energy-detail-panel__summary-metric">
        <span className="energy-detail-panel__summary-value">{profile.consumption ?? '—'}</span>
        <span className="energy-detail-panel__summary-label">kWh</span>
      </div>
      <div className="energy-detail-panel__summary-metric">
        <span className="energy-detail-panel__summary-value">{profile.savingsPotential ?? '—'}</span>
        <span className="energy-detail-panel__summary-label">Savings kWh</span>
      </div>
      <div className="energy-detail-panel__summary-metric">
        <span className="energy-detail-panel__summary-value">{activeAnomalyCount}</span>
        <span className="energy-detail-panel__summary-label">Anomalies</span>
      </div>
    </div>
  ) : null;

  const body = (
    <div
      className={[
        'energy-detail-panel',
        compact ? 'energy-detail-panel--compact' : null,
        isStale ? 'energy-detail-panel--stale'   : null,
        error   ? 'energy-detail-panel--error'   : null,
        syncing ? 'energy-detail-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="energy-detail-panel__empty" role="status">No profile selected.</div>
      ) : (
        <>
          <CoreFieldsSection profile={profile} compact={compact} />
          <RecommendationsSection
            profile={profile}
            compact={compact}
            onAccept={onRecommendationAccept}
            onDefer={onRecommendationDefer}
            onEscalate={onRecommendationEscalate}
          />
          <AnomaliesSection profile={profile} compact={compact} />
          <RiskReferencesSection profile={profile} getRiskScoreById={getRiskScoreById} compact={compact} />
          <OperatorActionsSection profile={profile} compact={compact} />
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
        rail={profile ? <MetadataRail profile={profile} /> : null}
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
        right={profile ? <MetadataRail profile={profile} /> : null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

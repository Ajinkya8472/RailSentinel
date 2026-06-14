import React, { memo, useMemo, useState } from 'react';
import EnergyKPIs from './EnergyKPIs';
import EnergyFilters from './EnergyFilters';
import OptimizationCard from './OptimizationCard';
import EnergyStatusBadge from './EnergyStatusBadge';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';

/**
 * Purpose:
 * EnergyDashboard — system-wide energy overview for Module-7 Energy
 * Optimization. Orchestrates four content sections:
 *
 *   1. EnergyKPIs          — aggregate efficiency/consumption/savings/anomaly tiles
 *   2. Efficiency Board    — per-profile efficiency cards sorted by score asc
 *                            (lowest efficiency first = most opportunity)
 *   3. Savings Opportunities — profiles with highest savingsPotential
 *   4. Active Anomalies    — profiles with active unresolved anomalies
 *
 * Also composites EnergyFilters for local client-side filtering.
 * Every `onOptimizationAccept` call MUST create an OperatorAction record
 * (the responsibility lies with the parent caller, this component fires
 * the callback with the action context).
 *
 * Store integrations (read-only): none — all data arrives via props.
 *
 * Dependencies:
 * - React (memo, useMemo, useState)
 * - `./EnergyKPIs`
 * - `./EnergyFilters`
 * - `./OptimizationCard`
 * - `./EnergyStatusBadge`
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `profiles`              (object[])  — EnergyProfile array (default: [])
 * - `loading`               (boolean)   (default: false)
 * - `refreshing`            (boolean)   (default: false)
 * - `syncing`               (boolean)   (default: false)
 * - `error`                 (any)       (default: null)
 * - `isStale`               (boolean)   (default: false)
 * - `layout`                ('detail'|'split'|null) (default: null)
 * - `title`                 (string|null) (default: null)
 * - `maxOpportunities`      (number)    (default: 6)
 * - `maxAnomalies`          (number)    (default: 8)
 * - `compact`               (boolean)   (default: false)
 * - `onProfileOpen`         (fn|null)   — profile click callback
 * - `onOptimizationAccept`  (fn|null)   — accept recommendation (creates OperatorAction)
 * - `onOptimizationDefer`   (fn|null)   — defer recommendation
 * - `onOptimizationEscalate`(fn|null)   — escalate recommendation
 * - `onRetry`               (fn|null)   (default: null)
 *
 * State:
 * - Local filter state via EnergyFilters (zero store mutations)
 */

// ---------------------------------------------------------------------------
// Default filters
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS = {
  route: 'all', train: 'all', station: 'all',
  efficiency: 'all', anomaly: 'all', timeWindow: 'all', query: '',
};

const ANOMALY_SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

function hasActiveAnomaly(p) {
  return (Array.isArray(p.anomalies) ? p.anomalies : []).some(
    (a) => !['resolved', 'closed'].includes(String(a.status ?? 'active').toLowerCase()),
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-dashboard__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function ProfileSummaryRow({ profile, compact, onOpen }) {
  const score    = profile.efficiencyScore ?? null;
  const isClick  = typeof onOpen === 'function';
  const routeId  = profile.routeId ?? profile.routeName ?? null;
  const trainId  = profile.trainId ?? null;
  const station  = profile.stationId ?? profile.station ?? null;

  return (
    <article
      className={[
        'energy-dashboard__profile-row',
        isClick ? 'energy-dashboard__profile-row--clickable' : null,
        compact ? 'energy-dashboard__profile-row--compact'  : null,
      ].filter(Boolean).join(' ')}
      role={isClick ? 'button' : 'article'}
      tabIndex={isClick ? 0 : undefined}
      aria-label={`Energy profile ${profile.id}: efficiency ${score ?? '?'}%`}
      onClick={isClick ? () => onOpen(profile) : undefined}
      onKeyDown={isClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(profile); } } : undefined}
    >
      <EnergyStatusBadge profile={profile} size="sm" showLabel={false} />
      <div className="energy-dashboard__profile-identity">
        {routeId && <span className="energy-dashboard__profile-route">{routeId}</span>}
        {trainId && <span className="energy-dashboard__profile-train">🚆{trainId}</span>}
        {station && <span className="energy-dashboard__profile-station">🚉{station}</span>}
        {!routeId && !trainId && !station && <span className="energy-dashboard__profile-id">{profile.id}</span>}
      </div>
      {score != null && (
        <div className="energy-dashboard__efficiency-bar" role="meter"
          aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Efficiency: ${score}%`}>
          <div className={`energy-dashboard__efficiency-fill energy-dashboard__efficiency-fill--${score >= 90 ? 'optimized' : score >= 70 ? 'normal' : score >= 50 ? 'medium' : 'low'}`}
            style={{ width: `${Math.min(100, score)}%` }} aria-hidden="true" />
          <span className="energy-dashboard__efficiency-value">{score}%</span>
        </div>
      )}
      {!compact && profile.savingsPotential != null && (
        <span className="energy-dashboard__savings-badge" aria-label={`Savings potential: ${profile.savingsPotential} kWh`}>
          ↓{profile.savingsPotential} kWh
        </span>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyDashboard({
  profiles              = [],
  loading               = false,
  refreshing            = false,
  syncing               = false,
  error                 = null,
  isStale               = false,
  layout                = null,
  title                 = null,
  maxOpportunities      = 6,
  maxAnomalies          = 8,
  compact               = false,
  onProfileOpen         = null,
  onOptimizationAccept  = null,
  onOptimizationDefer   = null,
  onOptimizationEscalate= null,
  onRetry               = null,
}) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

  // ── Local filtering ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = profiles;
    if (filters.route    !== 'all') list = list.filter((p) => String(p.routeId   ?? p.routeName ?? '').toLowerCase() === filters.route);
    if (filters.train    !== 'all') list = list.filter((p) => String(p.trainId   ?? '').toLowerCase() === filters.train);
    if (filters.station  !== 'all') list = list.filter((p) => String(p.stationId ?? '').toLowerCase() === filters.station);
    if (filters.efficiency !== 'all') {
      list = list.filter((p) => {
        const s = Number(p.efficiencyScore ?? 0);
        if (filters.efficiency === 'optimized')  return s >= 90;
        if (filters.efficiency === 'normal')     return s >= 70 && s < 90;
        if (filters.efficiency === 'medium')     return s >= 50 && s < 70;
        if (filters.efficiency === 'low')        return s < 50;
        return true;
      });
    }
    if (filters.anomaly !== 'all') {
      const wantAnomaly = filters.anomaly === 'active';
      list = list.filter((p) => hasActiveAnomaly(p) === wantAnomaly);
    }
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      list = list.filter((p) =>
        String(p.id ?? '').toLowerCase().includes(q) ||
        String(p.routeId ?? p.routeName ?? '').toLowerCase().includes(q) ||
        String(p.trainId ?? '').toLowerCase().includes(q) ||
        String(p.stationId ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [profiles, filters]);

  // ── Board sections ────────────────────────────────────────────────────────
  const opportunities = useMemo(() =>
    [...filtered]
      .filter((p) => (p.savingsPotential ?? 0) > 0)
      .sort((a, b) => (b.savingsPotential ?? 0) - (a.savingsPotential ?? 0))
      .slice(0, maxOpportunities),
  [filtered, maxOpportunities]);

  const anomalousProfiles = useMemo(() =>
    filtered
      .filter(hasActiveAnomaly)
      .sort((a, b) => {
        const maxSev = (p) => (Array.isArray(p.anomalies) ? p.anomalies : [])
          .reduce((mx, an) => Math.max(mx, ANOMALY_SEVERITY_RANK[String(an.severity ?? 'low').toLowerCase()] ?? 0), 0);
        return maxSev(b) - maxSev(a);
      })
      .slice(0, maxAnomalies),
  [filtered, maxAnomalies]);

  // Top recommendations across all filtered profiles
  const recommendations = useMemo(() => {
    const recs = [];
    for (const p of filtered) {
      for (const r of (Array.isArray(p.recommendations) ? p.recommendations : [])) {
        if (['pending', 'accepted'].includes(String(r.status ?? 'pending').toLowerCase())) {
          recs.push({ ...r, _profile: p });
        }
      }
    }
    return recs
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 4);
  }, [filtered]);

  const isEmpty       = profiles.length === 0 && !loading;
  const resolvedTitle = title ?? 'Energy Optimization Dashboard';

  const body = (
    <div
      className={[
        'energy-dashboard',
        compact ? 'energy-dashboard--compact' : null,
        isStale ? 'energy-dashboard--stale'   : null,
        error   ? 'energy-dashboard--error'   : null,
        syncing ? 'energy-dashboard--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      <EnergyKPIs profiles={profiles} loading={loading} refreshing={refreshing} syncing={syncing} error={error} isStale={isStale} compact={compact} />

      {!compact && (
        <EnergyFilters profiles={profiles} filters={filters} onFiltersChange={setFilters} />
      )}

      {isEmpty ? (
        <div className="energy-dashboard__empty" role="status">No energy profiles available.</div>
      ) : (
        <>
          {/* Savings Opportunities */}
          {opportunities.length > 0 && (
            <section className="energy-dashboard__section" aria-label="Savings Opportunities">
              <h3 className="energy-dashboard__section-title">
                Savings Opportunities
                <span className="energy-dashboard__section-count">{opportunities.length}</span>
              </h3>
              <div className="energy-dashboard__profile-list">
                {opportunities.map((p) => (
                  <ProfileSummaryRow key={p.id} profile={p} compact={compact} onOpen={onProfileOpen} />
                ))}
              </div>
            </section>
          )}

          {/* Active Recommendations */}
          {recommendations.length > 0 && (
            <section className="energy-dashboard__section" aria-label="Top Recommendations">
              <h3 className="energy-dashboard__section-title">Top Recommendations</h3>
              <div className="energy-dashboard__rec-stack">
                {recommendations.map((rec, idx) => (
                  <OptimizationCard
                    key={rec.id ?? idx}
                    recommendation={rec}
                    profile={rec._profile}
                    compact={compact}
                    onAccept={onOptimizationAccept}
                    onDefer={onOptimizationDefer}
                    onEscalate={onOptimizationEscalate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Active Anomalies */}
          {anomalousProfiles.length > 0 && (
            <section className="energy-dashboard__section energy-dashboard__section--anomaly" aria-label="Active Anomalies">
              <h3 className="energy-dashboard__section-title">
                Active Anomalies
                <span className="energy-dashboard__section-badge">{anomalousProfiles.length}</span>
              </h3>
              <div className="energy-dashboard__profile-list">
                {anomalousProfiles.map((p) => (
                  <ProfileSummaryRow key={p.id} profile={p} compact={compact} onOpen={onProfileOpen} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={
          <div className="energy-dashboard__detail-summary">
            {filtered.length} profiles · {recommendations.length} recs
            <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
          </div>
        }
        body={body}
        rail={<EnergyKPIs profiles={profiles} compact={true} />}
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
        left={body}
        right={<EnergyKPIs profiles={profiles} compact={true} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

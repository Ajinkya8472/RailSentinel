import React, { memo, useMemo } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useRiskStore from '../../store/riskStore';

/**
 * Purpose:
 * EnergyRiskPanel — energy-linked risk posture surface for M7 Energy
 * Optimization. Renders RiskScore entities referenced by an EnergyProfile
 * via `riskScoreIds[]` / `riskContext`, resolved via riskStore selectors:
 *
 *   1. Risk Posture Summary    — linked risk counts by severityBand
 *   2. Linked Risk Score Cards — resolved RiskScore entities with:
 *                               severityBand, score, category, lastUpdatedAt
 *   3. Energy Risk Band        — derived energy-specific risk posture
 *                               (highest severityBand across linked risks)
 *   4. Escalation Guidance     — threshold-triggered recommendation for operator
 *                               action based on combined risk posture
 *
 * Risk integration is read-only. Energy-risk linkage follows the approved
 * architecture: EnergyProfile.riskScoreIds[] → riskStore.getRiskScoreById.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore` (read-only — getRiskScoreById, getRiskCounts)
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
// Configuration
// ---------------------------------------------------------------------------

const BAND_CONFIG = {
  critical: { label: 'Critical', cssModifier: 'critical', rank: 3, icon: '✕', escalate: true  },
  high:     { label: 'High',     cssModifier: 'high',     rank: 2, icon: '▲', escalate: true  },
  medium:   { label: 'Medium',   cssModifier: 'medium',   rank: 1, icon: '◉', escalate: false },
  low:      { label: 'Low',      cssModifier: 'low',      rank: 0, icon: 'ℹ', escalate: false },
};

function bandCfg(k) { return BAND_CONFIG[String(k ?? 'low').toLowerCase()] ?? BAND_CONFIG.low; }

const ESCALATION_GUIDANCE = {
  critical: 'Immediate escalation required. Suspend non-essential energy loads. Notify operations manager.',
  high:     'Escalate to shift supervisor. Investigate energy spikes. Apply emergency optimization protocols.',
  medium:   'Monitor energy risk posture. Review linked optimization recommendations.',
  low:      'Energy risk posture nominal. Continue scheduled optimization reviews.',
};

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-risk-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function RiskScoreCard({ riskScore, compact }) {
  const cfg = bandCfg(riskScore.severityBand);
  return (
    <div className={`energy-risk-panel__risk-card energy-risk-panel__risk-card--${cfg.cssModifier}`}
      aria-label={`Risk: ${cfg.label} — ${riskScore.category ?? riskScore.id}`}>
      <div className="energy-risk-panel__risk-card-header">
        <span className="energy-risk-panel__risk-band" aria-hidden="true">{cfg.icon}</span>
        <span className="energy-risk-panel__risk-band-label">{cfg.label}</span>
        {riskScore.score != null && (
          <span className="energy-risk-panel__risk-score">Score: {riskScore.score}</span>
        )}
      </div>
      <dl className="energy-risk-panel__risk-card-dl">
        {riskScore.category && <><dt>Category</dt><dd>{riskScore.category}</dd></>}
        {!compact && riskScore.lastUpdatedAt && <><dt>Updated</dt><dd>{formatWhen(riskScore.lastUpdatedAt)}</dd></>}
        {!compact && riskScore.description && <><dt>Description</dt><dd>{riskScore.description}</dd></>}
      </dl>
    </div>
  );
}

function EscalationGuidanceSection({ maxBand }) {
  const cfg      = bandCfg(maxBand);
  const guidance = ESCALATION_GUIDANCE[maxBand] ?? ESCALATION_GUIDANCE.low;
  return (
    <section className={`energy-risk-panel__section energy-risk-panel__section--guidance energy-risk-panel__section--${cfg.cssModifier}`}
      aria-label="Escalation Guidance">
      <h3 className="energy-risk-panel__section-title">Escalation Guidance</h3>
      <div className={`energy-risk-panel__guidance energy-risk-panel__guidance--${cfg.cssModifier}`}
        role={cfg.escalate ? 'alert' : 'note'}>
        <span className="energy-risk-panel__guidance-band">{cfg.label} Posture</span>
        <p className="energy-risk-panel__guidance-text">{guidance}</p>
      </div>
    </section>
  );
}

function RiskRailSummary({ linkedScores, maxBand, byCounts }) {
  const cfg = bandCfg(maxBand);
  return (
    <div className="energy-risk-panel__rail" aria-label="Energy risk summary">
      <div className="energy-risk-panel__rail-title">Energy Risk</div>
      <dl className="energy-risk-panel__rail-dl">
        <dt>Posture</dt><dd className={`energy-risk-panel__rail-band--${cfg.cssModifier}`}>{cfg.label}</dd>
        <dt>Linked</dt><dd>{linkedScores.length}</dd>
        {byCounts.critical > 0 && <><dt>Critical</dt><dd className="energy-risk-panel__rail-critical">{byCounts.critical}</dd></>}
        {byCounts.high     > 0 && <><dt>High</dt><dd className="energy-risk-panel__rail-high">{byCounts.high}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyRiskPanel({
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
  const getRiskScoreById = useRiskStore((s) => s.getRiskScoreById);

  const riskIds = useMemo(() => {
    const ids  = Array.isArray(profile?.riskScoreIds) ? profile.riskScoreIds : [];
    const ctx  = profile?.riskContext;
    if (ctx && typeof ctx === 'string') return Array.from(new Set([...ids, ctx]));
    if (ctx?.id) return Array.from(new Set([...ids, ctx.id]));
    return ids;
  }, [profile?.riskScoreIds, profile?.riskContext]);

  const linkedScores = useMemo(() =>
    riskIds
      .map((id) => getRiskScoreById(id))
      .filter(Boolean)
      .sort((a, b) => (bandCfg(b.severityBand).rank - bandCfg(a.severityBand).rank)),
  [riskIds, getRiskScoreById]);

  const maxBand = useMemo(() =>
    linkedScores.length > 0 ? String(linkedScores[0].severityBand ?? 'low').toLowerCase() : 'low',
  [linkedScores]);

  const byCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const rs of linkedScores) {
      const k = String(rs.severityBand ?? 'low').toLowerCase();
      if (counts[k] != null) counts[k] += 1;
    }
    return counts;
  }, [linkedScores]);

  const isEmpty       = riskIds.length === 0 && !loading;
  const resolvedTitle = title ?? (profile ? `Risk — ${profile.routeId ?? profile.id}` : 'Energy Risk Posture');

  const body = (
    <div
      className={[
        'energy-risk-panel',
        compact ? 'energy-risk-panel--compact' : null,
        isStale ? 'energy-risk-panel--stale'   : null,
        error   ? 'energy-risk-panel--error'   : null,
        syncing ? 'energy-risk-panel--live'    : null,
        `energy-risk-panel--posture-${maxBand}`,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty && !loading ? (
        <div className="energy-risk-panel__empty" role="status">No risk data linked to this profile.</div>
      ) : (
        <>
          {/* Risk posture header */}
          <section className="energy-risk-panel__section" aria-label="Energy Risk Posture">
            <h3 className="energy-risk-panel__section-title">Risk Posture</h3>
            <div className={`energy-risk-panel__posture energy-risk-panel__posture--${bandCfg(maxBand).cssModifier}`}
              aria-label={`Energy risk posture: ${bandCfg(maxBand).label}`}>
              <span aria-hidden="true">{bandCfg(maxBand).icon}</span> {bandCfg(maxBand).label}
            </div>
          </section>

          {/* Linked risk score cards */}
          {linkedScores.length > 0 && (
            <section className="energy-risk-panel__section" aria-label="Linked Risk Scores">
              <h3 className="energy-risk-panel__section-title">Risk Scores ({linkedScores.length})</h3>
              <div className="energy-risk-panel__risk-card-grid">
                {linkedScores.map((rs) => (
                  <RiskScoreCard key={rs.id} riskScore={rs} compact={compact} />
                ))}
              </div>
            </section>
          )}

          {/* Unresolved risk IDs with no store match */}
          {!compact && riskIds.length > linkedScores.length && (
            <div className="energy-risk-panel__unresolved" role="note">
              {riskIds.length - linkedScores.length} risk score(s) not yet loaded.
            </div>
          )}

          {/* Escalation guidance */}
          <EscalationGuidanceSection maxBand={maxBand} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{bandCfg(maxBand).label} posture · {linkedScores.length} linked<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<RiskRailSummary linkedScores={linkedScores} maxBand={maxBand} byCounts={byCounts} />}
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
        right={<RiskRailSummary linkedScores={linkedScores} maxBand={maxBand} byCounts={byCounts} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

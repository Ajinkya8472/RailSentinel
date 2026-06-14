import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * PredictionImpactPanel — canonical cross-domain impact surface for M4
 * Predictive Intelligence. Renders operational consequences of the prediction
 * across four impact domains, reading exclusively from fields the Prediction
 * (RiskScore) domain model carries as pass-through API references. No other
 * domain store is imported — cross-domain IDs are rendered as reference items
 * with module attribution notes.
 *
 * Four impact sections:
 *
 *   1. Service Impact       — derived from `expectedImpact`, `serviceImpact`,
 *                            `serviceDisruptionRisk`, `affectedRoutes[]`
 *                            + grade inferred from `severityBand` / severity
 *                            score.
 *
 *   2. Maintenance Impact   — derived from `maintenanceAction`, `maintenanceUrgency`,
 *                            `maintenanceWindow`, `maintenanceCost`, `downtime`
 *                            + grade inferred from time-to-failure closeness.
 *
 *   3. Asset Cross-Reference — `affectedTrainId` resolved to train name via
 *                            trainStore; `affectedAssetId` + `subcomponents[]`
 *                            as reference list.
 *
 *   4. Risk Prioritization  — explicit `severityScore` / `riskPriority` or
 *                            composite inferred score: severityBand rank (60%)
 *                            + confidence inverse (20%) + overdue flag (20%).
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore`  (Zustand — read-only)
 * - `src/store/trainStore` (Zustand — read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `predictionId`   (string|null)  (default: null)
 * - `prediction`     (object|null)  (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `staleThreshold` (number)       (default: 60000)
 * - `compact`        (boolean)      (default: false)
 * - `onRetry`        (fn|null)      (default: null)
 *
 * State (derived from store selectors only — zero mutations):
 * - riskStore: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`,
 *              `getRiskScoreById`, `getSelectedRiskScore`
 * - trainStore: `getTrainById`
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
function sevRank(k) { return SEVERITY_RANK[String(k ?? 'low').toLowerCase()] ?? 0; }

const SERVICE_IMPACT_GRADE = {
  low:      { label: 'Minimal',     cssModifier: 'minimal',  description: 'No significant service disruption expected.' },
  medium:   { label: 'Moderate',    cssModifier: 'medium',   description: 'Minor service adjustments may be required.' },
  high:     { label: 'Significant', cssModifier: 'high',     description: 'Service disruption likely. Pre-arrange contingency.' },
  critical: { label: 'Severe',      cssModifier: 'critical', description: 'Immediate service impact. Activate incident protocol.' },
};

const MAINT_URGENCY_GRADE = {
  0: { label: 'Routine',   cssModifier: 'routine',   description: 'Schedule during next maintenance window.' },
  1: { label: 'Priority',  cssModifier: 'priority',  description: 'Prioritise within current maintenance cycle.' },
  2: { label: 'Urgent',    cssModifier: 'urgent',    description: 'Schedule immediate inspection. Defer only if safe.' },
  3: { label: 'Emergency', cssModifier: 'emergency', description: 'Emergency maintenance required. Do not defer.' },
};

function maintUrgencyGrade(p) {
  const failAt = p.predictedFailureAt ? Date.parse(p.predictedFailureAt) : null;
  const now    = Date.now();
  const bRank  = sevRank(p.severityBand);

  if (failAt != null && failAt < now)                              return MAINT_URGENCY_GRADE[3];
  if (failAt != null && failAt - now < 2 * 3600000 && bRank >= 3) return MAINT_URGENCY_GRADE[3];
  if (failAt != null && failAt - now < 8 * 3600000)               return MAINT_URGENCY_GRADE[2];
  if (bRank >= 2)                                                  return MAINT_URGENCY_GRADE[2];
  if (bRank === 1)                                                 return MAINT_URGENCY_GRADE[1];
  return MAINT_URGENCY_GRADE[0];
}

function computeRiskScore(p) {
  if (!p) return 0;
  if (typeof p.severityScore === 'number') {
    return p.severityScore <= 1 ? Math.round(p.severityScore * 100) : Math.min(100, Math.round(p.severityScore));
  }
  const bRank  = sevRank(p.severityBand);
  const conf   = p.confidenceScore != null ? (p.confidenceScore <= 1 ? p.confidenceScore : p.confidenceScore / 100) : 0.5;
  const failAt = p.predictedFailureAt ? Date.parse(p.predictedFailureAt) : null;
  const overdue = failAt != null && failAt < Date.now();

  let score = (bRank / 3) * 60;
  score += (1 - conf) * 20;
  if (overdue) score += 20;
  return Math.min(100, Math.round(score));
}

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
    <div className="prediction-impact-panel__pills" aria-live="polite" aria-atomic="true">
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
    <span className={`prediction-impact-panel__grade prediction-impact-panel__grade--${cssModifier}`}
      aria-label={`Impact grade: ${label}`}>{label}</span>
  );
}

function ServiceImpactSection({ prediction, compact }) {
  const band    = String(prediction?.severityBand ?? 'low').toLowerCase();
  const gradeCfg = SERVICE_IMPACT_GRADE[band] ?? SERVICE_IMPACT_GRADE.low;
  const expectedImpact     = prediction?.expectedImpact ?? null;
  const serviceImpact      = prediction?.serviceImpact ?? null;
  const serviceDisruptRisk = prediction?.serviceDisruptionRisk ?? null;
  const affectedRoutes     = Array.isArray(prediction?.affectedRoutes) ? prediction.affectedRoutes : [];

  return (
    <section className="prediction-impact-panel__section" aria-label="Service Impact">
      <h3 className="prediction-impact-panel__section-title">
        Service Impact <ImpactGradeBadge label={gradeCfg.label} cssModifier={gradeCfg.cssModifier} />
      </h3>
      <p className="prediction-impact-panel__grade-desc">{gradeCfg.description}</p>

      {expectedImpact && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Expected Impact</span>
          <span className="prediction-impact-panel__field-value">{expectedImpact}</span>
        </div>
      )}
      {serviceImpact != null && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Service Impact</span>
          <span className="prediction-impact-panel__field-value">
            {typeof serviceImpact === 'object' ? (serviceImpact.description ?? JSON.stringify(serviceImpact)) : serviceImpact}
          </span>
        </div>
      )}
      {serviceDisruptRisk != null && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Disruption Risk</span>
          <span className="prediction-impact-panel__field-value">{serviceDisruptRisk}</span>
        </div>
      )}
      {!compact && affectedRoutes.length > 0 && (
        <div className="prediction-impact-panel__routes" aria-label={`${affectedRoutes.length} affected routes`}>
          <span className="prediction-impact-panel__field-label">Affected Routes</span>
          <div className="prediction-impact-panel__route-chips" role="list">
            {affectedRoutes.map((r, idx) => (
              <span key={idx} className="prediction-impact-panel__route-chip" role="listitem">{typeof r === 'string' ? r : r.name ?? r.id ?? `Route ${idx + 1}`}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MaintenanceImpactSection({ prediction, compact }) {
  const urgCfg          = maintUrgencyGrade(prediction);
  const maintenanceAction = prediction?.maintenanceAction ?? null;
  const maintWindow       = prediction?.maintenanceWindow ?? null;
  const maintCost         = prediction?.maintenanceCost ?? null;
  const downtime          = prediction?.downtime ?? null;

  return (
    <section className="prediction-impact-panel__section" aria-label="Maintenance Impact">
      <h3 className="prediction-impact-panel__section-title">
        Maintenance Impact <ImpactGradeBadge label={urgCfg.label} cssModifier={urgCfg.cssModifier} />
      </h3>
      <p className="prediction-impact-panel__grade-desc">{urgCfg.description}</p>

      {maintenanceAction && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Recommended Action</span>
          <span className="prediction-impact-panel__field-value">{maintenanceAction}</span>
        </div>
      )}
      {!compact && maintWindow && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Maintenance Window</span>
          <span className="prediction-impact-panel__field-value">{maintWindow}</span>
        </div>
      )}
      {!compact && downtime && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Estimated Downtime</span>
          <span className="prediction-impact-panel__field-value">{downtime}</span>
        </div>
      )}
      {!compact && maintCost != null && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Estimated Cost</span>
          <span className="prediction-impact-panel__field-value">{maintCost}</span>
        </div>
      )}
    </section>
  );
}

function AssetCrossReferenceSection({ prediction, affectedTrain, compact }) {
  const subcomponents = Array.isArray(prediction?.subcomponents) ? prediction.subcomponents : [];
  const assetName     = affectedTrain?.name ?? affectedTrain?.number ?? prediction?.affectedAssetId ?? prediction?.affectedTrainId ?? null;

  return (
    <section className="prediction-impact-panel__section" aria-label="Asset Cross-Reference">
      <h3 className="prediction-impact-panel__section-title">Asset Cross-Reference</h3>

      {assetName && (
        <div className="prediction-impact-panel__asset-id" aria-label={`Affected asset: ${assetName}`}>
          <span className="prediction-impact-panel__field-label">Affected Asset</span>
          <span className="prediction-impact-panel__field-value">
            <span aria-hidden="true">🚆</span> {assetName}
          </span>
          {prediction?.affectedTrainId && (
            <div className="prediction-impact-panel__ref-note" role="note">
              Train ID: {prediction.affectedTrainId}. Resolve via Train Operations module.
            </div>
          )}
        </div>
      )}

      {prediction?.affectedAssetId && prediction?.affectedAssetId !== prediction?.affectedTrainId && (
        <div className="prediction-impact-panel__field">
          <span className="prediction-impact-panel__field-label">Asset Component</span>
          <span className="prediction-impact-panel__field-value">{prediction.affectedAssetId}</span>
        </div>
      )}

      {!compact && subcomponents.length > 0 && (
        <div className="prediction-impact-panel__subcomponents" aria-label={`${subcomponents.length} affected subcomponents`}>
          <span className="prediction-impact-panel__field-label">Subcomponents</span>
          <ul className="prediction-impact-panel__subcomp-list">
            {subcomponents.map((s, idx) => (
              <li key={idx} className="prediction-impact-panel__subcomp-row">
                {typeof s === 'string' ? s : s.name ?? s.id ?? `Component ${idx + 1}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RiskPrioritizationSection({ prediction, compact }) {
  const riskScore    = computeRiskScore(prediction);
  const riskLevel    = prediction?.riskLevel ?? null;
  const riskPriority = prediction?.riskPriority ?? null;

  const riskLabel = riskScore >= 75 ? 'Critical' : riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low';
  const riskMod   = riskLabel.toLowerCase();

  return (
    <section className="prediction-impact-panel__section" aria-label="Risk Prioritization">
      <h3 className="prediction-impact-panel__section-title">Risk Prioritization</h3>

      <div className="prediction-impact-panel__risk-header">
        <span className={`prediction-impact-panel__risk-level prediction-impact-panel__risk-level--${riskMod}`}>
          {riskLevel ?? riskLabel}
        </span>
        {riskPriority != null && (
          <span className="prediction-impact-panel__risk-priority">Priority #{riskPriority}</span>
        )}
      </div>

      <div className="prediction-impact-panel__risk-meter"
        role="meter" aria-valuenow={riskScore} aria-valuemin={0} aria-valuemax={100}
        aria-label={`Risk score: ${riskScore}%`}>
        <div className={`prediction-impact-panel__risk-fill prediction-impact-panel__risk-fill--${riskMod}`}
          style={{ width: `${riskScore}%` }} aria-hidden="true" />
        <span className="prediction-impact-panel__risk-score">{riskScore}</span>
      </div>

      {!compact && (
        <div className="prediction-impact-panel__risk-breakdown" role="note">
          Score reflects severity band, inverse model confidence, and overdue status.
          {typeof prediction?.severityScore === 'number' ? ' Using explicit severity score from prediction.' : ' Score is inferred from prediction domain fields.'}
        </div>
      )}
    </section>
  );
}

function ImpactRailSummary({ prediction, riskScore, maintGrade, serviceGrade }) {
  return (
    <div className="prediction-impact-panel__rail" aria-label="Impact summary">
      <div className="prediction-impact-panel__rail-title">Impact Summary</div>
      <dl className="prediction-impact-panel__rail-dl">
        <dt>Service Impact</dt>
        <dd className={`prediction-impact-panel__rail-val--${serviceGrade.cssModifier}`}>{serviceGrade.label}</dd>
        <dt>Maintenance</dt>
        <dd className={`prediction-impact-panel__rail-val--${maintGrade.cssModifier}`}>{maintGrade.label}</dd>
        <dt>Risk Score</dt>
        <dd>{riskScore}/100</dd>
        {prediction?.riskPriority != null && <><dt>Priority</dt><dd>#{prediction.riskPriority}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionImpactPanel({
  predictionId      = null,
  prediction: pProp = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  compact           = false,
  onRetry           = null,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useRiskStore((s) => s.loading);
  const refreshing    = useRiskStore((s) => s.refreshing);
  const syncing       = useRiskStore((s) => s.syncing);
  const error         = useRiskStore((s) => s.error);
  const lastUpdatedAt = useRiskStore((s) => s.lastUpdatedAt);

  const predFromStore = useRiskStore((s) =>
    predictionId ? s.getRiskScoreById(predictionId) : s.getSelectedRiskScore(),
  );

  const getTrainById = useTrainStore((s) => s.getTrainById);

  // ── Resolved prediction ───────────────────────────────────────────────────
  const prediction = useMemo(() => pProp ?? predFromStore ?? null, [pProp, predFromStore]);

  const affectedTrain = useMemo(() => {
    if (!prediction?.affectedTrainId) return null;
    try { return getTrainById(prediction.affectedTrainId); } catch { return null; }
  }, [prediction?.affectedTrainId, getTrainById]);

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : prediction?.lastUpdatedAt ? Date.parse(prediction.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, prediction, staleThreshold]);

  // ── Derived values ────────────────────────────────────────────────────────
  const isEmpty       = !prediction && !loading;
  const riskScore     = computeRiskScore(prediction);
  const maintGrade    = prediction ? maintUrgencyGrade(prediction) : MAINT_URGENCY_GRADE[0];
  const serviceGrade  = prediction ? (SERVICE_IMPACT_GRADE[String(prediction.severityBand ?? 'low').toLowerCase()] ?? SERVICE_IMPACT_GRADE.low) : SERVICE_IMPACT_GRADE.low;
  const assetName     = affectedTrain?.name ?? affectedTrain?.number ?? prediction?.affectedAssetId ?? prediction?.affectedTrainId ?? null;
  const resolvedTitle = title ?? (assetName ? `Impact Analysis — ${assetName}` : 'Prediction Impact Analysis');

  const detailSummary = prediction ? (
    <div className="prediction-impact-panel__summary">
      {assetName && <div className="prediction-impact-panel__summary-asset">{assetName}</div>}
      <div>Risk Score: <strong>{riskScore}</strong>/100</div>
      <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
    </div>
  ) : null;

  const body = (
    <div
      className={[
        'prediction-impact-panel',
        compact ? 'prediction-impact-panel--compact' : null,
        isStale ? 'prediction-impact-panel--stale'   : null,
        error   ? 'prediction-impact-panel--error'   : null,
        syncing ? 'prediction-impact-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="prediction-impact-panel__empty" role="status">No prediction selected.</div>
      ) : (
        <>
          <ServiceImpactSection prediction={prediction} compact={compact} />
          <MaintenanceImpactSection prediction={prediction} compact={compact} />
          <AssetCrossReferenceSection prediction={prediction} affectedTrain={affectedTrain} compact={compact} />
          <RiskPrioritizationSection prediction={prediction} compact={compact} />
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={detailSummary}
        body={body}
        rail={prediction ? <ImpactRailSummary prediction={prediction} riskScore={riskScore} maintGrade={maintGrade} serviceGrade={serviceGrade} /> : null}
        footer={null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(prediction)}
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
        right={prediction ? <ImpactRailSummary prediction={prediction} riskScore={riskScore} maintGrade={maintGrade} serviceGrade={serviceGrade} /> : null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * PredictionDetailPanel — canonical single-entity deep-review surface for
 * Module-4 Predictive Intelligence. Renders the complete operational profile
 * of one Prediction (RiskScore) entity across five coordinated content regions
 * using all available DetailLayout slots.
 *
 * This is the terminal drill-down destination when an operator selects a
 * specific prediction from a list, alert, or dashboard card.
 *
 * Content regions (DetailLayout slots):
 *
 *   Header slot  — entity identity: title, severity badge, time-to-failure
 *                  countdown, category, model source, live/stale pills.
 *
 *   Summary slot — key metrics: severity score meter, confidence gauge,
 *                  affected asset name, and predicted failure timestamp.
 *
 *   Body         — four stacked sections:
 *     1. Prediction Detail  — all core fields: severityBand, severityScore,
 *                            confidenceScore, confidenceBand, source, category,
 *                            computedAt, predictedFailureAt, description, summary
 *     2. Sensor Readings    — sensorReadings[] as condensed reading strip
 *     3. Mitigation Actions — mitigationActions[] / maintenanceAction checklist
 *     4. Cross-Domain Links — affectedTrainId (resolved), affectedAssetId,
 *                            linkedIncidentIds[], affectedRoutes[]
 *
 *   Rail slot    — prediction metadata: prediction ID, model source,
 *                  computedAt, predictedFailureAt, category, severity score,
 *                  confidence score, lastUpdatedAt.
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
 * - `thresholdSeverity` ('medium'|'high'|'critical') — the operator-configured
 *                    minimum breach severity to annotate (default: 'high')
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

const SEVERITY_CONFIG = {
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
};

function sevConfig(key) {
  return SEVERITY_CONFIG[String(key ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low;
}

function sevRank(k) { return sevConfig(k).rank; }

const HEALTH_CONFIG = {
  healthy:  { label: 'Healthy',  cssModifier: 'healthy'  },
  degraded: { label: 'Degraded', cssModifier: 'degraded' },
  critical: { label: 'Critical', cssModifier: 'critical' },
  offline:  { label: 'Offline',  cssModifier: 'offline'  },
};

function healthConfig(k) { return HEALTH_CONFIG[String(k ?? 'healthy').toLowerCase()] ?? HEALTH_CONFIG.healthy; }

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

function normConf(score) {
  if (score == null) return null;
  return score <= 1 ? score : score / 100;
}

function confPct(score) {
  const n = normConf(score);
  return n == null ? null : Math.round(n * 100);
}

function computeSevScore(p) {
  if (!p) return 0;
  if (typeof p.severityScore === 'number') {
    return p.severityScore <= 1 ? Math.round(p.severityScore * 100) : Math.min(100, Math.round(p.severityScore));
  }
  return Math.round((sevRank(p.severityBand) / 3) * 100);
}

function formatTTF(iso) {
  if (!iso) return null;
  try {
    const diff = Date.parse(iso) - Date.now();
    if (Number.isNaN(diff)) return null;
    if (diff < 0) return { label: 'Overdue', overdue: true };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    let label;
    if (h >= 24) label = `${Math.floor(h / 24)}d ${h % 24}h`;
    else if (h > 0) label = `${h}h ${m}m`;
    else label = `${m}m`;
    return { label: `T−${label}`, overdue: false };
  } catch { return null; }
}

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

function inferSensorHealth(r) {
  if (r.health) return String(r.health).toLowerCase();
  const v = Number(r.readingValue ?? 0);
  const t = Number(r.threshold ?? 0);
  if (t <= 0) return 'healthy';
  if (v >= t * 1.2) return 'critical';
  if (v >= t) return 'degraded';
  return 'healthy';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="prediction-detail-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ── Header slot ───────────────────────────────────────────────────────────
function EntityHeader({ prediction, isStale, syncing }) {
  const cfg    = sevConfig(prediction?.severityBand);
  const ttf    = formatTTF(prediction?.predictedFailureAt);

  return (
    <div className="prediction-detail-panel__entity-header" aria-label="Prediction entity header">
      <span className={`prediction-detail-panel__entity-severity prediction-detail-panel__entity-severity--${cfg.cssModifier}`}
        aria-label={`Severity: ${cfg.label}`}>
        <span aria-hidden="true">{cfg.icon}</span> {cfg.label}
      </span>
      {ttf && (
        <span className={`prediction-detail-panel__entity-ttf ${ttf.overdue ? 'prediction-detail-panel__entity-ttf--overdue' : ''}`}
          aria-label={`Time to failure: ${ttf.label}`}>
          {ttf.overdue ? '⚠ Overdue' : ttf.label}
        </span>
      )}
      {prediction?.category && (
        <span className="prediction-detail-panel__entity-category">{prediction.category}</span>
      )}
      {prediction?.source && (
        <span className="prediction-detail-panel__entity-source">{prediction.source}</span>
      )}
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
    </div>
  );
}

// ── Summary slot ──────────────────────────────────────────────────────────
function KeyMetricsSummary({ prediction, affectedTrain }) {
  const sevScore = computeSevScore(prediction);
  const conf     = confPct(prediction?.confidenceScore);
  const sevCfg   = sevConfig(prediction?.severityBand);
  const assetName = affectedTrain?.name ?? affectedTrain?.number ?? prediction?.affectedAssetId ?? prediction?.affectedTrainId ?? null;

  const confMod = conf == null ? null : conf >= 80 ? 'high' : conf >= 50 ? 'medium' : 'low';

  return (
    <div className="prediction-detail-panel__summary-grid" aria-label="Key prediction metrics">
      <div className={`prediction-detail-panel__summary-metric prediction-detail-panel__summary-metric--${sevCfg.cssModifier}`}
        aria-label={`Severity: ${sevCfg.label}`}>
        <span className="prediction-detail-panel__summary-value">{sevCfg.label}</span>
        <span className="prediction-detail-panel__summary-label">Severity</span>
        <div className="prediction-detail-panel__summary-bar"
          role="meter" aria-valuenow={sevScore} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Severity score: ${sevScore}%`} aria-hidden="true">
          <div className={`prediction-detail-panel__summary-bar-fill prediction-detail-panel__summary-bar-fill--${sevCfg.cssModifier}`}
            style={{ width: `${sevScore}%` }} />
        </div>
      </div>
      {conf != null && (
        <div className={`prediction-detail-panel__summary-metric prediction-detail-panel__summary-metric--conf-${confMod}`}
          aria-label={`Confidence: ${conf}%`}>
          <span className="prediction-detail-panel__summary-value">{conf}%</span>
          <span className="prediction-detail-panel__summary-label">Confidence</span>
        </div>
      )}
      {assetName && (
        <div className="prediction-detail-panel__summary-metric" aria-label={`Asset: ${assetName}`}>
          <span className="prediction-detail-panel__summary-value">{assetName}</span>
          <span className="prediction-detail-panel__summary-label">Affected Asset</span>
        </div>
      )}
      {prediction?.predictedFailureAt && (
        <div className="prediction-detail-panel__summary-metric" aria-label={`Predicted failure: ${formatWhen(prediction.predictedFailureAt)}`}>
          <span className="prediction-detail-panel__summary-value">{formatWhen(prediction.predictedFailureAt)}</span>
          <span className="prediction-detail-panel__summary-label">Predicted Failure</span>
        </div>
      )}
    </div>
  );
}

// ── Body Section 1: Prediction Detail ─────────────────────────────────────
function PredictionDetailSection({ prediction, thresholdSeverity, compact }) {
  const sevCfg   = sevConfig(prediction?.severityBand);
  const isBreached = sevRank(prediction?.severityBand) >= sevRank(thresholdSeverity);
  const confPctVal = confPct(prediction?.confidenceScore);
  const sevScore   = computeSevScore(prediction);

  return (
    <section className="prediction-detail-panel__section" aria-label="Prediction Detail">
      <h3 className="prediction-detail-panel__section-title">Prediction Detail</h3>
      <dl className="prediction-detail-panel__field-list">
        <dt>Severity</dt>
        <dd>
          <span className={`prediction-detail-panel__severity-chip prediction-detail-panel__severity-chip--${sevCfg.cssModifier}`}>
            {sevCfg.icon} {sevCfg.label}
          </span>
          {isBreached && <span className="prediction-detail-panel__breach-flag" role="status">Above Threshold</span>}
        </dd>
        {sevScore > 0 && <><dt>Severity Score</dt><dd>{sevScore}/100</dd></>}
        {confPctVal != null && <><dt>Confidence</dt><dd>{confPctVal}%</dd></>}
        {prediction?.confidenceBand && <><dt>Confidence Band</dt><dd>{prediction.confidenceBand}</dd></>}
        {prediction?.category && <><dt>Category</dt><dd>{prediction.category}</dd></>}
        {prediction?.source && <><dt>Model Source</dt><dd>{prediction.source}</dd></>}
        {prediction?.computedAt && <><dt>Computed At</dt><dd>{formatWhen(prediction.computedAt)}</dd></>}
        {prediction?.predictedFailureAt && <><dt>Predicted Failure</dt><dd>{formatWhen(prediction.predictedFailureAt)}</dd></>}
        {prediction?.description && <><dt>Description</dt><dd>{prediction.description}</dd></>}
        {!compact && prediction?.summary && <><dt>Summary</dt><dd>{prediction.summary}</dd></>}
      </dl>
    </section>
  );
}

// ── Body Section 2: Sensor Readings ───────────────────────────────────────
function SensorReadingsSection({ prediction, compact }) {
  const readings = useMemo(() => {
    const raw = Array.isArray(prediction?.sensorReadings) ? prediction.sensorReadings : [];
    return raw.map((r) => ({ ...r, _health: inferSensorHealth(r) }))
      .sort((a, b) => {
        const ranks = { critical: 3, offline: 2, degraded: 1, healthy: 0 };
        return (ranks[b._health] ?? 0) - (ranks[a._health] ?? 0);
      });
  }, [prediction?.sensorReadings]);

  if (readings.length === 0) return null;

  return (
    <section className="prediction-detail-panel__section" aria-label="Sensor Readings">
      <h3 className="prediction-detail-panel__section-title">
        Sensor Readings
        <span className="prediction-detail-panel__section-count">{readings.length}</span>
      </h3>
      <ul className="prediction-detail-panel__sensor-strip" aria-label={`${readings.length} sensor reading${readings.length !== 1 ? 's' : ''}`}>
        {readings.map((r, idx) => {
          const hcfg = healthConfig(r._health);
          return (
            <li key={r.sensorId ?? idx}
              className={`prediction-detail-panel__sensor-row prediction-detail-panel__sensor-row--${hcfg.cssModifier}`}
              role="listitem"
              aria-label={`${r.sensorId ?? `Sensor ${idx + 1}`}: ${r.readingValue ?? '—'}${r.unit ?? ''} — ${hcfg.label}`}>
              <span className="prediction-detail-panel__sensor-id">{r.sensorId ?? `Sensor ${idx + 1}`}</span>
              {r.sensorType && <span className="prediction-detail-panel__sensor-type">{r.sensorType}</span>}
              <span className="prediction-detail-panel__sensor-value">{r.readingValue ?? '—'}{r.unit ?? ''}</span>
              {!compact && r.threshold && <span className="prediction-detail-panel__sensor-thresh">/{r.threshold}{r.unit ?? ''}</span>}
              <span className={`prediction-detail-panel__sensor-health prediction-detail-panel__sensor-health--${hcfg.cssModifier}`}>
                {hcfg.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Body Section 3: Mitigation Actions ────────────────────────────────────
function MitigationActionsSection({ prediction }) {
  const actions = useMemo(() => {
    if (Array.isArray(prediction?.mitigationActions)) return prediction.mitigationActions;
    if (typeof prediction?.maintenanceAction === 'string') return [prediction.maintenanceAction];
    return [];
  }, [prediction?.mitigationActions, prediction?.maintenanceAction]);

  return (
    <section className="prediction-detail-panel__section" aria-label="Mitigation Actions">
      <h3 className="prediction-detail-panel__section-title">Mitigation Actions</h3>
      {actions.length === 0 ? (
        <div className="prediction-detail-panel__no-data" role="note">No mitigation actions specified.</div>
      ) : (
        <ol className="prediction-detail-panel__mitigation-list" aria-label="Recommended actions">
          {actions.map((a, idx) => (
            <li key={idx} className="prediction-detail-panel__mitigation-item">
              <span className="prediction-detail-panel__mitigation-num" aria-hidden="true">{idx + 1}</span>
              <span className="prediction-detail-panel__mitigation-text">{a}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Body Section 4: Cross-Domain Links ────────────────────────────────────
function CrossDomainLinksSection({ prediction, affectedTrain, compact }) {
  const linkedIncidentIds = useMemo(() => {
    const arr = Array.isArray(prediction?.linkedIncidentIds) ? prediction.linkedIncidentIds : [];
    const arr2 = Array.isArray(prediction?.incidentIds) ? prediction.incidentIds : [];
    const seen = new Set();
    return [...arr, ...arr2].filter((id) => { if (seen.has(id)) return false; seen.add(id); return true; });
  }, [prediction?.linkedIncidentIds, prediction?.incidentIds]);

  const affectedRoutes = Array.isArray(prediction?.affectedRoutes) ? prediction.affectedRoutes : [];
  const assetName = affectedTrain?.name ?? affectedTrain?.number ?? null;

  const hasAny = prediction?.affectedTrainId || prediction?.affectedAssetId || linkedIncidentIds.length > 0 || affectedRoutes.length > 0;
  if (!hasAny) return null;

  return (
    <section className="prediction-detail-panel__section prediction-detail-panel__section--crossdomain" aria-label="Cross-Domain References">
      <h3 className="prediction-detail-panel__section-title">Cross-Domain References</h3>

      {prediction?.affectedTrainId && (
        <div className="prediction-detail-panel__crossdomain-group">
          <div className="prediction-detail-panel__crossdomain-label">Affected Train</div>
          <div className="prediction-detail-panel__crossdomain-value">
            {assetName ? `${assetName} (${prediction.affectedTrainId})` : prediction.affectedTrainId}
          </div>
          <div className="prediction-detail-panel__crossdomain-note" role="note">Resolve via Train Operations module.</div>
        </div>
      )}

      {prediction?.affectedAssetId && prediction.affectedAssetId !== prediction?.affectedTrainId && (
        <div className="prediction-detail-panel__crossdomain-group">
          <div className="prediction-detail-panel__crossdomain-label">Asset Component</div>
          <div className="prediction-detail-panel__crossdomain-value">{prediction.affectedAssetId}</div>
        </div>
      )}

      {linkedIncidentIds.length > 0 && (
        <div className="prediction-detail-panel__crossdomain-group">
          <div className="prediction-detail-panel__crossdomain-label">Linked Incidents ({linkedIncidentIds.length})</div>
          <div className="prediction-detail-panel__crossdomain-ids" role="list">
            {linkedIncidentIds.slice(0, 6).map((id) => (
              <span key={id} className="prediction-detail-panel__crossdomain-id" role="listitem">{id}</span>
            ))}
            {linkedIncidentIds.length > 6 && (
              <span className="prediction-detail-panel__crossdomain-id prediction-detail-panel__crossdomain-id--overflow">
                +{linkedIncidentIds.length - 6}
              </span>
            )}
          </div>
          <div className="prediction-detail-panel__crossdomain-note" role="note">Resolve via Incident Response module.</div>
        </div>
      )}

      {!compact && affectedRoutes.length > 0 && (
        <div className="prediction-detail-panel__crossdomain-group">
          <div className="prediction-detail-panel__crossdomain-label">Affected Routes</div>
          <div className="prediction-detail-panel__crossdomain-ids" role="list">
            {affectedRoutes.map((r, idx) => (
              <span key={idx} className="prediction-detail-panel__crossdomain-id" role="listitem">
                {typeof r === 'string' ? r : r.name ?? r.id ?? `Route ${idx + 1}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Rail slot — prediction metadata ───────────────────────────────────────
function PredictionMetadataRail({ prediction }) {
  const sevScore = computeSevScore(prediction);
  const confPctVal = confPct(prediction?.confidenceScore);

  return (
    <div className="prediction-detail-panel__rail" aria-label="Prediction metadata">
      <div className="prediction-detail-panel__rail-title">Prediction Metadata</div>
      <dl className="prediction-detail-panel__rail-dl">
        {prediction?.id && <><dt>Prediction ID</dt><dd className="prediction-detail-panel__rail-id">{prediction.id}</dd></>}
        {prediction?.source && <><dt>Model Source</dt><dd>{prediction.source}</dd></>}
        {prediction?.category && <><dt>Category</dt><dd>{prediction.category}</dd></>}
        {sevScore > 0 && <><dt>Severity Score</dt><dd>{sevScore}/100</dd></>}
        {confPctVal != null && <><dt>Confidence</dt><dd>{confPctVal}%</dd></>}
        {prediction?.computedAt && <><dt>Computed At</dt><dd>{formatWhen(prediction.computedAt)}</dd></>}
        {prediction?.predictedFailureAt && <><dt>Failure Predicted</dt><dd>{formatWhen(prediction.predictedFailureAt)}</dd></>}
        {prediction?.lastUpdatedAt && <><dt>Last Updated</dt><dd>{formatWhen(prediction.lastUpdatedAt)}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionDetailPanel({
  predictionId       = null,
  prediction: pProp  = null,
  layout             = null,
  title              = null,
  staleThreshold     = 60000,
  thresholdSeverity  = 'high',
  compact            = false,
  onRetry            = null,
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const isEmpty       = !prediction && !loading;
  const resolvedTitle = title
    ?? (prediction?.title ?? prediction?.name ?? (prediction ? 'Prediction Detail' : 'No Prediction'));

  const headerSlot  = prediction ? <EntityHeader prediction={prediction} isStale={isStale} syncing={syncing} /> : null;
  const summarySlot = prediction ? <KeyMetricsSummary prediction={prediction} affectedTrain={affectedTrain} /> : null;
  const railSlot    = prediction ? <PredictionMetadataRail prediction={prediction} /> : null;

  const body = (
    <div
      className={[
        'prediction-detail-panel',
        compact ? 'prediction-detail-panel--compact' : null,
        isStale ? 'prediction-detail-panel--stale'   : null,
        error   ? 'prediction-detail-panel--error'   : null,
        syncing ? 'prediction-detail-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && (
        <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
      )}

      {isEmpty ? (
        <div className="prediction-detail-panel__empty" role="status">No prediction selected.</div>
      ) : (
        <>
          <PredictionDetailSection
            prediction={prediction}
            thresholdSeverity={thresholdSeverity}
            compact={compact}
          />
          <SensorReadingsSection prediction={prediction} compact={compact} />
          <MitigationActionsSection prediction={prediction} />
          <CrossDomainLinksSection prediction={prediction} affectedTrain={affectedTrain} compact={compact} />
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
        rail={railSlot}
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

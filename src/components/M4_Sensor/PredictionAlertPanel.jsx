import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * PredictionAlertPanel — canonical alert surface for M4 Predictive
 * Intelligence. Synthesises actionable alert conditions exclusively from
 * the Prediction (RiskScore) domain model fields — no alert store imported.
 *
 * Eight alert conditions derived from domain fields:
 *
 *   1. Critical Failure Imminent  — severityBand: 'critical' + predictedFailureAt
 *                                  within next 2 hours → critical
 *   2. Overdue Failure Window     — predictedFailureAt < now → critical
 *   3. Critical Severity          — severityBand: 'critical' (no failure window) → critical
 *   4. High Severity              — severityBand: 'high' → high
 *   5. Critical Sensor Reading    — sensorReadings[] with health: 'critical' → high
 *   6. Maintenance Required       — maintenanceAction / maintenanceRecommended → high
 *   7. Low Confidence             — confidenceScore < 0.5 on high/critical severity → medium
 *   8. Medium Severity            — severityBand: 'medium' → low (informational)
 *
 * Two modes:
 *   Single-asset mode (predictionId / prediction supplied): all alerts for anchor.
 *   Network mode: worst alert per asset across all visible predictions.
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/riskStore`  (Zustand — read-only)
 * - `src/store/trainStore` (Zustand — read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `predictionId`   (string|null)  (default: null → network mode)
 * - `prediction`     (object|null)  (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `staleThreshold` (number)       (default: 60000)
 * - `minSeverity`    ('low'|'medium'|'high'|'critical') (default: 'low')
 * - `maxRows`        (number)       (default: 20)
 * - `compact`        (boolean)      (default: false)
 * - `onAlertDismiss` (fn|null)      — callback with alert (no store write)
 * - `onAssetSelect`  (fn|null)      — callback with Prediction on row click
 * - `onRetry`        (fn|null)      (default: null)
 *
 * State (derived from store selectors only — zero mutations):
 * - riskStore: `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`,
 *              `getRiskScoreById`, `getSelectedRiskScore`, `getVisibleRiskScores`
 * - trainStore: `getTrainById`
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEVERITY_CFG = {
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
};

function sevCfg(k) { return SEVERITY_CFG[String(k ?? 'low').toLowerCase()] ?? SEVERITY_CFG.low; }
function sevRank(k) { return sevCfg(k).rank; }

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function normaliseConf(score) {
  if (score == null) return null;
  return score <= 1 ? score : score / 100;
}

// ---------------------------------------------------------------------------
// Alert synthesis
// ---------------------------------------------------------------------------

function inferSensorCritical(p) {
  const readings = Array.isArray(p.sensorReadings) ? p.sensorReadings : [];
  return readings.some((r) => String(r.health ?? '').toLowerCase() === 'critical');
}

function deriveAlerts(p, getTrainById) {
  if (!p) return [];
  const alerts  = [];
  const now     = Date.now();
  const band    = String(p.severityBand ?? 'low').toLowerCase();
  const bRank   = sevRank(band);
  const conf    = normaliseConf(p.confidenceScore);
  const failAt  = p.predictedFailureAt ? Date.parse(p.predictedFailureAt) : null;
  const train   = p.affectedTrainId ? (typeof getTrainById === 'function' ? getTrainById(p.affectedTrainId) : null) : null;
  const assetName = train?.name ?? train?.number ?? p.affectedAssetId ?? p.affectedTrainId ?? p.id;

  // 1. Critical failure imminent (≤2h)
  if (failAt != null && failAt > now && failAt - now <= TWO_HOURS_MS && band === 'critical') {
    const h = Math.floor((failAt - now) / 3600000);
    const m = Math.floor(((failAt - now) % 3600000) / 60000);
    alerts.push({ key: `imminent-${p.id}`, severity: 'critical', category: 'imminent',
      title: 'Critical Failure Imminent',
      detail: `Asset ${assetName} — failure predicted in ${h}h ${m}m. Immediate action required.`,
      assetName, prediction: p });
  }

  // 2. Overdue failure window
  if (failAt != null && failAt < now) {
    alerts.push({ key: `overdue-${p.id}`, severity: 'critical', category: 'overdue',
      title: 'Overdue Failure Window',
      detail: `Asset ${assetName} — predicted failure window has passed. Inspect immediately.`,
      assetName, prediction: p });
  }

  // 3. Critical severity (no failure window or far out)
  if (band === 'critical' && !alerts.find((a) => a.category === 'imminent' || a.category === 'overdue')) {
    alerts.push({ key: `critical-${p.id}`, severity: 'critical', category: 'severity',
      title: 'Critical Risk Detected',
      detail: `Asset ${assetName}: ${p.title ?? p.name ?? p.id}.`,
      assetName, prediction: p });
  }

  // 4. High severity
  if (band === 'high') {
    alerts.push({ key: `high-${p.id}`, severity: 'high', category: 'severity',
      title: 'High Risk Prediction',
      detail: `Asset ${assetName}: ${p.title ?? p.name ?? p.id}.`,
      assetName, prediction: p });
  }

  // 5. Critical sensor reading
  if (inferSensorCritical(p)) {
    alerts.push({ key: `sensor-critical-${p.id}`, severity: 'high', category: 'sensor',
      title: 'Critical Sensor Reading',
      detail: `One or more sensors on asset ${assetName} are in critical health.`,
      assetName, prediction: p });
  }

  // 6. Maintenance required
  if (p.maintenanceAction || p.maintenanceRecommended) {
    alerts.push({ key: `maintenance-${p.id}`, severity: 'high', category: 'maintenance',
      title: 'Maintenance Required',
      detail: typeof p.maintenanceAction === 'string' ? p.maintenanceAction : `Maintenance recommended for ${assetName}.`,
      assetName, prediction: p });
  }

  // 7. Low confidence on high/critical
  if (conf != null && conf < 0.5 && bRank >= 2) {
    alerts.push({ key: `lowconf-${p.id}`, severity: 'medium', category: 'confidence',
      title: 'Low Model Confidence',
      detail: `Confidence is ${Math.round(conf * 100)}% for a ${band} severity prediction on ${assetName}. Verify before acting.`,
      assetName, prediction: p });
  }

  // 8. Medium severity
  if (band === 'medium') {
    alerts.push({ key: `medium-${p.id}`, severity: 'low', category: 'severity',
      title: 'Medium Risk Prediction',
      detail: `Asset ${assetName}: ${p.title ?? p.name ?? p.id}.`,
      assetName, prediction: p });
  }

  return alerts.sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="prediction-alert-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function AlertRow({ alert, compact, onAlertDismiss, rowId }) {
  const cfg = sevCfg(alert.severity);
  const canDismiss = typeof onAlertDismiss === 'function';
  return (
    <li id={rowId}
      className={[
        'prediction-alert-panel__alert-row',
        `prediction-alert-panel__alert-row--${cfg.cssModifier}`,
        `prediction-alert-panel__alert-row--${alert.category}`,
        compact ? 'prediction-alert-panel__alert-row--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${cfg.label}: ${alert.title} — ${alert.assetName}`}
    >
      <span className={`prediction-alert-panel__alert-icon prediction-alert-panel__alert-icon--${cfg.cssModifier}`} aria-hidden="true">{cfg.icon}</span>
      <div className="prediction-alert-panel__alert-body">
        <div className="prediction-alert-panel__alert-header">
          <span className="prediction-alert-panel__alert-title">{alert.title}</span>
          <span className={`prediction-alert-panel__alert-badge prediction-alert-panel__alert-badge--${cfg.cssModifier}`}>{cfg.label}</span>
        </div>
        {!compact && alert.detail && <div className="prediction-alert-panel__alert-detail">{alert.detail}</div>}
      </div>
      {canDismiss && (
        <button type="button" className="prediction-alert-panel__alert-dismiss"
          aria-label={`Dismiss: ${alert.title}`}
          onClick={() => onAlertDismiss(alert)}>×</button>
      )}
    </li>
  );
}

function NetworkRow({ entry, compact, onAssetSelect, rowId }) {
  const { prediction, worst } = entry;
  const cfg        = sevCfg(worst.severity);
  const isClickable = typeof onAssetSelect === 'function';
  return (
    <li id={rowId}
      className={[
        'prediction-alert-panel__network-row',
        `prediction-alert-panel__network-row--${cfg.cssModifier}`,
        isClickable ? 'prediction-alert-panel__network-row--clickable' : null,
        compact ? 'prediction-alert-panel__network-row--compact' : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'listitem'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`${worst.assetName}: ${worst.title} — ${cfg.label}`}
      onClick={isClickable ? () => onAssetSelect(prediction) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAssetSelect(prediction); } } : undefined}
    >
      <span className={`prediction-alert-panel__network-icon prediction-alert-panel__network-icon--${cfg.cssModifier}`} aria-hidden="true">{cfg.icon}</span>
      <span className="prediction-alert-panel__network-asset">{worst.assetName}</span>
      <span className="prediction-alert-panel__network-title">{worst.title}</span>
      <span className={`prediction-alert-panel__network-badge prediction-alert-panel__network-badge--${cfg.cssModifier}`}>{cfg.label}</span>
    </li>
  );
}

function AlertSummaryRail({ alerts }) {
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCat = {};
  for (const a of alerts) {
    if (bySev[a.severity] != null) bySev[a.severity] += 1;
    byCat[a.category] = (byCat[a.category] ?? 0) + 1;
  }
  return (
    <div className="prediction-alert-panel__rail" aria-label="Alert summary">
      <div className="prediction-alert-panel__rail-title">Alert Summary</div>
      <div className="prediction-alert-panel__rail-severity" role="list">
        {Object.entries(SEVERITY_CFG).sort((a, b) => b[1].rank - a[1].rank).map(([k, c]) => (
          <div key={k} className={`prediction-alert-panel__rail-sev prediction-alert-panel__rail-sev--${c.cssModifier}`} role="listitem"
            aria-label={`${c.label}: ${bySev[k]}`}>
            <span aria-hidden="true">{c.icon}</span><span>{c.label}</span>
            <span className="prediction-alert-panel__rail-sev-count">{bySev[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionAlertPanel({
  predictionId      = null,
  prediction: pProp = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  minSeverity       = 'low',
  maxRows           = 20,
  compact           = false,
  onAlertDismiss    = null,
  onAssetSelect     = null,
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
  const getVisibleRiskScores = useRiskStore((s) =>
    typeof s.getVisibleRiskScores === 'function' ? s.getVisibleRiskScores : null,
  );
  const getTrainById = useTrainStore((s) => s.getTrainById);

  const anchor = useMemo(() => pProp ?? predFromStore ?? null, [pProp, predFromStore]);

  const allPredictions = useMemo(() => {
    try { return getVisibleRiskScores ? getVisibleRiskScores() : []; }
    catch { return []; }
  }, [getVisibleRiskScores]);

  const isNetworkMode = !predictionId && !pProp;
  const minRank = sevRank(minSeverity);

  // ── Single-asset alerts ───────────────────────────────────────────────────
  const singleAlerts = useMemo(() => {
    if (isNetworkMode) return [];
    const assetKey = anchor?.affectedTrainId ?? anchor?.affectedAssetId ?? anchor?.id;
    const scoped = assetKey
      ? allPredictions.filter((p) => (p.affectedTrainId ?? p.affectedAssetId ?? p.id) === assetKey)
      : anchor ? [anchor] : [];

    const all = scoped.flatMap((p) => deriveAlerts(p, getTrainById));
    const seen = {};
    for (const a of all) {
      const baseKey = a.key.replace(/-[^-]+$/, '');
      if (!seen[baseKey] || sevRank(a.severity) > sevRank(seen[baseKey].severity)) seen[baseKey] = a;
    }
    return Object.values(seen).filter((a) => sevRank(a.severity) >= minRank)
      .sort((a, b) => sevRank(b.severity) - sevRank(a.severity)).slice(0, maxRows);
  }, [isNetworkMode, anchor, allPredictions, getTrainById, minRank, maxRows]);

  // ── Network alert board ───────────────────────────────────────────────────
  const networkEntries = useMemo(() => {
    if (!isNetworkMode) return [];
    const assetMap = {};
    for (const p of allPredictions) {
      const assetKey = p.affectedTrainId ?? p.affectedAssetId ?? p.id;
      const alerts   = deriveAlerts(p, getTrainById);
      if (alerts.length === 0) continue;
      const worst = alerts[0];
      if (sevRank(worst.severity) < minRank) continue;
      if (!assetMap[assetKey] || sevRank(worst.severity) > sevRank(assetMap[assetKey].worst.severity)) {
        assetMap[assetKey] = { prediction: p, worst };
      }
    }
    return Object.values(assetMap)
      .sort((a, b) => sevRank(b.worst.severity) - sevRank(a.worst.severity))
      .slice(0, maxRows);
  }, [isNetworkMode, allPredictions, getTrainById, minRank, maxRows]);

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchor?.lastUpdatedAt ? Date.parse(anchor.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchor, staleThreshold]);

  const isEmpty       = (isNetworkMode ? networkEntries.length === 0 : singleAlerts.length === 0) && !loading;
  const resolvedTitle = title ?? (isNetworkMode ? 'Network Prediction Alerts' : 'Prediction Alerts');
  const listId        = useId();
  const railAlerts    = isNetworkMode ? networkEntries.map((e) => e.worst) : singleAlerts;

  const body = (
    <div
      className={[
        'prediction-alert-panel',
        isNetworkMode ? 'prediction-alert-panel--network' : 'prediction-alert-panel--single',
        compact ? 'prediction-alert-panel--compact' : null,
        isStale ? 'prediction-alert-panel--stale'   : null,
        error   ? 'prediction-alert-panel--error'   : null,
        syncing ? 'prediction-alert-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="prediction-alert-panel__empty" role="status">No prediction alerts.</div>
      ) : isNetworkMode ? (
        <ol id={listId} className="prediction-alert-panel__network-list"
          aria-label={`${networkEntries.length} asset${networkEntries.length !== 1 ? 's' : ''} with alerts`}>
          {networkEntries.map((entry) => (
            <NetworkRow key={entry.prediction.id}
              rowId={`${listId}-net-${entry.prediction.id}`}
              entry={entry} compact={compact} onAssetSelect={onAssetSelect} />
          ))}
        </ol>
      ) : (
        <>
          <div className="prediction-alert-panel__count">{singleAlerts.length} alert{singleAlerts.length !== 1 ? 's' : ''}</div>
          <ul id={listId} className="prediction-alert-panel__alert-list"
            aria-label={`${singleAlerts.length} prediction alerts`}>
            {singleAlerts.map((alert) => (
              <AlertRow key={alert.key}
                rowId={`${listId}-${alert.key}`}
                alert={alert} compact={compact} onAlertDismiss={onAlertDismiss} />
            ))}
          </ul>
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={
          <div className="prediction-alert-panel__detail-summary">
            {isNetworkMode ? networkEntries.length : singleAlerts.length} alert{(isNetworkMode ? networkEntries.length : singleAlerts.length) !== 1 ? 's' : ''}
            <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
          </div>
        }
        body={body}
        rail={<AlertSummaryRail alerts={railAlerts} />}
        footer={null}
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
        header={null}
        left={body}
        right={<AlertSummaryRail alerts={railAlerts} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

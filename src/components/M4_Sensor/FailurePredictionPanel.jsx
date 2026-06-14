import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * FailurePredictionPanel — deep-review surface for predicted failure events
 * derived from the Prediction (RiskScore) domain model. Renders:
 *
 *   1. Failure Horizon Strip  — visual timeline of predicted failure windows
 *                             ordered by `predictedFailureAt` ascending; each
 *                             entry shows asset identity, time-to-failure
 *                             countdown, severity, and maintenance action.
 *
 *   2. Overdue Failures       — predictions where `predictedFailureAt` < now
 *                             that have not been cleared; shown as critical
 *                             attention items.
 *
 *   3. Maintenance Schedule   — predictions with `maintenanceAction` or
 *                             `maintenanceRecommended: true`, ordered by
 *                             urgency (time-to-failure ascending).
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
 * - `predictionId`   (string|null)  (default: null)
 * - `prediction`     (object|null)  (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `staleThreshold` (number)       (default: 60000)
 * - `maxItems`       (number)       — max horizon items (default: 15)
 * - `compact`        (boolean)      (default: false)
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

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
  medium:   { label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { label: 'Critical', cssModifier: 'critical', icon: '✕' },
};

function severityConfig(key) {
  return SEVERITY_CONFIG[String(key ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="failure-prediction-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function HorizonRow({ p, assetName, compact, rowId }) {
  const sevCfg = severityConfig(p.severityBand);
  const ttf    = formatTTF(p.predictedFailureAt);

  return (
    <li
      id={rowId}
      className={[
        'failure-prediction-panel__horizon-row',
        `failure-prediction-panel__horizon-row--${sevCfg.cssModifier}`,
        ttf?.overdue ? 'failure-prediction-panel__horizon-row--overdue' : null,
        compact ? 'failure-prediction-panel__horizon-row--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${assetName}: ${p.title ?? p.name ?? p.id} — ${ttf?.label ?? 'no failure window'} — ${sevCfg.label}`}
    >
      <div className="failure-prediction-panel__horizon-ttf">
        {ttf ? (
          <span className={ttf.overdue ? 'failure-prediction-panel__horizon-overdue' : ''}>
            {ttf.overdue ? '⚠ Overdue' : ttf.label}
          </span>
        ) : '—'}
      </div>
      <div className="failure-prediction-panel__horizon-identity">
        <span className="failure-prediction-panel__horizon-asset">{assetName}</span>
        <span className="failure-prediction-panel__horizon-title">{p.title ?? p.name ?? p.id}</span>
      </div>
      {!compact && p.category && (
        <span className="failure-prediction-panel__horizon-category">{p.category}</span>
      )}
      <span className={`failure-prediction-panel__horizon-badge failure-prediction-panel__horizon-badge--${sevCfg.cssModifier}`}>
        {sevCfg.label}
      </span>
      {!compact && p.predictedFailureAt && (
        <div className="failure-prediction-panel__horizon-when">{formatWhen(p.predictedFailureAt)}</div>
      )}
    </li>
  );
}

function MaintenanceScheduleRail({ items }) {
  return (
    <div className="failure-prediction-panel__rail" aria-label="Maintenance schedule">
      <div className="failure-prediction-panel__rail-title">Maintenance Schedule</div>
      {items.length === 0 ? (
        <div className="failure-prediction-panel__rail-empty">No maintenance recommendations.</div>
      ) : (
        <ol className="failure-prediction-panel__rail-list">
          {items.slice(0, 8).map((p, idx) => {
            const ttf = formatTTF(p.predictedFailureAt);
            return (
              <li key={p.id} className="failure-prediction-panel__rail-row">
                <span className="failure-prediction-panel__rail-num">{idx + 1}</span>
                <span className="failure-prediction-panel__rail-name">{p.title ?? p.name ?? p.id}</span>
                {ttf && <span className="failure-prediction-panel__rail-ttf">{ttf.label}</span>}
                {typeof p.maintenanceAction === 'string' && (
                  <div className="failure-prediction-panel__rail-action">{p.maintenanceAction}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function FailurePredictionPanel({
  predictionId      = null,
  prediction: pProp = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  maxItems          = 15,
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
  const getVisibleRiskScores = useRiskStore((s) =>
    typeof s.getVisibleRiskScores === 'function' ? s.getVisibleRiskScores : null,
  );
  const getTrainById = useTrainStore((s) => s.getTrainById);

  // ── Data ─────────────────────────────────────────────────────────────────
  const anchor = useMemo(() => pProp ?? predFromStore ?? null, [pProp, predFromStore]);

  const allPredictions = useMemo(() => {
    try { return getVisibleRiskScores ? getVisibleRiskScores() : []; }
    catch { return []; }
  }, [getVisibleRiskScores]);

  const scopedPredictions = useMemo(() => {
    if (!predictionId && !pProp) return allPredictions;
    const assetKey = anchor?.affectedTrainId ?? anchor?.affectedAssetId ?? anchor?.id;
    if (!assetKey) return anchor ? [anchor] : [];
    return allPredictions.filter((p) =>
      (p.affectedTrainId ?? p.affectedAssetId ?? p.id) === assetKey,
    );
  }, [predictionId, pProp, allPredictions, anchor]);

  const resolveAssetName = (p) => {
    const train = p.affectedTrainId ? (typeof getTrainById === 'function' ? getTrainById(p.affectedTrainId) : null) : null;
    return train?.name ?? train?.number ?? p.affectedAssetId ?? p.affectedTrainId ?? p.id;
  };

  // Predictions with a failure window, sorted by predictedFailureAt asc
  const horizonItems = useMemo(() =>
    scopedPredictions
      .filter((p) => p.predictedFailureAt)
      .sort((a, b) => String(a.predictedFailureAt).localeCompare(String(b.predictedFailureAt)))
      .slice(0, maxItems),
  [scopedPredictions, maxItems]);

  const now = Date.now();
  const overdueItems = useMemo(() =>
    horizonItems.filter((p) => Date.parse(p.predictedFailureAt) < now),
  [horizonItems]);

  const maintenanceItems = useMemo(() =>
    scopedPredictions
      .filter((p) => p.maintenanceAction || p.maintenanceRecommended)
      .sort((a, b) => String(a.predictedFailureAt ?? '').localeCompare(String(b.predictedFailureAt ?? ''))),
  [scopedPredictions]);

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchor?.lastUpdatedAt ? Date.parse(anchor.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchor, staleThreshold]);

  const isEmpty       = horizonItems.length === 0 && !loading;
  const resolvedTitle = title ?? 'Failure Predictions';
  const listId        = useId();

  const body = (
    <div
      className={[
        'failure-prediction-panel',
        compact ? 'failure-prediction-panel--compact' : null,
        isStale ? 'failure-prediction-panel--stale'   : null,
        error   ? 'failure-prediction-panel--error'   : null,
        syncing ? 'failure-prediction-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {overdueItems.length > 0 && (
        <div className="failure-prediction-panel__overdue-banner" role="alert"
          aria-label={`${overdueItems.length} overdue failure window${overdueItems.length !== 1 ? 's' : ''}`}>
          <span aria-hidden="true">⚠</span>
          {overdueItems.length} overdue failure window{overdueItems.length !== 1 ? 's' : ''} — immediate attention required
        </div>
      )}

      {isEmpty ? (
        <div className="failure-prediction-panel__empty" role="status">
          {scopedPredictions.length > 0
            ? 'No failure windows predicted in current scope.'
            : 'No prediction data available.'}
        </div>
      ) : (
        <ol id={listId} className="failure-prediction-panel__horizon-list"
          aria-label={`${horizonItems.length} failure prediction${horizonItems.length !== 1 ? 's' : ''} by urgency`}>
          {horizonItems.map((p, idx) => (
            <HorizonRow
              key={p.id}
              rowId={`${listId}-horizon-${p.id}`}
              p={p}
              assetName={resolveAssetName(p)}
              compact={compact}
            />
          ))}
        </ol>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={
          <div className="failure-prediction-panel__detail-summary">
            {horizonItems.length} failure window{horizonItems.length !== 1 ? 's' : ''}
            {overdueItems.length > 0 && <span className="failure-prediction-panel__detail-overdue">{overdueItems.length} overdue</span>}
            <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />
          </div>
        }
        body={body}
        rail={<MaintenanceScheduleRail items={maintenanceItems} />}
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
        right={<MaintenanceScheduleRail items={maintenanceItems} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

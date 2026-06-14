import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * PredictionTimeline — chronological event log for M4 Predictive Intelligence.
 * Synthesises timeline events from the Prediction domain model fields:
 *
 *   1. Prediction Issued   — every visible prediction entry with `computedAt`
 *   2. Severity Escalation — consecutive predictions for the same asset where
 *                           `severityBand` rank increased
 *   3. Confidence Change   — significant confidence delta (≥ 15 pp) between
 *                           consecutive predictions for the same asset
 *   4. Overdue Crossing    — predictions where `predictedFailureAt` < now
 *   5. Maintenance Trigger — predictions with `maintenanceAction` or
 *                           `maintenanceRecommended: true`
 *
 * Supports DetailLayout (primary) and SplitPanelLayout (secondary).
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/riskStore`  (Zustand — read-only)
 * - `src/store/trainStore` (Zustand — read-only; asset name resolution)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `predictionId`   (string|null)  — anchor prediction; scopes to that asset
 *                    (default: null → show all assets)
 * - `prediction`     (object|null)  — direct override (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `staleThreshold` (number)       (default: 60000)
 * - `filter`         (string[])     — event type filter; empty = all
 *                    (default: [])
 * - `maxEvents`      (number)       — max rendered events (default: 50)
 * - `compact`        (boolean)      (default: false)
 * - `onRetry`        (fn|null)      (default: null)
 *
 * State (derived from store selectors only — zero mutations):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getRiskScoreById`, `getSelectedRiskScore`, `getVisibleRiskScores`
 * - `getTrainById` from trainStore
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
function sevRank(k) { return SEVERITY_RANK[String(k ?? 'low').toLowerCase()] ?? 0; }

const EVENT_TYPE_CONFIG = {
  issued:      { label: 'Prediction Issued',   icon: '◉', cssModifier: 'issued'      },
  escalation:  { label: 'Severity Escalated',  icon: '▲', cssModifier: 'escalation'  },
  confidence:  { label: 'Confidence Changed',  icon: '◔', cssModifier: 'confidence'  },
  overdue:     { label: 'Overdue',             icon: '✕', cssModifier: 'overdue'     },
  maintenance: { label: 'Maintenance Trigger', icon: '⚙', cssModifier: 'maintenance' },
};

function eventConfig(type) {
  return EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.issued;
}

// ---------------------------------------------------------------------------
// Event synthesis
// ---------------------------------------------------------------------------

function synthesiseEvents(predictions, getTrainById) {
  const now = Date.now();
  const events = [];

  // Sort newest first for escalation detection, then reverse for display
  const sorted = [...predictions].sort((a, b) =>
    String(a.computedAt ?? '').localeCompare(String(b.computedAt ?? '')),
  );

  // Group by assetKey for consecutive comparisons
  const byAsset = {};
  for (const p of sorted) {
    const key = p.affectedTrainId ?? p.affectedAssetId ?? p.id;
    if (!byAsset[key]) byAsset[key] = [];
    byAsset[key].push(p);
  }

  for (const p of sorted) {
    const assetKey  = p.affectedTrainId ?? p.affectedAssetId ?? p.id;
    const train     = p.affectedTrainId ? (typeof getTrainById === 'function' ? getTrainById(p.affectedTrainId) : null) : null;
    const assetName = train?.name ?? train?.number ?? p.affectedAssetId ?? p.affectedTrainId ?? assetKey;
    const ts        = p.computedAt ?? null;

    // 1. Prediction Issued
    events.push({
      key:       `issued-${p.id}`,
      type:      'issued',
      ts,
      assetKey,
      assetName,
      title:     `Prediction issued — ${p.title ?? p.name ?? p.id}`,
      detail:    p.source ? `Source: ${p.source}` : null,
      severity:  p.severityBand ?? 'low',
      prediction: p,
    });

    // 2. Severity escalation (compare to previous prediction for same asset)
    const assetPreds = byAsset[assetKey];
    const pIdx = assetPreds.indexOf(p);
    if (pIdx > 0) {
      const prev = assetPreds[pIdx - 1];
      const prevRank = sevRank(prev.severityBand);
      const currRank = sevRank(p.severityBand);
      if (currRank > prevRank) {
        events.push({
          key:       `escalation-${p.id}`,
          type:      'escalation',
          ts,
          assetKey,
          assetName,
          title:     `Severity escalated: ${String(prev.severityBand ?? 'low')} → ${String(p.severityBand ?? 'high')}`,
          detail:    null,
          severity:  p.severityBand ?? 'high',
          prediction: p,
        });
      }

      // 3. Confidence change ≥ 15pp
      const prevConf = prev.confidenceScore != null ? (prev.confidenceScore <= 1 ? prev.confidenceScore * 100 : prev.confidenceScore) : null;
      const currConf = p.confidenceScore    != null ? (p.confidenceScore    <= 1 ? p.confidenceScore    * 100 : p.confidenceScore)    : null;
      if (prevConf != null && currConf != null && Math.abs(currConf - prevConf) >= 15) {
        events.push({
          key:       `confidence-${p.id}`,
          type:      'confidence',
          ts,
          assetKey,
          assetName,
          title:     `Confidence: ${Math.round(prevConf)}% → ${Math.round(currConf)}%`,
          detail:    null,
          severity:  p.severityBand ?? 'low',
          prediction: p,
        });
      }
    }

    // 4. Overdue crossing
    const failAt = p.predictedFailureAt ? Date.parse(p.predictedFailureAt) : null;
    if (failAt != null && failAt < now) {
      events.push({
        key:       `overdue-${p.id}`,
        type:      'overdue',
        ts:        p.predictedFailureAt,
        assetKey,
        assetName,
        title:     `Predicted failure window passed`,
        detail:    p.maintenanceAction ? `Action: ${p.maintenanceAction}` : null,
        severity:  'critical',
        prediction: p,
      });
    }

    // 5. Maintenance trigger
    if (p.maintenanceAction || p.maintenanceRecommended) {
      events.push({
        key:       `maintenance-${p.id}`,
        type:      'maintenance',
        ts,
        assetKey,
        assetName,
        title:     `Maintenance recommended`,
        detail:    typeof p.maintenanceAction === 'string' ? p.maintenanceAction : null,
        severity:  p.severityBand ?? 'medium',
        prediction: p,
      });
    }
  }

  // Sort newest first
  return events.sort((a, b) => String(b.ts ?? '').localeCompare(String(a.ts ?? '')));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="prediction-timeline__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EventRow({ event, compact, rowId }) {
  const cfg = eventConfig(event.type);
  const d   = event.ts ? new Date(event.ts) : null;
  const timeStr = d && !Number.isNaN(d.getTime())
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;
  const dateStr = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <li
      id={rowId}
      className={[
        'prediction-timeline__event',
        `prediction-timeline__event--${cfg.cssModifier}`,
        compact ? 'prediction-timeline__event--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${cfg.label}: ${event.title} at ${event.assetName}`}
    >
      <div className="prediction-timeline__event-time" aria-label={`${dateStr ?? ''} ${timeStr ?? ''}`}>
        {dateStr && <span className="prediction-timeline__event-date">{dateStr}</span>}
        {timeStr && <span className="prediction-timeline__event-clock">{timeStr}</span>}
      </div>
      <div className="prediction-timeline__event-connector" aria-hidden="true">
        <span className={`prediction-timeline__event-dot prediction-timeline__event-dot--${cfg.cssModifier}`}>{cfg.icon}</span>
        <div className="prediction-timeline__event-line" />
      </div>
      <div className="prediction-timeline__event-body">
        <div className="prediction-timeline__event-asset">{event.assetName}</div>
        <div className="prediction-timeline__event-title">{event.title}</div>
        {!compact && event.detail && (
          <div className="prediction-timeline__event-detail">{event.detail}</div>
        )}
      </div>
    </li>
  );
}

function EventTypeSummary({ events }) {
  const counts = {};
  for (const e of events) { counts[e.type] = (counts[e.type] ?? 0) + 1; }
  return (
    <div className="prediction-timeline__summary" aria-label="Event type summary">
      {Object.entries(EVENT_TYPE_CONFIG).map(([type, cfg]) => (
        counts[type] ? (
          <div key={type} className={`prediction-timeline__summary-row prediction-timeline__summary-row--${cfg.cssModifier}`}>
            <span aria-hidden="true">{cfg.icon}</span>
            <span>{cfg.label}</span>
            <span className="prediction-timeline__summary-count">{counts[type]}</span>
          </div>
        ) : null
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function PredictionTimeline({
  predictionId      = null,
  prediction: pProp = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  filter            = [],
  maxEvents         = 50,
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

  // ── Resolved data ─────────────────────────────────────────────────────────
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

  // ── Event synthesis ───────────────────────────────────────────────────────
  const allEvents = useMemo(
    () => synthesiseEvents(scopedPredictions, getTrainById),
    [scopedPredictions, getTrainById],
  );

  const events = useMemo(() => {
    const activeFilter = Array.isArray(filter) ? filter.filter(Boolean) : [];
    const filtered = activeFilter.length > 0
      ? allEvents.filter((e) => activeFilter.includes(e.type))
      : allEvents;
    return filtered.slice(0, maxEvents);
  }, [allEvents, filter, maxEvents]);

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchor?.lastUpdatedAt ? Date.parse(anchor.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchor, staleThreshold]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isEmpty       = events.length === 0 && !loading;
  const assetName     = anchor ? (anchor.affectedTrainId ?? anchor.affectedAssetId ?? null) : null;
  const resolvedTitle = title ?? (assetName ? `Timeline — ${assetName}` : 'Prediction Timeline');
  const listId        = useId();

  const eventList = (
    <div
      className={[
        'prediction-timeline',
        compact ? 'prediction-timeline--compact' : null,
        isStale ? 'prediction-timeline--stale'   : null,
        error   ? 'prediction-timeline--error'   : null,
        syncing ? 'prediction-timeline--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="prediction-timeline__empty" role="status">No prediction events to display.</div>
      ) : (
        <ol id={listId} className="prediction-timeline__list" aria-label={`${events.length} prediction events`}>
          {events.map((evt, idx) => (
            <EventRow key={evt.key} rowId={`${listId}-${evt.key}`} event={evt} compact={compact} />
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
        summary={<div className="prediction-timeline__detail-summary">{events.length} events<StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={eventList}
        rail={<EventTypeSummary events={allEvents} />}
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
        left={eventList}
        right={<EventTypeSummary events={allEvents} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return eventList;
});

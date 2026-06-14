import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';

/**
 * Purpose:
 * SensorReadingPanel — deep-review panel for raw sensor readings from the
 * `sensorReadings[]` pass-through field on the Prediction (RiskScore) entity.
 *
 * Renders:
 *   1. Reading Overview    — count, sensor types, freshness of most recent reading
 *   2. Reading Detail List — sorted by `recordedAt` descending; each row shows
 *                           sensor ID, type, value vs threshold, unit, health,
 *                           and timestamp
 *   3. Type Breakdown      — readings grouped by `sensorType` with min/max/avg
 *                           value statistics
 *
 * Differs from SensorHealthPanel (which shows worst-per-sensor health rollup)
 * by showing the raw time-ordered reading stream — useful for deep triage.
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/riskStore` (Zustand — read-only)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `predictionId`   (string|null)  — anchor prediction (default: null)
 * - `prediction`     (object|null)  — direct override (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `staleThreshold` (number)       (default: 60000)
 * - `maxReadings`    (number)       — max reading rows (default: 30)
 * - `compact`        (boolean)      (default: false)
 * - `onRetry`        (fn|null)      (default: null)
 *
 * State (derived from riskStore selectors only — zero mutations):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`
 * - `getRiskScoreById`, `getSelectedRiskScore`, `getVisibleRiskScores`
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function inferHealth(reading) {
  if (reading.health) return String(reading.health).toLowerCase();
  const value  = Number(reading.readingValue ?? 0);
  const thresh = Number(reading.threshold ?? 0);
  if (thresh <= 0) return 'healthy';
  if (value >= thresh * 1.2) return 'critical';
  if (value >= thresh) return 'degraded';
  return 'healthy';
}

const HEALTH_MOD = { healthy: 'healthy', degraded: 'degraded', critical: 'critical', offline: 'offline' };

function healthMod(key) { return HEALTH_MOD[String(key ?? 'healthy').toLowerCase()] ?? 'healthy'; }

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function collectReadings(predictions) {
  const out = [];
  for (const p of predictions) {
    const readings = Array.isArray(p.sensorReadings) ? p.sensorReadings : [];
    for (const r of readings) {
      out.push({
        ...r,
        sensorId:    r.sensorId ?? `${p.id}-${r.sensorType ?? 'unknown'}`,
        health:      inferHealth(r),
        predictionId: p.id,
      });
    }
  }
  return out.sort((a, b) =>
    String(b.recordedAt ?? b.computedAt ?? '').localeCompare(String(a.recordedAt ?? a.computedAt ?? '')),
  );
}

function computeTypeStats(readings) {
  const byType = {};
  for (const r of readings) {
    const type  = r.sensorType ?? 'unknown';
    const value = Number(r.readingValue);
    if (Number.isNaN(value)) continue;
    if (!byType[type]) byType[type] = { type, values: [], unit: r.unit ?? '' };
    byType[type].values.push(value);
  }
  return Object.values(byType).map(({ type, values, unit }) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
    return { type, min, max, avg, count: values.length, unit };
  }).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

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
    <div className="sensor-reading-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function ReadingRow({ reading, compact, rowId }) {
  const mod    = healthMod(reading.health);
  const value  = reading.readingValue ?? null;
  const thresh = reading.threshold ?? null;
  const pct    = thresh != null && thresh > 0 && value != null
    ? Math.min(120, Math.round((Number(value) / Number(thresh)) * 100)) : null;
  const ts     = reading.recordedAt ?? reading.computedAt ?? null;

  return (
    <li
      id={rowId}
      className={[
        'sensor-reading-panel__reading-row',
        `sensor-reading-panel__reading-row--${mod}`,
        compact ? 'sensor-reading-panel__reading-row--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${reading.sensorId}: ${value != null ? `${value}${reading.unit ?? ''}` : '—'} (${reading.health})`}
    >
      <div className="sensor-reading-panel__reading-id">{reading.sensorId}</div>
      {reading.sensorType && (
        <div className="sensor-reading-panel__reading-type">{reading.sensorType}</div>
      )}
      <div className="sensor-reading-panel__reading-value-group">
        {value != null && (
          <span className={`sensor-reading-panel__reading-value sensor-reading-panel__reading-value--${mod}`}>
            {value}{reading.unit ?? ''}
          </span>
        )}
        {!compact && thresh != null && (
          <span className="sensor-reading-panel__reading-thresh">/{thresh}{reading.unit ?? ''}</span>
        )}
      </div>
      {!compact && pct != null && (
        <div className="sensor-reading-panel__reading-bar"
          role="meter" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${pct}% of threshold`}>
          <div className={`sensor-reading-panel__reading-bar-fill sensor-reading-panel__reading-bar-fill--${mod}`}
            style={{ width: `${Math.min(100, pct)}%` }} aria-hidden="true" />
        </div>
      )}
      <span className={`sensor-reading-panel__reading-health sensor-reading-panel__reading-health--${mod}`}>
        {reading.health}
      </span>
      {!compact && ts && (
        <div className="sensor-reading-panel__reading-ts" aria-label={`Recorded: ${formatWhen(ts)}`}>
          {formatWhen(ts)}
        </div>
      )}
    </li>
  );
}

function TypeStatsRail({ stats }) {
  return (
    <div className="sensor-reading-panel__rail" aria-label="Sensor type statistics">
      <div className="sensor-reading-panel__rail-title">By Sensor Type</div>
      {stats.length === 0 ? (
        <div className="sensor-reading-panel__rail-empty">No readings.</div>
      ) : (
        <dl className="sensor-reading-panel__rail-stats">
          {stats.map((s) => (
            <div key={s.type} className="sensor-reading-panel__rail-stat-row">
              <dt className="sensor-reading-panel__rail-type">{s.type}</dt>
              <dd className="sensor-reading-panel__rail-values">
                <span>Min {s.min}{s.unit}</span>
                <span>Avg {s.avg}{s.unit}</span>
                <span>Max {s.max}{s.unit}</span>
                <span className="sensor-reading-panel__rail-count">({s.count})</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function SensorReadingPanel({
  predictionId      = null,
  prediction: pProp = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  maxReadings       = 30,
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

  const readings   = useMemo(() => collectReadings(scopedPredictions), [scopedPredictions]);
  const typeStats  = useMemo(() => computeTypeStats(readings), [readings]);
  const visible    = readings.slice(0, maxReadings);
  const overflow   = readings.length - visible.length;

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchor?.lastUpdatedAt ? Date.parse(anchor.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchor, staleThreshold]);

  const isEmpty       = readings.length === 0 && !loading;
  const resolvedTitle = title ?? 'Sensor Readings';
  const listId        = useId();

  const body = (
    <div
      className={[
        'sensor-reading-panel',
        compact ? 'sensor-reading-panel--compact' : null,
        isStale ? 'sensor-reading-panel--stale'   : null,
        error   ? 'sensor-reading-panel--error'   : null,
        syncing ? 'sensor-reading-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {!compact && readings.length > 0 && (
        <div className="sensor-reading-panel__overview">
          <span>{readings.length} reading{readings.length !== 1 ? 's' : ''}</span>
          <span>{typeStats.length} sensor type{typeStats.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {isEmpty ? (
        <div className="sensor-reading-panel__empty" role="status">
          {scopedPredictions.length > 0 ? 'No sensor readings in this prediction.' : 'No prediction data available.'}
        </div>
      ) : (
        <>
          <ul id={listId} className="sensor-reading-panel__reading-list" aria-label={`${visible.length} sensor readings`}>
            {visible.map((r, idx) => (
              <ReadingRow key={r.sensorId ?? idx} rowId={`${listId}-reading-${r.sensorId ?? idx}`} reading={r} compact={compact} />
            ))}
          </ul>
          {overflow > 0 && (
            <div className="sensor-reading-panel__overflow" role="note">+{overflow} more readings</div>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={<div className="sensor-reading-panel__detail-summary">{readings.length} readings{readings.length > 0 ? ` · ${typeStats.length} types` : ''}<StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<TypeStatsRail stats={typeStats} />}
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
        right={<TypeStatsRail stats={typeStats} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

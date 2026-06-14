import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useRiskStore from '../../store/riskStore';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * SensorHealthPanel — deep-review panel for sensor health status derived from
 * the `sensorReadings[]` pass-through field on the Prediction (RiskScore)
 * domain model.
 *
 * Each `SensorReading` item in `sensorReadings[]` is expected to carry:
 *   - `sensorId`      — sensor identifier
 *   - `sensorType`    — type label (vibration, temperature, pressure, …)
 *   - `readingValue`  — current numeric value
 *   - `unit`          — unit string (°C, RPM, bar, …)
 *   - `threshold`     — numeric warning threshold
 *   - `health`        — explicit health string (healthy/degraded/critical/offline)
 *   - `recordedAt`    — ISO timestamp of reading
 *
 * When `health` is absent, it is inferred from `readingValue` vs `threshold`.
 *
 * Sections:
 *   1. Fleet Health Summary — distribution bar: healthy / degraded / critical /
 *                            offline across all sensors of all scoped predictions
 *   2. Sensor List          — ranked sensor rows: worst health first
 *   3. Threshold Violations — sensors at or above threshold (or in critical/offline)
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
 * - `predictionId`   (string|null)  — anchor prediction; scopes sensors to
 *                    that asset (default: null → all visible predictions)
 * - `prediction`     (object|null)  — direct override (default: null)
 * - `layout`         ('detail'|'split'|null) (default: null)
 * - `title`          (string|null)  (default: null)
 * - `staleThreshold` (number)       (default: 60000)
 * - `maxSensors`     (number)       — max sensor rows (default: 20)
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

const HEALTH_CONFIG = {
  healthy:   { rank: 0, label: 'Healthy',   cssModifier: 'healthy',   icon: '✓' },
  degraded:  { rank: 1, label: 'Degraded',  cssModifier: 'degraded',  icon: '◑' },
  critical:  { rank: 2, label: 'Critical',  cssModifier: 'critical',  icon: '✕' },
  offline:   { rank: 3, label: 'Offline',   cssModifier: 'offline',   icon: '○' },
};

const HEALTH_ORDER = ['healthy', 'degraded', 'critical', 'offline'];

function healthConfig(key) {
  return HEALTH_CONFIG[String(key ?? 'healthy').toLowerCase()] ?? HEALTH_CONFIG.healthy;
}

function healthRank(key) { return healthConfig(key).rank; }

// ---------------------------------------------------------------------------
// Health inference
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

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function aggregateSensors(predictions) {
  const sensorMap = {};

  for (const p of predictions) {
    const readings = Array.isArray(p.sensorReadings) ? p.sensorReadings : [];
    for (const r of readings) {
      const sid    = r.sensorId ?? `${p.id}-sensor-${r.sensorType ?? 'unknown'}`;
      const health = inferHealth(r);
      if (!sensorMap[sid]) {
        sensorMap[sid] = { ...r, sensorId: sid, health, predictionId: p.id };
      } else if (healthRank(health) > healthRank(sensorMap[sid].health)) {
        sensorMap[sid] = { ...r, sensorId: sid, health, predictionId: p.id };
      }
    }
  }

  return Object.values(sensorMap).sort((a, b) => healthRank(b.health) - healthRank(a.health));
}

function healthDistribution(sensors) {
  const counts = { healthy: 0, degraded: 0, critical: 0, offline: 0 };
  for (const s of sensors) {
    const k = String(s.health ?? 'healthy').toLowerCase();
    if (counts[k] != null) counts[k] += 1;
  }
  return counts;
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
    <div className="sensor-health-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function HealthDistributionBar({ dist, total }) {
  if (total === 0) return null;
  return (
    <div className="sensor-health-panel__dist-bar" role="img" aria-label="Sensor health distribution">
      {HEALTH_ORDER.map((k) => {
        const pct = Math.round((dist[k] / total) * 100);
        if (pct === 0) return null;
        const cfg = healthConfig(k);
        return (
          <div
            key={k}
            className={`sensor-health-panel__dist-segment sensor-health-panel__dist-segment--${cfg.cssModifier}`}
            style={{ width: `${pct}%` }}
            title={`${cfg.label}: ${dist[k]}`}
            aria-label={`${cfg.label}: ${dist[k]} sensors (${pct}%)`}
          />
        );
      })}
    </div>
  );
}

function HealthLegend({ dist }) {
  return (
    <div className="sensor-health-panel__dist-legend" role="list">
      {HEALTH_ORDER.map((k) => {
        const cfg = healthConfig(k);
        return (
          <span key={k} className={`sensor-health-panel__legend-item sensor-health-panel__legend-item--${cfg.cssModifier}`} role="listitem">
            <span aria-hidden="true">{cfg.icon}</span> {cfg.label} {dist[k]}
          </span>
        );
      })}
    </div>
  );
}

function SensorRow({ sensor, compact, rowId }) {
  const cfg      = healthConfig(sensor.health);
  const value    = sensor.readingValue ?? null;
  const thresh   = sensor.threshold ?? null;
  const pct      = thresh != null && thresh > 0 && value != null
    ? Math.min(120, Math.round((Number(value) / Number(thresh)) * 100)) : null;

  return (
    <li
      id={rowId}
      className={[
        'sensor-health-panel__sensor-row',
        `sensor-health-panel__sensor-row--${cfg.cssModifier}`,
        compact ? 'sensor-health-panel__sensor-row--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${sensor.sensorId}: ${cfg.label}${value != null ? `, ${value}${sensor.unit ?? ''}` : ''}`}
    >
      <span className={`sensor-health-panel__sensor-icon sensor-health-panel__sensor-icon--${cfg.cssModifier}`} aria-hidden="true">{cfg.icon}</span>
      <div className="sensor-health-panel__sensor-identity">
        <span className="sensor-health-panel__sensor-id">{sensor.sensorId}</span>
        {sensor.sensorType && <span className="sensor-health-panel__sensor-type">{sensor.sensorType}</span>}
      </div>
      {value != null && (
        <div className="sensor-health-panel__sensor-reading" aria-label={`Reading: ${value}${sensor.unit ?? ''}`}>
          <span className="sensor-health-panel__sensor-value">{value}</span>
          {sensor.unit && <span className="sensor-health-panel__sensor-unit">{sensor.unit}</span>}
        </div>
      )}
      {!compact && thresh != null && (
        <div className="sensor-health-panel__sensor-thresh" aria-label={`Threshold: ${thresh}${sensor.unit ?? ''}`}>
          <span>/{thresh}{sensor.unit ?? ''}</span>
        </div>
      )}
      {!compact && pct != null && (
        <div className="sensor-health-panel__sensor-bar"
          role="meter" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${pct}% of threshold`}>
          <div className={`sensor-health-panel__sensor-bar-fill sensor-health-panel__sensor-bar-fill--${cfg.cssModifier}`}
            style={{ width: `${Math.min(100, pct)}%` }} aria-hidden="true" />
        </div>
      )}
      <span className={`sensor-health-panel__sensor-badge sensor-health-panel__sensor-badge--${cfg.cssModifier}`}>{cfg.label}</span>
    </li>
  );
}

function RailSummary({ sensors, dist, total }) {
  return (
    <div className="sensor-health-panel__rail" aria-label="Sensor health summary">
      <div className="sensor-health-panel__rail-total" aria-label={`${total} sensors monitored`}>
        <span className="sensor-health-panel__rail-value">{total}</span>
        <span className="sensor-health-panel__rail-label">Sensors</span>
      </div>
      <HealthDistributionBar dist={dist} total={total} />
      <HealthLegend dist={dist} />
      {dist.critical > 0 && (
        <div className="sensor-health-panel__rail-alert" role="alert">
          {dist.critical} sensor{dist.critical !== 1 ? 's' : ''} critical
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function SensorHealthPanel({
  predictionId      = null,
  prediction: pProp = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  maxSensors        = 20,
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

  const sensors    = useMemo(() => aggregateSensors(scopedPredictions), [scopedPredictions]);
  const dist       = useMemo(() => healthDistribution(sensors), [sensors]);
  const total      = sensors.length;
  const visible    = sensors.slice(0, maxSensors);
  const overflow   = sensors.length - visible.length;

  // ── Stale detection ───────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt)
      : anchor?.lastUpdatedAt ? Date.parse(anchor.lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, anchor, staleThreshold]);

  const isEmpty       = total === 0 && !loading;
  const resolvedTitle = title ?? 'Sensor Health';
  const listId        = useId();

  const body = (
    <div
      className={[
        'sensor-health-panel',
        compact ? 'sensor-health-panel--compact' : null,
        isStale ? 'sensor-health-panel--stale'   : null,
        error   ? 'sensor-health-panel--error'   : null,
        syncing ? 'sensor-health-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} />}

      {!compact && total > 0 && (
        <>
          <HealthDistributionBar dist={dist} total={total} />
          <HealthLegend dist={dist} />
        </>
      )}

      {isEmpty ? (
        <div className="sensor-health-panel__empty" role="status">
          {scopedPredictions.length > 0 ? 'No sensor readings in current predictions.' : 'No prediction data available.'}
        </div>
      ) : (
        <>
          <ul id={listId} className="sensor-health-panel__sensor-list" aria-label={`${visible.length} sensors`}>
            {visible.map((s, idx) => (
              <SensorRow key={s.sensorId ?? idx} rowId={`${listId}-sensor-${s.sensorId ?? idx}`} sensor={s} compact={compact} />
            ))}
          </ul>
          {overflow > 0 && (
            <div className="sensor-health-panel__overflow" role="note">+{overflow} more sensors</div>
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
        summary={<div className="sensor-health-panel__detail-summary">{total} sensors<StatusPills loading={loading} refreshing={refreshing} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<RailSummary sensors={sensors} dist={dist} total={total} />}
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
        right={<RailSummary sensors={sensors} dist={dist} total={total} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

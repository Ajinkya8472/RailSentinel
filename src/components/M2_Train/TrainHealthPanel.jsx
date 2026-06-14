import React, { memo, useMemo, useId } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * TrainHealthPanel — canonical asset-health surface for Module-2 Train
 * Operations. Visualises the `healthStatus` field of the approved `Train`
 * domain model (`normal | watch | degraded | critical`) together with
 * related operational signals available directly on the Train entity:
 * active sensor count (`activeSensorReadingIds`), occupancy, speed, and
 * operational `status`.
 *
 * The component operates in two complementary modes:
 *
 *   1. Single-train mode (when `trainId` or `train` prop is supplied):
 *      Renders a focused health card — status badge, sensor activity count,
 *      occupancy ratio, speed, and a health-factor checklist synthesised
 *      from Train model fields. Includes a `riskScoreId` reference link
 *      for operator drilldown without importing cross-domain stores.
 *
 *   2. Fleet mode (when neither `trainId` nor `train` is supplied):
 *      Reads `getVisibleTrains()` from `useTrainStore`, groups trains by
 *      `healthStatus`, and renders a ranked fleet-health board — critical
 *      trains first, then degraded, watch, and normal. Suitable for the
 *      DashboardLayout `primary` region or the left panel of a
 *      `SplitPanelLayout`.
 *
 * The component is a pure read surface. All presentation state is derived
 * exclusively from `useTrainStore` selectors. No store mutations are ever
 * performed. No cross-domain store is imported.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/trainStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId`          (string|number|null) — store key for lookup; falls
 *                      back to `getSelectedTrain()` when null. When both
 *                      `trainId` and `train` are absent, fleet mode
 *                      activates (default: null)
 * - `train`            (object|null)        — direct Train object override;
 *                      takes precedence over store lookup (default: null)
 * - `layout`           ('dashboard'|'split'|null) — optional layout wrapper;
 *                      null renders bare content (default: null)
 * - `title`            (string|null)        — layout title override (default: null)
 * - `staleThreshold`   (number)             — ms before `lastUpdatedAt` is
 *                      considered stale (default: 60000)
 * - `maxRows`          (number)             — maximum trains shown in fleet
 *                      mode (default: 30)
 * - `onTrainSelect`    (fn|null)            — callback fired with a Train
 *                      object when a fleet-mode row is clicked (default: null)
 * - `compact`          (boolean)            — compact visual mode; reduces
 *                      padding and secondary metadata (default: false)
 * - `showSensorCount`  (boolean)            — render active sensor reading
 *                      count in single-train mode (default: true)
 * - `showFactors`      (boolean)            — render health-factor checklist
 *                      in single-train mode (default: true)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`          — initial fetch in progress
 * - `refreshing`       — background refresh in progress
 * - `syncing`          — live WebSocket update in progress
 * - `error`            — last error from the store
 * - `lastUpdatedAt`    — ISO timestamp of last store write
 * - `getTrainById`     — id-keyed lookup selector
 * - `getSelectedTrain` — current-selection fallback selector
 * - `getVisibleTrains` — filtered + sorted fleet selector (fleet mode only)
 */

// ---------------------------------------------------------------------------
// Health status configuration — aligned to Train domain model enum
// ---------------------------------------------------------------------------

const HEALTH_CONFIG = {
  normal:   { label: 'Normal',   rank: 0, cssModifier: 'normal',   icon: '✓' },
  watch:    { label: 'Watch',    rank: 1, cssModifier: 'watch',    icon: '◉' },
  degraded: { label: 'Degraded', rank: 2, cssModifier: 'degraded', icon: '▲' },
  critical: { label: 'Critical', rank: 3, cssModifier: 'critical', icon: '✕' },
};

const HEALTH_RANK_ORDER = ['critical', 'degraded', 'watch', 'normal'];

function resolveHealth(train) {
  if (!train) return HEALTH_CONFIG.normal;
  const key = String(train.healthStatus ?? 'normal').toLowerCase();
  return HEALTH_CONFIG[key] ?? HEALTH_CONFIG.normal;
}

// ---------------------------------------------------------------------------
// Health factor synthesis from Train domain model fields
// Derives presentational health signals without inventing new domain fields.
// ---------------------------------------------------------------------------

function deriveHealthFactors(train) {
  if (!train) return [];
  const factors = [];

  // Sensor activity
  const sensorCount = Array.isArray(train.activeSensorReadingIds)
    ? train.activeSensorReadingIds.length
    : null;
  factors.push({
    key: 'sensors',
    label: 'Active Sensors',
    value: sensorCount != null ? String(sensorCount) : '—',
    ok: sensorCount == null || sensorCount > 0,
  });

  // Operational status
  const status = String(train.status ?? '').toLowerCase();
  const statusOk = !['terminated', 'outofservice', 'out_of_service', 'out-of-service'].includes(status);
  factors.push({
    key: 'status',
    label: 'Operational Status',
    value: train.status ?? '—',
    ok: statusOk,
  });

  // Speed (present if GPS/telemetry is available)
  if (train.speedKph != null) {
    const speedOk = Number(train.speedKph) >= 0;
    factors.push({
      key: 'speed',
      label: 'Speed',
      value: `${Number(train.speedKph).toFixed(0)} km/h`,
      ok: speedOk,
    });
  }

  // Occupancy ratio
  if (train.occupancy != null && train.capacity != null) {
    const pct = Math.round((Number(train.occupancy) / Number(train.capacity)) * 100);
    const occupancyOk = pct <= 110; // >110% is over-capacity
    factors.push({
      key: 'occupancy',
      label: 'Occupancy',
      value: `${pct}%`,
      ok: occupancyOk,
    });
  } else if (train.occupancy != null) {
    factors.push({
      key: 'occupancy',
      label: 'Occupancy',
      value: typeof train.occupancy === 'object'
        ? (train.occupancy.pct != null ? `${train.occupancy.pct}%` : '—')
        : `${train.occupancy}`,
      ok: true,
    });
  }

  // Delay signal
  if (train.delayMinutes != null) {
    const delayOk = Number(train.delayMinutes) <= 15;
    factors.push({
      key: 'delay',
      label: 'Delay',
      value: Number(train.delayMinutes) === 0
        ? 'On time'
        : `+${train.delayMinutes}m`,
      ok: delayOk,
    });
  }

  // Energy profile link (existence check only — no cross-store import)
  const hasEnergy = Boolean(train.energyProfileId);
  factors.push({
    key: 'energy',
    label: 'Energy Profile',
    value: hasEnergy ? 'Linked' : 'None',
    ok: hasEnergy,
  });

  // Risk score link
  const hasRisk = Boolean(train.riskScoreId);
  factors.push({
    key: 'risk',
    label: 'Risk Score',
    value: hasRisk ? 'Linked' : 'None',
    ok: null, // neutral — presence is informational, not pass/fail
  });

  return factors;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="train-health-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function HealthBadge({ health, size = 'md' }) {
  return (
    <div
      className={`train-health-badge train-health-badge--${health.cssModifier} train-health-badge--${size}`}
      aria-label={`Health status: ${health.label}`}
      role="img"
    >
      <span className="train-health-badge__icon" aria-hidden="true">
        {health.icon}
      </span>
      <span className="train-health-badge__label">{health.label}</span>
    </div>
  );
}

function HealthMeter({ health }) {
  // Visual 4-step meter showing which band is active
  return (
    <div
      className="train-health-meter"
      aria-label={`Health level: ${health.label} (${health.rank + 1} of 4)`}
      role="meter"
      aria-valuenow={health.rank + 1}
      aria-valuemin={1}
      aria-valuemax={4}
    >
      {HEALTH_RANK_ORDER.slice().reverse().map((key, idx) => {
        const cfg = HEALTH_CONFIG[key];
        const active = cfg.rank <= health.rank;
        return (
          <div
            key={key}
            className={[
              'train-health-meter__segment',
              `train-health-meter__segment--${cfg.cssModifier}`,
              active ? 'train-health-meter__segment--active' : null,
            ].filter(Boolean).join(' ')}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-train health detail view
// ---------------------------------------------------------------------------

function FactorRow({ factor }) {
  const isNeutral = factor.ok === null;
  const icon = isNeutral ? '·' : factor.ok ? '✓' : '✕';
  const mod  = isNeutral ? 'neutral' : factor.ok ? 'ok' : 'fail';

  return (
    <li className={`train-health-factor train-health-factor--${mod}`}>
      <span className="train-health-factor__icon" aria-hidden="true">{icon}</span>
      <span className="train-health-factor__label">{factor.label}</span>
      <span className="train-health-factor__value">{factor.value}</span>
    </li>
  );
}

function SingleTrainHealth({ train, showSensorCount, showFactors, compact }) {
  if (!train) {
    return (
      <div className="train-health-panel__empty" role="status">
        No train data available.
      </div>
    );
  }

  const health      = resolveHealth(train);
  const factors     = useMemo(() => deriveHealthFactors(train), [train]);
  const sensorCount = Array.isArray(train.activeSensorReadingIds)
    ? train.activeSensorReadingIds.length
    : null;
  const lastUpdate  = formatWhen(train.lastUpdatedAt ?? null);

  return (
    <div className={`train-health-single ${compact ? 'train-health-single--compact' : ''}`}>

      {/* Header: badge + meter + identity */}
      <div className="train-health-single__header">
        <div className="train-health-single__identity">
          <span className="train-health-single__number">
            {train.trainNumber ?? train.id ?? '—'}
          </span>
          {train.serviceType && (
            <span
              className={`train-health-single__service train-health-single__service--${String(
                train.serviceType,
              ).toLowerCase()}`}
            >
              {train.serviceType}
            </span>
          )}
        </div>

        <div className="train-health-single__status">
          <HealthBadge health={health} size="lg" />
          <HealthMeter health={health} />
        </div>
      </div>

      {/* Sensor activity */}
      {showSensorCount && sensorCount != null && (
        <div className="train-health-single__sensors">
          <span className="train-health-single__sensors-count">{sensorCount}</span>
          <span className="train-health-single__sensors-label">
            {sensorCount === 1 ? 'active sensor reading' : 'active sensor readings'}
          </span>
        </div>
      )}

      {/* Health factors checklist */}
      {showFactors && !compact && factors.length > 0 && (
        <section
          className="train-health-single__factors"
          aria-label="Health factors"
        >
          <h3 className="train-health-single__factors-title">Health Factors</h3>
          <ul className="train-health-single__factors-list">
            {factors.map((f) => (
              <FactorRow key={f.key} factor={f} />
            ))}
          </ul>
        </section>
      )}

      {/* Route context */}
      {!compact && (train.routeId || train.operatorName) && (
        <div className="train-health-single__meta">
          {train.routeId && (
            <span className="train-health-single__meta-item">
              Route {train.routeId}
            </span>
          )}
          {train.operatorName && (
            <span className="train-health-single__meta-item">
              {train.operatorName}
            </span>
          )}
        </div>
      )}

      {/* Last update */}
      {!compact && lastUpdate && (
        <div className="train-health-single__updated">
          <span className="train-health-single__updated-label">Updated</span>
          <span className="train-health-single__updated-value">{lastUpdate}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fleet health board (multi-train mode)
// ---------------------------------------------------------------------------

function FleetHealthRow({ train, onTrainSelect, compact, rowId }) {
  const health      = resolveHealth(train);
  const sensorCount = Array.isArray(train.activeSensorReadingIds)
    ? train.activeSensorReadingIds.length
    : null;
  const isClickable = typeof onTrainSelect === 'function';

  const handleClick = () => {
    if (isClickable) onTrainSelect(train);
  };

  return (
    <li
      id={rowId}
      className={[
        'train-health-row',
        `train-health-row--${health.cssModifier}`,
        compact     ? 'train-health-row--compact'   : null,
        isClickable ? 'train-health-row--clickable'  : null,
      ].filter(Boolean).join(' ')}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`Train ${train.trainNumber ?? train.id}, health ${health.label}`}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      {/* Health indicator */}
      <span
        className={`train-health-row__indicator train-health-row__indicator--${health.cssModifier}`}
        aria-label={health.label}
        role="img"
      >
        {health.icon}
      </span>

      {/* Identity */}
      <span className="train-health-row__number">
        {train.trainNumber ?? train.id ?? '—'}
      </span>

      {/* Status */}
      <span
        className={`train-health-row__status train-health-row__status--${String(
          train.status ?? 'unknown',
        ).toLowerCase()}`}
      >
        {train.status ?? '—'}
      </span>

      {/* Route (non-compact) */}
      {!compact && (
        <span className="train-health-row__route">
          {train.routeId ?? '—'}
        </span>
      )}

      {/* Sensors (non-compact) */}
      {!compact && sensorCount != null && (
        <span className="train-health-row__sensors">
          {sensorCount} sensor{sensorCount !== 1 ? 's' : ''}
        </span>
      )}

      {/* Health badge */}
      <span
        className={`train-health-row__badge train-health-row__badge--${health.cssModifier}`}
      >
        {health.label}
      </span>
    </li>
  );
}

function FleetHealthBoard({ grouped, maxRows, onTrainSelect, compact, listId }) {
  // Flatten in rank order: critical → degraded → watch → normal
  const orderedTrains = useMemo(() => {
    const all = [];
    for (const key of HEALTH_RANK_ORDER) {
      if (grouped[key]) all.push(...grouped[key]);
    }
    return all.slice(0, maxRows);
  }, [grouped, maxRows]);

  if (orderedTrains.length === 0) {
    return (
      <div className="train-health-panel__empty" role="status">
        No train health data in current view.
      </div>
    );
  }

  return (
    <ol
      id={listId}
      className="train-health-board"
      aria-label={`Fleet health board — ${orderedTrains.length} trains`}
    >
      {orderedTrains.map((train, idx) => {
        const sid = train.id ?? train.trainId ?? `row-${idx}`;
        return (
          <FleetHealthRow
            key={`${sid}-${idx}`}
            rowId={`${listId}-row-${sid}`}
            train={train}
            onTrainSelect={onTrainSelect}
            compact={compact}
          />
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function TrainHealthPanel({
  trainId           = null,
  train: trainProp  = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  maxRows           = 30,
  onTrainSelect     = null,
  compact           = false,
  showSensorCount   = true,
  showFactors       = true,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useTrainStore((s) => s.loading);
  const refreshing    = useTrainStore((s) => s.refreshing);
  const syncing       = useTrainStore((s) => s.syncing);
  const error         = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);

  const trainFromStore = useTrainStore((s) =>
    trainId ? s.getTrainById(trainId) : s.getSelectedTrain(),
  );

  const getVisibleTrains = useTrainStore((s) =>
    typeof s.getVisibleTrains === 'function' ? s.getVisibleTrains : null,
  );

  // ── Resolved single train ────────────────────────────────────────────────
  const train = useMemo(
    () => trainProp ?? trainFromStore ?? null,
    [trainProp, trainFromStore],
  );

  // ── Fleet mode ───────────────────────────────────────────────────────────
  const isFleetMode = !trainId && !trainProp;

  const grouped = useMemo(() => {
    if (!isFleetMode) return {};
    try {
      const all = getVisibleTrains ? getVisibleTrains() : [];
      const out = { normal: [], watch: [], degraded: [], critical: [] };
      for (const t of all || []) {
        const key = String(t.healthStatus ?? 'normal').toLowerCase();
        if (out[key]) out[key].push(t);
        else out.normal.push(t); // unknown maps to normal bucket
      }
      return out;
    } catch {
      return { normal: [], watch: [], degraded: [], critical: [] };
    }
  }, [isFleetMode, getVisibleTrains]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt
      ? Date.parse(lastUpdatedAt)
      : train?.lastUpdatedAt
        ? Date.parse(train.lastUpdatedAt)
        : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, train, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const totalFleetCount = isFleetMode
    ? Object.values(grouped).reduce((s, arr) => s + arr.length, 0)
    : 0;

  const isEmpty = isFleetMode ? totalFleetCount === 0 : !train;

  const resolvedTitle = title ?? (
    isFleetMode
      ? 'Fleet Health'
      : train
        ? `Health — ${train.trainNumber ?? train.id ?? 'Train'}`
        : 'Train Health'
  );

  // ── KPI strip ────────────────────────────────────────────────────────────
  const kpiStrip = useMemo(() => {
    if (isFleetMode) {
      return (
        <div className="train-health-panel__kpi-strip" aria-label="Fleet health KPIs">
          <span className="train-kpi train-kpi--danger">
            <span className="train-kpi__value">{grouped.critical?.length ?? 0}</span>
            <span className="train-kpi__label">Critical</span>
          </span>
          <span className="train-kpi train-kpi--warning">
            <span className="train-kpi__value">{grouped.degraded?.length ?? 0}</span>
            <span className="train-kpi__label">Degraded</span>
          </span>
          <span className="train-kpi train-kpi--watch">
            <span className="train-kpi__value">{grouped.watch?.length ?? 0}</span>
            <span className="train-kpi__label">Watch</span>
          </span>
          <span className="train-kpi train-kpi--good">
            <span className="train-kpi__value">{grouped.normal?.length ?? 0}</span>
            <span className="train-kpi__label">Normal</span>
          </span>
        </div>
      );
    }

    const health      = resolveHealth(train);
    const sensorCount = Array.isArray(train?.activeSensorReadingIds)
      ? train.activeSensorReadingIds.length
      : null;
    const factors     = deriveHealthFactors(train);
    const failCount   = factors.filter((f) => f.ok === false).length;

    return (
      <div className="train-health-panel__kpi-strip" aria-label="Train health KPIs">
        <span className={`train-kpi train-kpi--${health.cssModifier}`}>
          <span className="train-kpi__value">{health.label}</span>
          <span className="train-kpi__label">Health</span>
        </span>
        {sensorCount != null && (
          <span className="train-kpi">
            <span className="train-kpi__value">{sensorCount}</span>
            <span className="train-kpi__label">Sensors</span>
          </span>
        )}
        <span className={`train-kpi ${failCount > 0 ? 'train-kpi--warning' : 'train-kpi--good'}`}>
          <span className="train-kpi__value">{failCount}</span>
          <span className="train-kpi__label">Issues</span>
        </span>
        <span className="train-kpi">
          <span className="train-kpi__value">{train?.status ?? '—'}</span>
          <span className="train-kpi__label">Status</span>
        </span>
      </div>
    );
  }, [isFleetMode, grouped, train]);

  // ── Stable list ID ───────────────────────────────────────────────────────
  const boardId = useId();

  // ── Core content ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'train-health-panel',
        isFleetMode ? 'train-health-panel--fleet'   : 'train-health-panel--single',
        compact     ? 'train-health-panel--compact'  : null,
        isStale     ? 'train-health-panel--stale'   : null,
        error       ? 'train-health-panel--error'   : null,
        syncing     ? 'train-health-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <StatusPills
        loading={loading}
        refreshing={refreshing}
        syncing={syncing}
        isStale={isStale}
        error={error}
      />

      {isFleetMode ? (
        <FleetHealthBoard
          grouped={grouped}
          maxRows={maxRows}
          onTrainSelect={onTrainSelect}
          compact={compact}
          listId={boardId}
        />
      ) : (
        <SingleTrainHealth
          train={train}
          showSensorCount={showSensorCount}
          showFactors={showFactors}
          compact={compact}
        />
      )}
    </div>
  );

  // ── Layout wrappers ───────────────────────────────────────────────────────
  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={null}
        left={content}
        right={null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={resolvedTitle}
        kpiStrip={kpiStrip}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      >
        {content}
      </DashboardLayout>
    );
  }

  return content;
});

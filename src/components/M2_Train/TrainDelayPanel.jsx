import React, { memo, useMemo, useId } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * TrainDelayPanel — canonical delay intelligence surface for Module-2 Train
 * Operations. Operates in two complementary modes:
 *
 *   1. Single-train mode (when `trainId` or `train` prop is supplied):
 *      Renders the delay magnitude, severity classification, ETA shift,
 *      impacted next stop, and any propagation risk indicators for that
 *      specific train from the approved `Train` domain model.
 *
 *   2. Fleet mode (when neither `trainId` nor `train` is supplied):
 *      Reads `getVisibleTrains()` from `useTrainStore`, filters to trains
 *      with a non-zero `delayMinutes`, sorts by descending delay, and
 *      renders a ranked delay board — suitable for the DashboardLayout
 *      `primary` region or the left panel of a `SplitPanelLayout`.
 *
 * The component is a pure read surface. All presentation state is derived
 * exclusively from `useTrainStore` selectors. No store mutations are ever
 * performed.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/trainStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId`           (string|number|null) — store key for lookup; falls
 *                       back to `getSelectedTrain()` when null. When both
 *                       `trainId` and `train` are absent, fleet mode
 *                       activates (default: null)
 * - `train`             (object|null)        — direct Train object override;
 *                       takes precedence over store lookup (default: null)
 * - `layout`            ('dashboard'|'split'|null) — optional layout wrapper;
 *                       null renders bare content (default: null)
 * - `title`             (string|null)        — layout title override (default: null)
 * - `staleThreshold`    (number)             — ms before `lastUpdatedAt` is
 *                       considered stale (default: 60000)
 * - `maxRows`           (number)             — maximum delayed trains shown
 *                       in fleet mode (default: 20)
 * - `onTrainSelect`     (fn|null)            — callback fired with a Train
 *                       object when a fleet-mode row is clicked (default: null)
 * - `compact`           (boolean)            — compact visual mode; reduces
 *                       padding and secondary metadata (default: false)
 * - `showPropagation`   (boolean)            — render downstream propagation
 *                       risk indicator in single-train mode (default: true)
 * - `minDelayMinutes`   (number)             — fleet mode: minimum delay to
 *                       include a train in the board (default: 1)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`           — initial fetch in progress
 * - `refreshing`        — background refresh in progress
 * - `syncing`           — live WebSocket update in progress
 * - `error`             — last error from the store
 * - `lastUpdatedAt`     — ISO timestamp of last store write
 * - `getTrainById`      — id-keyed lookup selector
 * - `getSelectedTrain`  — current-selection fallback selector
 * - `getVisibleTrains`  — filtered + sorted fleet selector (fleet mode only)
 */

// ---------------------------------------------------------------------------
// Delay severity thresholds (aligned to Indian Railways operational bands)
// ---------------------------------------------------------------------------

const SEVERITY = [
  { key: 'on-time',  label: 'On Time',  min: null, max: 0,   cssModifier: 'on-time'  },
  { key: 'minor',    label: 'Minor',    min: 1,    max: 15,  cssModifier: 'minor'    },
  { key: 'moderate', label: 'Moderate', min: 16,   max: 60,  cssModifier: 'moderate' },
  { key: 'severe',   label: 'Severe',   min: 61,   max: 120, cssModifier: 'severe'   },
  { key: 'critical', label: 'Critical', min: 121,  max: null, cssModifier: 'critical' },
];

function getSeverity(delayMinutes) {
  const d = delayMinutes == null ? 0 : Number(delayMinutes);
  if (d <= 0) return SEVERITY[0];
  for (const band of SEVERITY.slice(1)) {
    const withinUpper = band.max == null || d <= band.max;
    if (d >= band.min && withinUpper) return band;
  }
  return SEVERITY[SEVERITY.length - 1];
}

function formatDelay(minutes) {
  if (minutes == null || minutes === 0) return 'On time';
  const abs = Math.abs(minutes);
  const sign = minutes > 0 ? '+' : '−';
  if (abs < 60) return `${sign}${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
}

function formatTime(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

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
    <div className="train-delay-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function SeverityBar({ delayMinutes }) {
  const severity = getSeverity(delayMinutes);
  // Fill ratio: cap visual bar at 120 min for proportional display
  const pct = delayMinutes == null || delayMinutes <= 0
    ? 0
    : Math.min(100, Math.round((Math.min(delayMinutes, 120) / 120) * 100));

  return (
    <div
      className={`train-delay-severity train-delay-severity--${severity.cssModifier}`}
      aria-label={`Delay severity: ${severity.label}`}
    >
      <div
        className="train-delay-severity__bar-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of maximum displayed delay`}
      >
        <div
          className="train-delay-severity__bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="train-delay-severity__label">{severity.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-train delay detail view
// ---------------------------------------------------------------------------

function SingleTrainDelay({ train, showPropagation, compact }) {
  if (!train) {
    return (
      <div className="train-delay-panel__empty" role="status">
        No train data available.
      </div>
    );
  }

  const delayMinutes = train.delayMinutes ?? 0;
  const severity = getSeverity(delayMinutes);
  const displayDelay = formatDelay(delayMinutes);

  const scheduledArrival = formatTime(train.arrivalTime ?? null);
  const estimatedArrival = formatTime(train.estimatedArrivalTime ?? null);
  const lastUpdate       = formatWhen(train.lastUpdatedAt ?? null);

  const nextStation      = train.nextStationId
    ? (train.nextStationName ?? train.nextStationId)
    : null;
  const currentStation   = train.currentStationId
    ? (train.currentStationName ?? train.currentStationId)
    : null;

  // Propagation risk: estimated when delay > moderate threshold and train
  // has a next stop — this is a presentational heuristic, not domain logic.
  const propagationRisk  = showPropagation && delayMinutes >= 16 && nextStation;

  return (
    <div className={`train-delay-single ${compact ? 'train-delay-single--compact' : ''}`}>

      {/* Primary delay callout */}
      <div
        className={`train-delay-single__callout train-delay-single__callout--${severity.cssModifier}`}
        aria-label={`Train delay: ${displayDelay}`}
      >
        <span className="train-delay-single__delay-value">{displayDelay}</span>
        <span className="train-delay-single__train-ref">
          {train.trainNumber ?? train.id ?? '—'}
        </span>
      </div>

      <SeverityBar delayMinutes={delayMinutes} />

      {/* Timing detail */}
      {!compact && (scheduledArrival || estimatedArrival) && (
        <dl className="train-delay-single__timing">
          {scheduledArrival && (
            <>
              <dt className="train-delay-single__timing-label">Scheduled</dt>
              <dd className="train-delay-single__timing-value">{scheduledArrival}</dd>
            </>
          )}
          {estimatedArrival && (
            <>
              <dt className="train-delay-single__timing-label">Estimated</dt>
              <dd
                className={`train-delay-single__timing-value ${
                  delayMinutes > 0 ? 'train-delay-single__timing-value--late' : ''
                }`}
              >
                {estimatedArrival}
              </dd>
            </>
          )}
        </dl>
      )}

      {/* Location context */}
      {(currentStation || nextStation) && (
        <div className="train-delay-single__location">
          {currentStation && (
            <div className="train-delay-single__location-row">
              <span className="train-delay-single__location-icon" aria-hidden="true">●</span>
              <span className="train-delay-single__location-label">Current</span>
              <span className="train-delay-single__location-value">{currentStation}</span>
            </div>
          )}
          {nextStation && (
            <div className="train-delay-single__location-row">
              <span className="train-delay-single__location-icon" aria-hidden="true">→</span>
              <span className="train-delay-single__location-label">Next</span>
              <span className="train-delay-single__location-value">{nextStation}</span>
            </div>
          )}
        </div>
      )}

      {/* Propagation risk notice */}
      {propagationRisk && (
        <div
          className="train-delay-single__propagation"
          role="note"
          aria-label="Downstream propagation risk"
        >
          <span className="train-delay-single__propagation-icon" aria-hidden="true">⚠</span>
          <span className="train-delay-single__propagation-text">
            Delay may propagate to {nextStation} and downstream services.
          </span>
        </div>
      )}

      {/* Meta */}
      {!compact && lastUpdate && (
        <div className="train-delay-single__meta">
          <span className="train-delay-single__meta-label">Updated</span>
          <span className="train-delay-single__meta-value">{lastUpdate}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fleet delay board (multi-train mode)
// ---------------------------------------------------------------------------

function FleetDelayRow({ train, onTrainSelect, compact, rowId }) {
  const delayMinutes = train.delayMinutes ?? 0;
  const severity     = getSeverity(delayMinutes);
  const displayDelay = formatDelay(delayMinutes);
  const nextStation  = train.nextStationId
    ? (train.nextStationName ?? train.nextStationId)
    : null;

  const handleClick = () => {
    if (typeof onTrainSelect === 'function') onTrainSelect(train);
  };

  const isClickable = typeof onTrainSelect === 'function';

  return (
    <li
      id={rowId}
      className={[
        'train-delay-row',
        `train-delay-row--${severity.cssModifier}`,
        compact      ? 'train-delay-row--compact'   : null,
        isClickable  ? 'train-delay-row--clickable'  : null,
      ].filter(Boolean).join(' ')}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`Train ${train.trainNumber ?? train.id}, delayed ${displayDelay}`}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }
          : undefined
      }
    >
      {/* Train identity */}
      <span className="train-delay-row__number">
        {train.trainNumber ?? train.id ?? '—'}
      </span>

      {/* Route context */}
      {!compact && (
        <span className="train-delay-row__route">
          {train.routeId ?? train.routeName ?? '—'}
        </span>
      )}

      {/* Next stop */}
      {!compact && nextStation && (
        <span className="train-delay-row__next-stop">{nextStation}</span>
      )}

      {/* Status */}
      <span
        className={`train-delay-row__status train-delay-row__status--${String(
          train.status ?? 'unknown',
        ).toLowerCase()}`}
      >
        {train.status ?? '—'}
      </span>

      {/* Delay badge */}
      <span
        className={`train-delay-row__delay train-delay-row__delay--${severity.cssModifier}`}
        aria-label={`Delay ${displayDelay}`}
      >
        {displayDelay}
      </span>

      {/* Inline severity bar (compact uses colour only) */}
      {!compact && (
        <div className="train-delay-row__bar-wrap" aria-hidden="true">
          <div
            className="train-delay-row__bar-track"
            role="presentation"
          >
            <div
              className={`train-delay-row__bar-fill train-delay-row__bar-fill--${severity.cssModifier}`}
              style={{
                width: `${Math.min(100, Math.round((Math.min(delayMinutes, 120) / 120) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function FleetDelayBoard({ delayedTrains, maxRows, onTrainSelect, compact, listId }) {
  if (!delayedTrains || delayedTrains.length === 0) {
    return (
      <div className="train-delay-panel__empty" role="status">
        No delayed trains in current view.
      </div>
    );
  }

  const slice = delayedTrains.slice(0, maxRows);

  return (
    <ol
      id={listId}
      className="train-delay-board"
      aria-label={`Delayed trains — ${slice.length} shown`}
    >
      {slice.map((train, idx) => {
        const sid = train.id ?? train.trainId ?? `row-${idx}`;
        return (
          <FleetDelayRow
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

export default memo(function TrainDelayPanel({
  trainId          = null,
  train: trainProp = null,
  layout           = null,
  title            = null,
  staleThreshold   = 60000,
  maxRows          = 20,
  onTrainSelect    = null,
  compact          = false,
  showPropagation  = true,
  minDelayMinutes  = 1,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading      = useTrainStore((s) => s.loading);
  const refreshing   = useTrainStore((s) => s.refreshing);
  const syncing      = useTrainStore((s) => s.syncing);
  const error        = useTrainStore((s) => s.error);
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

  // ── Fleet mode: collect delayed trains from store ────────────────────────
  // Activated only when no trainId / train prop is explicitly supplied.
  const isFleetMode = !trainId && !trainProp;

  const delayedTrains = useMemo(() => {
    if (!isFleetMode) return [];
    try {
      const all = getVisibleTrains ? getVisibleTrains() : [];
      return (all || [])
        .filter((t) => (t.delayMinutes ?? 0) >= minDelayMinutes)
        .sort((a, b) => (b.delayMinutes ?? 0) - (a.delayMinutes ?? 0));
    } catch {
      return [];
    }
  }, [isFleetMode, getVisibleTrains, minDelayMinutes]);

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
  const isEmpty = isFleetMode
    ? delayedTrains.length === 0
    : !train;

  const resolvedTitle = title ?? (
    isFleetMode
      ? 'Delay Board'
      : train
        ? `Delay — ${train.trainNumber ?? train.id ?? 'Train'}`
        : 'Train Delay'
  );

  // ── KPI strip (for DashboardLayout) ─────────────────────────────────────
  const kpiStrip = useMemo(() => {
    if (isFleetMode) {
      const critical = delayedTrains.filter((t) => getSeverity(t.delayMinutes).key === 'critical').length;
      const severe   = delayedTrains.filter((t) => getSeverity(t.delayMinutes).key === 'severe').length;
      const avgDelay = delayedTrains.length > 0
        ? Math.round(delayedTrains.reduce((sum, t) => sum + (t.delayMinutes ?? 0), 0) / delayedTrains.length)
        : 0;
      return (
        <div className="train-delay-panel__kpi-strip" aria-label="Delay KPIs">
          <span className="train-kpi">
            <span className="train-kpi__value">{delayedTrains.length}</span>
            <span className="train-kpi__label">Delayed</span>
          </span>
          <span className="train-kpi train-kpi--danger">
            <span className="train-kpi__value">{critical}</span>
            <span className="train-kpi__label">Critical</span>
          </span>
          <span className="train-kpi train-kpi--warning">
            <span className="train-kpi__value">{severe}</span>
            <span className="train-kpi__label">Severe</span>
          </span>
          <span className="train-kpi">
            <span className="train-kpi__value">{formatDelay(avgDelay)}</span>
            <span className="train-kpi__label">Avg Delay</span>
          </span>
        </div>
      );
    }

    // Single-train KPI strip
    const severity     = getSeverity(train?.delayMinutes);
    const eta          = formatTime(train?.estimatedArrivalTime ?? train?.arrivalTime ?? null);
    const displayDelay = formatDelay(train?.delayMinutes ?? 0);
    return (
      <div className="train-delay-panel__kpi-strip" aria-label="Train delay KPIs">
        <span className={`train-kpi train-kpi--${severity.cssModifier}`}>
          <span className="train-kpi__value">{displayDelay}</span>
          <span className="train-kpi__label">Delay</span>
        </span>
        <span className={`train-kpi train-kpi--${severity.cssModifier}`}>
          <span className="train-kpi__value">{severity.label}</span>
          <span className="train-kpi__label">Severity</span>
        </span>
        {eta && (
          <span className="train-kpi">
            <span className="train-kpi__value">{eta}</span>
            <span className="train-kpi__label">ETA</span>
          </span>
        )}
        <span className="train-kpi">
          <span className="train-kpi__value">{train?.status ?? '—'}</span>
          <span className="train-kpi__label">Status</span>
        </span>
      </div>
    );
  }, [isFleetMode, delayedTrains, train]);

  // ── Stable IDs ───────────────────────────────────────────────────────────
  const boardId = useId();

  // ── Core content ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'train-delay-panel',
        isFleetMode        ? 'train-delay-panel--fleet'   : 'train-delay-panel--single',
        compact            ? 'train-delay-panel--compact'  : null,
        isStale            ? 'train-delay-panel--stale'   : null,
        error              ? 'train-delay-panel--error'   : null,
        syncing            ? 'train-delay-panel--live'    : null,
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
        <FleetDelayBoard
          delayedTrains={delayedTrains}
          maxRows={maxRows}
          onTrainSelect={onTrainSelect}
          compact={compact}
          listId={boardId}
        />
      ) : (
        <SingleTrainDelay
          train={train}
          showPropagation={showPropagation}
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

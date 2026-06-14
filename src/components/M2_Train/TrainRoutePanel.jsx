import React, { memo, useMemo, useCallback, useId } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * TrainRoutePanel — canonical route-progress visualisation for Module-2 Train
 * Operations. Renders the ordered stop sequence for a single train (origin →
 * intermediate stops → destination), marking each stop as completed, current,
 * or upcoming based on the canonical `Train` domain model fields
 * (`originStationId`, `destinationStationId`, `currentStationId`,
 * `nextStationId`, `routeId`, `status`, `delayMinutes`,
 * `estimatedArrivalTime`, `departureTime`, `arrivalTime`).
 *
 * The component is a pure read surface. All presentation state is derived
 * exclusively from `useTrainStore` selectors. No store mutations are performed.
 * It supports being mounted standalone, or wrapped by `DashboardLayout`
 * (kpiStrip + primary slot) or `SplitPanelLayout` (left or right panel).
 *
 * Dependencies:
 * - React (memo, useMemo, useCallback, useId)
 * - `src/store/trainStore` (Zustand selectors only — no mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId`        (string|number|null) — store key for lookup; falls back
 *                    to `getSelectedTrain()` when null (default: null)
 * - `train`          (object|null)        — optional direct Train object;
 *                    takes precedence over store lookup when supplied (default: null)
 * - `stops`          (Array|null)         — ordered stop array supplied by the
 *                    page when available from a route service response; each
 *                    entry: { stationId, stationName, scheduledArrival?,
 *                    scheduledDeparture?, platform? }. When null the panel
 *                    derives a minimal two-stop route from the Train model's
 *                    origin/destination fields (default: null)
 * - `layout`         ('dashboard'|'split'|null) — optional wrapper layout;
 *                    null renders bare content (default: null)
 * - `title`          (string|null)        — layout title override (default: null)
 * - `staleThreshold` (number)             — ms before `lastUpdatedAt` is
 *                    considered stale (default: 60000)
 * - `onStopSelect`   (fn|null)            — callback fired with the stop object
 *                    when a stop row is clicked (default: null)
 * - `compact`        (boolean)            — compact visual mode; reduces
 *                    padding and hides secondary metadata (default: false)
 * - `showDelay`      (boolean)            — render delay indicator on the
 *                    current stop when `train.delayMinutes` is set (default: true)
 * - `showPlatform`   (boolean)            — render platform column when stop
 *                    data carries a `platform` field (default: true)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`        — initial fetch in progress
 * - `refreshing`     — background refresh in progress
 * - `syncing`        — live WebSocket update in progress
 * - `error`          — last error from the store
 * - `lastUpdatedAt`  — ISO timestamp of last store write
 * - `getTrainById`   — id-keyed lookup selector
 * - `getSelectedTrain` — current selection fallback selector
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the stop state relative to the train's current position.
 * Returns 'completed' | 'current' | 'next' | 'upcoming'.
 */
function resolveStopState(stop, train, stopIndex, stops) {
  if (!train) return 'upcoming';

  const currentId = train.currentStationId ?? train.currentStation ?? null;
  const nextId = train.nextStationId ?? train.nextStation ?? null;
  const originId = train.originStationId ?? train.originStation ?? null;
  const sid = stop.stationId ?? stop.id ?? null;

  if (sid === currentId) return 'current';
  if (sid === nextId) return 'next';

  // Derive completed stops: everything before the current stop index
  if (currentId) {
    const currentIdx = stops.findIndex(
      (s) => (s.stationId ?? s.id) === currentId,
    );
    if (currentIdx > -1 && stopIndex < currentIdx) return 'completed';
  }

  // If no currentStationId exists but train has departed origin, mark origin completed
  if (sid === originId && train.status !== 'scheduled') return 'completed';

  return 'upcoming';
}

/**
 * Build a minimal two-stop list from the Train domain model when no external
 * stops array is provided.
 */
function deriveStopsFromTrain(train) {
  if (!train) return [];
  const stops = [];

  const origin = train.originStationId ?? train.originStation ?? null;
  const destination = train.destinationStationId ?? train.destinationStation ?? null;
  const current = train.currentStationId ?? train.currentStation ?? null;
  const next = train.nextStationId ?? train.nextStation ?? null;

  if (origin) {
    stops.push({
      stationId: origin,
      stationName: train.originStationName ?? origin,
      scheduledDeparture: train.departureTime ?? null,
      platform: train.originPlatform ?? null,
    });
  }

  // Insert current if it differs from origin and destination
  if (current && current !== origin && current !== destination) {
    stops.push({
      stationId: current,
      stationName: train.currentStationName ?? current,
      scheduledArrival: null,
      platform: train.platform ?? null,
    });
  }

  // Insert next if it differs from current and destination
  if (next && next !== current && next !== destination) {
    stops.push({
      stationId: next,
      stationName: train.nextStationName ?? next,
      scheduledArrival: null,
      platform: null,
    });
  }

  if (destination) {
    stops.push({
      stationId: destination,
      stationName: train.destinationStationName ?? destination,
      scheduledArrival: train.estimatedArrivalTime ?? train.arrivalTime ?? null,
      platform: train.destinationPlatform ?? null,
    });
  }

  return stops;
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

function formatDelay(minutes) {
  if (minutes == null || minutes === 0) return null;
  const sign = minutes > 0 ? '+' : '';
  return `${sign}${minutes}m`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="train-route-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {refreshing && <span className="train-pill" role="status">Refreshing</span>}
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function StopStateIcon({ state }) {
  switch (state) {
    case 'completed':
      return (
        <svg
          className="train-route-stop__icon train-route-stop__icon--completed"
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
        >
          <circle cx="9" cy="9" r="8" fill="currentColor" />
          <path d="M5 9l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'current':
      return (
        <svg
          className="train-route-stop__icon train-route-stop__icon--current"
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
        >
          <circle cx="9" cy="9" r="8" fill="currentColor" />
          <circle cx="9" cy="9" r="3.5" fill="#fff" />
        </svg>
      );
    case 'next':
      return (
        <svg
          className="train-route-stop__icon train-route-stop__icon--next"
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
        >
          <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="2" fill="#fff" />
          <circle cx="9" cy="9" r="3" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg
          className="train-route-stop__icon train-route-stop__icon--upcoming"
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
        >
          <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );
  }
}

function StopRow({
  stop,
  state,
  train,
  isLast,
  showDelay,
  showPlatform,
  compact,
  onClick,
  labelledById,
}) {
  const arrival = formatTime(stop.scheduledArrival ?? stop.arrivalTime ?? null);
  const departure = formatTime(stop.scheduledDeparture ?? stop.departureTime ?? null);
  const timeLabel = arrival ?? departure ?? null;
  const delay = state === 'current' && showDelay ? formatDelay(train?.delayMinutes) : null;
  const platform = showPlatform ? (stop.platform ?? null) : null;
  const stationName = stop.stationName ?? stop.name ?? stop.stationId ?? '—';

  const handleClick = useCallback(() => {
    if (typeof onClick === 'function') onClick(stop);
  }, [onClick, stop]);

  return (
    <li
      className={[
        'train-route-stop',
        `train-route-stop--${state}`,
        compact ? 'train-route-stop--compact' : null,
        !isLast ? 'train-route-stop--has-connector' : null,
        typeof onClick === 'function' ? 'train-route-stop--clickable' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-current={state === 'current' ? 'step' : undefined}
      aria-labelledby={labelledById}
      onClick={typeof onClick === 'function' ? handleClick : undefined}
      role={typeof onClick === 'function' ? 'button' : undefined}
      tabIndex={typeof onClick === 'function' ? 0 : undefined}
      onKeyDown={
        typeof onClick === 'function'
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }
          : undefined
      }
    >
      {/* Spine connector drawn by CSS using ::before on non-last items */}
      <div className="train-route-stop__spine" aria-hidden="true">
        <StopStateIcon state={state} />
      </div>

      <div className="train-route-stop__body">
        <div id={labelledById} className="train-route-stop__name">
          {stationName}
          {state === 'current' && (
            <span className="train-route-stop__badge train-route-stop__badge--current">
              Current
            </span>
          )}
          {state === 'next' && (
            <span className="train-route-stop__badge train-route-stop__badge--next">
              Next
            </span>
          )}
        </div>

        {!compact && (
          <div className="train-route-stop__meta">
            {timeLabel && (
              <span className="train-route-stop__time">{timeLabel}</span>
            )}
            {delay && (
              <span
                className={`train-route-stop__delay ${
                  (train?.delayMinutes ?? 0) > 0
                    ? 'train-route-stop__delay--late'
                    : 'train-route-stop__delay--early'
                }`}
              >
                {delay}
              </span>
            )}
            {platform && (
              <span className="train-route-stop__platform">Pf {platform}</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function RouteHeader({ train, stops }) {
  if (!train) return null;
  const totalStops = stops.length;
  const completedCount = stops.filter((_, i) => {
    const state = resolveStopState(stops[i], train, i, stops);
    return state === 'completed';
  }).length;

  const routeLabel = train.routeId ?? train.routeName ?? null;
  const serviceType = train.serviceType ?? null;
  const operatorName = train.operatorName ?? null;
  const delayStr = formatDelay(train.delayMinutes);

  return (
    <header className="train-route-panel__route-header">
      <div className="train-route-panel__route-meta">
        {routeLabel && (
          <span className="train-route-panel__route-id">Route {routeLabel}</span>
        )}
        {serviceType && (
          <span className={`train-route-panel__service-type train-route-panel__service-type--${String(serviceType).toLowerCase()}`}>
            {serviceType}
          </span>
        )}
        {operatorName && (
          <span className="train-route-panel__operator">{operatorName}</span>
        )}
      </div>
      <div className="train-route-panel__progress">
        <span className="train-route-panel__progress-label">
          {completedCount} / {totalStops} stops
        </span>
        {delayStr && (
          <span
            className={`train-route-panel__delay-badge ${
              (train.delayMinutes ?? 0) > 0
                ? 'train-route-panel__delay-badge--late'
                : 'train-route-panel__delay-badge--early'
            }`}
          >
            {delayStr}
          </span>
        )}
        <span
          className={`train-route-panel__status-chip train-route-panel__status-chip--${String(
            train.status ?? 'unknown',
          ).toLowerCase()}`}
        >
          {train.status ?? 'Unknown'}
        </span>
      </div>
    </header>
  );
}

function RouteBody({ train, resolvedStops, showDelay, showPlatform, compact, onStopSelect }) {
  const listId = useId();

  if (!train) {
    return (
      <div className="train-route-panel__empty" role="status">
        No train data available.
      </div>
    );
  }

  if (!resolvedStops || resolvedStops.length === 0) {
    return (
      <div className="train-route-panel__empty" role="status">
        No route stops available for this train.
      </div>
    );
  }

  return (
    <ol
      id={listId}
      className="train-route-panel__stop-list"
      aria-label={`Route stops for train ${train.trainNumber ?? train.id}`}
    >
      {resolvedStops.map((stop, idx) => {
        const state = resolveStopState(stop, train, idx, resolvedStops);
        const sid = stop.stationId ?? stop.id ?? `stop-${idx}`;
        const labelId = `${listId}-stop-${sid}`;

        return (
          <StopRow
            key={`${sid}-${idx}`}
            stop={stop}
            state={state}
            train={train}
            isLast={idx === resolvedStops.length - 1}
            showDelay={showDelay}
            showPlatform={showPlatform}
            compact={compact}
            onClick={onStopSelect}
            labelledById={labelId}
          />
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function TrainRoutePanel({
  trainId = null,
  train: trainProp = null,
  stops: stopsProp = null,
  layout = null,
  title = null,
  staleThreshold = 60000,
  onStopSelect = null,
  compact = false,
  showDelay = true,
  showPlatform = true,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);

  const trainFromStore = useTrainStore((s) =>
    trainId ? s.getTrainById(trainId) : s.getSelectedTrain(),
  );

  // ── Resolved train (prop wins over store) ────────────────────────────────
  const train = useMemo(
    () => trainProp ?? trainFromStore ?? null,
    [trainProp, trainFromStore],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt
      ? Date.parse(lastUpdatedAt)
      : train?.lastUpdatedAt
        ? Date.parse(train.lastUpdatedAt)
        : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, train, staleThreshold]);

  // ── Stop resolution ──────────────────────────────────────────────────────
  // Prefer explicit stops prop from page/route service over derived stops
  const resolvedStops = useMemo(() => {
    if (Array.isArray(stopsProp) && stopsProp.length > 0) return stopsProp;
    return deriveStopsFromTrain(train);
  }, [stopsProp, train]);

  // ── KPI strip (for DashboardLayout) ─────────────────────────────────────
  const kpiStrip = useMemo(() => {
    const totalStops = resolvedStops.length;
    const completedCount = resolvedStops.filter((s, i) => {
      const state = resolveStopState(s, train, i, resolvedStops);
      return state === 'completed';
    }).length;
    const eta = formatTime(
      train?.estimatedArrivalTime ?? train?.arrivalTime ?? null,
    );
    const delayStr = showDelay ? formatDelay(train?.delayMinutes) : null;

    return (
      <div className="train-route-panel__kpi-strip" aria-label="Route KPIs">
        <span className="train-kpi">
          <span className="train-kpi__value">{completedCount}/{totalStops}</span>
          <span className="train-kpi__label">Stops</span>
        </span>
        {eta && (
          <span className="train-kpi">
            <span className="train-kpi__value">{eta}</span>
            <span className="train-kpi__label">ETA</span>
          </span>
        )}
        {delayStr && (
          <span className={`train-kpi ${(train?.delayMinutes ?? 0) > 0 ? 'train-kpi--warning' : 'train-kpi--good'}`}>
            <span className="train-kpi__value">{delayStr}</span>
            <span className="train-kpi__label">Delay</span>
          </span>
        )}
        <span className="train-kpi">
          <span className="train-kpi__value">{train?.status ?? '—'}</span>
          <span className="train-kpi__label">Status</span>
        </span>
      </div>
    );
  }, [resolvedStops, train, showDelay]);

  // ── Derived empty/title state ────────────────────────────────────────────
  const isEmpty = !train || resolvedStops.length === 0;
  const resolvedTitle =
    title ??
    (train
      ? `Route — ${train.trainNumber ?? train.id ?? 'Train'}`
      : 'Train Route');

  // ── Core content ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'train-route-panel',
        compact ? 'train-route-panel--compact' : null,
        isStale ? 'train-route-panel--stale' : null,
        error ? 'train-route-panel--error' : null,
        syncing ? 'train-route-panel--live' : null,
      ]
        .filter(Boolean)
        .join(' ')}
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

      <RouteHeader train={train} stops={resolvedStops} />

      <RouteBody
        train={train}
        resolvedStops={resolvedStops}
        showDelay={showDelay}
        showPlatform={showPlatform}
        compact={compact}
        onStopSelect={onStopSelect}
      />
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

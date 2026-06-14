import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdTimeline — canonical crowd evolution timeline for Module-3 Crowd
 * Intelligence. Synthesises a chronological event log for a single station's
 * CrowdForecast history from fields available on the approved `CrowdForecast`
 * domain model, surfacing four operationally distinct event types:
 *
 *   1. Crowd Evolution      — crowd level change events (light → moderate,
 *                            moderate → heavy, etc.) derived by comparing
 *                            successive forecasts ordered by `generatedAt`.
 *
 *   2. Forecast Changes     — new forecast issuance events derived from
 *                            `generatedAt` and `generatedBy` on each forecast
 *                            in the station's visible collection.
 *
 *   3. Threshold Crossings  — events where the crowd level crossed above or
 *                            below the configurable `thresholdLevel`; each
 *                            crossing is annotated as "entered" or "cleared".
 *
 *   4. Surge History        — events where occupancy ≥ 90% or `surgeFlag`
 *                            is set; annotated with occupancy at surge time
 *                            and resolution when the condition clears.
 *
 * The component operates in two modes:
 *
 *   Single-station mode (when `forecastId` or `forecast` prop is supplied):
 *     Reads all visible forecasts for the same station from `getVisibleCrowdForecasts()`,
 *     filters by station key, and builds the event log chronologically.
 *
 *   All-stations mode (when neither is supplied):
 *     Synthesises a network-wide event log from the full visible forecast
 *     collection — each event is annotated with its station name.
 *
 * All presentation state is derived exclusively from `useCrowdStore` selectors.
 * No mutations are performed. No cross-domain store is imported.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `src/layouts/DetailLayout.jsx`
 *
 * Props:
 * - `forecastId`       (string|null)  — store key for lookup; falls back to
 *                      `getSelectedCrowdForecast()`. When absent, all-stations
 *                      mode activates (default: null)
 * - `forecast`         (object|null)  — direct CrowdForecast override; the
 *                      station key of this forecast is used to filter the
 *                      timeline scope (default: null)
 * - `layout`           ('detail'|'split'|null) — optional layout wrapper;
 *                      null renders bare content. `'detail'` is the primary
 *                      intended usage for deep-review surfaces (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before `lastUpdatedAt` is stale
 *                      (default: 60000)
 * - `thresholdLevel`   ('moderate'|'heavy'|'severe') — crowd level that
 *                      triggers threshold-crossing events (default: 'heavy')
 * - `maxEvents`        (number)       — max event rows to show (default: 50)
 * - `filter`           (string[]|null) — array of event type keys to show;
 *                      null shows all types. Valid keys: 'evolution',
 *                      'forecast', 'threshold', 'surge' (default: null)
 * - `compact`          (boolean)      — compact event row mode (default: false)
 * - `onEventSelect`    (fn|null)      — callback fired with the source
 *                      CrowdForecast when an event row is clicked (default: null)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`          — initial fetch in progress
 * - `refreshing`       — background refresh in progress
 * - `syncing`          — live WebSocket update in progress
 * - `error`            — last store error
 * - `lastUpdatedAt`    — ISO timestamp of last store write
 * - `getCrowdForecastById`      — id-keyed lookup selector
 * - `getSelectedCrowdForecast`  — current-selection fallback
 * - `getVisibleCrowdForecasts`  — full filtered collection
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CROWD_LEVEL_RANK = {
  light:    0,
  moderate: 1,
  heavy:    2,
  severe:   3,
};

const SURGE_THRESHOLD_PCT = 90;

const EVENT_TYPE_CONFIG = {
  evolution:  { key: 'evolution',  label: 'Crowd Evolution',    cssModifier: 'evolution',  icon: '↕' },
  forecast:   { key: 'forecast',   label: 'Forecast Issued',    cssModifier: 'forecast',   icon: '◎' },
  threshold:  { key: 'threshold',  label: 'Threshold Crossing', cssModifier: 'threshold',  icon: '⚡' },
  surge:      { key: 'surge',      label: 'Surge Event',        cssModifier: 'surge',      icon: '●' },
};

const CROWD_LEVEL_CONFIG = {
  light:    { label: 'Light',    cssModifier: 'light'    },
  moderate: { label: 'Moderate', cssModifier: 'moderate' },
  heavy:    { label: 'Heavy',    cssModifier: 'heavy'    },
  severe:   { label: 'Severe',   cssModifier: 'severe'   },
};

function levelRank(key) {
  return CROWD_LEVEL_RANK[String(key ?? 'light').toLowerCase()] ?? 0;
}

function levelLabel(key) {
  return CROWD_LEVEL_CONFIG[String(key ?? 'light').toLowerCase()]?.label ?? String(key);
}

function levelMod(key) {
  return CROWD_LEVEL_CONFIG[String(key ?? 'light').toLowerCase()]?.cssModifier ?? 'light';
}

// ---------------------------------------------------------------------------
// Occupancy derivation
// ---------------------------------------------------------------------------

function deriveOccupancyPct(forecast) {
  if (!forecast) return null;
  if (typeof forecast.occupancy === 'number') {
    return forecast.occupancy <= 1
      ? Math.round(forecast.occupancy * 100)
      : Math.min(100, Math.round(forecast.occupancy));
  }
  if (forecast.occupancy && typeof forecast.occupancy === 'object') {
    if (forecast.occupancy.pct   != null) return Math.min(100, Math.round(forecast.occupancy.pct));
    if (forecast.occupancy.ratio != null) return Math.round(forecast.occupancy.ratio * 100);
  }
  if (forecast.currentOccupancy != null && forecast.capacity != null) {
    return Math.min(
      100,
      Math.round((Number(forecast.currentOccupancy) / Number(forecast.capacity)) * 100),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Event synthesis
//
// Each synthesised event:
// {
//   id:           string,       -- unique key
//   type:         string,       -- 'evolution' | 'forecast' | 'threshold' | 'surge'
//   ts:           number,       -- Unix ms timestamp for sorting
//   tsIso:        string,       -- ISO string for display
//   stationName:  string,
//   title:        string,       -- event headline
//   detail:       string|null,  -- secondary description
//   fromLevel:    string|null,  -- for evolution events
//   toLevel:      string|null,  -- for evolution events
//   level:        string,       -- current crowd level at event time
//   direction:    'up'|'down'|null, -- for evolution / threshold events
//   occupancyPct: number|null,
//   forecast:     object,       -- source CrowdForecast
// }
// ---------------------------------------------------------------------------

function synthesiseEvents(sortedForecasts, thresholdLevel, filter) {
  const events = [];
  const thresholdRank = levelRank(thresholdLevel);

  // 1. Forecast issuance events (one per forecast)
  for (const f of sortedForecasts) {
    if (!filter || filter.includes('forecast')) {
      const ts    = f.generatedAt ?? f.lastUpdatedAt ?? null;
      const tsMs  = ts ? Date.parse(ts) : null;
      if (tsMs != null) {
        events.push({
          id:          `forecast-${f.id ?? f.stationId}-${tsMs}`,
          type:        'forecast',
          ts:          tsMs,
          tsIso:       ts,
          stationName: f.stationName ?? f.station ?? '—',
          title:       `Forecast issued — ${levelLabel(f.predictedCrowdLevel ?? f.crowdLevel)}`,
          detail:      [
            f.horizon           ? `Horizon: ${f.horizon}` : null,
            f.generatedBy       ? `By: ${f.generatedBy}` : null,
            f.confidenceBand    ? `Confidence: ${f.confidenceBand}` : null,
          ].filter(Boolean).join(' · ') || null,
          fromLevel:    null,
          toLevel:      null,
          level:        String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase(),
          direction:    null,
          occupancyPct: deriveOccupancyPct(f),
          forecast:     f,
        });
      }
    }
  }

  // 2-4. Crowd evolution, threshold crossings, and surge events
  //      derived by comparing consecutive forecasts in generatedAt order
  const ordered = [...sortedForecasts].sort((a, b) => {
    const ta = Date.parse(a.generatedAt ?? a.lastUpdatedAt ?? '0');
    const tb = Date.parse(b.generatedAt ?? b.lastUpdatedAt ?? '0');
    return ta - tb;
  });

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];

    const prevLevel = String(prev.predictedCrowdLevel ?? prev.crowdLevel ?? 'light').toLowerCase();
    const currLevel = String(curr.predictedCrowdLevel ?? curr.crowdLevel ?? 'light').toLowerCase();
    const prevRank  = levelRank(prevLevel);
    const currRank  = levelRank(currLevel);
    const ts        = curr.generatedAt ?? curr.lastUpdatedAt ?? null;
    const tsMs      = ts ? Date.parse(ts) : null;
    const station   = curr.stationName ?? curr.station ?? '—';
    const occPct    = deriveOccupancyPct(curr);
    const prevOcc   = deriveOccupancyPct(prev);

    if (tsMs == null) continue;

    // 2. Crowd evolution — level changed between consecutive forecasts
    if (currRank !== prevRank && (!filter || filter.includes('evolution'))) {
      const direction = currRank > prevRank ? 'up' : 'down';
      events.push({
        id:          `evolution-${curr.id ?? curr.stationId}-${tsMs}`,
        type:        'evolution',
        ts:          tsMs,
        tsIso:       ts,
        stationName: station,
        title:       `Crowd level ${direction === 'up' ? 'increased' : 'decreased'}: ${levelLabel(prevLevel)} → ${levelLabel(currLevel)}`,
        detail:      occPct != null ? `Occupancy: ${occPct}%` : null,
        fromLevel:   prevLevel,
        toLevel:     currLevel,
        level:       currLevel,
        direction,
        occupancyPct: occPct,
        forecast:    curr,
      });
    }

    // 3. Threshold crossings — level crossed the threshold in either direction
    if (!filter || filter.includes('threshold')) {
      const prevAbove = prevRank >= thresholdRank;
      const currAbove = currRank >= thresholdRank;

      if (!prevAbove && currAbove) {
        // Entered threshold breach
        events.push({
          id:          `threshold-enter-${curr.id ?? curr.stationId}-${tsMs}`,
          type:        'threshold',
          ts:          tsMs,
          tsIso:       ts,
          stationName: station,
          title:       `Threshold entered: crowd level reached ${levelLabel(currLevel)}`,
          detail:      `Threshold: ${levelLabel(thresholdLevel)}${occPct != null ? ` · Occupancy: ${occPct}%` : ''}`,
          fromLevel:   prevLevel,
          toLevel:     currLevel,
          level:       currLevel,
          direction:   'up',
          occupancyPct: occPct,
          forecast:    curr,
        });
      } else if (prevAbove && !currAbove) {
        // Cleared threshold breach
        events.push({
          id:          `threshold-clear-${curr.id ?? curr.stationId}-${tsMs}`,
          type:        'threshold',
          ts:          tsMs,
          tsIso:       ts,
          stationName: station,
          title:       `Threshold cleared: crowd level returned to ${levelLabel(currLevel)}`,
          detail:      `Was at: ${levelLabel(prevLevel)}${occPct != null ? ` · Occupancy: ${occPct}%` : ''}`,
          fromLevel:   prevLevel,
          toLevel:     currLevel,
          level:       currLevel,
          direction:   'down',
          occupancyPct: occPct,
          forecast:    curr,
        });
      }
    }

    // 4. Surge history — surge onset and resolution
    if (!filter || filter.includes('surge')) {
      const prevSurge = Boolean(prev.surgeFlag ?? prev.isSurge) || (prevOcc != null && prevOcc >= SURGE_THRESHOLD_PCT);
      const currSurge = Boolean(curr.surgeFlag ?? curr.isSurge) || (occPct  != null && occPct  >= SURGE_THRESHOLD_PCT);

      if (!prevSurge && currSurge) {
        events.push({
          id:          `surge-onset-${curr.id ?? curr.stationId}-${tsMs}`,
          type:        'surge',
          ts:          tsMs,
          tsIso:       ts,
          stationName: station,
          title:       'Surge onset',
          detail:      occPct != null ? `Occupancy: ${occPct}%` : null,
          fromLevel:   prevLevel,
          toLevel:     currLevel,
          level:       currLevel,
          direction:   'up',
          occupancyPct: occPct,
          forecast:    curr,
        });
      } else if (prevSurge && !currSurge) {
        events.push({
          id:          `surge-clear-${curr.id ?? curr.stationId}-${tsMs}`,
          type:        'surge',
          ts:          tsMs,
          tsIso:       ts,
          stationName: station,
          title:       'Surge resolved',
          detail:      occPct != null ? `Occupancy returned to ${occPct}%` : null,
          fromLevel:   prevLevel,
          toLevel:     currLevel,
          level:       currLevel,
          direction:   'down',
          occupancyPct: occPct,
          forecast:    curr,
        });
      }
    }
  }

  // Sort all events descending (newest first)
  events.sort((a, b) => b.ts - a.ts);

  return events;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatDate(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return null; }
}

function formatTime(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="crowd-timeline__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

/**
 * LevelChip — tiny inline crowd level label used in evolution events.
 */
function LevelChip({ level }) {
  return (
    <span
      className={`crowd-timeline__level-chip crowd-timeline__level-chip--${levelMod(level)}`}
      aria-label={levelLabel(level)}
    >
      {levelLabel(level)}
    </span>
  );
}

/**
 * EventRow — a single timeline event item.
 */
function EventRow({ event, isAllStations, compact, onEventSelect, rowId }) {
  const typeCfg = EVENT_TYPE_CONFIG[event.type] ?? EVENT_TYPE_CONFIG.forecast;
  const isClickable = typeof onEventSelect === 'function' && Boolean(event.forecast);

  const handleClick = () => {
    if (isClickable) onEventSelect(event.forecast);
  };

  return (
    <li
      id={rowId}
      className={[
        'crowd-timeline__event',
        `crowd-timeline__event--${typeCfg.cssModifier}`,
        `crowd-timeline__event--level-${levelMod(event.level)}`,
        event.direction ? `crowd-timeline__event--${event.direction}` : null,
        compact      ? 'crowd-timeline__event--compact'   : null,
        isClickable  ? 'crowd-timeline__event--clickable'  : null,
      ].filter(Boolean).join(' ')}
      role={isClickable ? 'button' : 'listitem'}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`${typeCfg.label} — ${event.title}${isAllStations ? ` at ${event.stationName}` : ''}`}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }
          : undefined
      }
    >
      {/* Timeline spine connector */}
      <div className="crowd-timeline__event-spine" aria-hidden="true">
        <span
          className={`crowd-timeline__event-node crowd-timeline__event-node--${typeCfg.cssModifier}`}
        >
          {typeCfg.icon}
        </span>
        <div className="crowd-timeline__event-line" />
      </div>

      {/* Event body */}
      <div className="crowd-timeline__event-body">
        {/* Timestamp */}
        <div className="crowd-timeline__event-time" aria-label={`Event time: ${formatWhen(event.tsIso)}`}>
          <span className="crowd-timeline__event-date">{formatDate(event.tsIso)}</span>
          <span className="crowd-timeline__event-clock">{formatTime(event.tsIso)}</span>
        </div>

        {/* Type badge */}
        <span
          className={`crowd-timeline__event-type crowd-timeline__event-type--${typeCfg.cssModifier}`}
        >
          {typeCfg.label}
        </span>

        {/* Title with level chip for evolution events */}
        <div className="crowd-timeline__event-title">
          {event.type === 'evolution' && event.fromLevel && event.toLevel ? (
            <>
              Crowd{' '}
              {event.direction === 'up' ? 'increased' : 'decreased'}
              {': '}
              <LevelChip level={event.fromLevel} />
              {' → '}
              <LevelChip level={event.toLevel} />
            </>
          ) : (
            event.title
          )}
        </div>

        {/* Station (all-stations mode) */}
        {isAllStations && (
          <div className="crowd-timeline__event-station" aria-label={`Station: ${event.stationName}`}>
            {event.stationName}
          </div>
        )}

        {/* Detail */}
        {!compact && event.detail && (
          <div className="crowd-timeline__event-detail">{event.detail}</div>
        )}
      </div>
    </li>
  );
}

/**
 * EventList — the full chronological event list.
 */
function EventList({ events, maxEvents, isAllStations, compact, onEventSelect, listId }) {
  if (events.length === 0) {
    return (
      <div className="crowd-timeline__empty" role="status">
        No timeline events for current scope.
      </div>
    );
  }

  const visible  = events.slice(0, maxEvents);
  const overflow = events.length - visible.length;

  return (
    <>
      <ol
        id={listId}
        className={[
          'crowd-timeline__list',
          compact ? 'crowd-timeline__list--compact' : null,
        ].filter(Boolean).join(' ')}
        aria-label={`Crowd timeline — ${visible.length} events`}
      >
        {visible.map((ev, idx) => (
          <EventRow
            key={ev.id ?? idx}
            rowId={`${listId}-ev-${ev.id ?? idx}`}
            event={ev}
            isAllStations={isAllStations}
            compact={compact}
            onEventSelect={onEventSelect}
          />
        ))}
      </ol>
      {overflow > 0 && (
        <div
          className="crowd-timeline__overflow"
          role="note"
          aria-label={`${overflow} older events not shown`}
        >
          +{overflow} older events
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Event type filter summary (for DetailLayout rail slot)
// ---------------------------------------------------------------------------

function EventTypeSummary({ events }) {
  const counts = { evolution: 0, forecast: 0, threshold: 0, surge: 0 };
  for (const ev of events) {
    if (counts[ev.type] != null) counts[ev.type] += 1;
  }

  return (
    <div className="crowd-timeline__type-summary" aria-label="Event type breakdown">
      {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
        <div
          key={key}
          className={`crowd-timeline__type-row crowd-timeline__type-row--${cfg.cssModifier}`}
          aria-label={`${cfg.label}: ${counts[key]} event${counts[key] !== 1 ? 's' : ''}`}
        >
          <span className="crowd-timeline__type-icon" aria-hidden="true">{cfg.icon}</span>
          <span className="crowd-timeline__type-name">{cfg.label}</span>
          <span className="crowd-timeline__type-count">{counts[key]}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdTimeline({
  forecastId       = null,
  forecast: fProp  = null,
  layout           = null,
  title            = null,
  staleThreshold   = 60000,
  thresholdLevel   = 'heavy',
  maxEvents        = 50,
  filter           = null,
  compact          = false,
  onEventSelect    = null,
}) {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useCrowdStore((s) => s.loading);
  const refreshing    = useCrowdStore((s) => s.refreshing);
  const syncing       = useCrowdStore((s) => s.syncing);
  const error         = useCrowdStore((s) => s.error);
  const lastUpdatedAt = useCrowdStore((s) => s.lastUpdatedAt);

  const forecastFromStore = useCrowdStore((s) =>
    forecastId ? s.getCrowdForecastById(forecastId) : s.getSelectedCrowdForecast(),
  );

  const getVisibleCrowdForecasts = useCrowdStore((s) =>
    typeof s.getVisibleCrowdForecasts === 'function' ? s.getVisibleCrowdForecasts : null,
  );

  // ── Resolved anchor forecast ─────────────────────────────────────────────
  const anchorForecast = useMemo(
    () => fProp ?? forecastFromStore ?? null,
    [fProp, forecastFromStore],
  );

  // ── All visible forecasts ────────────────────────────────────────────────
  const allForecasts = useMemo(() => {
    try { return getVisibleCrowdForecasts ? getVisibleCrowdForecasts() : []; }
    catch { return []; }
  }, [getVisibleCrowdForecasts]);

  // ── Mode determination ───────────────────────────────────────────────────
  const isAllStations = !forecastId && !fProp;

  // ── Scoped forecast collection for this timeline ─────────────────────────
  const scopedForecasts = useMemo(() => {
    if (isAllStations) return allForecasts;
    const stationKey =
      anchorForecast?.stationId ??
      anchorForecast?.stationName ??
      anchorForecast?.station ??
      null;
    if (!stationKey) return anchorForecast ? [anchorForecast] : [];
    return allForecasts.filter((f) => {
      const fKey = f.stationId ?? f.stationName ?? f.station;
      return fKey === stationKey;
    });
  }, [isAllStations, allForecasts, anchorForecast]);

  // ── Event synthesis ──────────────────────────────────────────────────────
  const events = useMemo(
    () => synthesiseEvents(scopedForecasts, thresholdLevel, filter),
    [scopedForecasts, thresholdLevel, filter],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty = scopedForecasts.length === 0 && !loading;

  const stationName = anchorForecast?.stationName ?? anchorForecast?.station ?? null;
  const resolvedTitle = title ?? (
    isAllStations
      ? 'Crowd Timeline — All Stations'
      : stationName
        ? `Crowd Timeline — ${stationName}`
        : 'Crowd Timeline'
  );

  // ── Event counts for summary ─────────────────────────────────────────────
  const surgeCount     = events.filter((e) => e.type === 'surge').length;
  const thresholdCount = events.filter((e) => e.type === 'threshold').length;
  const evolutionCount = events.filter((e) => e.type === 'evolution').length;
  const lastUpdated    = formatWhen(lastUpdatedAt);

  // ── Stable IDs ───────────────────────────────────────────────────────────
  const listId = useId();

  // ── Core event list ──────────────────────────────────────────────────────
  const eventList = (
    <EventList
      events={events}
      maxEvents={maxEvents}
      isAllStations={isAllStations}
      compact={compact}
      onEventSelect={onEventSelect}
      listId={listId}
    />
  );

  // ── Core wrapper ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'crowd-timeline',
        isAllStations ? 'crowd-timeline--all-stations'  : 'crowd-timeline--single-station',
        compact       ? 'crowd-timeline--compact'        : null,
        isStale       ? 'crowd-timeline--stale'          : null,
        error         ? 'crowd-timeline--error'          : null,
        syncing       ? 'crowd-timeline--live'           : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <div className="crowd-timeline__header">
        <StatusPills
          loading={loading}
          refreshing={refreshing}
          syncing={syncing}
          isStale={isStale}
          error={error}
        />
        {!compact && !isAllStations && stationName && (
          <div className="crowd-timeline__station-label">{stationName}</div>
        )}
      </div>

      {isEmpty ? (
        <div className="crowd-timeline__empty" role="status">
          No crowd forecast data available for this scope.
        </div>
      ) : (
        eventList
      )}
    </div>
  );

  // ── DetailLayout summary slot ─────────────────────────────────────────────
  const detailSummary = (
    <div className="crowd-timeline__detail-summary">
      {stationName && (
        <div className="crowd-timeline__summary-station">{stationName}</div>
      )}
      <div className="crowd-timeline__summary-counts">
        <span className="crowd-timeline__summary-count" aria-label={`${events.length} total events`}>
          {events.length} events
        </span>
        {surgeCount > 0 && (
          <span className="crowd-timeline__summary-count crowd-timeline__summary-count--surge"
            aria-label={`${surgeCount} surge events`}>
            {surgeCount} surge
          </span>
        )}
        {thresholdCount > 0 && (
          <span className="crowd-timeline__summary-count crowd-timeline__summary-count--threshold"
            aria-label={`${thresholdCount} threshold crossings`}>
            {thresholdCount} crossings
          </span>
        )}
        {evolutionCount > 0 && (
          <span className="crowd-timeline__summary-count"
            aria-label={`${evolutionCount} level changes`}>
            {evolutionCount} level changes
          </span>
        )}
      </div>
      {lastUpdated && (
        <div className="crowd-timeline__summary-updated">Updated {lastUpdated}</div>
      )}
    </div>
  );

  // ── Layout wrappers ───────────────────────────────────────────────────────
  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={null}
        summary={detailSummary}
        body={content}
        rail={<EventTypeSummary events={events} />}
        footer={null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && !isEmpty}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={null}
        left={content}
        right={<EventTypeSummary events={events} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return content;
});

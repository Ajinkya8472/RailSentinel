import React, { memo, useMemo, useId } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * ConflictTimeline — chronological event log for Module-6 ScheduleConflict
 * entities. Synthesises a time-ordered event stream from conflict domain fields:
 *
 *   1. detected        — `createdAt` — conflict first detected
 *   2. escalated       — `escalationLevel` > 0 (uses `escalatedAt`)
 *   3. resolution_started — resolutionStatus: 'in-progress' (uses `updatedAt`)
 *   4. approved        — resolutionStatus: 'approved' (uses `approvedAt`)
 *   5. rejected        — resolutionStatus: 'rejected' (uses `rejectedAt`)
 *   6. resolved        — status: 'resolved' (uses `resolvedAt`)
 *   7. window_open     — `windowStart` event
 *   8. window_close    — `windowEnd` event
 *   9. events[]        — pass-through events from `/timeline` endpoint
 *
 * Supports single-conflict and multi-conflict modes.
 * DetailLayout is primary. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `conflict`      (object|null)  — single conflict (default: null)
 * - `conflicts`     (object[])     — list mode (default: [])
 * - `layout`        ('detail'|'split'|null) (default: null)
 * - `title`         (string|null)  (default: null)
 * - `loading`       (boolean)      (default: false)
 * - `syncing`       (boolean)      (default: false)
 * - `isStale`       (boolean)      (default: false)
 * - `error`         (any)          (default: null)
 * - `maxEvents`     (number)       (default: 60)
 * - `compact`       (boolean)      (default: false)
 * - `onRetry`       (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Event synthesis
// ---------------------------------------------------------------------------

const EVENT_CONFIG = {
  detected:           { label: 'Detected',            icon: '◉', cssModifier: 'detected'           },
  window_open:        { label: 'Window Opens',         icon: '→', cssModifier: 'window-open'        },
  window_close:       { label: 'Window Closes',        icon: '←', cssModifier: 'window-close'       },
  escalated:          { label: 'Escalated',            icon: '⚡', cssModifier: 'escalated'          },
  resolution_started: { label: 'Resolution Started',   icon: '↺', cssModifier: 'resolution-started' },
  approved:           { label: 'Approved',             icon: '✔', cssModifier: 'approved'           },
  rejected:           { label: 'Rejected',             icon: '✗', cssModifier: 'rejected'           },
  resolved:           { label: 'Resolved',             icon: '✓', cssModifier: 'resolved'           },
  event:              { label: 'Event',                icon: '·', cssModifier: 'event'              },
};

function evtConfig(type) { return EVENT_CONFIG[type] ?? EVENT_CONFIG.event; }

function extractEvents(c) {
  if (!c) return [];
  const events = [];

  if (c.createdAt)     events.push({ key: `detected-${c.id}`,   type: 'detected',           ts: c.createdAt,     conflict: c });
  if (c.windowStart)   events.push({ key: `wopen-${c.id}`,      type: 'window_open',         ts: c.windowStart,   conflict: c });
  if (c.windowEnd)     events.push({ key: `wclose-${c.id}`,     type: 'window_close',        ts: c.windowEnd,     conflict: c });

  const escLevel = Number(c.escalationLevel ?? 0);
  if (escLevel > 0 && (c.escalatedAt || c.updatedAt)) {
    events.push({ key: `esc-${c.id}`, type: 'escalated', ts: c.escalatedAt ?? c.updatedAt, conflict: c });
  }

  const resSt = String(c.resolutionStatus ?? '').toLowerCase();
  if (['in-progress', 'in_progress'].includes(resSt)) {
    events.push({ key: `res-started-${c.id}`, type: 'resolution_started', ts: c.resolutionStartedAt ?? c.updatedAt, conflict: c });
  }
  if (resSt === 'approved') events.push({ key: `approved-${c.id}`, type: 'approved', ts: c.approvedAt ?? c.resolvedAt ?? c.updatedAt, conflict: c });
  if (resSt === 'rejected') events.push({ key: `rejected-${c.id}`, type: 'rejected', ts: c.rejectedAt ?? c.updatedAt, conflict: c });

  const status = String(c.status ?? '').toLowerCase();
  if (status === 'resolved' && c.resolvedAt) {
    events.push({ key: `resolved-${c.id}`, type: 'resolved', ts: c.resolvedAt, conflict: c });
  }

  // Pass-through events from /timeline endpoint
  for (const e of (Array.isArray(c.events) ? c.events : [])) {
    events.push({ key: `evt-${c.id}-${e.id ?? Math.random()}`, type: 'event', ts: e.timestamp ?? e.at ?? null, label: e.type ?? e.label, conflict: c });
  }

  return events;
}

function formatTime(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return null; }
}
function formatDate(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="conflict-timeline__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EventRow({ event, compact, rowId }) {
  const cfg      = evtConfig(event.type);
  const timeStr  = formatTime(event.ts);
  const dateStr  = formatDate(event.ts);
  const typeText = event.label ?? cfg.label;
  const title    = event.conflict?.type ?? event.conflict?.id ?? '';

  return (
    <li id={rowId}
      className={[
        'conflict-timeline__event',
        `conflict-timeline__event--${cfg.cssModifier}`,
        compact ? 'conflict-timeline__event--compact' : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${typeText}${title ? `: ${title}` : ''}`}
    >
      <div className="conflict-timeline__event-time">
        {dateStr && <span className="conflict-timeline__event-date">{dateStr}</span>}
        {timeStr && <span className="conflict-timeline__event-clock">{timeStr}</span>}
      </div>
      <div className="conflict-timeline__event-connector" aria-hidden="true">
        <span className={`conflict-timeline__event-dot conflict-timeline__event-dot--${cfg.cssModifier}`}>{cfg.icon}</span>
        <div className="conflict-timeline__event-line" />
      </div>
      <div className="conflict-timeline__event-body">
        <div className="conflict-timeline__event-type">{typeText}</div>
        {title && !compact && <div className="conflict-timeline__event-conflict-id">{title}</div>}
      </div>
    </li>
  );
}

function TypeSummaryRail({ events }) {
  const counts = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return (
    <div className="conflict-timeline__rail" aria-label="Event type summary">
      <div className="conflict-timeline__rail-title">Event Types</div>
      {Object.entries(EVENT_CONFIG).map(([type, cfg]) =>
        counts[type] ? (
          <div key={type} className={`conflict-timeline__rail-row conflict-timeline__rail-row--${cfg.cssModifier}`}>
            <span aria-hidden="true">{cfg.icon}</span>
            <span>{cfg.label}</span>
            <span className="conflict-timeline__rail-count">{counts[type]}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ConflictTimeline({
  conflict    = null,
  conflicts   = [],
  layout      = null,
  title       = null,
  loading     = false,
  syncing     = false,
  isStale     = false,
  error       = null,
  maxEvents   = 60,
  compact     = false,
  onRetry     = null,
}) {
  const source = useMemo(() => {
    if (conflict) return [conflict];
    return conflicts;
  }, [conflict, conflicts]);

  const allEvents = useMemo(() =>
    source.flatMap(extractEvents)
      .sort((a, b) => String(b.ts ?? '').localeCompare(String(a.ts ?? ''))),
  [source]);

  const events    = allEvents.slice(0, maxEvents);
  const isEmpty   = events.length === 0 && !loading;
  const listId    = useId();
  const resolvedTitle = title ?? (conflict?.type ? `Timeline — ${conflict.type}` : 'Conflict Timeline');

  const body = (
    <div
      className={[
        'conflict-timeline',
        compact ? 'conflict-timeline--compact' : null,
        isStale ? 'conflict-timeline--stale'   : null,
        error   ? 'conflict-timeline--error'   : null,
        syncing ? 'conflict-timeline--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="conflict-timeline__empty" role="status">No conflict events.</div>
      ) : (
        <ol id={listId} className="conflict-timeline__list"
          aria-label={`${events.length} conflict event${events.length !== 1 ? 's' : ''}`}>
          {events.map((evt) => (
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
        summary={<div>{events.length} events<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<TypeSummaryRail events={allEvents} />}
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
        left={body}
        right={<TypeSummaryRail events={allEvents} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

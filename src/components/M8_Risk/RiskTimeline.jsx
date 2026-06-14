import React, { memo, useMemo, useId } from 'react';
import useRiskStore from '../../store/riskStore';
import RiskSeverityBadge from './RiskSeverityBadge';
import RiskInsightCard from './RiskInsightCard';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';

/**
 * Purpose:
 * RiskTimeline — chronological event log for Module-8 Risk Intelligence.
 * Synthesises a time-ordered event stream from RiskScore entities in the
 * store, using:
 *
 *   - `computedAt`     — risk score first computed / latest computation
 *   - `lastUpdatedAt`  — most recent update to the score
 *   - `events[]`       — pass-through events array (from /events endpoint)
 *
 * Each event row is grouped by day. Selected entity is highlighted.
 * Clicking an event card fires riskStore.selectRiskScore(id).
 *
 * Store integration (read-only selectors):
 *   - `getVisibleRiskScores()` — post-filter sorted list
 *   - `selectedRiskScoreId`    — highlight selected entity
 *   - `selectRiskScore()`      — selection action
 *   - `loading`, `syncing`, `error`, `refreshing`
 *
 * Dependencies:
 * - React (memo, useMemo, useId)
 * - `src/store/riskStore` (approved selectors only)
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./RiskSeverityBadge`
 * - `./RiskInsightCard`
 *
 * Props:
 * - `layout`      ('split'|null) (default: null)
 * - `title`       (string|null)  (default: null)
 * - `compact`     (boolean)      (default: false)
 * - `maxEvents`   (number)       (default: 50)
 * - `onRetry`     (fn|null)      (default: null)
 *
 * State: none local — all from riskStore.
 */

// ---------------------------------------------------------------------------
// Event synthesis
// ---------------------------------------------------------------------------

const EVENT_CONFIG = {
  computed:      { label: 'Computed',      icon: '◉', cssModifier: 'computed'  },
  updated:       { label: 'Updated',       icon: '↺', cssModifier: 'updated'   },
  escalated:     { label: 'Escalated',     icon: '⚡', cssModifier: 'escalated' },
  created:       { label: 'Created',       icon: '★', cssModifier: 'created'   },
  recalculated:  { label: 'Recalculated',  icon: '⟳', cssModifier: 'recalculate'},
  event:         { label: 'Event',         icon: '·', cssModifier: 'event'     },
};

function evtConfig(type) { return EVENT_CONFIG[type] ?? EVENT_CONFIG.event; }

function extractEvents(rs) {
  const events = [];
  if (rs.computedAt) {
    events.push({ key: `computed-${rs.id}`, type: 'computed', ts: rs.computedAt, riskScore: rs });
  }
  if (rs.lastUpdatedAt && rs.lastUpdatedAt !== rs.computedAt) {
    events.push({ key: `updated-${rs.id}`, type: 'updated', ts: rs.lastUpdatedAt, riskScore: rs });
  }
  if (rs.createdAt && rs.createdAt !== rs.computedAt) {
    events.push({ key: `created-${rs.id}`, type: 'created', ts: rs.createdAt, riskScore: rs });
  }
  for (const e of (Array.isArray(rs.events) ? rs.events : [])) {
    events.push({
      key: `evt-${rs.id}-${e.id ?? Math.random()}`,
      type: String(e.type ?? 'event').toLowerCase(),
      ts: e.timestamp ?? e.at ?? null,
      label: e.label ?? e.type,
      riskScore: rs,
    });
  }
  return events;
}

function formatDate(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return null; }
}
function formatTime(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return null; }
}
function dateGroupKey(iso) {
  try { if (!iso) return 'unknown'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10); } catch { return 'unknown'; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, error }) {
  if (!loading && !refreshing && !syncing && !error) return null;
  return (
    <div className="risk-timeline__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EventRow({ event, compact, isSelected, onSelectRisk }) {
  const cfg      = evtConfig(event.type);
  const timeStr  = formatTime(event.ts);
  const typeText = event.label ?? cfg.label;
  const name     = event.riskScore?.name ?? event.riskScore?.title ?? event.riskScore?.id ?? '';
  const band     = String(event.riskScore?.severityBand ?? '').toLowerCase();

  return (
    <li
      className={[
        'risk-timeline__event',
        `risk-timeline__event--${cfg.cssModifier}`,
        isSelected  ? 'risk-timeline__event--selected' : null,
        compact     ? 'risk-timeline__event--compact'  : null,
      ].filter(Boolean).join(' ')}
      role="listitem"
      aria-label={`${typeText}: ${name}`}
    >
      <div className="risk-timeline__event-time" aria-hidden="true">
        {timeStr && <span className="risk-timeline__event-clock">{timeStr}</span>}
      </div>
      <div className="risk-timeline__event-connector" aria-hidden="true">
        <span className={`risk-timeline__event-dot risk-timeline__event-dot--${band || 'unknown'}`}>{cfg.icon}</span>
        <div className="risk-timeline__event-line" />
      </div>
      <div className="risk-timeline__event-body">
        <button
          type="button"
          className="risk-timeline__event-btn"
          aria-label={`View risk: ${name}`}
          onClick={() => typeof onSelectRisk === 'function' && onSelectRisk(event.riskScore)}
        >
          <span className="risk-timeline__event-type">{typeText}</span>
          <span className="risk-timeline__event-name">{name}</span>
        </button>
        {!compact && (
          <RiskSeverityBadge riskScore={event.riskScore} size="sm" showLabel={false} />
        )}
      </div>
    </li>
  );
}

function EventTypeSummaryRail({ events }) {
  const counts = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return (
    <div className="risk-timeline__rail" aria-label="Timeline event type summary">
      <div className="risk-timeline__rail-title">Event Types</div>
      {Object.entries(EVENT_CONFIG).map(([type, cfg]) =>
        counts[type] ? (
          <div key={type} className={`risk-timeline__rail-row risk-timeline__rail-row--${cfg.cssModifier}`}>
            <span aria-hidden="true">{cfg.icon}</span>
            <span>{cfg.label}</span>
            <span className="risk-timeline__rail-count">{counts[type]}</span>
          </div>
        ) : null
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskTimeline({
  layout     = null,
  title      = null,
  compact    = false,
  maxEvents  = 50,
  onRetry    = null,
}) {
  const listId = useId();

  // ── Store reads ──────────────────────────────────────────────────────────────
  const loading              = useRiskStore((s) => s.loading);
  const refreshing           = useRiskStore((s) => s.refreshing);
  const syncing              = useRiskStore((s) => s.syncing);
  const error                = useRiskStore((s) => s.error);
  const selectedId           = useRiskStore((s) => s.selectedRiskScoreId);
  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);
  const selectRiskScore      = useRiskStore((s) => s.selectRiskScore);

  // ── Event synthesis ─────────────────────────────────────────────────────────
  const visible = useMemo(() => getVisibleRiskScores(), [getVisibleRiskScores]);

  const allEvents = useMemo(() =>
    visible
      .flatMap(extractEvents)
      .filter((e) => e.ts)
      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
      .slice(0, maxEvents),
  [visible, maxEvents]);

  // Group by day
  const groupedEvents = useMemo(() => {
    const groups = [];
    const seen = new Map();
    for (const evt of allEvents) {
      const dayKey = dateGroupKey(evt.ts);
      if (!seen.has(dayKey)) {
        seen.set(dayKey, groups.length);
        groups.push({ dayKey, label: formatDate(evt.ts) ?? dayKey, events: [] });
      }
      groups[seen.get(dayKey)].events.push(evt);
    }
    return groups;
  }, [allEvents]);

  function handleSelect(rs) { if (rs?.id) selectRiskScore(rs.id); }

  const isEmpty       = allEvents.length === 0 && !loading;
  const resolvedTitle = title ?? 'Risk Timeline';

  const body = (
    <div
      className={[
        'risk-timeline',
        compact ? 'risk-timeline--compact' : null,
        error   ? 'risk-timeline--error'   : null,
        syncing ? 'risk-timeline--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} refreshing={refreshing} syncing={syncing} error={error} />}

      {isEmpty ? (
        <div className="risk-timeline__empty" role="status">No risk events.</div>
      ) : (
        <div id={listId} className="risk-timeline__groups">
          {groupedEvents.map((group) => (
            <section key={group.dayKey} className="risk-timeline__day-group" aria-label={`Events on ${group.label}`}>
              <h3 className="risk-timeline__day-label">{group.label}</h3>
              <ol className="risk-timeline__event-list"
                aria-label={`${group.events.length} events`}>
                {group.events.map((evt) => (
                  <EventRow
                    key={evt.key}
                    event={evt}
                    compact={compact}
                    isSelected={evt.riskScore?.id === selectedId}
                    onSelectRisk={handleSelect}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={body}
        right={<EventTypeSummaryRail events={allEvents} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

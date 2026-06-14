import React, { memo, useMemo } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';
import useIncidentStore from '../../store/incidentStore';
import ScheduleStatusBadge from './ScheduleStatusBadge';

/**
 * Purpose:
 * ConflictDetailPanel — canonical single-entity deep-review surface for
 * Module-6 Smart Scheduling. Renders the complete operational profile of
 * one ScheduleConflict across all DetailLayout slots.
 *
 * Content regions (DetailLayout slots):
 *
 *   Header slot  — conflict type, severity badge, escalation level, timing window.
 *
 *   Summary slot — impact score meter, train count, route segment count,
 *                  resolution status.
 *
 *   Body         — five stacked sections:
 *     1. Core Detail          — id, type, severity, status, resolutionStatus,
 *                              impactScore, windowStart/End, createdAt/updatedAt
 *     2. Route Segments       — affectedRouteSegments[] as chips
 *     3. Train Paths          — conflictingTrainIds[] resolved to names via trainStore
 *     4. Linked Incidents     — linkedIncidentIds[] resolved via incidentStore
 *     5. Crowd / Risk Context — crowdForecastIds[], riskContext as references
 *
 *   Rail slot    — conflict metadata: ID, type, severity, impactScore,
 *                  escalationLevel, resolutionStatus, createdAt.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/trainStore`    (read-only — getTrainById)
 * - `src/store/incidentStore` (read-only — getIncidentById)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./ScheduleStatusBadge`
 *
 * Props:
 * - `conflict`    (object|null)  (default: null)
 * - `layout`      ('detail'|'split'|null) (default: null)
 * - `title`       (string|null)  (default: null)
 * - `loading`     (boolean)      (default: false)
 * - `syncing`     (boolean)      (default: false)
 * - `isStale`     (boolean)      (default: false)
 * - `error`       (any)          (default: null)
 * - `compact`     (boolean)      (default: false)
 * - `onRetry`     (fn|null)      (default: null)
 * - `onResolve`   (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
  medium:   { label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  high:     { label: 'High',     cssModifier: 'high',     icon: '▲' },
  critical: { label: 'Critical', cssModifier: 'critical', icon: '✕' },
};

function sevConfig(k) { return SEVERITY_CONFIG[String(k ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low; }
function sevRank(k)   { return ['low','medium','high','critical'].indexOf(String(k ?? 'low').toLowerCase()); }

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="conflict-detail-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function EntityHeader({ conflict, syncing, isStale }) {
  const sevCfg  = sevConfig(conflict?.severity);
  const escLevel = conflict?.escalationLevel ?? 0;
  const winStart = formatWhen(conflict?.windowStart);
  const winEnd   = formatWhen(conflict?.windowEnd);
  return (
    <div className="conflict-detail-panel__entity-header" aria-label="Conflict header">
      <span className={`conflict-detail-panel__severity conflict-detail-panel__severity--${sevCfg.cssModifier}`}
        aria-label={`Severity: ${sevCfg.label}`}>
        <span aria-hidden="true">{sevCfg.icon}</span> {sevCfg.label}
      </span>
      <span className="conflict-detail-panel__type">{conflict?.type ?? 'Unknown Type'}</span>
      {escLevel > 0 && (
        <span className="conflict-detail-panel__escalation-badge" aria-label={`Escalation level ${escLevel}`}>L{escLevel}</span>
      )}
      <ScheduleStatusBadge conflict={conflict} isStale={isStale} size="sm" />
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
    </div>
  );
}

function KeyMetricsSummary({ conflict }) {
  const impactScore = conflict?.impactScore ?? null;
  const trainCount  = (Array.isArray(conflict?.conflictingTrainIds) ? conflict.conflictingTrainIds : []).length;
  const routeCount  = (Array.isArray(conflict?.affectedRouteSegments) ? conflict.affectedRouteSegments : []).length;
  const resSt       = conflict?.resolutionStatus ?? 'pending';
  const sevScore    = Math.round((sevRank(conflict?.severity) / 3) * 100);

  return (
    <div className="conflict-detail-panel__summary-grid" aria-label="Key conflict metrics">
      {impactScore != null && (
        <div className="conflict-detail-panel__summary-metric" aria-label={`Impact score: ${impactScore}`}>
          <span className="conflict-detail-panel__summary-value">{impactScore}</span>
          <span className="conflict-detail-panel__summary-label">Impact Score</span>
          <div className="conflict-detail-panel__summary-bar" aria-hidden="true">
            <div className={`conflict-detail-panel__summary-fill conflict-detail-panel__summary-fill--${sevConfig(conflict.severity).cssModifier}`}
              style={{ width: `${Math.min(100, impactScore)}%` }} />
          </div>
        </div>
      )}
      <div className="conflict-detail-panel__summary-metric" aria-label={`Trains: ${trainCount}`}>
        <span className="conflict-detail-panel__summary-value">{trainCount}</span>
        <span className="conflict-detail-panel__summary-label">Trains</span>
      </div>
      <div className="conflict-detail-panel__summary-metric" aria-label={`Route segments: ${routeCount}`}>
        <span className="conflict-detail-panel__summary-value">{routeCount}</span>
        <span className="conflict-detail-panel__summary-label">Segments</span>
      </div>
      <div className="conflict-detail-panel__summary-metric" aria-label={`Resolution: ${resSt}`}>
        <span className="conflict-detail-panel__summary-value">{resSt}</span>
        <span className="conflict-detail-panel__summary-label">Resolution</span>
      </div>
    </div>
  );
}

function CoreDetailSection({ conflict, compact }) {
  return (
    <section className="conflict-detail-panel__section" aria-label="Core Conflict Detail">
      <h3 className="conflict-detail-panel__section-title">Core Detail</h3>
      <dl className="conflict-detail-panel__field-list">
        {conflict?.id              && <><dt>ID</dt><dd>{conflict.id}</dd></>}
        {conflict?.type            && <><dt>Type</dt><dd>{conflict.type}</dd></>}
        {conflict?.severity        && <><dt>Severity</dt><dd>{sevConfig(conflict.severity).label}</dd></>}
        {conflict?.status          && <><dt>Status</dt><dd>{conflict.status}</dd></>}
        {conflict?.resolutionStatus && <><dt>Resolution</dt><dd>{conflict.resolutionStatus}</dd></>}
        {conflict?.impactScore != null && <><dt>Impact Score</dt><dd>{conflict.impactScore}/100</dd></>}
        {conflict?.windowStart && <><dt>Window Start</dt><dd>{formatWhen(conflict.windowStart)}</dd></>}
        {conflict?.windowEnd   && <><dt>Window End</dt><dd>{formatWhen(conflict.windowEnd)}</dd></>}
        {!compact && conflict?.createdAt && <><dt>Detected At</dt><dd>{formatWhen(conflict.createdAt)}</dd></>}
        {!compact && conflict?.updatedAt && <><dt>Last Updated</dt><dd>{formatWhen(conflict.updatedAt)}</dd></>}
      </dl>
    </section>
  );
}

function RouteSegmentsSection({ conflict, compact }) {
  const segs = Array.isArray(conflict?.affectedRouteSegments) ? conflict.affectedRouteSegments : [];
  return (
    <section className="conflict-detail-panel__section" aria-label="Affected Route Segments">
      <h3 className="conflict-detail-panel__section-title">Route Segments ({segs.length})</h3>
      {segs.length === 0 ? (
        <div className="conflict-detail-panel__empty-note">No route segments.</div>
      ) : (
        <div className="conflict-detail-panel__chips" role="list">
          {segs.map((s, idx) => (
            <span key={idx} className="conflict-detail-panel__chip conflict-detail-panel__chip--route" role="listitem">{s}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function TrainPathsSection({ conflict, getTrainById, compact }) {
  const trainIds = Array.isArray(conflict?.conflictingTrainIds) ? conflict.conflictingTrainIds : [];
  return (
    <section className="conflict-detail-panel__section" aria-label="Conflicting Train Paths">
      <h3 className="conflict-detail-panel__section-title">Train Paths ({trainIds.length})</h3>
      {trainIds.length === 0 ? (
        <div className="conflict-detail-panel__empty-note">No conflicting trains.</div>
      ) : (
        <ul className="conflict-detail-panel__train-list">
          {trainIds.map((id) => {
            const train = typeof getTrainById === 'function' ? getTrainById(id) : null;
            const name  = train?.name ?? train?.number ?? id;
            const route = train?.routeName ?? train?.route ?? null;
            const status = train?.status ?? null;
            return (
              <li key={id} className="conflict-detail-panel__train-row"
                aria-label={`Train: ${name}${route ? ` on ${route}` : ''}`}>
                <span className="conflict-detail-panel__train-name">{name}</span>
                {route  && <span className="conflict-detail-panel__train-route">{route}</span>}
                {status && !compact && <span className={`conflict-detail-panel__train-status conflict-detail-panel__train-status--${String(status).toLowerCase()}`}>{status}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LinkedIncidentsSection({ conflict, getIncidentById, compact }) {
  const incidentIds = useMemo(() => {
    const a = Array.isArray(conflict?.linkedIncidentIds) ? conflict.linkedIncidentIds : [];
    const b = Array.isArray(conflict?.incidentIds)       ? conflict.incidentIds       : [];
    return Array.from(new Set([...a, ...b]));
  }, [conflict?.linkedIncidentIds, conflict?.incidentIds]);

  if (incidentIds.length === 0) return null;

  return (
    <section className="conflict-detail-panel__section" aria-label="Linked Incidents">
      <h3 className="conflict-detail-panel__section-title">Linked Incidents ({incidentIds.length})</h3>
      <ul className="conflict-detail-panel__incident-list">
        {incidentIds.slice(0, 6).map((id) => {
          const inc  = typeof getIncidentById === 'function' ? getIncidentById(id) : null;
          const text = inc?.title ?? inc?.description ?? id;
          const sev  = inc?.severity ?? null;
          return (
            <li key={id} className="conflict-detail-panel__incident-row"
              aria-label={text}>
              <span className="conflict-detail-panel__incident-title">{text}</span>
              {sev && !compact && <span className={`conflict-detail-panel__incident-sev conflict-detail-panel__incident-sev--${String(sev).toLowerCase()}`}>{sev}</span>}
              <div className="conflict-detail-panel__incident-note" role="note">Resolve via Incident Response module.</div>
            </li>
          );
        })}
        {incidentIds.length > 6 && (
          <li className="conflict-detail-panel__incident-overflow">+{incidentIds.length - 6} more</li>
        )}
      </ul>
    </section>
  );
}

function ContextSection({ conflict, compact }) {
  const crowdIds = Array.isArray(conflict?.crowdForecastIds) ? conflict.crowdForecastIds : [];
  const riskCtx  = conflict?.riskContext ?? conflict?.riskScore ?? null;
  if (crowdIds.length === 0 && !riskCtx) return null;
  return (
    <section className="conflict-detail-panel__section" aria-label="Crowd & Risk Context">
      <h3 className="conflict-detail-panel__section-title">Crowd & Risk Context</h3>
      {crowdIds.length > 0 && (
        <div className="conflict-detail-panel__context-group">
          <div className="conflict-detail-panel__field-label">Crowd Forecast IDs ({crowdIds.length})</div>
          <div className="conflict-detail-panel__chips" role="list">
            {crowdIds.slice(0, 4).map((id, idx) => (
              <span key={idx} className="conflict-detail-panel__chip" role="listitem">{id}</span>
            ))}
          </div>
          <div className="conflict-detail-panel__context-note" role="note">Resolve via Crowd Intelligence module.</div>
        </div>
      )}
      {riskCtx && (
        <div className="conflict-detail-panel__context-group">
          <div className="conflict-detail-panel__field-label">Risk Context</div>
          <div className="conflict-detail-panel__chip conflict-detail-panel__chip--risk">
            {typeof riskCtx === 'object' ? (riskCtx.severityBand ?? riskCtx.id ?? JSON.stringify(riskCtx)) : riskCtx}
          </div>
        </div>
      )}
    </section>
  );
}

function MetadataRail({ conflict }) {
  return (
    <div className="conflict-detail-panel__rail" aria-label="Conflict metadata">
      <div className="conflict-detail-panel__rail-title">Conflict Metadata</div>
      <dl className="conflict-detail-panel__rail-dl">
        {conflict?.id              && <><dt>ID</dt><dd className="conflict-detail-panel__rail-id">{conflict.id}</dd></>}
        {conflict?.type            && <><dt>Type</dt><dd>{conflict.type}</dd></>}
        {conflict?.severity        && <><dt>Severity</dt><dd>{sevConfig(conflict.severity).label}</dd></>}
        {conflict?.impactScore != null && <><dt>Impact</dt><dd>{conflict.impactScore}/100</dd></>}
        {conflict?.escalationLevel != null && conflict.escalationLevel > 0 && <><dt>Escalation</dt><dd>L{conflict.escalationLevel}</dd></>}
        {conflict?.resolutionStatus && <><dt>Resolution</dt><dd>{conflict.resolutionStatus}</dd></>}
        {conflict?.createdAt       && <><dt>Detected</dt><dd>{formatWhen(conflict.createdAt)}</dd></>}
        {conflict?.updatedAt       && <><dt>Updated</dt><dd>{formatWhen(conflict.updatedAt)}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ConflictDetailPanel({
  conflict   = null,
  layout     = null,
  title      = null,
  loading    = false,
  syncing    = false,
  isStale    = false,
  error      = null,
  compact    = false,
  onRetry    = null,
  onResolve  = null,
}) {
  const getTrainById    = useTrainStore((s) => s.getTrainById);
  const getIncidentById = useIncidentStore((s) => s.getIncidentById);

  const isEmpty       = !conflict && !loading;
  const resolvedTitle = title ?? (conflict?.type ? `${conflict.type} — Detail` : 'Conflict Detail');

  const headerSlot  = conflict ? <EntityHeader conflict={conflict} syncing={syncing} isStale={isStale} /> : null;
  const summarySlot = conflict ? <KeyMetricsSummary conflict={conflict} /> : null;
  const railSlot    = conflict ? <MetadataRail conflict={conflict} /> : null;

  const body = (
    <div
      className={[
        'conflict-detail-panel',
        compact ? 'conflict-detail-panel--compact' : null,
        isStale ? 'conflict-detail-panel--stale'   : null,
        error   ? 'conflict-detail-panel--error'   : null,
        syncing ? 'conflict-detail-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}
      {isEmpty ? (
        <div className="conflict-detail-panel__empty" role="status">No conflict selected.</div>
      ) : (
        <>
          <CoreDetailSection      conflict={conflict} compact={compact} />
          <RouteSegmentsSection   conflict={conflict} compact={compact} />
          <TrainPathsSection      conflict={conflict} getTrainById={getTrainById} compact={compact} />
          <LinkedIncidentsSection conflict={conflict} getIncidentById={getIncidentById} compact={compact} />
          <ContextSection         conflict={conflict} compact={compact} />
          {typeof onResolve === 'function' && String(conflict?.status ?? '').toLowerCase() !== 'resolved' && (
            <div className="conflict-detail-panel__footer-actions" role="group">
              <button type="button" className="conflict-detail-panel__resolve-btn"
                onClick={() => onResolve(conflict)}>Initiate Resolution</button>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        header={headerSlot}
        summary={summarySlot}
        body={body}
        rail={railSlot}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(conflict)}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        header={headerSlot}
        left={body}
        right={railSlot}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

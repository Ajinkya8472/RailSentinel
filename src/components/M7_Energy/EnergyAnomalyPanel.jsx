import React, { memo, useMemo } from 'react';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';

/**
 * Purpose:
 * EnergyAnomalyPanel — anomaly detection and investigation surface for M7
 * Energy Optimization. Renders detected anomalies from
 * `EnergyProfile.anomalies[]` across one or multiple profiles:
 *
 *   1. Anomaly Summary          — total, by severity, active vs resolved
 *   2. Active Anomaly List      — sorted by severity desc, with:
 *                                 detection timestamp, severity badge,
 *                                 threshold breach context, investigation notes
 *   3. Investigation Context    — anomaly.investigationNotes / investigatedBy
 *   4. Resolved Anomaly History — compact log of resolved anomalies
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `profile`    (object|null)  — single EnergyProfile (default: null)
 * - `profiles`   (object[])     — multi-profile mode (default: [])
 * - `layout`     ('detail'|'split'|null) (default: null)
 * - `title`      (string|null)  (default: null)
 * - `loading`    (boolean)      (default: false)
 * - `syncing`    (boolean)      (default: false)
 * - `isStale`    (boolean)      (default: false)
 * - `error`      (any)          (default: null)
 * - `compact`    (boolean)      (default: false)
 * - `onRetry`    (fn|null)      (default: null)
 *
 * State: none — all derived.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      cssModifier: 'low',      rank: 0, icon: 'ℹ' },
  medium:   { label: 'Medium',   cssModifier: 'medium',   rank: 1, icon: '◉' },
  high:     { label: 'High',     cssModifier: 'high',     rank: 2, icon: '▲' },
  critical: { label: 'Critical', cssModifier: 'critical', rank: 3, icon: '✕' },
};

function sevConfig(k) { return SEVERITY_CONFIG[String(k ?? 'low').toLowerCase()] ?? SEVERITY_CONFIG.low; }

const ACTIVE_STATUSES   = new Set(['active', 'open', 'investigating']);
const RESOLVED_STATUSES = new Set(['resolved', 'closed', 'dismissed']);

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="energy-anomaly-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function AnomalyRow({ anomaly, profileId, compact }) {
  const cfg     = sevConfig(anomaly.severity);
  const status  = String(anomaly.status ?? 'active').toLowerCase();
  const title   = anomaly.title ?? anomaly.type ?? anomaly.description ?? 'Anomaly';
  const detectedAt = formatWhen(anomaly.detectedAt ?? anomaly.timestamp ?? anomaly.createdAt);
  return (
    <li className={`energy-anomaly-panel__anomaly-row energy-anomaly-panel__anomaly-row--${cfg.cssModifier}`}
      role="listitem"
      aria-label={`${title}: ${cfg.label}`}>
      <div className="energy-anomaly-panel__anomaly-header">
        <span className={`energy-anomaly-panel__severity energy-anomaly-panel__severity--${cfg.cssModifier}`}
          aria-label={`Severity: ${cfg.label}`}>
          <span aria-hidden="true">{cfg.icon}</span> {cfg.label}
        </span>
        <span className={`energy-anomaly-panel__status energy-anomaly-panel__status--${status}`}>{status}</span>
        {detectedAt && !compact && <span className="energy-anomaly-panel__detected-at">{detectedAt}</span>}
      </div>
      <div className="energy-anomaly-panel__anomaly-title">{title}</div>
      {!compact && anomaly.thresholdBreach && (
        <div className="energy-anomaly-panel__threshold" aria-label="Threshold breach context">
          Threshold breach: {typeof anomaly.thresholdBreach === 'object'
            ? `${anomaly.thresholdBreach.value ?? '?'} / limit ${anomaly.thresholdBreach.limit ?? '?'}`
            : anomaly.thresholdBreach}
        </div>
      )}
      {!compact && anomaly.investigationNotes && (
        <div className="energy-anomaly-panel__investigation-notes">
          <em>Investigation:</em> {anomaly.investigationNotes}
        </div>
      )}
      {!compact && anomaly.investigatedBy && (
        <div className="energy-anomaly-panel__investigator">By: {anomaly.investigatedBy}</div>
      )}
      {profileId && !compact && (
        <div className="energy-anomaly-panel__profile-ref" role="note">Profile: {profileId}</div>
      )}
    </li>
  );
}

function SummarySection({ active, resolved, bySeverity }) {
  return (
    <section className="energy-anomaly-panel__section" aria-label="Anomaly Summary">
      <h3 className="energy-anomaly-panel__section-title">
        Anomalies
        {active.length > 0 && <span className="energy-anomaly-panel__section-badge">{active.length} active</span>}
      </h3>
      <div className="energy-anomaly-panel__summary-grid">
        {Object.entries(bySeverity).map(([sev, count]) => count > 0 && (
          <div key={sev} className={`energy-anomaly-panel__summary-tile energy-anomaly-panel__summary-tile--${sev}`}
            aria-label={`${sevConfig(sev).label}: ${count}`}>
            <span className="energy-anomaly-panel__summary-value">{count}</span>
            <span className="energy-anomaly-panel__summary-label">{sevConfig(sev).label}</span>
          </div>
        ))}
        <div className="energy-anomaly-panel__summary-tile energy-anomaly-panel__summary-tile--resolved"
          aria-label={`Resolved: ${resolved.length}`}>
          <span className="energy-anomaly-panel__summary-value">{resolved.length}</span>
          <span className="energy-anomaly-panel__summary-label">Resolved</span>
        </div>
      </div>
    </section>
  );
}

function RailSummary({ active, resolved, bySeverity }) {
  return (
    <div className="energy-anomaly-panel__rail" aria-label="Anomaly summary">
      <div className="energy-anomaly-panel__rail-title">Anomalies</div>
      <dl className="energy-anomaly-panel__rail-dl">
        <dt>Active</dt><dd className={active.length > 0 ? 'energy-anomaly-panel__rail-active' : ''}>{active.length}</dd>
        <dt>Resolved</dt><dd>{resolved.length}</dd>
        {bySeverity.critical > 0 && <><dt>Critical</dt><dd className="energy-anomaly-panel__rail-critical">{bySeverity.critical}</dd></>}
        {bySeverity.high     > 0 && <><dt>High</dt><dd className="energy-anomaly-panel__rail-high">{bySeverity.high}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyAnomalyPanel({
  profile   = null,
  profiles  = [],
  layout    = null,
  title     = null,
  loading   = false,
  syncing   = false,
  isStale   = false,
  error     = null,
  compact   = false,
  onRetry   = null,
}) {
  const source = useMemo(() => {
    if (profile) return [profile];
    return profiles;
  }, [profile, profiles]);

  // Flatten anomalies with profile reference
  const allAnomalies = useMemo(() => {
    const out = [];
    for (const p of source) {
      for (const a of (Array.isArray(p.anomalies) ? p.anomalies : [])) {
        out.push({ ...a, _profileId: p.id });
      }
    }
    return out;
  }, [source]);

  const active   = useMemo(() =>
    allAnomalies
      .filter((a) => ACTIVE_STATUSES.has(String(a.status ?? 'active').toLowerCase()))
      .sort((a, b) => (sevConfig(b.severity).rank - sevConfig(a.severity).rank)),
  [allAnomalies]);

  const resolved = useMemo(() =>
    allAnomalies
      .filter((a) => RESOLVED_STATUSES.has(String(a.status ?? '').toLowerCase()))
      .sort((a, b) => String(b.resolvedAt ?? '').localeCompare(String(a.resolvedAt ?? ''))),
  [allAnomalies]);

  const bySeverity = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of active) {
      const k = String(a.severity ?? 'low').toLowerCase();
      if (counts[k] != null) counts[k] += 1;
    }
    return counts;
  }, [active]);

  const isEmpty       = allAnomalies.length === 0 && !loading;
  const resolvedTitle = title ?? (profile ? `Anomalies — ${profile.routeId ?? profile.id}` : 'Energy Anomalies');

  const body = (
    <div
      className={[
        'energy-anomaly-panel',
        compact ? 'energy-anomaly-panel--compact' : null,
        isStale ? 'energy-anomaly-panel--stale'   : null,
        error   ? 'energy-anomaly-panel--error'   : null,
        syncing ? 'energy-anomaly-panel--live'    : null,
        active.length > 0 ? 'energy-anomaly-panel--has-active' : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="energy-anomaly-panel__empty" role="status">No anomalies detected.</div>
      ) : (
        <>
          <SummarySection active={active} resolved={resolved} bySeverity={bySeverity} />

          {active.length > 0 && (
            <section className="energy-anomaly-panel__section" aria-label="Active Anomalies">
              <h3 className="energy-anomaly-panel__section-title">Active ({active.length})</h3>
              <ul className="energy-anomaly-panel__anomaly-list">
                {active.map((a, idx) => (
                  <AnomalyRow key={a.id ?? idx} anomaly={a} profileId={a._profileId} compact={compact} />
                ))}
              </ul>
            </section>
          )}

          {!compact && resolved.length > 0 && (
            <section className="energy-anomaly-panel__section" aria-label="Resolved Anomalies">
              <h3 className="energy-anomaly-panel__section-title">Resolved ({resolved.length})</h3>
              <ul className="energy-anomaly-panel__anomaly-list energy-anomaly-panel__anomaly-list--resolved">
                {resolved.slice(0, 5).map((a, idx) => (
                  <AnomalyRow key={a.id ?? idx} anomaly={a} profileId={a._profileId} compact={true} />
                ))}
                {resolved.length > 5 && (
                  <li className="energy-anomaly-panel__overflow">+{resolved.length - 5} more</li>
                )}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{active.length} active anomalies<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<RailSummary active={active} resolved={resolved} bySeverity={bySeverity} />}
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
        right={<RailSummary active={active} resolved={resolved} bySeverity={bySeverity} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

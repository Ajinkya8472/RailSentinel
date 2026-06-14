import React, { memo, useMemo } from 'react';
import useRiskStore from '../../store/riskStore';
import { DetailLayout } from '../../layouts/DetailLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import RiskSeverityBadge from './RiskSeverityBadge';
import RiskConfidenceIndicator from './RiskConfidenceIndicator';

/**
 * Purpose:
 * RiskExplanationPanel — deep-dive explanation and driver analysis surface
 * for Module-8 Risk Intelligence. Renders the selected or supplied
 * RiskScore entity with:
 *
 *   1. Core Profile         — id, name, category, source, domain, severityBand,
 *                            severityScore, confidence, computedAt, lastUpdatedAt
 *   2. Explanation          — riskScore.description / summary / explanation
 *   3. Risk Drivers         — riskScore.drivers[] or breakdown (from /drivers endpoint)
 *                            rendered as ranked factor bars
 *   4. Risk Breakdown       — riskScore.breakdown (object or string) — sub-scores
 *   5. Computation Context  — computedAt, source, model version, recalculate link
 *
 * Primary usage is DetailLayout with all slots. SplitPanelLayout secondary.
 *
 * Store integration (read-only):
 *   - `selectedRiskScoreId` → `getSelectedRiskScore()` — auto-binds to selection
 *   - All reads are purely derived; no mutations.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/store/riskStore` (read-only — getSelectedRiskScore, getRiskScoreById)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 * - `./RiskSeverityBadge`
 * - `./RiskConfidenceIndicator`
 *
 * Props:
 * - `riskScore`  (object|null) — explicit override (default: uses store selection)
 * - `layout`     ('detail'|'split'|null) (default: null)
 * - `title`      (string|null) (default: null)
 * - `loading`    (boolean)     (default: false)
 * - `syncing`    (boolean)     (default: false)
 * - `isStale`    (boolean)     (default: false)
 * - `error`      (any)         (default: null)
 * - `compact`    (boolean)     (default: false)
 * - `onRetry`    (fn|null)     (default: null)
 *
 * State: none local — derived from props / store.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWhen(iso) {
  try { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleString(); } catch { return null; }
}

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="risk-explanation-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill"                   role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function CoreProfileSection({ rs, compact }) {
  return (
    <section className="risk-explanation-panel__section" aria-label="Core Risk Profile">
      <h3 className="risk-explanation-panel__section-title">Risk Profile</h3>
      <dl className="risk-explanation-panel__field-list">
        {rs.id       && <><dt>ID</dt><dd>{rs.id}</dd></>}
        {rs.category && <><dt>Category</dt><dd>{rs.category}</dd></>}
        {rs.source   && <><dt>Source</dt><dd>{rs.source}</dd></>}
        {(rs.domain ?? rs.domainArea) && <><dt>Domain</dt><dd>{rs.domain ?? rs.domainArea}</dd></>}
        {rs.severityScore != null && <><dt>Severity Score</dt><dd>{rs.severityScore}/100</dd></>}
        {!compact && rs.computedAt   && <><dt>Computed At</dt><dd>{formatWhen(rs.computedAt)}</dd></>}
        {!compact && rs.lastUpdatedAt && <><dt>Last Updated</dt><dd>{formatWhen(rs.lastUpdatedAt)}</dd></>}
        {!compact && rs.modelVersion && <><dt>Model Version</dt><dd>{rs.modelVersion}</dd></>}
      </dl>

      {/* Severity + Confidence side-by-side */}
      <div className="risk-explanation-panel__indicators">
        <div className="risk-explanation-panel__indicator-wrap">
          <div className="risk-explanation-panel__indicator-label">Severity</div>
          <RiskSeverityBadge riskScore={rs} size="md" showScore={!compact} />
        </div>
        <div className="risk-explanation-panel__indicator-wrap">
          <div className="risk-explanation-panel__indicator-label">Confidence</div>
          <RiskConfidenceIndicator confidence={rs.confidence} size="md" compact={compact} />
        </div>
      </div>
    </section>
  );
}

function ExplanationSection({ rs, compact }) {
  const text = rs.explanation ?? rs.description ?? rs.summary ?? null;
  if (!text) return null;
  return (
    <section className="risk-explanation-panel__section" aria-label="Risk Explanation">
      <h3 className="risk-explanation-panel__section-title">Explanation</h3>
      <p className="risk-explanation-panel__explanation-text">{text}</p>
    </section>
  );
}

function DriversSection({ rs, compact }) {
  const drivers = useMemo(() => {
    if (Array.isArray(rs.drivers)) return rs.drivers;
    if (rs.breakdown && typeof rs.breakdown === 'object' && !Array.isArray(rs.breakdown)) {
      return Object.entries(rs.breakdown).map(([label, score]) => ({ label, score }));
    }
    return [];
  }, [rs.drivers, rs.breakdown]);

  if (drivers.length === 0) return null;

  const maxScore = Math.max(...drivers.map((d) => Number(d.score ?? d.weight ?? d.contribution ?? 0)), 1);

  return (
    <section className="risk-explanation-panel__section" aria-label="Risk Drivers">
      <h3 className="risk-explanation-panel__section-title">Risk Drivers</h3>
      <ol className="risk-explanation-panel__driver-list">
        {drivers.slice(0, compact ? 4 : 10).map((driver, idx) => {
          const label = driver.label ?? driver.factor ?? driver.name ?? `Factor ${idx + 1}`;
          const score = Number(driver.score ?? driver.weight ?? driver.contribution ?? 0);
          const pct   = Math.round((score / maxScore) * 100);
          const band  = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low';
          return (
            <li key={idx}
              className="risk-explanation-panel__driver-row"
              aria-label={`${label}: contribution ${pct}%`}>
              <div className="risk-explanation-panel__driver-label">
                <span className="risk-explanation-panel__driver-rank">#{idx + 1}</span>
                <span className="risk-explanation-panel__driver-name">{label}</span>
                <span className="risk-explanation-panel__driver-score">{score}</span>
              </div>
              <div className="risk-explanation-panel__driver-bar"
                role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`risk-explanation-panel__driver-fill risk-explanation-panel__driver-fill--${band}`}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </div>
              {!compact && driver.description && (
                <div className="risk-explanation-panel__driver-desc">{driver.description}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BreakdownSection({ rs, compact }) {
  // Only show if breakdown is a plain object (not already rendered as drivers)
  const breakdown = rs.breakdown;
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return null;
  if (Array.isArray(rs.drivers) && rs.drivers.length > 0) return null; // already shown via DriversSection
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;
  return (
    <section className="risk-explanation-panel__section" aria-label="Risk Score Breakdown">
      <h3 className="risk-explanation-panel__section-title">Score Breakdown</h3>
      <dl className="risk-explanation-panel__field-list">
        {entries.slice(0, compact ? 4 : entries.length).map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd>{typeof v === 'object' ? JSON.stringify(v) : v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}

function MetadataRail({ rs }) {
  return (
    <div className="risk-explanation-panel__rail" aria-label="Risk score metadata">
      <div className="risk-explanation-panel__rail-title">Risk Score</div>
      <RiskSeverityBadge riskScore={rs} size="md" showScore />
      <dl className="risk-explanation-panel__rail-dl">
        {rs.id           && <><dt>ID</dt><dd className="risk-explanation-panel__rail-id">{rs.id}</dd></>}
        {rs.category     && <><dt>Category</dt><dd>{rs.category}</dd></>}
        {rs.source       && <><dt>Source</dt><dd>{rs.source}</dd></>}
        {rs.computedAt   && <><dt>Computed</dt><dd>{formatWhen(rs.computedAt)}</dd></>}
      </dl>
      <div className="risk-explanation-panel__rail-conf">
        <span>Confidence</span>
        <RiskConfidenceIndicator confidence={rs.confidence} size="sm" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function RiskExplanationPanel({
  riskScore  = null,
  layout     = null,
  title      = null,
  loading    = false,
  syncing    = false,
  isStale    = false,
  error      = null,
  compact    = false,
  onRetry    = null,
}) {
  // Auto-bind to store selection if no explicit riskScore passed
  const getSelectedRiskScore = useRiskStore((s) => s.getSelectedRiskScore);
  const rs = riskScore ?? (typeof getSelectedRiskScore === 'function' ? getSelectedRiskScore() : null);

  const isEmpty       = !rs && !loading;
  const resolvedTitle = title ?? (rs ? `Explanation — ${rs.name ?? rs.title ?? rs.id}` : 'Risk Explanation');

  const headerSlot = rs ? (
    <div className="risk-explanation-panel__entity-header" aria-label="Risk header">
      <RiskSeverityBadge riskScore={rs} isStale={isStale} size="sm" showScore={!compact} />
      <span className="risk-explanation-panel__entity-name">{rs.name ?? rs.title ?? rs.id}</span>
      {syncing && <span className="train-pill train-pill--live" role="status">Live</span>}
    </div>
  ) : null;

  const summarySlot = rs ? (
    <div className="risk-explanation-panel__summary-grid" aria-label="Risk summary metrics">
      <div className="risk-explanation-panel__summary-metric">
        <span className="risk-explanation-panel__summary-value">{rs.severityScore ?? '—'}</span>
        <span className="risk-explanation-panel__summary-label">Severity Score</span>
      </div>
      <div className="risk-explanation-panel__summary-metric">
        <span className="risk-explanation-panel__summary-value">{rs.confidence ?? '—'}</span>
        <span className="risk-explanation-panel__summary-label">Confidence %</span>
      </div>
      <div className="risk-explanation-panel__summary-metric">
        <span className="risk-explanation-panel__summary-value">{(Array.isArray(rs.drivers) ? rs.drivers : []).length || '—'}</span>
        <span className="risk-explanation-panel__summary-label">Drivers</span>
      </div>
    </div>
  ) : null;

  const body = (
    <div
      className={[
        'risk-explanation-panel',
        compact ? 'risk-explanation-panel--compact' : null,
        isStale ? 'risk-explanation-panel--stale'   : null,
        error   ? 'risk-explanation-panel--error'   : null,
        syncing ? 'risk-explanation-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="risk-explanation-panel__empty" role="status">
          {loading ? 'Loading risk data…' : 'No risk score selected. Click a risk entity to view its explanation.'}
        </div>
      ) : (
        <>
          <CoreProfileSection   rs={rs} compact={compact} />
          <ExplanationSection   rs={rs} compact={compact} />
          <DriversSection       rs={rs} compact={compact} />
          <BreakdownSection     rs={rs} compact={compact} />
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
        rail={rs ? <MetadataRail rs={rs} /> : null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && Boolean(rs)}
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
        right={rs ? <MetadataRail rs={rs} /> : null}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

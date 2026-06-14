import React, { memo, useMemo, useId } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * TrainAlertPanel — canonical alert surface for Module-2 Train Operations.
 * Synthesises actionable alert conditions from the approved `Train` domain
 * model fields — `healthStatus`, `status`, `delayMinutes`,
 * `activeSensorReadingIds`, `riskScoreId` — and renders them as a ranked,
 * severity-ordered alert list. No external alert store or cross-domain import
 * is used; every alert is derived from what is already present on the Train
 * entity.
 *
 * The component operates in two complementary modes:
 *
 *   1. Single-train mode (when `trainId` or `train` prop is supplied):
 *      Derives and renders all active alert conditions for that specific
 *      train in descending severity order. A "no alerts" confirmation state
 *      is rendered when the train is fully clear.
 *
 *   2. Fleet mode (when neither `trainId` nor `train` is supplied):
 *      Reads `getVisibleTrains()` from `useTrainStore`, synthesises the
 *      worst alert for each train, filters to trains with at least one
 *      condition, and renders a ranked fleet-alert board — critical first.
 *      Suitable for the DashboardLayout `primary` region or the left panel
 *      of a `SplitPanelLayout`.
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
 * - `maxRows`           (number)             — maximum rows shown in fleet
 *                       mode (default: 30)
 * - `minSeverity`       ('low'|'medium'|'high'|'critical') — minimum severity
 *                       level to include in fleet mode; lower-severity alerts
 *                       below this threshold are suppressed (default: 'low')
 * - `onTrainSelect`     (fn|null)            — callback fired with a Train
 *                       object when a fleet-mode row is clicked (default: null)
 * - `onAlertDismiss`    (fn|null)            — callback fired with an alert
 *                       object in single-train mode when dismiss is clicked;
 *                       the panel itself does not mutate state (default: null)
 * - `compact`           (boolean)            — compact visual mode; reduces
 *                       padding and secondary metadata (default: false)
 * - `showClearState`    (boolean)            — render a positive "no alerts"
 *                       confirmation in single-train mode when the train is
 *                       fully healthy (default: true)
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
// Alert severity configuration
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  critical: { rank: 3, label: 'Critical', cssModifier: 'critical', icon: '✕' },
  high:     { rank: 2, label: 'High',     cssModifier: 'high',     icon: '▲' },
  medium:   { rank: 1, label: 'Medium',   cssModifier: 'medium',   icon: '◉' },
  low:      { rank: 0, label: 'Low',      cssModifier: 'low',      icon: 'ℹ' },
};

const SEVERITY_RANK_ORDER = ['critical', 'high', 'medium', 'low'];

function getSeverityConfig(key) {
  return SEVERITY_CONFIG[key] ?? SEVERITY_CONFIG.low;
}

function severityRank(key) {
  return SEVERITY_CONFIG[key]?.rank ?? 0;
}

// ---------------------------------------------------------------------------
// Alert derivation — synthesises alerts solely from Train domain model fields
// ---------------------------------------------------------------------------

function deriveAlerts(train) {
  if (!train) return [];
  const alerts = [];

  const healthStatus = String(train.healthStatus ?? 'normal').toLowerCase();
  const opStatus     = String(train.status ?? '').toLowerCase();
  const delay        = train.delayMinutes != null ? Number(train.delayMinutes) : null;
  const sensorCount  = Array.isArray(train.activeSensorReadingIds)
    ? train.activeSensorReadingIds.length
    : null;
  const hasRisk      = Boolean(train.riskScoreId);

  // ── Health status alerts (mutually exclusive by severity) ────────────────
  if (healthStatus === 'critical') {
    alerts.push({
      key: 'health-critical',
      severity: 'critical',
      category: 'health',
      title: 'Critical Health Status',
      detail: 'Train health is critical. Immediate inspection required.',
    });
  } else if (healthStatus === 'degraded') {
    alerts.push({
      key: 'health-degraded',
      severity: 'high',
      category: 'health',
      title: 'Degraded Health',
      detail: 'Train health is degraded. Schedule maintenance review.',
    });
  } else if (healthStatus === 'watch') {
    alerts.push({
      key: 'health-watch',
      severity: 'medium',
      category: 'health',
      title: 'Health Watch',
      detail: 'Train is under health monitoring. Watch for further changes.',
    });
  }

  // ── Operational status alerts ────────────────────────────────────────────
  if (opStatus === 'terminated') {
    alerts.push({
      key: 'status-terminated',
      severity: 'critical',
      category: 'operations',
      title: 'Service Terminated',
      detail: 'This train service has been terminated.',
    });
  } else if (opStatus === 'outofservice' || opStatus === 'out_of_service' || opStatus === 'out-of-service') {
    alerts.push({
      key: 'status-outofservice',
      severity: 'critical',
      category: 'operations',
      title: 'Out of Service',
      detail: 'Train is currently out of service.',
    });
  } else if (opStatus === 'halted') {
    alerts.push({
      key: 'status-halted',
      severity: 'high',
      category: 'operations',
      title: 'Train Halted',
      detail: `Train halted${
        train.currentStationId
          ? ` at ${train.currentStationName ?? train.currentStationId}`
          : ''
      }.`,
    });
  }

  // ── Delay alerts (tiered, mutually exclusive) ────────────────────────────
  if (delay != null && delay > 0) {
    if (delay > 120) {
      alerts.push({
        key: 'delay-critical',
        severity: 'critical',
        category: 'delay',
        title: 'Critical Delay',
        detail: `Train is delayed by ${delay} minutes. Major service disruption.`,
      });
    } else if (delay >= 61) {
      alerts.push({
        key: 'delay-severe',
        severity: 'high',
        category: 'delay',
        title: 'Severe Delay',
        detail: `Train is delayed by ${delay} minutes.`,
      });
    } else if (delay >= 16) {
      alerts.push({
        key: 'delay-moderate',
        severity: 'medium',
        category: 'delay',
        title: 'Moderate Delay',
        detail: `Train is delayed by ${delay} minutes.`,
      });
    } else {
      alerts.push({
        key: 'delay-minor',
        severity: 'low',
        category: 'delay',
        title: 'Minor Delay',
        detail: `Train is delayed by ${delay} minute${delay !== 1 ? 's' : ''}.`,
      });
    }
  }

  // ── Sensor alerts ────────────────────────────────────────────────────────
  if (sensorCount === 0) {
    alerts.push({
      key: 'sensors-none',
      severity: 'medium',
      category: 'telemetry',
      title: 'No Active Sensor Readings',
      detail: 'Train has no active sensor readings. Telemetry may be offline.',
    });
  }

  // ── Risk score reference ─────────────────────────────────────────────────
  // Shown as a low-severity informational alert when risk is linked on a
  // non-normal health train — prompts operator to review risk details.
  if (hasRisk && healthStatus !== 'normal') {
    alerts.push({
      key: 'risk-linked',
      severity: 'low',
      category: 'risk',
      title: 'Risk Score Linked',
      detail: 'A risk score is associated with this train. Review risk details.',
    });
  }

  // Sort by severity descending
  alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return alerts;
}

// ---------------------------------------------------------------------------
// Worst alert for a train (used in fleet mode summary)
// ---------------------------------------------------------------------------

function worstAlert(train) {
  const alerts = deriveAlerts(train);
  return alerts.length > 0 ? alerts[0] : null;
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
    <div className="train-alert-panel__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const cfg = getSeverityConfig(severity);
  return (
    <span
      className={`train-alert-badge train-alert-badge--${cfg.cssModifier}`}
      aria-label={`Severity: ${cfg.label}`}
    >
      <span className="train-alert-badge__icon" aria-hidden="true">{cfg.icon}</span>
      <span className="train-alert-badge__label">{cfg.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single-train alert list
// ---------------------------------------------------------------------------

function ClearState() {
  return (
    <div className="train-alert-panel__clear" role="status" aria-label="No alerts">
      <span className="train-alert-panel__clear-icon" aria-hidden="true">✓</span>
      <span className="train-alert-panel__clear-title">No Active Alerts</span>
      <span className="train-alert-panel__clear-detail">
        This train has no outstanding alert conditions.
      </span>
    </div>
  );
}

function AlertRow({ alert, onDismiss, compact, rowId }) {
  const cfg = getSeverityConfig(alert.severity);
  const canDismiss = typeof onDismiss === 'function';

  return (
    <li
      id={rowId}
      className={[
        'train-alert-row',
        `train-alert-row--${cfg.cssModifier}`,
        `train-alert-row--${alert.category}`,
        compact ? 'train-alert-row--compact' : null,
      ].filter(Boolean).join(' ')}
      aria-label={`${cfg.label} alert: ${alert.title}`}
      role="listitem"
    >
      <div className="train-alert-row__lead">
        <span
          className={`train-alert-row__icon train-alert-row__icon--${cfg.cssModifier}`}
          aria-hidden="true"
        >
          {cfg.icon}
        </span>
      </div>

      <div className="train-alert-row__body">
        <div className="train-alert-row__header">
          <span className="train-alert-row__title">{alert.title}</span>
          <SeverityBadge severity={alert.severity} />
        </div>

        {!compact && (
          <div className="train-alert-row__detail">{alert.detail}</div>
        )}

        {!compact && alert.category && (
          <div className="train-alert-row__category">
            {String(alert.category).charAt(0).toUpperCase() +
              String(alert.category).slice(1)}
          </div>
        )}
      </div>

      {canDismiss && (
        <button
          type="button"
          className="train-alert-row__dismiss"
          aria-label={`Dismiss alert: ${alert.title}`}
          onClick={() => onDismiss(alert)}
        >
          ×
        </button>
      )}
    </li>
  );
}

function SingleTrainAlerts({
  train,
  alerts,
  onAlertDismiss,
  showClearState,
  compact,
  listId,
  lastUpdatedAt,
}) {
  const lastUpdate = formatWhen(train?.lastUpdatedAt ?? lastUpdatedAt ?? null);

  if (!train) {
    return (
      <div className="train-alert-panel__empty" role="status">
        No train data available.
      </div>
    );
  }

  return (
    <div className="train-alert-single">
      {/* Train identity header */}
      <div className="train-alert-single__header">
        <span className="train-alert-single__number">
          {train.trainNumber ?? train.id ?? '—'}
        </span>
        {train.serviceType && (
          <span
            className={`train-alert-single__service train-alert-single__service--${String(
              train.serviceType,
            ).toLowerCase()}`}
          >
            {train.serviceType}
          </span>
        )}
        {train.routeId && (
          <span className="train-alert-single__route">Route {train.routeId}</span>
        )}
        <span
          className={`train-alert-single__op-status train-alert-single__op-status--${String(
            train.status ?? 'unknown',
          ).toLowerCase()}`}
        >
          {train.status ?? '—'}
        </span>
      </div>

      {/* Alert count summary */}
      {alerts.length > 0 && (
        <div className="train-alert-single__summary" aria-live="polite">
          <span className="train-alert-single__count">
            {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
          </span>
          {!compact && lastUpdate && (
            <span className="train-alert-single__updated">
              as of {lastUpdate}
            </span>
          )}
        </div>
      )}

      {/* Alert list or clear state */}
      {alerts.length === 0 ? (
        showClearState ? <ClearState /> : null
      ) : (
        <ul
          id={listId}
          className="train-alert-single__list"
          aria-label={`Alerts for train ${train.trainNumber ?? train.id}`}
        >
          {alerts.map((alert, idx) => (
            <AlertRow
              key={alert.key}
              rowId={`${listId}-${alert.key}-${idx}`}
              alert={alert}
              onDismiss={onAlertDismiss}
              compact={compact}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fleet alert board (multi-train mode)
// ---------------------------------------------------------------------------

function FleetAlertRow({ train, worst, onTrainSelect, compact, rowId }) {
  const cfg = getSeverityConfig(worst.severity);
  const isClickable = typeof onTrainSelect === 'function';

  const handleClick = () => {
    if (isClickable) onTrainSelect(train);
  };

  return (
    <li
      id={rowId}
      className={[
        'train-alert-fleet-row',
        `train-alert-fleet-row--${cfg.cssModifier}`,
        compact     ? 'train-alert-fleet-row--compact'   : null,
        isClickable ? 'train-alert-fleet-row--clickable'  : null,
      ].filter(Boolean).join(' ')}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`Train ${train.trainNumber ?? train.id}: ${worst.title}`}
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
      {/* Severity indicator */}
      <span
        className={`train-alert-fleet-row__indicator train-alert-fleet-row__indicator--${cfg.cssModifier}`}
        aria-label={cfg.label}
        role="img"
      >
        {cfg.icon}
      </span>

      {/* Train identity */}
      <span className="train-alert-fleet-row__number">
        {train.trainNumber ?? train.id ?? '—'}
      </span>

      {/* Op status */}
      <span
        className={`train-alert-fleet-row__status train-alert-fleet-row__status--${String(
          train.status ?? 'unknown',
        ).toLowerCase()}`}
      >
        {train.status ?? '—'}
      </span>

      {/* Worst alert title */}
      <span className="train-alert-fleet-row__alert-title">{worst.title}</span>

      {/* Severity badge */}
      <SeverityBadge severity={worst.severity} />
    </li>
  );
}

function FleetAlertBoard({
  alertedTrains,
  maxRows,
  onTrainSelect,
  compact,
  listId,
}) {
  if (!alertedTrains || alertedTrains.length === 0) {
    return (
      <div className="train-alert-panel__empty" role="status">
        No train alerts in current view.
      </div>
    );
  }

  const slice = alertedTrains.slice(0, maxRows);

  return (
    <ol
      id={listId}
      className="train-alert-board"
      aria-label={`Fleet alert board — ${slice.length} trains`}
    >
      {slice.map((entry, idx) => {
        const sid = entry.train.id ?? entry.train.trainId ?? `row-${idx}`;
        return (
          <FleetAlertRow
            key={`${sid}-${idx}`}
            rowId={`${listId}-row-${sid}`}
            train={entry.train}
            worst={entry.worst}
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

export default memo(function TrainAlertPanel({
  trainId           = null,
  train: trainProp  = null,
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  maxRows           = 30,
  minSeverity       = 'low',
  onTrainSelect     = null,
  onAlertDismiss    = null,
  compact           = false,
  showClearState    = true,
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

  // ── Mode determination ───────────────────────────────────────────────────
  const isFleetMode = !trainId && !trainProp;

  // ── Single-train alert derivation ────────────────────────────────────────
  const singleAlerts = useMemo(() => {
    if (isFleetMode) return [];
    const all = deriveAlerts(train);
    const minRank = severityRank(minSeverity);
    return all.filter((a) => severityRank(a.severity) >= minRank);
  }, [isFleetMode, train, minSeverity]);

  // ── Fleet alert derivation ───────────────────────────────────────────────
  const alertedTrains = useMemo(() => {
    if (!isFleetMode) return [];
    try {
      const all = getVisibleTrains ? getVisibleTrains() : [];
      const minRank = severityRank(minSeverity);
      const result = [];
      for (const t of all || []) {
        const worst = worstAlert(t);
        if (worst && severityRank(worst.severity) >= minRank) {
          result.push({ train: t, worst });
        }
      }
      // Sort by worst severity descending, then by train number ascending
      result.sort((a, b) => {
        const rankDiff = severityRank(b.worst.severity) - severityRank(a.worst.severity);
        if (rankDiff !== 0) return rankDiff;
        const numA = String(a.train.trainNumber ?? a.train.id ?? '');
        const numB = String(b.train.trainNumber ?? b.train.id ?? '');
        return numA.localeCompare(numB);
      });
      return result;
    } catch {
      return [];
    }
  }, [isFleetMode, getVisibleTrains, minSeverity]);

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt
      ? Date.parse(lastUpdatedAt)
      : train?.lastUpdatedAt
        ? Date.parse(train.lastUpdatedAt)
        : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, train, staleThreshold]);

  // ── Derived empty state ──────────────────────────────────────────────────
  const isEmpty = isFleetMode
    ? alertedTrains.length === 0
    : !train;

  const resolvedTitle = title ?? (
    isFleetMode
      ? 'Fleet Alerts'
      : train
        ? `Alerts — ${train.trainNumber ?? train.id ?? 'Train'}`
        : 'Train Alerts'
  );

  // ── KPI strip ────────────────────────────────────────────────────────────
  const kpiStrip = useMemo(() => {
    if (isFleetMode) {
      const critical = alertedTrains.filter((e) => e.worst.severity === 'critical').length;
      const high     = alertedTrains.filter((e) => e.worst.severity === 'high').length;
      const medium   = alertedTrains.filter((e) => e.worst.severity === 'medium').length;
      const low      = alertedTrains.filter((e) => e.worst.severity === 'low').length;
      return (
        <div className="train-alert-panel__kpi-strip" aria-label="Fleet alert KPIs">
          <span className="train-kpi train-kpi--danger">
            <span className="train-kpi__value">{critical}</span>
            <span className="train-kpi__label">Critical</span>
          </span>
          <span className="train-kpi train-kpi--warning">
            <span className="train-kpi__value">{high}</span>
            <span className="train-kpi__label">High</span>
          </span>
          <span className="train-kpi train-kpi--watch">
            <span className="train-kpi__value">{medium}</span>
            <span className="train-kpi__label">Medium</span>
          </span>
          <span className="train-kpi">
            <span className="train-kpi__value">{low}</span>
            <span className="train-kpi__label">Low</span>
          </span>
        </div>
      );
    }

    // Single-train KPI strip
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of singleAlerts) {
      if (bySeverity[a.severity] != null) bySeverity[a.severity] += 1;
    }
    const worst = singleAlerts[0] ?? null;
    return (
      <div className="train-alert-panel__kpi-strip" aria-label="Train alert KPIs">
        <span className="train-kpi">
          <span className="train-kpi__value">{singleAlerts.length}</span>
          <span className="train-kpi__label">Alerts</span>
        </span>
        <span className="train-kpi train-kpi--danger">
          <span className="train-kpi__value">{bySeverity.critical}</span>
          <span className="train-kpi__label">Critical</span>
        </span>
        <span className="train-kpi train-kpi--warning">
          <span className="train-kpi__value">{bySeverity.high}</span>
          <span className="train-kpi__label">High</span>
        </span>
        <span className={`train-kpi ${worst ? `train-kpi--${getSeverityConfig(worst.severity).cssModifier}` : ''}`}>
          <span className="train-kpi__value">
            {worst ? getSeverityConfig(worst.severity).label : 'None'}
          </span>
          <span className="train-kpi__label">Worst</span>
        </span>
      </div>
    );
  }, [isFleetMode, alertedTrains, singleAlerts]);

  // ── Stable IDs ───────────────────────────────────────────────────────────
  const listId = useId();

  // ── Core content ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'train-alert-panel',
        isFleetMode ? 'train-alert-panel--fleet'   : 'train-alert-panel--single',
        compact     ? 'train-alert-panel--compact'  : null,
        isStale     ? 'train-alert-panel--stale'   : null,
        error       ? 'train-alert-panel--error'   : null,
        syncing     ? 'train-alert-panel--live'    : null,
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
        <FleetAlertBoard
          alertedTrains={alertedTrains}
          maxRows={maxRows}
          onTrainSelect={onTrainSelect}
          compact={compact}
          listId={listId}
        />
      ) : (
        <SingleTrainAlerts
          train={train}
          alerts={singleAlerts}
          onAlertDismiss={onAlertDismiss}
          showClearState={showClearState}
          compact={compact}
          listId={listId}
          lastUpdatedAt={lastUpdatedAt}
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

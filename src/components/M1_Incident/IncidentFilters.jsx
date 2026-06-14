import React, { memo, useCallback, useMemo, useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useIncidentStore from '../../store/incidentStore';

/**
 * Purpose:
 * IncidentFilters provides a canonical UI for filtering incident lists in
 * Module-1. It binds to the canonical `incidentStore` selectors and actions
 * and exposes an embeddable region compatible with `DashboardLayout` and
 * `SplitPanelLayout`. It surfaces loading, empty, stale, error and live
 * update presentation states.
 *
 * Dependencies:
 * - React
 * - `src/store/incidentStore` (Zustand hook) for filters, counts, and actions
 * - `src/layouts/DashboardLayout.jsx` and `src/layouts/SplitPanelLayout.jsx` for optional wrapping
 *
 * Props:
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout (default: null)
 * - `title` (string|null): optional title to show when wrapped
 * - `staleThreshold` (number): ms to consider data stale (default: 60000)
 * - `onApply` (fn): optional callback called when filters are applied
 * - `onReset` (fn): optional callback when filters are reset
 * - `showQuick` (boolean): show quick filter chips (default: true)
 * - `compact` (boolean): compact rendering (default: false)
 *
 * State:
 * - Derived from `useIncidentStore`: `filters`, `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getIncidentCounts`
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function FilterRow({ label, children }) {
  return (
    <div className="incident-filters__row">
      <label className="incident-filters__label">{label}</label>
      <div className="incident-filters__control">{children}</div>
    </div>
  );
}

export default memo(function IncidentFilters({ layout = null, title = null, staleThreshold = 60000, onApply = null, onReset = null, showQuick = true, compact = false }) {
  const storeFilters = useIncidentStore((s) => s.filters);
  const setFilters = useIncidentStore((s) => s.setFilters);
  const resetFilters = useIncidentStore((s) => s.resetFilters);
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const syncing = useIncidentStore((s) => s.syncing);
  const error = useIncidentStore((s) => s.error);
  const lastUpdatedAt = useIncidentStore((s) => s.lastUpdatedAt);
  const counts = useIncidentStore((s) => s.getIncidentCounts());

  const [local, setLocal] = useState(() => ({ ...(storeFilters || {}) }));

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleChange = useCallback((key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }, []);

  const apply = useCallback(() => {
    try {
      setFilters(local || {});
      if (typeof onApply === 'function') onApply(local || {});
    } catch (e) {
      // ignore
    }
  }, [local, setFilters, onApply]);

  const reset = useCallback(() => {
    try {
      resetFilters();
      setLocal({});
      if (typeof onReset === 'function') onReset();
    } catch (e) {
      // ignore
    }
  }, [resetFilters, onReset]);

  const quickChips = useMemo(() => {
    if (!showQuick) return null;
    return (
      <div className="incident-filters__chips">
        <button type="button" className="incident-filters__chip" onClick={() => { handleChange('status', 'open'); apply(); }}>Open</button>
        <button type="button" className="incident-filters__chip" onClick={() => { handleChange('status', 'closed'); apply(); }}>Closed</button>
        <button type="button" className="incident-filters__chip" onClick={() => { handleChange('severity', 'critical'); apply(); }}>Critical</button>
        <button type="button" className="incident-filters__chip" onClick={() => { reset(); }}>Reset</button>
      </div>
    );
  }, [showQuick, handleChange, apply, reset]);

  const body = (
    <div className={cx('incident-filters', compact ? 'incident-filters--compact' : null)}>
      <div className="incident-filters__status">
        <div className="incident-filters__state">
          {loading ? <span className="incident-filters__pill">Loading</span> : null}
          {refreshing ? <span className="incident-filters__pill">Refreshing</span> : null}
          {syncing ? <span className="incident-filters__pill">Live</span> : null}
          {isStale ? <span className="incident-filters__pill">Stale</span> : null}
          {error ? <span className="incident-filters__pill incident-filters__pill--error">Error</span> : null}
        </div>

        <div className="incident-filters__counts">
          <span className="incident-filters__count">Total: {counts?.total ?? '-'}</span>
          <span className="incident-filters__count">Open: {counts?.byStatus?.open ?? 0}</span>
          <span className="incident-filters__count">Critical: {counts?.bySeverity?.critical ?? 0}</span>
        </div>
      </div>

      <div className="incident-filters__controls">
        <FilterRow label="Status">
          <select value={local.status ?? ''} onChange={(e) => handleChange('status', e.target.value)}>
            <option value="">Any</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="investigating">Investigating</option>
          </select>
        </FilterRow>

        <FilterRow label="Severity">
          <select value={local.severity ?? ''} onChange={(e) => handleChange('severity', e.target.value)}>
            <option value="">Any</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </FilterRow>

        <FilterRow label="Source">
          <select value={local.source ?? ''} onChange={(e) => handleChange('source', e.target.value)}>
            <option value="">Any</option>
            <option value="sensor">Sensor</option>
            <option value="operator">Operator</option>
            <option value="ai">AI</option>
          </select>
        </FilterRow>

        <FilterRow label="Assignee">
          <input value={local.assignee ?? ''} onChange={(e) => handleChange('assignee', e.target.value)} placeholder="Assignee ID or name" />
        </FilterRow>

        <FilterRow label="Search">
          <input value={local.query ?? ''} onChange={(e) => handleChange('query', e.target.value)} placeholder="Search title, description..." />
        </FilterRow>
      </div>

      {quickChips}

      <div className="incident-filters__actions">
        <button type="button" className="incident-filters__btn incident-filters__btn--apply" onClick={apply}>Apply</button>
        <button type="button" className="incident-filters__btn" onClick={reset}>Reset</button>
      </div>
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? 'Incident filters'}
        header={null}
        left={body}
        right={null}
        loading={loading}
        empty={false}
        error={Boolean(error)}
        success={!loading && !error}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? 'Incident filters'}
        header={null}
        primary={body}
        loading={loading}
        empty={false}
        error={Boolean(error)}
        success={!loading && !error}
      />
    );
  }

  return body;
});

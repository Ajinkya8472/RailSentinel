import React, { memo, useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * Filter controls for Module-2 Train Operations. Presents UI to build a
 * filter object (status, platform, search) for train listings. Reads
 * presentation data (available trains, last update, loading state) from
 * `useTrainStore` selectors only. The component does not mutate store state
 * — it emits the chosen filter object via `onChange` so parent components or
 * canonical store owners can apply the filters.
 *
 * Dependencies:
 * - React
 * - `src/store/trainStore` (Zustand selectors only)
 * - `src/layouts/DashboardLayout.jsx`, `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId` (string|number|null): optional context train id (not required)
 * - `train` (object|null): optional train object override
 * - `layout` ('dashboard'|'split'|null): optional wrapper layout
 * - `title` (string|null): optional layout title
 * - `staleThreshold` (number): ms to consider data stale (default 60000)
 * - `initialFilters` (object): initial filter values (default {})
 * - `onChange` (fn): called with filter object when user applies filters
 * - `compact` (boolean): compact visual mode (default true)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getVisibleTrains`
 */

function isArrayLike(v){ return Array.isArray(v) && v.length > 0; }

export default memo(function TrainFilters({ trainId = null, train: trainProp = null, layout = null, title = null, staleThreshold = 60000, initialFilters = {}, onChange = null, compact = true }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);
  const getVisibleTrains = useTrainStore((s) => (typeof s.getVisibleTrains === 'function' ? s.getVisibleTrains : null));

  const trains = useMemo(() => {
    try {
      if (getVisibleTrains) return getVisibleTrains();
      return [];
    } catch (e) { return []; }
  }, [getVisibleTrains]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    (trains || []).forEach(t => { if (t && t.status) set.add(String(t.status)); });
    return Array.from(set).sort();
  }, [trains]);

  const platformOptions = useMemo(() => {
    const set = new Set();
    (trains || []).forEach(t => { if (t && t.platform != null) set.add(String(t.platform)); });
    return Array.from(set).sort((a,b)=>Number(a)-Number(b));
  }, [trains]);

  const [filters, setFilters] = useState(() => ({
    status: initialFilters.status ?? '',
    platform: initialFilters.platform ?? '',
    q: initialFilters.q ?? '',
  }));

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const apply = useCallback(() => { if (typeof onChange === 'function') onChange(filters); }, [onChange, filters]);
  const reset = useCallback(() => { const n = { status: '', platform: '', q: '' }; setFilters(n); if (typeof onChange === 'function') onChange(n); }, [onChange]);

  const onInput = useCallback((e) => { const { name, value } = e.target; setFilters(f => ({ ...f, [name]: value })); }, []);

  const control = (
    <div className={`train-filters ${compact ? 'train-filters--compact' : ''} ${isStale ? 'train-filters--stale' : ''} ${error ? 'train-filters--error' : ''}`} aria-live="polite">
      <div className="train-filters__status-row">
        {loading && <span className="train-pill">Loading</span>}
        {refreshing && <span className="train-pill">Refreshing</span>}
        {syncing && <span className="train-pill train-pill--live">Live</span>}
        {isStale && <span className="train-pill train-pill--stale">Stale</span>}
        {error && <span className="train-pill train-pill--error">Error</span>}
      </div>

      <div className="train-filters__controls">
        <label className="train-filters__label">Status
          <select name="status" value={filters.status} onChange={onInput} className="train-filters__select">
            <option value="">(any)</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="train-filters__label">Platform
          <select name="platform" value={filters.platform} onChange={onInput} className="train-filters__select">
            <option value="">(any)</option>
            {platformOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label className="train-filters__label">Search
          <input name="q" value={filters.q} onChange={onInput} placeholder="Train number, origin, destination..." className="train-filters__input" />
        </label>

        <div className="train-filters__actions">
          <button type="button" className="train-filters__btn" onClick={apply}>Apply</button>
          <button type="button" className="train-filters__btn train-filters__btn--muted" onClick={reset}>Reset</button>
        </div>
      </div>
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? 'Train Filters'}
        header={null}
        left={control}
        right={null}
        loading={loading}
        empty={!(isArrayLike(trains))}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? 'Train Filters'}
        kpiStrip={control}
        loading={loading}
        empty={!(isArrayLike(trains))}
        error={Boolean(error)}
      />
    );
  }

  return control;
});

import React, { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useTrainStore from '../../store/trainStore';

/**
 * Purpose:
 * Lightweight search bar for Module-2 Train Operations. Provides text search
 * (train number, origin, destination) and emits queries via `onSearch`.
 * Reads presentation data (available trains, loading/sync state, last update)
 * exclusively from `useTrainStore` selectors and does not mutate store state.
 *
 * Dependencies:
 * - React
 * - `src/store/trainStore` (Zustand selectors only)
 * - `src/layouts/DashboardLayout.jsx`, `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `trainId` (string|number|null) — optional context id
 * - `train` (object|null) — optional train override
 * - `layout` ('dashboard'|'split'|null) — optional wrapper layout
 * - `title` (string|null) — optional layout title
 * - `placeholder` (string) — input placeholder
 * - `staleThreshold` (number) — ms to consider data stale (default 60000)
 * - `debounceMs` (number) — debounce for typing (default 300)
 * - `onSearch` (fn) — callback receiving search string and optional results
 * - `compact` (boolean) — compact visual mode (default true)
 *
 * State (derived from `useTrainStore` selectors only):
 * - `loading`, `refreshing`, `syncing`, `error`, `lastUpdatedAt`, `getVisibleTrains`
 */

function matchTrain(train, q) {
  if (!train) return false;
  if (!q) return true;
  const s = String(q).toLowerCase();
  const fields = [train.number, train.id, train.origin, train.destination, train.serviceId, train.route].filter(Boolean);
  return fields.some(f => String(f).toLowerCase().includes(s));
}

export default memo(function TrainSearchBar({ trainId = null, train: trainProp = null, layout = null, title = null, placeholder = 'Search trains...', staleThreshold = 60000, debounceMs = 300, onSearch = null, compact = true }) {
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const lastUpdatedAt = useTrainStore((s) => s.lastUpdatedAt);
  const getVisibleTrains = useTrainStore((s) => (typeof s.getVisibleTrains === 'function' ? s.getVisibleTrains : null));

  const trains = useMemo(() => {
    try { return getVisibleTrains ? getVisibleTrains() : []; } catch (e) { return []; }
  }, [getVisibleTrains]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    let mounted = true;
    const id = setTimeout(() => {
      const q = (query || '').trim();
      const matches = q ? trains.filter(t => matchTrain(t, q)) : [];
      if (mounted) {
        setResults(matches);
        if (typeof onSearch === 'function') onSearch(q, matches);
      }
    }, Number(debounceMs) || 300);
    return () => { mounted = false; clearTimeout(id); };
  }, [query, trains, debounceMs, onSearch]);

  const now = Date.now();
  const lastUpdatedTs = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
  const isStale = lastUpdatedTs ? now - lastUpdatedTs > Number(staleThreshold) : false;

  const handleChange = useCallback((e) => setQuery(e.target.value), []);
  const clear = useCallback(() => { setQuery(''); setResults([]); if (typeof onSearch === 'function') onSearch('', []); }, [onSearch]);

  const control = (
    <div className={`train-search ${compact ? 'train-search--compact' : ''} ${isStale ? 'train-search--stale' : ''} ${error ? 'train-search--error' : ''}`} aria-live="polite">
      <div className="train-search__status-row">
        {loading && <span className="train-pill">Loading</span>}
        {refreshing && <span className="train-pill">Refreshing</span>}
        {syncing && <span className="train-pill train-pill--live">Live</span>}
        {isStale && <span className="train-pill train-pill--stale">Stale</span>}
        {error && <span className="train-pill train-pill--error">Error</span>}
      </div>

      <div className="train-search__row">
        <input className="train-search__input" placeholder={placeholder} value={query} onChange={handleChange} />
        <div className="train-search__actions">
          <button type="button" className="train-search__btn" onClick={() => { if (typeof onSearch === 'function') onSearch(query, results); }}>Search</button>
          <button type="button" className="train-search__btn train-search__btn--muted" onClick={clear}>Clear</button>
        </div>
      </div>

      {query && results.length ? (
        <ul className="train-search__results">
          {results.slice(0, 20).map(r => (
            <li key={r.id ?? r.number} className="train-search__result-item">{r.number ?? r.id} — {r.origin} → {r.destination}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={title ?? 'Train Search'}
        header={null}
        left={control}
        right={null}
        loading={loading}
        empty={!trains || trains.length === 0}
        error={Boolean(error)}
      />
    );
  }

  if (layout === 'dashboard') {
    return (
      <DashboardLayout
        title={title ?? 'Train Search'}
        kpiStrip={control}
        loading={loading}
        empty={!trains || trains.length === 0}
        error={Boolean(error)}
      />
    );
  }

  return control;
});

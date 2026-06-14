import React, { memo, useMemo, useState, useId } from 'react';

/**
 * Purpose:
 * EnergyFilters — client-side filter bar for Module-7 Energy Optimization
 * profile lists. All filtering is local (zero server round-trips).
 * Derives available filter options from the `profiles` prop.
 *
 * Filters:
 *   - route       — routeId values present in profiles (+ 'all')
 *   - train       — trainId values present in profiles (+ 'all')
 *   - station     — stationId values present in profiles (+ 'all')
 *   - efficiency  — Optimized (>=90) / Normal (70-89) / Medium (50-69) / Low (<50) / all
 *   - anomaly     — 'all' | 'active' | 'none'
 *   - timeWindow  — 'all' | 'today' | 'week' | 'month'
 *   - query       — text search on id, routeId, trainId, stationId
 *
 * Supports compact (primary row only) and full (+ advanced section) modes.
 *
 * Dependencies:
 * - React (memo, useMemo, useState, useId)
 *
 * Props:
 * - `profiles`        (object[])  — EnergyProfile array (default: [])
 * - `filters`         (object)    — current filter state (required)
 * - `onFiltersChange` (fn)        — (nextFilters: object) => void (required)
 * - `compact`         (boolean)   (default: false)
 *
 * State:
 * - `expanded` — advanced filter visibility (local only)
 */

// ---------------------------------------------------------------------------
// Static options
// ---------------------------------------------------------------------------

const EFFICIENCY_OPTIONS = [
  { value: 'all',       label: 'All Efficiency'      },
  { value: 'optimized', label: 'Optimized (≥90%)'   },
  { value: 'normal',    label: 'Normal (70–89%)'    },
  { value: 'medium',    label: 'Medium (50–69%)'    },
  { value: 'low',       label: 'Low (<50%)'          },
];

const ANOMALY_OPTIONS = [
  { value: 'all',    label: 'All Anomaly Status' },
  { value: 'active', label: 'Has Active Anomaly'  },
  { value: 'none',   label: 'No Active Anomaly'   },
];

const TIME_WINDOW_OPTIONS = [
  { value: 'all',   label: 'All Time'    },
  { value: 'today', label: 'Today'       },
  { value: 'week',  label: 'This Week'   },
  { value: 'month', label: 'This Month'  },
];

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function EnergyFilters({
  profiles         = [],
  filters          = {},
  onFiltersChange  = () => {},
  compact          = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const filterId = useId();

  // Derive available values from current dataset
  const routeOptions   = useMemo(() => uniqueSorted(profiles.map((p) => String(p.routeId   ?? '').toLowerCase()).filter(Boolean)), [profiles]);
  const trainOptions   = useMemo(() => uniqueSorted(profiles.map((p) => String(p.trainId   ?? '').toLowerCase()).filter(Boolean)), [profiles]);
  const stationOptions = useMemo(() => uniqueSorted(profiles.map((p) => String(p.stationId ?? '').toLowerCase()).filter(Boolean)), [profiles]);

  function patch(key, value) { onFiltersChange({ ...filters, [key]: value }); }

  const hasActiveFilters = useMemo(() =>
    (filters.route      && filters.route      !== 'all') ||
    (filters.train      && filters.train      !== 'all') ||
    (filters.station    && filters.station    !== 'all') ||
    (filters.efficiency && filters.efficiency !== 'all') ||
    (filters.anomaly    && filters.anomaly    !== 'all') ||
    (filters.timeWindow && filters.timeWindow !== 'all') ||
    Boolean(filters.query?.trim()),
  [filters]);

  function handleClear() {
    onFiltersChange({ route: 'all', train: 'all', station: 'all', efficiency: 'all', anomaly: 'all', timeWindow: 'all', query: '' });
  }

  return (
    <div
      className={[
        'energy-filters',
        compact         ? 'energy-filters--compact'  : null,
        expanded        ? 'energy-filters--expanded' : null,
        hasActiveFilters? 'energy-filters--active'   : null,
      ].filter(Boolean).join(' ')}
      role="search"
      aria-label="Filter energy profiles"
    >
      {/* Primary row */}
      <div className="energy-filters__row energy-filters__row--primary">
        {/* Text search */}
        <div className="energy-filters__field">
          <label htmlFor={`${filterId}-query`} className="energy-filters__label">Search</label>
          <input
            id={`${filterId}-query`}
            type="search"
            className="energy-filters__input"
            value={filters.query ?? ''}
            onChange={(e) => patch('query', e.target.value)}
            placeholder="Route, train, station…"
            aria-label="Search energy profiles"
          />
        </div>

        {/* Efficiency */}
        <div className="energy-filters__field">
          <label htmlFor={`${filterId}-efficiency`} className="energy-filters__label">Efficiency</label>
          <select
            id={`${filterId}-efficiency`}
            className="energy-filters__select"
            value={filters.efficiency ?? 'all'}
            onChange={(e) => patch('efficiency', e.target.value)}
            aria-label="Filter by efficiency band"
          >
            {EFFICIENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Anomaly */}
        <div className="energy-filters__field">
          <label htmlFor={`${filterId}-anomaly`} className="energy-filters__label">Anomaly</label>
          <select
            id={`${filterId}-anomaly`}
            className="energy-filters__select"
            value={filters.anomaly ?? 'all'}
            onChange={(e) => patch('anomaly', e.target.value)}
            aria-label="Filter by anomaly status"
          >
            {ANOMALY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Expand toggle */}
        {!compact && (
          <button
            type="button"
            id={`${filterId}-expand`}
            className={`energy-filters__expand-btn ${expanded ? 'energy-filters__expand-btn--active' : ''}`}
            aria-expanded={expanded}
            aria-controls={`${filterId}-advanced`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '▲ Less' : '▼ More'}
          </button>
        )}

        {/* Clear */}
        {hasActiveFilters && (
          <button
            type="button"
            id={`${filterId}-clear`}
            className="energy-filters__clear-btn"
            aria-label="Clear all energy filters"
            onClick={handleClear}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Advanced section */}
      {!compact && expanded && (
        <div
          id={`${filterId}-advanced`}
          className="energy-filters__row energy-filters__row--advanced"
          role="group"
          aria-label="Advanced energy filters"
        >
          {/* Route */}
          {routeOptions.length > 0 && (
            <div className="energy-filters__field">
              <label htmlFor={`${filterId}-route`} className="energy-filters__label">Route</label>
              <select
                id={`${filterId}-route`}
                className="energy-filters__select"
                value={filters.route ?? 'all'}
                onChange={(e) => patch('route', e.target.value)}
                aria-label="Filter by route"
              >
                <option value="all">All Routes</option>
                {routeOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* Train */}
          {trainOptions.length > 0 && (
            <div className="energy-filters__field">
              <label htmlFor={`${filterId}-train`} className="energy-filters__label">Train</label>
              <select
                id={`${filterId}-train`}
                className="energy-filters__select"
                value={filters.train ?? 'all'}
                onChange={(e) => patch('train', e.target.value)}
                aria-label="Filter by train"
              >
                <option value="all">All Trains</option>
                {trainOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Station */}
          {stationOptions.length > 0 && (
            <div className="energy-filters__field">
              <label htmlFor={`${filterId}-station`} className="energy-filters__label">Station</label>
              <select
                id={`${filterId}-station`}
                className="energy-filters__select"
                value={filters.station ?? 'all'}
                onChange={(e) => patch('station', e.target.value)}
                aria-label="Filter by station"
              >
                <option value="all">All Stations</option>
                {stationOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Time window */}
          <div className="energy-filters__field">
            <label htmlFor={`${filterId}-window`} className="energy-filters__label">Time Window</label>
            <select
              id={`${filterId}-window`}
              className="energy-filters__select"
              value={filters.timeWindow ?? 'all'}
              onChange={(e) => patch('timeWindow', e.target.value)}
              aria-label="Filter by time window"
            >
              {TIME_WINDOW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="energy-filters__active-summary" aria-live="polite" role="status">
          {[
            filters.route      !== 'all' && `Route: ${filters.route}`,
            filters.train      !== 'all' && `Train: ${filters.train}`,
            filters.station    !== 'all' && `Station: ${filters.station}`,
            filters.efficiency !== 'all' && `Efficiency: ${filters.efficiency}`,
            filters.anomaly    !== 'all' && `Anomaly: ${filters.anomaly}`,
            filters.timeWindow !== 'all' && `Window: ${filters.timeWindow}`,
            filters.query?.trim() && `"${filters.query.trim()}"`,
          ].filter(Boolean).map((tag, idx) => (
            <span key={idx} className="energy-filters__tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
});

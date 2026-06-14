import React, { memo, useMemo, useState, useId } from 'react';

/**
 * Purpose:
 * ScheduleFilters — client-side filter bar for Module-6 Smart Scheduling
 * conflict lists. All filtering is local (zero server round-trips) and feeds
 * the `filters` / `onFiltersChange` contract shared by ScheduleBoard and any
 * other consumer of ScheduleConflict lists.
 *
 * Derives available filter options from the conflicts array to ensure only
 * values present in the current dataset are offered.
 *
 * Filters:
 *   - severity      (all | low | medium | high | critical)
 *   - status        (all | + values present in conflicts)
 *   - type          (all | + types present in conflicts)
 *   - resolutionStatus (all | + values present)
 *   - escalationLevel  (all | 0 | 1 | 2 | 3+)
 *   - query         (text search: conflict id, type, route segments)
 *
 * Dependencies:
 * - React (memo, useMemo, useState, useId)
 *
 * Props:
 * - `conflicts`         (object[])   — ScheduleConflict array (default: [])
 * - `filters`           (object)     — current filter state (required)
 * - `onFiltersChange`   (fn)         — (nextFilters: object) => void (required)
 * - `compact`           (boolean)    (default: false)
 * - `showEscalation`    (boolean)    (default: true)
 *
 * State:
 * - `expanded` — whether advanced filters are shown (local only)
 */

const SEVERITY_OPTIONS = [
  { value: 'all',      label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High' },
  { value: 'medium',   label: 'Medium' },
  { value: 'low',      label: 'Low' },
];

const ESCALATION_OPTIONS = [
  { value: 'all', label: 'All Levels' },
  { value: '0',   label: 'Not Escalated' },
  { value: '1',   label: 'Supervisor (L1)' },
  { value: '2',   label: 'Ops Manager (L2)' },
  { value: '3',   label: 'Executive (L3+)' },
];

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

export default memo(function ScheduleFilters({
  conflicts         = [],
  filters           = {},
  onFiltersChange   = () => {},
  compact           = false,
  showEscalation    = true,
}) {
  const [expanded, setExpanded] = useState(false);
  const filterId = useId();

  // Derive available values from current dataset
  const statusOptions = useMemo(() =>
    uniqueSorted(conflicts.map((c) => String(c.status ?? '').toLowerCase())),
  [conflicts]);

  const typeOptions = useMemo(() =>
    uniqueSorted(conflicts.map((c) => String(c.type ?? '').toLowerCase())),
  [conflicts]);

  const resolutionStatusOptions = useMemo(() =>
    uniqueSorted(conflicts.map((c) => String(c.resolutionStatus ?? '').toLowerCase())),
  [conflicts]);

  function patch(key, value) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.severity  && filters.severity  !== 'all') ||
      (filters.status    && filters.status    !== 'all') ||
      (filters.type      && filters.type      !== 'all') ||
      (filters.escalation && filters.escalation !== 'all') ||
      (filters.resolutionStatus && filters.resolutionStatus !== 'all') ||
      Boolean(filters.query?.trim())
    );
  }, [filters]);

  function handleClear() {
    onFiltersChange({ severity: 'all', status: 'all', type: 'all', escalation: 'all', resolutionStatus: 'all', query: '' });
  }

  return (
    <div
      className={[
        'schedule-filters',
        compact    ? 'schedule-filters--compact'  : null,
        expanded   ? 'schedule-filters--expanded' : null,
        hasActiveFilters ? 'schedule-filters--active' : null,
      ].filter(Boolean).join(' ')}
      role="search"
      aria-label="Filter schedule conflicts"
    >
      {/* Primary row */}
      <div className="schedule-filters__row schedule-filters__row--primary">
        {/* Text search */}
        <div className="schedule-filters__field">
          <label htmlFor={`${filterId}-query`} className="schedule-filters__label">Search</label>
          <input
            id={`${filterId}-query`}
            type="search"
            className="schedule-filters__input"
            value={filters.query ?? ''}
            onChange={(e) => patch('query', e.target.value)}
            placeholder="ID, type, route segment…"
            aria-label="Search schedule conflicts"
          />
        </div>

        {/* Severity */}
        <div className="schedule-filters__field">
          <label htmlFor={`${filterId}-severity`} className="schedule-filters__label">Severity</label>
          <select
            id={`${filterId}-severity`}
            className="schedule-filters__select"
            value={filters.severity ?? 'all'}
            onChange={(e) => patch('severity', e.target.value)}
            aria-label="Filter by severity"
          >
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Status */}
        {statusOptions.length > 0 && (
          <div className="schedule-filters__field">
            <label htmlFor={`${filterId}-status`} className="schedule-filters__label">Status</label>
            <select
              id={`${filterId}-status`}
              className="schedule-filters__select"
              value={filters.status ?? 'all'}
              onChange={(e) => patch('status', e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Expand toggle */}
        {!compact && (
          <button
            type="button"
            id={`${filterId}-expand`}
            className={`schedule-filters__expand-btn ${expanded ? 'schedule-filters__expand-btn--active' : ''}`}
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
            className="schedule-filters__clear-btn"
            aria-label="Clear all filters"
            onClick={handleClear}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {!compact && expanded && (
        <div
          id={`${filterId}-advanced`}
          className="schedule-filters__row schedule-filters__row--advanced"
          role="group"
          aria-label="Advanced filters"
        >
          {/* Type */}
          {typeOptions.length > 0 && (
            <div className="schedule-filters__field">
              <label htmlFor={`${filterId}-type`} className="schedule-filters__label">Conflict Type</label>
              <select
                id={`${filterId}-type`}
                className="schedule-filters__select"
                value={filters.type ?? 'all'}
                onChange={(e) => patch('type', e.target.value)}
                aria-label="Filter by conflict type"
              >
                <option value="all">All Types</option>
                {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Resolution Status */}
          {resolutionStatusOptions.length > 0 && (
            <div className="schedule-filters__field">
              <label htmlFor={`${filterId}-res-status`} className="schedule-filters__label">Resolution</label>
              <select
                id={`${filterId}-res-status`}
                className="schedule-filters__select"
                value={filters.resolutionStatus ?? 'all'}
                onChange={(e) => patch('resolutionStatus', e.target.value)}
                aria-label="Filter by resolution status"
              >
                <option value="all">All Resolution Statuses</option>
                {resolutionStatusOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* Escalation Level */}
          {showEscalation && (
            <div className="schedule-filters__field">
              <label htmlFor={`${filterId}-escalation`} className="schedule-filters__label">Escalation</label>
              <select
                id={`${filterId}-escalation`}
                className="schedule-filters__select"
                value={filters.escalation ?? 'all'}
                onChange={(e) => patch('escalation', e.target.value)}
                aria-label="Filter by escalation level"
              >
                {ESCALATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="schedule-filters__active-summary" aria-live="polite" role="status">
          {[
            filters.severity  !== 'all' && `Severity: ${filters.severity}`,
            filters.status    !== 'all' && `Status: ${filters.status}`,
            filters.type      !== 'all' && `Type: ${filters.type}`,
            filters.escalation !== 'all' && `Escalation: ${filters.escalation}`,
            filters.resolutionStatus !== 'all' && `Resolution: ${filters.resolutionStatus}`,
            filters.query?.trim() && `"${filters.query.trim()}"`,
          ].filter(Boolean).map((tag, idx) => (
            <span key={idx} className="schedule-filters__tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
});

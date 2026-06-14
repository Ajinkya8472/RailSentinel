import React, { memo, useMemo, useState, useCallback, useId } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import useCrowdStore from '../../store/crowdStore';

/**
 * Purpose:
 * CrowdHeatmap — canonical crowd density visualisation for Module-3 Crowd
 * Intelligence. Renders a location × forecast-horizon grid where each cell
 * is colour-encoded by crowd level (light / moderate / heavy / severe) and
 * optionally labelled with occupancy percentage.
 *
 * Supports three mutually exclusive view modes controlled by the `mode` prop:
 *
 *   station  — one row per unique station; columns = sorted forecast horizons.
 *              Best for network-wide snapshot at a glance.
 *
 *   platform — one row per hotspot zone (platform / concourse / gate) derived
 *              from the `hotspots[]` field on each CrowdForecast; columns =
 *              severity bands. Best for station-level zone breakdown.
 *
 *   corridor — one row per line / route; worst crowd level across all stations
 *              on that line per horizon column. Best for line-level pressure.
 *
 * All three modes are computed from `getVisibleCrowdForecasts()` without any
 * cross-domain store access. A lightweight internal `useState` controls the
 * active mode tab — pure UI state, not domain state.
 *
 * The heatmap is rendered as a CSS Grid of `<div>` cells with BEM modifier
 * classes — no SVG, no canvas, no external charting library. Full ARIA grid
 * semantics (`role="grid"`, `role="row"`, `role="gridcell"`) are applied.
 *
 * Dependencies:
 * - React (memo, useMemo, useState, useCallback, useId)
 * - `src/store/crowdStore` (Zustand selectors only — zero mutations)
 * - `src/layouts/DashboardLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `mode`             ('station'|'platform'|'corridor') — initial view mode;
 *                      can be changed via the internal mode tab bar
 *                      (default: 'station')
 * - `layout`           ('dashboard'|'split'|null) — optional layout wrapper
 *                      (default: null)
 * - `title`            (string|null)  — layout title override (default: null)
 * - `staleThreshold`   (number)       — ms before `lastUpdatedAt` is stale
 *                      (default: 60000)
 * - `showOccupancy`    (boolean)      — render occupancy % inside each cell
 *                      (default: true)
 * - `showLegend`       (boolean)      — render the crowd level colour legend
 *                      (default: true)
 * - `maxRows`          (number)       — maximum location rows to display
 *                      before overflow (default: 20)
 * - `onCellSelect`     (fn|null)      — callback fired with the CrowdForecast
 *                      object when a data cell is activated; no store writes
 *                      (default: null)
 * - `compact`          (boolean)      — compact cell mode; reduces cell size
 *                      and hides occupancy labels (default: false)
 *
 * State (derived from `useCrowdStore` selectors only):
 * - `loading`          — initial fetch in progress
 * - `refreshing`       — background refresh in progress
 * - `syncing`          — live WebSocket update in progress
 * - `error`            — last store error
 * - `lastUpdatedAt`    — ISO timestamp of last store write
 * - `getVisibleCrowdForecasts` — filtered + sorted forecast collection
 */

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

const CROWD_LEVEL_CONFIG = {
  light:    { rank: 0, label: 'Light',    cssModifier: 'light',    short: 'L' },
  moderate: { rank: 1, label: 'Moderate', cssModifier: 'moderate', short: 'M' },
  heavy:    { rank: 2, label: 'Heavy',    cssModifier: 'heavy',    short: 'H' },
  severe:   { rank: 3, label: 'Severe',   cssModifier: 'severe',   short: 'S' },
};

const LEVEL_ORDER = ['light', 'moderate', 'heavy', 'severe'];

const HOTSPOT_SEVERITY_TO_LEVEL = {
  critical: 'severe',
  high:     'heavy',
  medium:   'moderate',
  low:      'light',
};

// Canonical horizon sort order
const HORIZON_ORDER = [
  '5min', '10min', '15min', '20min', '30min', '45min',
  '1h', '1.5h', '2h', '3h', '4h', '6h', '12h', '24h',
];

function levelConfig(key) {
  return CROWD_LEVEL_CONFIG[String(key ?? 'light').toLowerCase()] ?? CROWD_LEVEL_CONFIG.light;
}

function horizonRank(h) {
  const idx = HORIZON_ORDER.indexOf(String(h ?? '').toLowerCase().replace(/\s/g, ''));
  return idx === -1 ? 999 : idx;
}

const VIEW_MODES = [
  { key: 'station',  label: 'Stations'  },
  { key: 'platform', label: 'Platforms' },
  { key: 'corridor', label: 'Corridors' },
];

// ---------------------------------------------------------------------------
// Occupancy derivation
// ---------------------------------------------------------------------------

function deriveOccupancyPct(forecast) {
  if (!forecast) return null;
  if (typeof forecast.occupancy === 'number') {
    return forecast.occupancy <= 1
      ? Math.round(forecast.occupancy * 100)
      : Math.min(100, Math.round(forecast.occupancy));
  }
  if (forecast.occupancy && typeof forecast.occupancy === 'object') {
    if (forecast.occupancy.pct   != null) return Math.min(100, Math.round(forecast.occupancy.pct));
    if (forecast.occupancy.ratio != null) return Math.round(forecast.occupancy.ratio * 100);
  }
  if (forecast.currentOccupancy != null && forecast.capacity != null) {
    return Math.min(
      100,
      Math.round((Number(forecast.currentOccupancy) / Number(forecast.capacity)) * 100),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Grid data structures
//
// GridData = {
//   rows: Array<{ rowKey, rowLabel, rowSub? }>,
//   cols: Array<{ colKey, colLabel }>,
//   cells: { [rowKey]: { [colKey]: CellData | null } }
// }
//
// CellData = {
//   level: string,       // 'light' | 'moderate' | 'heavy' | 'severe'
//   occupancyPct: number | null,
//   forecast: object | null,  // source CrowdForecast (or null for synthetic)
//   label: string,       // accessible cell description
// }
// ---------------------------------------------------------------------------

// ── Station mode: row = station, col = forecast horizon ──────────────────────
function computeStationGrid(forecasts) {
  // Collect unique stations and unique horizons
  const stationMap  = {}; // stationKey → { rowKey, rowLabel }
  const horizonSet  = new Set();

  for (const f of forecasts) {
    const key   = f.stationId ?? f.stationName ?? f.station ?? f.id ?? 'unknown';
    const name  = f.stationName ?? f.station ?? f.stationId ?? '—';
    const horizon = f.horizon ?? 'now';

    if (!stationMap[key]) stationMap[key] = { rowKey: key, rowLabel: name };
    horizonSet.add(horizon);
  }

  const rows = Object.values(stationMap);
  const cols = Array.from(horizonSet)
    .sort((a, b) => horizonRank(a) - horizonRank(b))
    .map((h) => ({ colKey: h, colLabel: h }));

  // Build cells: for each station × horizon, pick the forecast with highest level
  const cells = {};
  for (const { rowKey } of rows) {
    cells[rowKey] = {};
    for (const { colKey } of cols) cells[rowKey][colKey] = null;
  }

  for (const f of forecasts) {
    const rowKey  = f.stationId ?? f.stationName ?? f.station ?? f.id ?? 'unknown';
    const colKey  = f.horizon ?? 'now';
    const rawLevel = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
    const cfg     = levelConfig(rawLevel);
    const existing = cells[rowKey]?.[colKey];

    if (!existing || cfg.rank > levelConfig(existing.level).rank) {
      cells[rowKey][colKey] = {
        level: rawLevel,
        occupancyPct: deriveOccupancyPct(f),
        forecast: f,
        label: `${f.stationName ?? f.station ?? '—'} at ${colKey}: ${cfg.label} crowd`,
      };
    }
  }

  return { rows, cols, cells };
}

// ── Platform mode: row = station+zone, col = severity band ───────────────────
function computePlatformGrid(forecasts) {
  const zoneMap = {}; // `${stationKey}::${zoneId}` → { rowKey, rowLabel, rowSub }

  for (const f of forecasts) {
    if (!Array.isArray(f.hotspots) || f.hotspots.length === 0) continue;
    const stationName = f.stationName ?? f.station ?? f.stationId ?? '—';
    const stationKey  = f.stationId ?? f.stationName ?? f.station ?? f.id ?? 'unknown';

    for (const h of f.hotspots) {
      const zoneId  = h.zoneId ?? h.id ?? `${stationKey}-${h.zoneName ?? 'zone'}`;
      const compKey = `${stationKey}::${zoneId}`;
      if (!zoneMap[compKey]) {
        zoneMap[compKey] = {
          rowKey:   compKey,
          rowLabel: h.zoneName ?? h.name ?? zoneId,
          rowSub:   stationName,
          _zoneId:  zoneId,
          _stationKey: stationKey,
          _hotspots: [],
        };
      }
      zoneMap[compKey]._hotspots.push({ severity: h.severity, forecast: f });
    }
  }

  const rows = Object.values(zoneMap);

  // Columns = severity bands (fixed)
  const cols = ['critical', 'high', 'medium', 'low'].map((s) => ({
    colKey: s,
    colLabel: s.charAt(0).toUpperCase() + s.slice(1),
  }));

  const cells = {};
  for (const row of rows) {
    cells[row.rowKey] = {};
    for (const col of cols) cells[row.rowKey][col.colKey] = null;

    // Group hotspot appearances by severity
    const bySeverity = {};
    for (const h of row._hotspots) {
      const sev = String(h.severity ?? 'low').toLowerCase();
      if (!bySeverity[sev]) bySeverity[sev] = [];
      bySeverity[sev].push(h.forecast);
    }

    for (const col of cols) {
      const appearances = bySeverity[col.colKey];
      if (appearances && appearances.length > 0) {
        const mappedLevel = HOTSPOT_SEVERITY_TO_LEVEL[col.colKey] ?? 'light';
        cells[row.rowKey][col.colKey] = {
          level: mappedLevel,
          occupancyPct: null,
          forecast: appearances[0],
          label: `${row.rowLabel} at ${row.rowSub}: ${col.colLabel} severity hotspot`,
          count: appearances.length,
        };
      }
    }
  }

  return { rows, cols, cells };
}

// ── Corridor mode: row = line/route, col = forecast horizon ──────────────────
function computeCorridorGrid(forecasts) {
  const lineMap   = {}; // lineKey → { rowKey, rowLabel }
  const horizonSet = new Set();

  for (const f of forecasts) {
    const lineKey  = f.lineName ?? f.line ?? f.routeId ?? 'Unknown Line';
    const horizon  = f.horizon ?? 'now';

    if (!lineMap[lineKey]) lineMap[lineKey] = { rowKey: lineKey, rowLabel: lineKey };
    horizonSet.add(horizon);
  }

  const rows = Object.values(lineMap);
  const cols = Array.from(horizonSet)
    .sort((a, b) => horizonRank(a) - horizonRank(b))
    .map((h) => ({ colKey: h, colLabel: h }));

  const cells = {};
  for (const { rowKey } of rows) {
    cells[rowKey] = {};
    for (const { colKey } of cols) cells[rowKey][colKey] = null;
  }

  // For each line × horizon, take the worst crowd level across all stations
  for (const f of forecasts) {
    const rowKey   = f.lineName ?? f.line ?? f.routeId ?? 'Unknown Line';
    const colKey   = f.horizon ?? 'now';
    const rawLevel = String(f.predictedCrowdLevel ?? f.crowdLevel ?? 'light').toLowerCase();
    const cfg      = levelConfig(rawLevel);
    const existing = cells[rowKey]?.[colKey];

    if (!existing || cfg.rank > levelConfig(existing.level).rank) {
      cells[rowKey][colKey] = {
        level: rawLevel,
        occupancyPct: deriveOccupancyPct(f),
        forecast: f,
        label: `${rowKey} at ${colKey}: ${cfg.label} crowd (worst station)`,
      };
    }
  }

  return { rows, cols, cells };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
function computeHeatmapData(forecasts, mode) {
  if (!Array.isArray(forecasts) || forecasts.length === 0) {
    return { rows: [], cols: [], cells: {} };
  }
  switch (mode) {
    case 'platform': return computePlatformGrid(forecasts);
    case 'corridor': return computeCorridorGrid(forecasts);
    case 'station':
    default:         return computeStationGrid(forecasts);
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, refreshing, syncing, isStale, error }) {
  if (!loading && !refreshing && !syncing && !isStale && !error) return null;
  return (
    <div className="crowd-heatmap__pills" aria-live="polite" aria-atomic="true">
      {loading    && <span className="train-pill"                   role="status">Loading</span>}
      {refreshing && <span className="train-pill"                   role="status">Refreshing</span>}
      {syncing    && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale    && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error      && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div
      className="crowd-heatmap__legend"
      role="list"
      aria-label="Crowd level colour legend"
    >
      {LEVEL_ORDER.map((key) => {
        const cfg = levelConfig(key);
        return (
          <div
            key={key}
            className="crowd-heatmap__legend-item"
            role="listitem"
            aria-label={cfg.label}
          >
            <span
              className={`crowd-heatmap__legend-swatch crowd-heatmap__legend-swatch--${cfg.cssModifier}`}
              aria-hidden="true"
            />
            <span className="crowd-heatmap__legend-label">{cfg.label}</span>
          </div>
        );
      })}
      <div className="crowd-heatmap__legend-item" role="listitem" aria-label="No data">
        <span className="crowd-heatmap__legend-swatch crowd-heatmap__legend-swatch--empty" aria-hidden="true" />
        <span className="crowd-heatmap__legend-label">No data</span>
      </div>
    </div>
  );
}

function ModeToggle({ activeMode, onChange }) {
  return (
    <div
      className="crowd-heatmap__mode-toggle"
      role="tablist"
      aria-label="Heatmap view mode"
    >
      {VIEW_MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          className={[
            'crowd-heatmap__mode-btn',
            activeMode === m.key ? 'crowd-heatmap__mode-btn--active' : null,
          ].filter(Boolean).join(' ')}
          aria-selected={activeMode === m.key}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/**
 * HeatmapCell — a single grid cell representing one location × horizon data point.
 */
function HeatmapCell({ cell, showOccupancy, compact, onCellSelect, cellId }) {
  const handleClick = useCallback(() => {
    if (cell && typeof onCellSelect === 'function') onCellSelect(cell.forecast);
  }, [cell, onCellSelect]);

  if (!cell) {
    return (
      <div
        id={cellId}
        className="crowd-heatmap__cell crowd-heatmap__cell--empty"
        role="gridcell"
        aria-label="No data"
      />
    );
  }

  const cfg         = levelConfig(cell.level);
  const isClickable = typeof onCellSelect === 'function' && Boolean(cell.forecast);

  return (
    <div
      id={cellId}
      className={[
        'crowd-heatmap__cell',
        `crowd-heatmap__cell--${cfg.cssModifier}`,
        compact     ? 'crowd-heatmap__cell--compact'   : null,
        isClickable ? 'crowd-heatmap__cell--clickable'  : null,
      ].filter(Boolean).join(' ')}
      role="gridcell"
      aria-label={cell.label}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }
          : undefined
      }
    >
      {/* Accessible short label inside cell (screen readers read aria-label instead) */}
      <span className="crowd-heatmap__cell-short" aria-hidden="true">
        {compact ? cfg.short : cfg.label}
      </span>

      {/* Occupancy percentage (non-compact, opt-in) */}
      {showOccupancy && !compact && cell.occupancyPct != null && (
        <span className="crowd-heatmap__cell-occ" aria-hidden="true">
          {cell.occupancyPct}%
        </span>
      )}

      {/* Count badge for platform mode multi-occurrence cells */}
      {!compact && cell.count != null && cell.count > 1 && (
        <span
          className="crowd-heatmap__cell-count"
          aria-hidden="true"
          title={`${cell.count} occurrences`}
        >
          ×{cell.count}
        </span>
      )}
    </div>
  );
}

/**
 * HeatmapGrid — the full location × column CSS Grid with row/column labels.
 */
function HeatmapGrid({
  rows,
  cols,
  cells,
  maxRows,
  showOccupancy,
  compact,
  onCellSelect,
  gridId,
}) {
  const visibleRows = rows.slice(0, maxRows);
  const overflowRows = rows.length - visibleRows.length;

  if (visibleRows.length === 0) {
    return (
      <div className="crowd-heatmap__empty" role="status">
        No location data for this view mode.
      </div>
    );
  }

  // CSS Grid: 1 label column + N data columns
  const gridTemplateColumns = `minmax(120px, 1fr) repeat(${cols.length}, minmax(60px, 1fr))`;

  return (
    <div className="crowd-heatmap__grid-wrapper">
      <div
        id={gridId}
        className={`crowd-heatmap__grid ${compact ? 'crowd-heatmap__grid--compact' : ''}`}
        role="grid"
        aria-label="Crowd heatmap"
        style={{ gridTemplateColumns }}
      >
        {/* Header row: empty corner + column labels */}
        <div className="crowd-heatmap__header-row" role="row">
          <div
            className="crowd-heatmap__corner"
            role="columnheader"
            aria-label="Location"
          />
          {cols.map((col) => (
            <div
              key={col.colKey}
              className="crowd-heatmap__col-header"
              role="columnheader"
              aria-label={col.colLabel}
            >
              {col.colLabel}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {visibleRows.map((row) => (
          <div
            key={row.rowKey}
            className="crowd-heatmap__row"
            role="row"
            aria-label={row.rowLabel}
          >
            {/* Row label */}
            <div
              className="crowd-heatmap__row-label"
              role="rowheader"
              title={row.rowSub ? `${row.rowLabel} — ${row.rowSub}` : row.rowLabel}
            >
              <span className="crowd-heatmap__row-name">{row.rowLabel}</span>
              {row.rowSub && (
                <span className="crowd-heatmap__row-sub">{row.rowSub}</span>
              )}
            </div>

            {/* Data cells */}
            {cols.map((col, cIdx) => {
              const cell   = cells[row.rowKey]?.[col.colKey] ?? null;
              const cellId = `${gridId}-${row.rowKey}-${col.colKey}-${cIdx}`;
              return (
                <HeatmapCell
                  key={col.colKey}
                  cell={cell}
                  showOccupancy={showOccupancy}
                  compact={compact}
                  onCellSelect={onCellSelect}
                  cellId={cellId}
                />
              );
            })}
          </div>
        ))}

        {/* Overflow notice row */}
        {overflowRows > 0 && (
          <div className="crowd-heatmap__overflow-row" role="row">
            <div
              className="crowd-heatmap__overflow-label"
              role="rowheader"
              aria-label={`${overflowRows} more locations not shown`}
            >
              +{overflowRows} more
            </div>
            {cols.map((col) => (
              <div
                key={col.colKey}
                className="crowd-heatmap__cell crowd-heatmap__cell--overflow"
                role="gridcell"
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CrowdHeatmap({
  mode: modeProp    = 'station',
  layout            = null,
  title             = null,
  staleThreshold    = 60000,
  showOccupancy     = true,
  showLegend        = true,
  maxRows           = 20,
  onCellSelect      = null,
  compact           = false,
}) {
  // ── Local UI state: active view mode (pure UI, not domain state) ─────────
  const [activeMode, setActiveMode] = useState(
    () => ['station', 'platform', 'corridor'].includes(modeProp) ? modeProp : 'station',
  );

  const handleModeChange = useCallback((m) => setActiveMode(m), []);

  // ── Store selectors (read-only) ──────────────────────────────────────────
  const loading       = useCrowdStore((s) => s.loading);
  const refreshing    = useCrowdStore((s) => s.refreshing);
  const syncing       = useCrowdStore((s) => s.syncing);
  const error         = useCrowdStore((s) => s.error);
  const lastUpdatedAt = useCrowdStore((s) => s.lastUpdatedAt);

  const getVisibleCrowdForecasts = useCrowdStore((s) =>
    typeof s.getVisibleCrowdForecasts === 'function' ? s.getVisibleCrowdForecasts : null,
  );

  // ── Visible forecasts ────────────────────────────────────────────────────
  const forecasts = useMemo(() => {
    try { return getVisibleCrowdForecasts ? getVisibleCrowdForecasts() : []; }
    catch { return []; }
  }, [getVisibleCrowdForecasts]);

  // ── Grid data ────────────────────────────────────────────────────────────
  const { rows, cols, cells } = useMemo(
    () => computeHeatmapData(forecasts, activeMode),
    [forecasts, activeMode],
  );

  // ── Stale detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    const ts = lastUpdatedAt ? Date.parse(lastUpdatedAt) : null;
    return ts != null ? Date.now() - ts > Number(staleThreshold) : false;
  }, [lastUpdatedAt, staleThreshold]);

  // ── Derived state ────────────────────────────────────────────────────────
  const isEmpty       = rows.length === 0 && !loading;
  const resolvedTitle = title ?? 'Crowd Heatmap';

  // ── Stable IDs ───────────────────────────────────────────────────────────
  const gridId = useId();

  // ── Core content ─────────────────────────────────────────────────────────
  const content = (
    <div
      className={[
        'crowd-heatmap',
        `crowd-heatmap--${activeMode}`,
        compact ? 'crowd-heatmap--compact' : null,
        isStale ? 'crowd-heatmap--stale'   : null,
        error   ? 'crowd-heatmap--error'   : null,
        syncing ? 'crowd-heatmap--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
    >
      {/* Toolbar: mode toggle + status pills */}
      <div className="crowd-heatmap__toolbar">
        <ModeToggle activeMode={activeMode} onChange={handleModeChange} />
        <StatusPills
          loading={loading}
          refreshing={refreshing}
          syncing={syncing}
          isStale={isStale}
          error={error}
        />
      </div>

      {/* Platform mode notice — explains data source */}
      {activeMode === 'platform' && (
        <div
          className="crowd-heatmap__mode-notice"
          role="note"
          aria-label="Platform view source"
        >
          Showing hotspot zones from crowd forecast data. Platform view populates
          when forecasts include hotspot zone records.
        </div>
      )}

      {/* Empty state */}
      {isEmpty ? (
        <div className="crowd-heatmap__empty" role="status">
          {activeMode === 'platform' && forecasts.length > 0
            ? 'No hotspot zone data available for platform view.'
            : 'No crowd forecast data available.'}
        </div>
      ) : (
        <HeatmapGrid
          rows={rows}
          cols={cols}
          cells={cells}
          maxRows={maxRows}
          showOccupancy={showOccupancy && !compact}
          compact={compact}
          onCellSelect={onCellSelect}
          gridId={gridId}
        />
      )}

      {/* Legend */}
      {showLegend && !isEmpty && <HeatmapLegend />}
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
        kpiStrip={null}
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

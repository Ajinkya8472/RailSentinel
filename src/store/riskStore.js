import { create } from 'zustand';

/**
 * Purpose:
 * Canonical risk store for RailSentinel. It owns risk score records,
 * risk-specific selection, filters, sorting, paging, live sync state,
 * and the latest composite risk snapshot pushed via WebSocket.
 * It must not own incidents, trains, crowd forecasts, or shell UI state.
 *
 * Dependencies:
 * - zustand
 * - Risk score domain model and risk-related event payloads
 * - Approved views and workflows consume this store through the generated hook
 *
 * Props:
 * - None. The store is initialized internally and used as a global hook.
 * - Optional hydration can be provided through the public actions.
 *
 * State:
 * - riskScoreById / riskScoreIds as the canonical risk collection
 * - selectedRiskScoreId and focusedRiskScoreId for workflows
 * - filters, sort, paging, loading, error, and sync metadata
 * - composite / compositeUpdatedAt for the latest M8 risk_update snapshot
 * - derived timestamps for list freshness and last mutation tracking
 */

const DEFAULT_FILTERS = {
  category: 'all',
  severity: 'all',
  source: 'all',
  query: '',
};

const DEFAULT_SORT = 'computedAt_desc';

const INITIAL_STATE = {
  riskScores: [],
  riskScoreById: {},
  riskScoreIds: [],
  selectedRiskScoreId: null,
  focusedRiskScoreId: null,
  filters: { ...DEFAULT_FILTERS },
  sort: DEFAULT_SORT,
  pagination: {
    page: 1,
    pageSize: 25,
    total: 0,
  },
  loading: false,
  refreshing: false,
  syncing: false,
  error: null,
  lastUpdatedAt: null,
  lastMutatedAt: null,
  lastSyncAt: null,

  // Latest composite M8 risk snapshot (from WS "risk_update" messages)
  composite: null,
  compositeUpdatedAt: null,
};

function uniqueIds(ids) {
  return Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
}

function toRiskScoreId(riskScore) {
  if (!riskScore || typeof riskScore !== 'object') {
    return null;
  }

  return riskScore.id ?? riskScore.riskScoreId ?? null;
}

function normalizeRiskScore(riskScore) {
  if (!riskScore || typeof riskScore !== 'object') {
    return null;
  }

  const id = toRiskScoreId(riskScore);
  if (!id) {
    return null;
  }

  return {
    ...riskScore,
    id,
  };
}

function sortRiskScores(riskScores, sort) {
  const list = [...riskScores];

  switch (sort) {
    case 'severity_desc':
      return list.sort((left, right) => Number(right.severityScore ?? 0) - Number(left.severityScore ?? 0));
    case 'severity_asc':
      return list.sort((left, right) => Number(left.severityScore ?? 0) - Number(right.severityScore ?? 0));
    case 'computedAt_asc':
      return list.sort((left, right) => String(left.computedAt ?? '').localeCompare(String(right.computedAt ?? '')));
    case 'computedAt_desc':
    default:
      return list.sort((left, right) => String(right.computedAt ?? '').localeCompare(String(left.computedAt ?? '')));
  }
}

function applyFilters(riskScores, filters) {
  const query = String(filters?.query ?? '').trim().toLowerCase();

  return riskScores.filter((riskScore) => {
    if (filters?.category && filters.category !== 'all' && String(riskScore.category ?? '').toLowerCase() !== filters.category.toLowerCase()) {
      return false;
    }

    if (filters?.severity && filters.severity !== 'all' && String(riskScore.severityBand ?? '').toLowerCase() !== filters.severity.toLowerCase()) {
      return false;
    }

    if (filters?.source && filters.source !== 'all' && String(riskScore.source ?? '').toLowerCase() !== filters.source.toLowerCase()) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableFields = [
      riskScore.id,
      riskScore.name,
      riskScore.title,
      riskScore.category,
      riskScore.severityBand,
      riskScore.source,
      riskScore.description,
      riskScore.summary,
    ];

    return searchableFields.some((value) => String(value ?? '').toLowerCase().includes(query));
  });
}

function upsertRecord(collection, item) {
  const next = { ...collection };
  next[item.id] = { ...(collection[item.id] ?? {}), ...item };
  return next;
}

export const useRiskStore = create((set, get) => ({
  ...INITIAL_STATE,

  setRiskScores: (riskScores = []) => {
    const normalized = riskScores.map(normalizeRiskScore).filter(Boolean);
    const riskScoreById = normalized.reduce((accumulator, riskScore) => {
      accumulator[riskScore.id] = riskScore;
      return accumulator;
    }, {});

    set({
      riskScores: sortRiskScores(normalized, get().sort),
      riskScoreById,
      riskScoreIds: uniqueIds(normalized.map((riskScore) => riskScore.id)),
      pagination: {
        ...get().pagination,
        total: normalized.length,
      },
      lastUpdatedAt: new Date().toISOString(),
      lastMutatedAt: new Date().toISOString(),
      error: null,
    });
  },

  upsertRiskScore: (riskScore) => {
    const normalized = normalizeRiskScore(riskScore);
    if (!normalized) {
      return;
    }

    set((state) => {
      const nextRiskScoreById = upsertRecord(state.riskScoreById, normalized);
      const nextRiskScores = sortRiskScores(Object.values(nextRiskScoreById), state.sort);
      const nextRiskScoreIds = uniqueIds(nextRiskScores.map((item) => item.id));

      return {
        riskScores: nextRiskScores,
        riskScoreById: nextRiskScoreById,
        riskScoreIds: nextRiskScoreIds,
        pagination: {
          ...state.pagination,
          total: nextRiskScoreIds.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  upsertRiskScores: (riskScores = []) => {
    if (!Array.isArray(riskScores) || riskScores.length === 0) {
      return;
    }

    set((state) => {
      const nextRiskScoreById = { ...state.riskScoreById };

      for (const riskScore of riskScores) {
        const normalized = normalizeRiskScore(riskScore);
        if (normalized) {
          nextRiskScoreById[normalized.id] = {
            ...(nextRiskScoreById[normalized.id] ?? {}),
            ...normalized,
          };
        }
      }

      const nextRiskScores = sortRiskScores(Object.values(nextRiskScoreById), state.sort);

      return {
        riskScores: nextRiskScores,
        riskScoreById: nextRiskScoreById,
        riskScoreIds: uniqueIds(nextRiskScores.map((item) => item.id)),
        pagination: {
          ...state.pagination,
          total: nextRiskScores.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  patchRiskScore: (riskScoreId, patch = {}) => {
    if (!riskScoreId) {
      return;
    }

    set((state) => {
      const current = state.riskScoreById[riskScoreId];
      if (!current) {
        return state;
      }

      const nextRiskScore = {
        ...current,
        ...patch,
        id: riskScoreId,
      };

      const nextRiskScoreById = {
        ...state.riskScoreById,
        [riskScoreId]: nextRiskScore,
      };
      const nextRiskScores = sortRiskScores(Object.values(nextRiskScoreById), state.sort);

      return {
        riskScores: nextRiskScores,
        riskScoreById: nextRiskScoreById,
        riskScoreIds: uniqueIds(nextRiskScores.map((item) => item.id)),
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  removeRiskScore: (riskScoreId) => {
    if (!riskScoreId) {
      return;
    }

    set((state) => {
      if (!state.riskScoreById[riskScoreId]) {
        return state;
      }

      const nextRiskScoreById = { ...state.riskScoreById };
      delete nextRiskScoreById[riskScoreId];

      const nextRiskScores = sortRiskScores(Object.values(nextRiskScoreById), state.sort);

      return {
        riskScores: nextRiskScores,
        riskScoreById: nextRiskScoreById,
        riskScoreIds: uniqueIds(nextRiskScores.map((item) => item.id)),
        selectedRiskScoreId: state.selectedRiskScoreId === riskScoreId ? null : state.selectedRiskScoreId,
        focusedRiskScoreId: state.focusedRiskScoreId === riskScoreId ? null : state.focusedRiskScoreId,
        pagination: {
          ...state.pagination,
          total: nextRiskScores.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
      };
    });
  },

  selectRiskScore: (selectedRiskScoreId) =>
    set({
      selectedRiskScoreId: selectedRiskScoreId ?? null,
      focusedRiskScoreId: selectedRiskScoreId ?? null,
    }),

  focusRiskScore: (focusedRiskScoreId) => set({ focusedRiskScoreId: focusedRiskScoreId ?? null }),

  clearSelection: () =>
    set({
      selectedRiskScoreId: null,
      focusedRiskScoreId: null,
    }),

  setFilters: (filters = {}) =>
    set((state) => ({
      filters: {
        ...state.filters,
        ...(filters && typeof filters === 'object' ? filters : {}),
      },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setSort: (sort) =>
    set((state) => ({
      sort: sort ?? state.sort,
      riskScores: sortRiskScores(state.riskScoreIds.map((id) => state.riskScoreById[id]).filter(Boolean), sort ?? state.sort),
    })),

  setPagination: (pagination = {}) =>
    set((state) => ({
      pagination: {
        ...state.pagination,
        ...(pagination && typeof pagination === 'object' ? pagination : {}),
      },
    })),

  setLoading: (loading) => set({ loading: Boolean(loading) }),
  setRefreshing: (refreshing) => set({ refreshing: Boolean(refreshing) }),
  setSyncing: (syncing) => set({ syncing: Boolean(syncing) }),
  setError: (error) => set({ error: error ?? null }),

  markSynced: () =>
    set({
      syncing: false,
      refreshing: false,
      lastSyncAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    }),

  // ── Composite M8 risk snapshot (from WS "risk_update") ────────────────
  // Called by useWebSocket.js whenever a `risk_update` message arrives.
  // Payload shape (direct, no wrapper): { type, composite_score, risk_level,
  // compound_alert, zones, ... } as returned by GET /api/risk/composite
  setRiskData: (data) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    set({
      composite: data,
      compositeUpdatedAt: new Date().toISOString(),
    });
  },

  clearRiskData: () =>
    set({
      composite: null,
      compositeUpdatedAt: null,
    }),

  hydrateRiskState: (nextState = {}) =>
    set((state) => ({
      ...state,
      ...nextState,
      filters: {
        ...state.filters,
        ...(nextState.filters && typeof nextState.filters === 'object' ? nextState.filters : {}),
      },
      pagination: {
        ...state.pagination,
        ...(nextState.pagination && typeof nextState.pagination === 'object' ? nextState.pagination : {}),
      },
      riskScoreById:
        nextState.riskScoreById && typeof nextState.riskScoreById === 'object'
          ? { ...state.riskScoreById, ...nextState.riskScoreById }
          : state.riskScoreById,
      riskScores: Array.isArray(nextState.riskScores)
        ? sortRiskScores(nextState.riskScores.map(normalizeRiskScore).filter(Boolean), nextState.sort ?? state.sort)
        : state.riskScores,
      riskScoreIds: Array.isArray(nextState.riskScoreIds)
        ? uniqueIds(nextState.riskScoreIds)
        : state.riskScoreIds,
    })),

  applyRiskEvent: (event) => {
    if (!event || typeof event !== 'object') {
      return;
    }

    const { type, payload } = event;

    switch (type) {
      case 'riskScore.created':
      case 'riskScore.updated':
      case 'riskScore.synced':
        if (Array.isArray(payload)) {
          get().upsertRiskScores(payload);
        } else {
          get().upsertRiskScore(payload);
        }
        get().markSynced();
        return;
      case 'riskScore.deleted':
        get().removeRiskScore(payload?.id ?? payload?.riskScoreId ?? null);
        get().markSynced();
        return;
      default:
        return;
    }
  },

  getRiskScoreById: (riskScoreId) => get().riskScoreById[riskScoreId] ?? null,

  getSelectedRiskScore: () => {
    const state = get();
    return state.selectedRiskScoreId ? state.riskScoreById[state.selectedRiskScoreId] ?? null : null;
  },

  getVisibleRiskScores: () => {
    const state = get();
    const filtered = applyFilters(Object.values(state.riskScoreById), state.filters);
    return sortRiskScores(filtered, state.sort);
  },

  getRiskCounts: () => {
    const riskScores = Object.values(get().riskScoreById);
    return riskScores.reduce(
      (accumulator, riskScore) => {
        const categoryKey = String(riskScore.category ?? 'unknown').toLowerCase();
        const bandKey = String(riskScore.severityBand ?? 'unknown').toLowerCase();

        accumulator.total += 1;
        accumulator.byCategory[categoryKey] = (accumulator.byCategory[categoryKey] ?? 0) + 1;
        accumulator.bySeverityBand[bandKey] = (accumulator.bySeverityBand[bandKey] ?? 0) + 1;
        return accumulator;
      },
      { total: 0, byCategory: {}, bySeverityBand: {} },
    );
  },

  getRiskSummary: () => {
    const state = get();
    const visible = state.getVisibleRiskScores();
    return {
      total: visible.length,
      selectedRiskScoreId: state.selectedRiskScoreId,
      focusedRiskScoreId: state.focusedRiskScoreId,
      latestUpdatedAt: visible[0]?.lastUpdatedAt ?? null,
      hasErrors: Boolean(state.error),
    };
  },

  // Latest composite snapshot accessor
  getComposite: () => get().composite,

  resetRiskState: () => set({ ...INITIAL_STATE, filters: { ...DEFAULT_FILTERS } }),
}));

export default useRiskStore;
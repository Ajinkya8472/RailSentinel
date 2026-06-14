import { create } from 'zustand';

/**
 * Purpose:
 * Canonical crowd store for RailSentinel. It owns crowd forecast records,
 * crowd-specific selection, filters, sorting, paging, and live sync state.
 * It must not own incidents, trains, risk scores, or shell UI state.
 *
 * Dependencies:
 * - zustand
 * - Crowd forecast domain model and crowd-related event payloads
 * - Approved views and workflows consume this store through the generated hook
 *
 * Props:
 * - None. The store is initialized internally and used as a global hook.
 * - Optional hydration can be provided through the public actions.
 *
 * State:
 * - crowdForecastById / crowdForecastIds as the canonical crowd collection
 * - selectedCrowdForecastId and focusedCrowdForecastId for workflows
 * - filters, sort, paging, loading, error, and sync metadata
 * - derived timestamps for list freshness and last mutation tracking
 */

const DEFAULT_FILTERS = {
  station: 'all',
  line: 'all',
  horizon: 'all',
  confidence: 'all',
  query: '',
};

const DEFAULT_SORT = 'generatedAt_desc';

const INITIAL_STATE = {
  crowdForecasts: [],
  crowdForecastById: {},
  crowdForecastIds: [],
  selectedCrowdForecastId: null,
  focusedCrowdForecastId: null,
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
};

function uniqueIds(ids) {
  return Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
}

function toCrowdForecastId(crowdForecast) {
  if (!crowdForecast || typeof crowdForecast !== 'object') {
    return null;
  }

  return crowdForecast.id ?? crowdForecast.crowdForecastId ?? null;
}

function normalizeCrowdForecast(crowdForecast) {
  if (!crowdForecast || typeof crowdForecast !== 'object') {
    return null;
  }

  const id = toCrowdForecastId(crowdForecast);
  if (!id) {
    return null;
  }

  return {
    ...crowdForecast,
    id,
  };
}

function sortCrowdForecasts(crowdForecasts, sort) {
  const list = [...crowdForecasts];

  switch (sort) {
    case 'confidence_desc':
      return list.sort((left, right) => Number(right.confidenceScore ?? 0) - Number(left.confidenceScore ?? 0));
    case 'confidence_asc':
      return list.sort((left, right) => Number(left.confidenceScore ?? 0) - Number(right.confidenceScore ?? 0));
    case 'generatedAt_asc':
      return list.sort((left, right) => String(left.generatedAt ?? '').localeCompare(String(right.generatedAt ?? '')));
    case 'generatedAt_desc':
    default:
      return list.sort((left, right) => String(right.generatedAt ?? '').localeCompare(String(left.generatedAt ?? '')));
  }
}

function applyFilters(crowdForecasts, filters) {
  const query = String(filters?.query ?? '').trim().toLowerCase();

  return crowdForecasts.filter((forecast) => {
    if (filters?.station && filters.station !== 'all' && String(forecast.stationName ?? forecast.station ?? '').toLowerCase() !== filters.station.toLowerCase()) {
      return false;
    }

    if (filters?.line && filters.line !== 'all' && String(forecast.lineName ?? forecast.line ?? '').toLowerCase() !== filters.line.toLowerCase()) {
      return false;
    }

    if (filters?.horizon && filters.horizon !== 'all' && String(forecast.horizon ?? '').toLowerCase() !== filters.horizon.toLowerCase()) {
      return false;
    }

    if (filters?.confidence && filters.confidence !== 'all' && String(forecast.confidenceBand ?? '').toLowerCase() !== filters.confidence.toLowerCase()) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableFields = [
      forecast.id,
      forecast.stationName,
      forecast.lineName,
      forecast.horizon,
      forecast.confidenceBand,
      forecast.description,
      forecast.summary,
      forecast.generatedBy,
    ];

    return searchableFields.some((value) => String(value ?? '').toLowerCase().includes(query));
  });
}

function upsertRecord(collection, item) {
  const next = { ...collection };
  next[item.id] = { ...(collection[item.id] ?? {}), ...item };
  return next;
}

export const useCrowdStore = create((set, get) => ({
  ...INITIAL_STATE,

  setCrowdForecasts: (crowdForecasts = []) => {
    const normalized = crowdForecasts.map(normalizeCrowdForecast).filter(Boolean);
    const crowdForecastById = normalized.reduce((accumulator, crowdForecast) => {
      accumulator[crowdForecast.id] = crowdForecast;
      return accumulator;
    }, {});

    set({
      crowdForecasts: sortCrowdForecasts(normalized, get().sort),
      crowdForecastById,
      crowdForecastIds: uniqueIds(normalized.map((crowdForecast) => crowdForecast.id)),
      pagination: {
        ...get().pagination,
        total: normalized.length,
      },
      lastUpdatedAt: new Date().toISOString(),
      lastMutatedAt: new Date().toISOString(),
      error: null,
    });
  },

  upsertCrowdForecast: (crowdForecast) => {
    const normalized = normalizeCrowdForecast(crowdForecast);
    if (!normalized) {
      return;
    }

    set((state) => {
      const nextCrowdForecastById = upsertRecord(state.crowdForecastById, normalized);
      const nextCrowdForecasts = sortCrowdForecasts(Object.values(nextCrowdForecastById), state.sort);
      const nextCrowdForecastIds = uniqueIds(nextCrowdForecasts.map((item) => item.id));

      return {
        crowdForecasts: nextCrowdForecasts,
        crowdForecastById: nextCrowdForecastById,
        crowdForecastIds: nextCrowdForecastIds,
        pagination: {
          ...state.pagination,
          total: nextCrowdForecastIds.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  upsertCrowdForecasts: (crowdForecasts = []) => {
    if (!Array.isArray(crowdForecasts) || crowdForecasts.length === 0) {
      return;
    }

    set((state) => {
      const nextCrowdForecastById = { ...state.crowdForecastById };

      for (const crowdForecast of crowdForecasts) {
        const normalized = normalizeCrowdForecast(crowdForecast);
        if (normalized) {
          nextCrowdForecastById[normalized.id] = {
            ...(nextCrowdForecastById[normalized.id] ?? {}),
            ...normalized,
          };
        }
      }

      const nextCrowdForecasts = sortCrowdForecasts(Object.values(nextCrowdForecastById), state.sort);

      return {
        crowdForecasts: nextCrowdForecasts,
        crowdForecastById: nextCrowdForecastById,
        crowdForecastIds: uniqueIds(nextCrowdForecasts.map((item) => item.id)),
        pagination: {
          ...state.pagination,
          total: nextCrowdForecasts.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  patchCrowdForecast: (crowdForecastId, patch = {}) => {
    if (!crowdForecastId) {
      return;
    }

    set((state) => {
      const current = state.crowdForecastById[crowdForecastId];
      if (!current) {
        return state;
      }

      const nextCrowdForecast = {
        ...current,
        ...patch,
        id: crowdForecastId,
      };

      const nextCrowdForecastById = {
        ...state.crowdForecastById,
        [crowdForecastId]: nextCrowdForecast,
      };
      const nextCrowdForecasts = sortCrowdForecasts(Object.values(nextCrowdForecastById), state.sort);

      return {
        crowdForecasts: nextCrowdForecasts,
        crowdForecastById: nextCrowdForecastById,
        crowdForecastIds: uniqueIds(nextCrowdForecasts.map((item) => item.id)),
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  removeCrowdForecast: (crowdForecastId) => {
    if (!crowdForecastId) {
      return;
    }

    set((state) => {
      if (!state.crowdForecastById[crowdForecastId]) {
        return state;
      }

      const nextCrowdForecastById = { ...state.crowdForecastById };
      delete nextCrowdForecastById[crowdForecastId];

      const nextCrowdForecasts = sortCrowdForecasts(Object.values(nextCrowdForecastById), state.sort);

      return {
        crowdForecasts: nextCrowdForecasts,
        crowdForecastById: nextCrowdForecastById,
        crowdForecastIds: uniqueIds(nextCrowdForecasts.map((item) => item.id)),
        selectedCrowdForecastId: state.selectedCrowdForecastId === crowdForecastId ? null : state.selectedCrowdForecastId,
        focusedCrowdForecastId: state.focusedCrowdForecastId === crowdForecastId ? null : state.focusedCrowdForecastId,
        pagination: {
          ...state.pagination,
          total: nextCrowdForecasts.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
      };
    });
  },

  selectCrowdForecast: (selectedCrowdForecastId) =>
    set({
      selectedCrowdForecastId: selectedCrowdForecastId ?? null,
      focusedCrowdForecastId: selectedCrowdForecastId ?? null,
    }),

  focusCrowdForecast: (focusedCrowdForecastId) => set({ focusedCrowdForecastId: focusedCrowdForecastId ?? null }),

  clearSelection: () =>
    set({
      selectedCrowdForecastId: null,
      focusedCrowdForecastId: null,
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
      crowdForecasts: sortCrowdForecasts(state.crowdForecastIds.map((id) => state.crowdForecastById[id]).filter(Boolean), sort ?? state.sort),
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

  hydrateCrowdState: (nextState = {}) =>
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
      crowdForecastById:
        nextState.crowdForecastById && typeof nextState.crowdForecastById === 'object'
          ? { ...state.crowdForecastById, ...nextState.crowdForecastById }
          : state.crowdForecastById,
      crowdForecasts: Array.isArray(nextState.crowdForecasts)
        ? sortCrowdForecasts(nextState.crowdForecasts.map(normalizeCrowdForecast).filter(Boolean), nextState.sort ?? state.sort)
        : state.crowdForecasts,
      crowdForecastIds: Array.isArray(nextState.crowdForecastIds)
        ? uniqueIds(nextState.crowdForecastIds)
        : state.crowdForecastIds,
    })),

  applyCrowdEvent: (event) => {
    if (!event || typeof event !== 'object') {
      return;
    }

    const { type, payload } = event;

    switch (type) {
      case 'crowdForecast.created':
      case 'crowdForecast.updated':
      case 'crowdForecast.synced':
        if (Array.isArray(payload)) {
          get().upsertCrowdForecasts(payload);
        } else {
          get().upsertCrowdForecast(payload);
        }
        get().markSynced();
        return;
      case 'crowdForecast.deleted':
        get().removeCrowdForecast(payload?.id ?? payload?.crowdForecastId ?? null);
        get().markSynced();
        return;
      default:
        return;
    }
  },

  getCrowdForecastById: (crowdForecastId) => get().crowdForecastById[crowdForecastId] ?? null,

  getSelectedCrowdForecast: () => {
    const state = get();
    return state.selectedCrowdForecastId ? state.crowdForecastById[state.selectedCrowdForecastId] ?? null : null;
  },

  getVisibleCrowdForecasts: () => {
    const state = get();
    const filtered = applyFilters(Object.values(state.crowdForecastById), state.filters);
    return sortCrowdForecasts(filtered, state.sort);
  },

  getCrowdCounts: () => {
    const crowdForecasts = Object.values(get().crowdForecastById);
    return crowdForecasts.reduce(
      (accumulator, crowdForecast) => {
        const stationKey = String(crowdForecast.stationName ?? crowdForecast.station ?? 'unknown').toLowerCase();
        const bandKey = String(crowdForecast.confidenceBand ?? 'unknown').toLowerCase();

        accumulator.total += 1;
        accumulator.byStation[stationKey] = (accumulator.byStation[stationKey] ?? 0) + 1;
        accumulator.byBand[bandKey] = (accumulator.byBand[bandKey] ?? 0) + 1;
        return accumulator;
      },
      { total: 0, byStation: {}, byBand: {} },
    );
  },

  getCrowdSummary: () => {
    const state = get();
    const visible = state.getVisibleCrowdForecasts();
    return {
      total: visible.length,
      selectedCrowdForecastId: state.selectedCrowdForecastId,
      focusedCrowdForecastId: state.focusedCrowdForecastId,
      latestUpdatedAt: visible[0]?.lastUpdatedAt ?? null,
      hasErrors: Boolean(state.error),
    };
  },

  resetCrowdState: () => set({ ...INITIAL_STATE, filters: { ...DEFAULT_FILTERS } }),
}));

export default useCrowdStore;

import { create } from 'zustand';

/**
 * Purpose:
 * Canonical train store for RailSentinel. It owns train records, train-specific
 * selection, filters, sorting, paging, and live sync state. It must not own
 * incidents, crowd forecasts, risk scores, or shell UI state.
 *
 * Dependencies:
 * - zustand
 * - Train domain model and train-related event payloads
 * - Approved views and workflows consume this store through the generated hook
 *
 * State:
 * - trainById / trainIds as the canonical train collection
 * - selectedTrainId and focusedTrainId for train workflows
 * - filters, sort, paging, loading, error, and sync metadata
 * - derived timestamps for list freshness and last mutation tracking
 */

const DEFAULT_FILTERS = {
  status: 'all',
  route: 'all',
  serviceType: 'all',
  operator: 'all',
  query: '',
};

const DEFAULT_SORT = 'lastUpdatedAt_desc';

const INITIAL_STATE = {
  trains: [],
  trainById: {},
  trainIds: [],
  selectedTrainId: null,
  focusedTrainId: null,
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

function toTrainId(train) {
  if (!train || typeof train !== 'object') {
    return null;
  }
  return train.id ?? train.trainId ?? null;
}

function normalizeTrain(train) {
  if (!train || typeof train !== 'object') {
    return null;
  }

  const id = toTrainId(train);
  if (!id) {
    return null;
  }

  return {
    ...train,
    id,
  };
}

function sortTrains(trains, sort) {
  const list = [...trains];

  switch (sort) {
    case 'status_desc':
      return list.sort((left, right) => String(right.status ?? '').localeCompare(String(left.status ?? '')));
    case 'status_asc':
      return list.sort((left, right) => String(left.status ?? '').localeCompare(String(right.status ?? '')));
    case 'createdAt_desc':
      return list.sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));
    case 'createdAt_asc':
      return list.sort((left, right) => String(left.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));
    case 'lastUpdatedAt_asc':
      return list.sort((left, right) => String(left.lastUpdatedAt ?? '').localeCompare(String(right.lastUpdatedAt ?? '')));
    case 'lastUpdatedAt_desc':
    default:
      return list.sort((left, right) => String(right.lastUpdatedAt ?? '').localeCompare(String(left.lastUpdatedAt ?? '')));
  }
}

function applyFilters(trains, filters) {
  const query = String(filters?.query ?? '').trim().toLowerCase();

  return trains.filter((train) => {
    if (filters?.status && filters.status !== 'all' && String(train.status ?? '').toLowerCase() !== filters.status.toLowerCase()) {
      return false;
    }

    if (filters?.route && filters.route !== 'all' && String(train.routeName ?? train.route ?? '').toLowerCase() !== filters.route.toLowerCase()) {
      return false;
    }

    if (
      filters?.serviceType &&
      filters.serviceType !== 'all' &&
      String(train.serviceType ?? '').toLowerCase() !== filters.serviceType.toLowerCase()
    ) {
      return false;
    }

    if (
      filters?.operator &&
      filters.operator !== 'all' &&
      String(train.operatorName ?? train.operator ?? '').toLowerCase() !== filters.operator.toLowerCase()
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableFields = [
      train.id,
      train.name,
      train.number,
      train.status,
      train.routeName,
      train.serviceType,
      train.operatorName,
      train.currentStation,
      train.destinationStation,
    ];

    return searchableFields.some((value) => String(value ?? '').toLowerCase().includes(query));
  });
}

function upsertRecord(collection, item) {
  const next = { ...collection };
  next[item.id] = { ...(collection[item.id] ?? {}), ...item };
  return next;
}

export const useTrainStore = create((set, get) => ({
  ...INITIAL_STATE,

  setTrains: (trains = []) => {
    const normalized = trains.map(normalizeTrain).filter(Boolean);
    const trainById = normalized.reduce((accumulator, train) => {
      accumulator[train.id] = train;
      return accumulator;
    }, {});

    set({
      trains: sortTrains(normalized, get().sort),
      trainById,
      trainIds: uniqueIds(normalized.map((train) => train.id)),
      pagination: {
        ...get().pagination,
        total: normalized.length,
      },
      lastUpdatedAt: new Date().toISOString(),
      lastMutatedAt: new Date().toISOString(),
      error: null,
    });
  },

  upsertTrain: (train) => {
    const normalized = normalizeTrain(train);
    if (!normalized) {
      return;
    }

    set((state) => {
      const nextTrainById = upsertRecord(state.trainById, normalized);
      const nextTrains = sortTrains(Object.values(nextTrainById), state.sort);
      const nextTrainIds = uniqueIds(nextTrains.map((item) => item.id));

      return {
        trains: nextTrains,
        trainById: nextTrainById,
        trainIds: nextTrainIds,
        pagination: {
          ...state.pagination,
          total: nextTrainIds.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  upsertTrains: (trains = []) => {
    if (!Array.isArray(trains) || trains.length === 0) {
      return;
    }

    set((state) => {
      const nextTrainById = { ...state.trainById };

      for (const train of trains) {
        const normalized = normalizeTrain(train);
        if (normalized) {
          nextTrainById[normalized.id] = {
            ...(nextTrainById[normalized.id] ?? {}),
            ...normalized,
          };
        }
      }

      const nextTrains = sortTrains(Object.values(nextTrainById), state.sort);

      return {
        trains: nextTrains,
        trainById: nextTrainById,
        trainIds: uniqueIds(nextTrains.map((item) => item.id)),
        pagination: {
          ...state.pagination,
          total: nextTrains.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  patchTrain: (trainId, patch = {}) => {
    if (!trainId) {
      return;
    }

    set((state) => {
      const current = state.trainById[trainId];
      if (!current) {
        return state;
      }

      const nextTrain = {
        ...current,
        ...patch,
        id: trainId,
      };

      const nextTrainById = {
        ...state.trainById,
        [trainId]: nextTrain,
      };
      const nextTrains = sortTrains(Object.values(nextTrainById), state.sort);

      return {
        trains: nextTrains,
        trainById: nextTrainById,
        trainIds: uniqueIds(nextTrains.map((item) => item.id)),
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  removeTrain: (trainId) => {
    if (!trainId) {
      return;
    }

    set((state) => {
      if (!state.trainById[trainId]) {
        return state;
      }

      const nextTrainById = { ...state.trainById };
      delete nextTrainById[trainId];

      const nextTrains = sortTrains(Object.values(nextTrainById), state.sort);

      return {
        trains: nextTrains,
        trainById: nextTrainById,
        trainIds: uniqueIds(nextTrains.map((item) => item.id)),
        selectedTrainId: state.selectedTrainId === trainId ? null : state.selectedTrainId,
        focusedTrainId: state.focusedTrainId === trainId ? null : state.focusedTrainId,
        pagination: {
          ...state.pagination,
          total: nextTrains.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
      };
    });
  },

  selectTrain: (selectedTrainId) =>
    set({
      selectedTrainId: selectedTrainId ?? null,
      focusedTrainId: selectedTrainId ?? null,
    }),

  focusTrain: (focusedTrainId) => set({ focusedTrainId: focusedTrainId ?? null }),

  clearSelection: () =>
    set({
      selectedTrainId: null,
      focusedTrainId: null,
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
      trains: sortTrains(state.trainIds.map((id) => state.trainById[id]).filter(Boolean), sort ?? state.sort),
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

  hydrateTrainState: (nextState = {}) =>
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
      trainById:
        nextState.trainById && typeof nextState.trainById === 'object'
          ? { ...state.trainById, ...nextState.trainById }
          : state.trainById,
      trains: Array.isArray(nextState.trains)
        ? sortTrains(nextState.trains.map(normalizeTrain).filter(Boolean), nextState.sort ?? state.sort)
        : state.trains,
      trainIds: Array.isArray(nextState.trainIds)
        ? uniqueIds(nextState.trainIds)
        : state.trainIds,
    })),

  applyTrainEvent: (event) => {
    if (!event || typeof event !== 'object') {
      return;
    }

    const { type, payload } = event;

    switch (type) {
      case 'train.created':
      case 'train.updated':
      case 'train.synced':
      case 'train.status_changed': // ⚡ Integrated backend telemetry update and status loop payload
        if (Array.isArray(payload)) {
          get().upsertTrains(payload);
        } else {
          get().upsertTrain(payload);
        }
        get().markSynced();
        return;
      case 'train.deleted':
        get().removeTrain(payload?.id ?? payload?.trainId ?? null);
        get().markSynced();
        return;
      default:
        return;
    }
  },

  getTrainById: (trainId) => get().trainById[trainId] ?? null,

  getSelectedTrain: () => {
    const state = get();
    return state.selectedTrainId ? state.trainById[state.selectedTrainId] ?? null : null;
  },

  getVisibleTrains: () => {
    const state = get();
    const filtered = applyFilters(Object.values(state.trainById), state.filters);
    return sortTrains(filtered, state.sort);
  },

  getTrainCounts: () => {
    const trains = Object.values(get().trainById);
    return trains.reduce(
      (accumulator, train) => {
        const statusKey = String(train.status ?? 'unknown').toLowerCase();
        const operatorKey = String(train.operatorName ?? train.operator ?? 'unknown').toLowerCase();

        accumulator.total += 1;
        accumulator.byStatus[statusKey] = (accumulator.byStatus[statusKey] ?? 0) + 1;
        accumulator.byOperator[operatorKey] = (accumulator.byOperator[operatorKey] ?? 0) + 1;
        return accumulator;
      },
      { total: 0, byStatus: {}, byOperator: {} },
    );
  },

  getTrainSummary: () => {
    const state = get();
    const visible = state.getVisibleTrains();
    return {
      total: visible.length,
      selectedTrainId: state.selectedTrainId,
      focusedTrainId: state.focusedTrainId,
      latestUpdatedAt: visible[0]?.lastUpdatedAt ?? null,
      hasErrors: Boolean(state.error),
    };
  },

  resetTrainState: () => set({ ...INITIAL_STATE, filters: { ...DEFAULT_FILTERS } }),
}));

export default useTrainStore;
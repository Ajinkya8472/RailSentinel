import { create } from 'zustand';

/**
 * Purpose:
 * Canonical incident store for RailSentinel. It owns incident records,
 * incident-specific selection, filters, sorting, paging, and live sync state.
 * It must not own trains, crowd forecasts, risk scores, or shell UI state.
 *
 * Dependencies:
 * - zustand
 * - Incident domain model and incident-related event payloads
 * - Approved views and workflows consume this store through the generated hook
 *
 * State:
 * - incidentById / incidentIds as the canonical incident collection
 * - selectedIncidentId and focusedIncidentId for incident workflows
 * - filters, sort, paging, loading, error, and sync metadata
 * - derived timestamps for list freshness and last mutation tracking
 */

const DEFAULT_FILTERS = {
  status: 'open',
  severity: 'all',
  source: 'all',
  assignee: 'all',
  query: '',
};

const DEFAULT_SORT = 'lastUpdatedAt_desc';

const INITIAL_STATE = {
  incidents: [],
  incidentById: {},
  incidentIds: [],
  selectedIncidentId: null,
  focusedIncidentId: null,
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

function toIncidentId(incident) {
  if (!incident || typeof incident !== 'object') {
    return null;
  }
  return incident.id ?? incident.incidentId ?? null;
}

function normalizeIncident(incident) {
  if (!incident || typeof incident !== 'object') {
    return null;
  }

  const id = toIncidentId(incident);
  if (!id) {
    return null;
  }

  return {
    ...incident,
    id,
  };
}

function sortIncidents(incidents, sort) {
  const list = [...incidents];

  switch (sort) {
    case 'severity_desc':
      return list.sort((left, right) => String(right.severity ?? '').localeCompare(String(left.severity ?? '')));
    case 'severity_asc':
      return list.sort((left, right) => String(left.severity ?? '').localeCompare(String(right.severity ?? '')));
    case 'createdAt_desc':
      return list.sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));
    case 'createdAt_asc':
      return list.sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')));
    case 'lastUpdatedAt_asc':
      return list.sort((left, right) => String(left.lastUpdatedAt ?? '').localeCompare(String(right.lastUpdatedAt ?? '')));
    case 'lastUpdatedAt_desc':
    default:
      return list.sort((left, right) => String(right.lastUpdatedAt ?? '').localeCompare(String(left.lastUpdatedAt ?? '')));
  }
}

function applyFilters(incidents, filters) {
  const query = String(filters?.query ?? '').trim().toLowerCase();

  return incidents.filter((incident) => {
    if (filters?.status && filters.status !== 'all' && String(incident.status ?? '').toLowerCase() !== filters.status.toLowerCase()) {
      return false;
    }

    if (
      filters?.severity &&
      filters.severity !== 'all' &&
      String(incident.severity ?? '').toLowerCase() !== filters.severity.toLowerCase()
    ) {
      return false;
    }

    if (
      filters?.source &&
      filters.source !== 'all' &&
      String(incident.source ?? '').toLowerCase() !== filters.source.toLowerCase()
    ) {
      return false;
    }

    if (
      filters?.assignee &&
      filters.assignee !== 'all' &&
      String(incident.assigneeId ?? incident.assignee ?? '').toLowerCase() !== filters.assignee.toLowerCase()
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableFields = [
      incident.id,
      incident.title,
      incident.description,
      incident.status,
      incident.severity,
      incident.source,
      incident.locationName,
      incident.type,
    ];

    return searchableFields.some((value) => String(value ?? '').toLowerCase().includes(query));
  });
}

function upsertRecord(collection, item) {
  const next = { ...collection };
  next[item.id] = { ...(collection[item.id] ?? {}), ...item };
  return next;
}

export const useIncidentStore = create((set, get) => ({
  ...INITIAL_STATE,

  setIncidents: (incidents = []) => {
    const normalized = incidents.map(normalizeIncident).filter(Boolean);
    const incidentById = normalized.reduce((accumulator, incident) => {
      accumulator[incident.id] = incident;
      return accumulator;
    }, {});

    set({
      incidents: sortIncidents(normalized, get().sort),
      incidentById,
      incidentIds: uniqueIds(normalized.map((incident) => incident.id)),
      pagination: {
        ...get().pagination,
        total: normalized.length,
      },
      lastUpdatedAt: new Date().toISOString(),
      lastMutatedAt: new Date().toISOString(),
      error: null,
    });
  },

  upsertIncident: (incident) => {
    const normalized = normalizeIncident(incident);
    if (!normalized) {
      return;
    }

    set((state) => {
      const nextIncidentById = upsertRecord(state.incidentById, normalized);
      const nextIncidents = sortIncidents(Object.values(nextIncidentById), state.sort);
      const nextIncidentIds = uniqueIds(nextIncidents.map((item) => item.id));

      return {
        incidents: nextIncidents,
        incidentById: nextIncidentById,
        incidentIds: nextIncidentIds,
        pagination: {
          ...state.pagination,
          total: nextIncidentIds.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },
// Called by useWebSocket.js on "new_incident" — adds/updates one incident
  addIncident: (incident) => {
    get().upsertIncident(incident);
  },

  // Called by useWebSocket.js on "incident_update" — patches status + merges incident object
  updateIncident: (incidentId, newStatus, updatedIncident) => {
    if (!incidentId) return;

    set((state) => {
      const current = state.incidentById[incidentId] ?? { id: incidentId };
      const merged = {
        ...current,
        ...(updatedIncident && typeof updatedIncident === 'object' ? updatedIncident : {}),
        ...(newStatus ? { status: newStatus } : {}),
        id: incidentId,
      };

      const nextIncidentById = { ...state.incidentById, [incidentId]: merged };
      const nextIncidents = sortIncidents(Object.values(nextIncidentById), state.sort);

      return {
        incidents: nextIncidents,
        incidentById: nextIncidentById,
        incidentIds: uniqueIds(nextIncidents.map((item) => item.id)),
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },
  upsertIncidents: (incidents = []) => {
    if (!Array.isArray(incidents) || incidents.length === 0) {
      return;
    }

    set((state) => {
      const nextIncidentById = { ...state.incidentById };

      for (const incident of incidents) {
        const normalized = normalizeIncident(incident);
        if (normalized) {
          nextIncidentById[normalized.id] = {
            ...(nextIncidentById[normalized.id] ?? {}),
            ...normalized,
          };
        }
      }

      const nextIncidents = sortIncidents(Object.values(nextIncidentById), state.sort);

      return {
        incidents: nextIncidents,
        incidentById: nextIncidentById,
        incidentIds: uniqueIds(nextIncidents.map((item) => item.id)),
        pagination: {
          ...state.pagination,
          total: nextIncidents.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  patchIncident: (incidentId, patch = {}) => {
    if (!incidentId) {
      return;
    }

    set((state) => {
      const current = state.incidentById[incidentId];
      if (!current) {
        return state;
      }

      const nextIncident = {
        ...current,
        ...patch,
        id: incidentId,
      };

      const nextIncidentById = {
        ...state.incidentById,
        [incidentId]: nextIncident,
      };
      const nextIncidents = sortIncidents(Object.values(nextIncidentById), state.sort);

      return {
        incidents: nextIncidents,
        incidentById: nextIncidentById,
        incidentIds: uniqueIds(nextIncidents.map((item) => item.id)),
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
        error: null,
      };
    });
  },

  removeIncident: (incidentId) => {
    if (!incidentId) {
      return;
    }

    set((state) => {
      if (!state.incidentById[incidentId]) {
        return state;
      }

      const nextIncidentById = { ...state.incidentById };
      delete nextIncidentById[incidentId];

      const nextIncidents = sortIncidents(Object.values(nextIncidentById), state.sort);

      return {
        incidents: nextIncidents,
        incidentById: nextIncidentById,
        incidentIds: uniqueIds(nextIncidents.map((item) => item.id)),
        selectedIncidentId: state.selectedIncidentId === incidentId ? null : state.selectedIncidentId,
        focusedIncidentId: state.focusedIncidentId === incidentId ? null : state.focusedIncidentId,
        pagination: {
          ...state.pagination,
          total: nextIncidents.length,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastMutatedAt: new Date().toISOString(),
      };
    });
  },

  selectIncident: (selectedIncidentId) =>
    set({
      selectedIncidentId: selectedIncidentId ?? null,
      focusedIncidentId: selectedIncidentId ?? null,
    }),

  focusIncident: (focusedIncidentId) => set({ focusedIncidentId: focusedIncidentId ?? null }),

  clearSelection: () =>
    set({
      selectedIncidentId: null,
      focusedIncidentId: null,
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
      incidents: sortIncidents(state.incidentIds.map((id) => state.incidentById[id]).filter(Boolean), sort ?? state.sort),
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

  hydrateIncidentState: (nextState = {}) =>
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
      incidentById:
        nextState.incidentById && typeof nextState.incidentById === 'object'
          ? { ...state.incidentById, ...nextState.incidentById }
          : state.incidentById,
      incidents: Array.isArray(nextState.incidents)
        ? sortIncidents(nextState.incidents.map(normalizeIncident).filter(Boolean), nextState.sort ?? state.sort)
        : state.incidents,
      incidentIds: Array.isArray(nextState.incidentIds)
        ? uniqueIds(nextState.incidentIds)
        : state.incidentIds,
    })),

  applyIncidentEvent: (event) => {
    if (!event || typeof event !== 'object') {
      return;
    }

    const { type, payload } = event;

    switch (type) {
      case 'incident.created':
      case 'incident.updated':
      case 'incident.synced':
      case 'incident.status_changed': // ⚡ Integrated backend live real-time state patch hook
        if (Array.isArray(payload)) {
          get().upsertIncidents(payload);
        } else {
          get().upsertIncident(payload);
        }
        get().markSynced();
        return;
      case 'incident.deleted':
        get().removeIncident(payload?.id ?? payload?.incidentId ?? null);
        get().markSynced();
        return;
      default:
        return;
    }
  },

  getIncidentById: (incidentId) => get().incidentById[incidentId] ?? null,

  getSelectedIncident: () => {
    const state = get();
    return state.selectedIncidentId ? state.incidentById[state.selectedIncidentId] ?? null : null;
  },

  getVisibleIncidents: () => {
    const state = get();
    const filtered = applyFilters(Object.values(state.incidentById), state.filters);
    return sortIncidents(filtered, state.sort);
  },

  getIncidentCounts: () => {
    const incidents = Object.values(get().incidentById);
    return incidents.reduce(
      (accumulator, incident) => {
        const statusKey = String(incident.status ?? 'unknown').toLowerCase();
        const severityKey = String(incident.severity ?? 'unknown').toLowerCase();

        accumulator.total += 1;
        accumulator.byStatus[statusKey] = (accumulator.byStatus[statusKey] ?? 0) + 1;
        accumulator.bySeverity[severityKey] = (accumulator.bySeverity[severityKey] ?? 0) + 1;
        return accumulator;
      },
      { total: 0, byStatus: {}, bySeverity: {} },
    );
  },

  getIncidentSummary: () => {
    const state = get();
    const visible = state.getVisibleIncidents();
    return {
      total: visible.length,
      selectedIncidentId: state.selectedIncidentId,
      focusedIncidentId: state.focusedIncidentId,
      latestUpdatedAt: visible[0]?.lastUpdatedAt ?? null,
      hasErrors: Boolean(state.error),
    };
  },

  resetIncidentState: () => set({ ...INITIAL_STATE, filters: { ...DEFAULT_FILTERS } }),
}));

export default useIncidentStore;
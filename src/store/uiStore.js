import { create } from 'zustand';

/**
 * Purpose:
 * Canonical UI store for RailSentinel. It owns all non-domain shell state,
 * layout state, overlays, navigation intent, filters, and ephemeral interface
 * state. It must not own incidents, trains, crowd forecasts, or risk scores.
 *
 * Dependencies:
 * - zustand
 * - Approved shell, layout, and navigation components consume this store
 * - Approved domain stores provide entity IDs and live data context
 *
 * Props:
 * - None. This store is initialized internally and consumed through hooks.
 * - Optional hydration can be provided through the setState API if needed by
 *   the application bootstrap layer.
 *
 * State:
 * - activeLayout: AppShell, DashboardLayout, SplitPanelLayout, MapLayout, DetailLayout
 * - sidebarCollapsed / sidebarOpen
 * - selectedEntityIds by domain reference only
 * - overlays: search, notifications, command palette, assistant
 * - navigation context: activePage, breadcrumbs, recentDestinations
 * - filters, sort modes, density preferences, focus state, and shell loading flags
 * - no duplicated domain ownership is stored here
 */

const INITIAL_STATE = {
  activeLayout: 'DashboardLayout',
  activePage: 'dashboard',
  activeModule: 'dashboard',
  sidebarCollapsed: false,
  sidebarOpen: true,
  notificationCenterOpen: false,
  commandPaletteOpen: false,
  globalSearchOpen: false,
  aiAssistantOpen: false,
  selectedIncidentId: null,
  selectedTrainId: null,
  selectedCrowdForecastId: null,
  selectedRiskScoreId: null,
  selectedNotificationId: null,
  selectedScheduleConflictId: null,
  selectedEnergyProfileId: null,
  selectedSensorReadingId: null,
  selectedEntityType: null,
  selectedEntityId: null,
  breadcrumbs: [],
  recentDestinations: [],
  filters: {
    incident: {},
    train: {},
    crowd: {},
    risk: {},
    notification: {},
    schedule: {},
    energy: {},
  },
  sort: {
    incident: 'lastUpdatedAt_desc',
    train: 'lastUpdatedAt_desc',
    crowd: 'generatedAt_desc',
    risk: 'computedAt_desc',
    notification: 'sentAt_desc',
    schedule: 'createdAt_desc',
    energy: 'generatedAt_desc',
  },
  density: 'comfortable',
  focusMode: false,
  loading: {
    shell: false,
    navigation: false,
    overlays: false,
  },
  error: {
    shell: null,
    navigation: null,
    overlays: null,
  },
  statusMessage: null,
};

function pushUnique(list, item, limit = 10) {
  const next = [item, ...list.filter((entry) => entry !== item)];
  return next.slice(0, limit);
}

export const useUiStore = create((set, get) => ({
  ...INITIAL_STATE,

  setActiveLayout: (activeLayout) => set({ activeLayout }),
  setActivePage: (activePage) => set({ activePage }),
  setActiveModule: (activeModule) => set({ activeModule }),

  setSidebarCollapsed: (sidebarCollapsed) =>
    set((state) => ({
      sidebarCollapsed,
      sidebarOpen: sidebarCollapsed ? false : state.sidebarOpen,
    })),

  setSidebarOpen: (sidebarOpen) =>
    set((state) => ({
      sidebarOpen,
      sidebarCollapsed: sidebarOpen ? state.sidebarCollapsed : true,
    })),

  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
      sidebarOpen: state.sidebarCollapsed ? true : state.sidebarOpen,
    })),

  openNotificationCenter: () => set({ notificationCenterOpen: true }),
  closeNotificationCenter: () => set({ notificationCenterOpen: false }),
  toggleNotificationCenter: () => set((state) => ({ notificationCenterOpen: !state.notificationCenterOpen })),

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  openGlobalSearch: () => set({ globalSearchOpen: true }),
  closeGlobalSearch: () => set({ globalSearchOpen: false }),
  toggleGlobalSearch: () => set((state) => ({ globalSearchOpen: !state.globalSearchOpen })),

  openAiAssistant: () => set({ aiAssistantOpen: true }),
  closeAiAssistant: () => set({ aiAssistantOpen: false }),
  toggleAiAssistant: () => set((state) => ({ aiAssistantOpen: !state.aiAssistantOpen })),

  setSelectedIncidentId: (selectedIncidentId) =>
    set((state) => ({
      selectedIncidentId,
      selectedEntityType: selectedIncidentId ? 'incident' : state.selectedEntityType,
      selectedEntityId: selectedIncidentId ?? state.selectedEntityId,
    })),

  setSelectedTrainId: (selectedTrainId) =>
    set((state) => ({
      selectedTrainId,
      selectedEntityType: selectedTrainId ? 'train' : state.selectedEntityType,
      selectedEntityId: selectedTrainId ?? state.selectedEntityId,
    })),

  setSelectedCrowdForecastId: (selectedCrowdForecastId) =>
    set((state) => ({
      selectedCrowdForecastId,
      selectedEntityType: selectedCrowdForecastId ? 'crowdForecast' : state.selectedEntityType,
      selectedEntityId: selectedCrowdForecastId ?? state.selectedEntityId,
    })),

  setSelectedRiskScoreId: (selectedRiskScoreId) =>
    set((state) => ({
      selectedRiskScoreId,
      selectedEntityType: selectedRiskScoreId ? 'riskScore' : state.selectedEntityType,
      selectedEntityId: selectedRiskScoreId ?? state.selectedEntityId,
    })),

  setSelectedNotificationId: (selectedNotificationId) =>
    set((state) => ({
      selectedNotificationId,
      selectedEntityType: selectedNotificationId ? 'notification' : state.selectedEntityType,
      selectedEntityId: selectedNotificationId ?? state.selectedEntityId,
    })),

  setSelectedScheduleConflictId: (selectedScheduleConflictId) =>
    set((state) => ({
      selectedScheduleConflictId,
      selectedEntityType: selectedScheduleConflictId ? 'scheduleConflict' : state.selectedEntityType,
      selectedEntityId: selectedScheduleConflictId ?? state.selectedEntityId,
    })),

  setSelectedEnergyProfileId: (selectedEnergyProfileId) =>
    set((state) => ({
      selectedEnergyProfileId,
      selectedEntityType: selectedEnergyProfileId ? 'energyProfile' : state.selectedEntityType,
      selectedEntityId: selectedEnergyProfileId ?? state.selectedEntityId,
    })),

  setSelectedSensorReadingId: (selectedSensorReadingId) =>
    set((state) => ({
      selectedSensorReadingId,
      selectedEntityType: selectedSensorReadingId ? 'sensorReading' : state.selectedEntityType,
      selectedEntityId: selectedSensorReadingId ?? state.selectedEntityId,
    })),

  setSelectedEntity: ({ entityType = null, entityId = null } = {}) =>
    set({
      selectedEntityType: entityType,
      selectedEntityId: entityId,
    }),

  clearSelection: () =>
    set({
      selectedIncidentId: null,
      selectedTrainId: null,
      selectedCrowdForecastId: null,
      selectedRiskScoreId: null,
      selectedNotificationId: null,
      selectedScheduleConflictId: null,
      selectedEnergyProfileId: null,
      selectedSensorReadingId: null,
      selectedEntityType: null,
      selectedEntityId: null,
    }),

  setBreadcrumbs: (breadcrumbs) =>
    set({
      breadcrumbs: Array.isArray(breadcrumbs) ? breadcrumbs : [],
    }),

  pushRecentDestination: (destination) =>
    set((state) => ({
      recentDestinations: pushUnique(state.recentDestinations, destination),
    })),

  clearRecentDestinations: () => set({ recentDestinations: [] }),

  setFilters: (scope, nextFilters) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [scope]: nextFilters && typeof nextFilters === 'object' ? { ...nextFilters } : {},
      },
    })),

  clearFilters: (scope) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [scope]: {},
      },
    })),

  setSort: (scope, value) =>
    set((state) => ({
      sort: {
        ...state.sort,
        [scope]: value,
      },
    })),

  setDensity: (density) => set({ density }),
  setFocusMode: (focusMode) => set({ focusMode: Boolean(focusMode) }),

  setLoading: (scope, value) =>
    set((state) => ({
      loading: {
        ...state.loading,
        [scope]: Boolean(value),
      },
    })),

  setError: (scope, value) =>
    set((state) => ({
      error: {
        ...state.error,
        [scope]: value ?? null,
      },
    })),

  setStatusMessage: (statusMessage) => set({ statusMessage: statusMessage ?? null }),
  resetUiState: () => set(INITIAL_STATE),

  selectEntityFromContext: (context) => {
    if (!context || typeof context !== 'object') {
      return;
    }

    const { entityType, entityId } = context;
    set({ selectedEntityType: entityType ?? null, selectedEntityId: entityId ?? null });
  },

  hydrateUiState: (nextState = {}) =>
    set((state) => ({
      ...state,
      ...nextState,
      filters: {
        ...state.filters,
        ...(nextState.filters && typeof nextState.filters === 'object' ? nextState.filters : {}),
      },
      sort: {
        ...state.sort,
        ...(nextState.sort && typeof nextState.sort === 'object' ? nextState.sort : {}),
      },
      loading: {
        ...state.loading,
        ...(nextState.loading && typeof nextState.loading === 'object' ? nextState.loading : {}),
      },
      error: {
        ...state.error,
        ...(nextState.error && typeof nextState.error === 'object' ? nextState.error : {}),
      },
    })),

  selectNotificationCenterRecord: (notificationId) =>
    set({
      selectedNotificationId: notificationId ?? null,
      selectedEntityType: notificationId ? 'notification' : null,
      selectedEntityId: notificationId ?? null,
      notificationCenterOpen: Boolean(notificationId),
    }),

  openOverlayForEntity: ({ entityType = null, entityId = null } = {}) =>
    set({
      selectedEntityType: entityType,
      selectedEntityId: entityId,
      globalSearchOpen: false,
      commandPaletteOpen: false,
      aiAssistantOpen: false,
    }),

  getSelectedEntityReference: () => {
    const state = get();
    return {
      entityType: state.selectedEntityType,
      entityId: state.selectedEntityId,
    };
  },

  getShellState: () => {
    const state = get();
    return {
      activeLayout: state.activeLayout,
      activePage: state.activePage,
      activeModule: state.activeModule,
      sidebarCollapsed: state.sidebarCollapsed,
      sidebarOpen: state.sidebarOpen,
      notificationCenterOpen: state.notificationCenterOpen,
      commandPaletteOpen: state.commandPaletteOpen,
      globalSearchOpen: state.globalSearchOpen,
      aiAssistantOpen: state.aiAssistantOpen,
      selectedEntityType: state.selectedEntityType,
      selectedEntityId: state.selectedEntityId,
      density: state.density,
      focusMode: state.focusMode,
      loading: state.loading,
      error: state.error,
      statusMessage: state.statusMessage,
    };
  },
}));

export default useUiStore;

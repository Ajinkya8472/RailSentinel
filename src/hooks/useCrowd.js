/**
 * Purpose:
 * Hook to manage crowd forecast domain interactions: list, CRUD, horizon
 * snapshots, summaries, and optional realtime ingestion. Syncs with the
 * canonical `useCrowdStore` and uses `crowdService` for transport.
 *
 * Dependencies:
 * - React hooks: `useCallback`, `useEffect`, `useMemo`
 * - `src/store/crowdStore` for canonical ownership
 * - `src/services/crowdService` for API calls
 * - `src/hooks/useWebSocket` for optional realtime ingestion
 *
 * Props (options):
 * - `autoLoad` (boolean): load initial list on mount (default: true)
 * - `params` (object): query params for `crowdService.list`
 * - `realtime` (boolean): enable WebSocket ingestion (default: false)
 * - `wsUrl` (string): WebSocket URL for events
 * - `wsOptions` (object): forwarded to `useWebSocket`
 * - `replaceOnLoad` (boolean): replace store on load (default: true)
 *
 * State (exposed):
 * - `forecasts`, `loading`, `refreshing`, `error`
 */

import { useCallback, useEffect, useMemo } from 'react';
import useCrowdStore from '../store/crowdStore';
import crowdService from '../services/crowdService';
import useWebSocket from './useWebSocket';

function safeGetBody(resp) {
  if (resp == null) return null;
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.results)) return resp.results;
    if (Array.isArray(resp.crowdForecasts)) return resp.crowdForecasts;
  }
  return null;
}

export default function useCrowd(options = {}) {
  const { autoLoad = true, params = {}, realtime = false, wsUrl = null, wsOptions = {}, replaceOnLoad = true } = options;

  const forecasts = useCrowdStore((s) => s.getVisibleCrowdForecasts());
  const loading = useCrowdStore((s) => s.loading);
  const refreshing = useCrowdStore((s) => s.refreshing);
  const error = useCrowdStore((s) => s.error);

  const setLoading = useCrowdStore((s) => s.setLoading);
  const setRefreshing = useCrowdStore((s) => s.setRefreshing);
  const setError = useCrowdStore((s) => s.setError);
  const setCrowdForecasts = useCrowdStore((s) => s.setCrowdForecasts);
  const upsertCrowdForecast = useCrowdStore((s) => s.upsertCrowdForecast);
  const upsertCrowdForecasts = useCrowdStore((s) => s.upsertCrowdForecasts);
  const removeCrowdForecast = useCrowdStore((s) => s.removeCrowdForecast);
  const applyCrowdEvent = useCrowdStore((s) => s.applyCrowdEvent);

  const loadForecasts = useCallback(
    async (opts = {}) => {
      const query = { ...(params || {}), ...(opts.params || {}) };
      const replace = opts.replaceOnLoad ?? replaceOnLoad;
      try {
        setLoading(true);
        setError(null);
        const resp = await crowdService.list(query);
        const body = safeGetBody(resp);
        if (Array.isArray(body)) {
          if (replace) setCrowdForecasts(body);
          else upsertCrowdForecasts(body);
        } else if (body == null && Array.isArray(resp)) {
          if (replace) setCrowdForecasts(resp);
          else upsertCrowdForecasts(resp);
        }
        return resp;
      } catch (err) {
        setError(err ?? new Error('Failed to load crowd forecasts'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [params, replaceOnLoad, setCrowdForecasts, setError, setLoading, upsertCrowdForecasts],
  );

  const refresh = useCallback(
    async (opts = {}) => {
      try {
        setRefreshing(true);
        const r = await loadForecasts(opts);
        return r;
      } finally {
        setRefreshing(false);
      }
    },
    [loadForecasts, setRefreshing],
  );

  const createForecast = useCallback(async (payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await crowdService.create(payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertCrowdForecast(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to create crowd forecast'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertCrowdForecast]);

  const updateForecast = useCallback(async (id, payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await crowdService.update(id, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertCrowdForecast(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to update crowd forecast'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertCrowdForecast]);

  const patchForecast = useCallback(async (id, patch, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await crowdService.patch(id, patch, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertCrowdForecast(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to patch crowd forecast'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertCrowdForecast]);

  const removeForecastApi = useCallback(async (id, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await crowdService.remove(id, opts);
      removeCrowdForecast(id);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to remove crowd forecast'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, removeCrowdForecast]);

  const getHorizon = useCallback((id, opts = {}) => crowdService.getHorizon(id, opts), []);
  const getSnapshot = useCallback((id, opts = {}) => crowdService.getSnapshot(id, opts), []);
  const getStationSummary = useCallback((id, opts = {}) => crowdService.getStationSummary(id, opts), []);
  const getRouteSummary = useCallback((id, opts = {}) => crowdService.getRouteSummary(id, opts), []);

  const ws = useWebSocket(wsUrl, {
    autoConnect: Boolean(realtime && wsUrl),
    autoReconnect: true,
    parseJson: true,
    ...wsOptions,
    onMessage: (msg) => {
      if (!msg || typeof msg !== 'object') return;
      try {
        applyCrowdEvent(msg);
      } catch (e) {
        // swallow
      }
    },
  });

  useEffect(() => {
    if (!autoLoad) return undefined;
    loadForecasts().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, loadForecasts]);

  const api = useMemo(() => ({
    forecasts,
    loading,
    refreshing,
    error,
    loadForecasts,
    refresh,
    createForecast,
    updateForecast,
    patchForecast,
    removeForecast: removeForecastApi,
    getHorizon,
    getSnapshot,
    getStationSummary,
    getRouteSummary,
    ws,
  }), [forecasts, loading, refreshing, error, loadForecasts, refresh, createForecast, updateForecast, patchForecast, removeForecastApi, getHorizon, getSnapshot, getStationSummary, getRouteSummary, ws]);

  return api;
}

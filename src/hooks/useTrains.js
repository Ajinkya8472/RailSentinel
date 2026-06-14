/**
 * Purpose:
 * Hook that manages train domain interactions: loading lists from the API,
 * applying CRUD operations through `trainService`, syncing results into the
 * canonical `useTrainStore`, and optional realtime ingestion via WebSocket.
 *
 * Dependencies:
 * - React hooks: `useEffect`, `useCallback`, `useMemo`
 * - `src/store/trainStore` (Zustand) for canonical train ownership
 * - `src/services/trainService` for HTTP transport
 * - `src/hooks/useWebSocket` optional for realtime event ingestion
 *
 * Props (options):
 * - `autoLoad` (boolean): load initial list on mount (default: true)
 * - `params` (object): query params passed to `trainService.list`
 * - `realtime` (boolean): enable WebSocket ingestion (default: false)
 * - `wsUrl` (string): WebSocket URL for realtime events
 * - `wsOptions` (object): options forwarded to `useWebSocket` (optional)
 * - `replaceOnLoad` (boolean): replace store on load via `setTrains` (default: true)
 *
 * State (exposed):
 * - `trains`: array of visible trains (from the store)
 * - `loading`, `refreshing`, `error`: operation status flags
 *
 * Notes:
 * - Keeps single source of truth in `useTrainStore`.
 * - Defensive parsing of service responses to support varied API shapes.
 */

import { useCallback, useEffect, useMemo } from 'react';
import useTrainStore from '../store/trainStore';
import trainService from '../services/trainService';
import useWebSocket from './useWebSocket';

function safeGetBody(resp) {
  if (resp == null) return null;
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.results)) return resp.results;
    if (Array.isArray(resp.trains)) return resp.trains;
  }
  return null;
}

export default function useTrains(options = {}) {
  const {
    autoLoad = true,
    params = {},
    realtime = false,
    wsUrl = null,
    wsOptions = {},
    replaceOnLoad = true,
  } = options;

  // selectors
  const trains = useTrainStore((s) => s.getVisibleTrains());
  const loading = useTrainStore((s) => s.loading);
  const refreshing = useTrainStore((s) => s.refreshing);
  const error = useTrainStore((s) => s.error);

  const setLoading = useTrainStore((s) => s.setLoading);
  const setRefreshing = useTrainStore((s) => s.setRefreshing);
  const setError = useTrainStore((s) => s.setError);
  const setTrains = useTrainStore((s) => s.setTrains);
  const upsertTrain = useTrainStore((s) => s.upsertTrain);
  const upsertTrains = useTrainStore((s) => s.upsertTrains);
  const removeTrain = useTrainStore((s) => s.removeTrain);
  const applyTrainEvent = useTrainStore((s) => s.applyTrainEvent);

  const loadTrains = useCallback(
    async (opts = {}) => {
      const query = { ...(params || {}), ...(opts.params || {}) };
      const replace = opts.replaceOnLoad ?? replaceOnLoad;
      try {
        setLoading(true);
        setError(null);
        const resp = await trainService.list(query);
        const body = safeGetBody(resp);
        if (Array.isArray(body)) {
          if (replace) setTrains(body);
          else upsertTrains(body);
        } else if (body == null && Array.isArray(resp)) {
          if (replace) setTrains(resp);
          else upsertTrains(resp);
        }
        return resp;
      } catch (err) {
        setError(err ?? new Error('Failed to load trains'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [params, replaceOnLoad, setError, setLoading, setTrains, upsertTrains],
  );

  const refresh = useCallback(
    async (opts = {}) => {
      try {
        setRefreshing(true);
        const r = await loadTrains(opts);
        return r;
      } finally {
        setRefreshing(false);
      }
    },
    [loadTrains, setRefreshing],
  );

  const createTrain = useCallback(async (payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await trainService.create(payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertTrain(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to create train'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertTrain]);

  const updateTrain = useCallback(async (trainId, payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await trainService.update(trainId, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertTrain(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to update train'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertTrain]);

  const patchTrainApi = useCallback(async (trainId, patch, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await trainService.patch(trainId, patch, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertTrain(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to patch train'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertTrain]);

  const removeTrainApi = useCallback(async (trainId, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await trainService.remove(trainId, opts);
      removeTrain(trainId);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to remove train'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, removeTrain]);

  const ws = useWebSocket(wsUrl, {
    autoConnect: Boolean(realtime && wsUrl),
    autoReconnect: true,
    parseJson: true,
    ...wsOptions,
    onMessage: (msg) => {
      if (!msg || typeof msg !== 'object') return;
      try {
        applyTrainEvent(msg);
      } catch (e) {
        // swallow
      }
    },
  });

  useEffect(() => {
    if (!autoLoad) return undefined;
    loadTrains().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const api = useMemo(
    () => ({
      trains,
      loading,
      refreshing,
      error,
      loadTrains,
      refresh,
      createTrain,
      updateTrain,
      patchTrain: patchTrainApi,
      removeTrain: removeTrainApi,
      ws,
    }),
    [trains, loading, refreshing, error, loadTrains, refresh, createTrain, updateTrain, patchTrainApi, removeTrainApi, ws],
  );

  return api;
}

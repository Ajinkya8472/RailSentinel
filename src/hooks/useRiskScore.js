/**
 * Purpose:
 * Hook to manage risk score domain interactions: loading lists, CRUD,
 * recalculation, and syncing results into the canonical `useRiskStore`.
 * Optionally ingests realtime risk events via WebSocket.
 *
 * Dependencies:
 * - React hooks: `useEffect`, `useCallback`, `useMemo`
 * - `src/store/riskStore` (Zustand)
 * - `src/services/riskService` for HTTP transport
 * - `src/hooks/useWebSocket` for optional realtime events
 *
 * Props (options):
 * - `autoLoad` (boolean): load on mount (default: true)
 * - `params` (object): query params for `riskService.list`
 * - `realtime` (boolean): enable WS ingestion (default: false)
 * - `wsUrl` (string): WebSocket URL for events
 * - `wsOptions` (object): forwarded to `useWebSocket`
 * - `replaceOnLoad` (boolean): use `setRiskScores` vs `upsertRiskScores` (default: true)
 *
 * State (exposed):
 * - `riskScores`, `loading`, `refreshing`, `error`
 */

import { useCallback, useEffect, useMemo } from 'react';
import useRiskStore from '../store/riskStore';
import riskService from '../services/riskService';
import useWebSocket from './useWebSocket';

function safeGetBody(resp) {
  if (resp == null) return null;
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.results)) return resp.results;
    if (Array.isArray(resp.riskScores)) return resp.riskScores;
  }
  return null;
}

export default function useRiskScore(options = {}) {
  const {
    autoLoad = true,
    params = {},
    realtime = false,
    wsUrl = null,
    wsOptions = {},
    replaceOnLoad = true,
  } = options;

  const riskScores = useRiskStore((s) => s.getVisibleRiskScores());
  const loading = useRiskStore((s) => s.loading);
  const refreshing = useRiskStore((s) => s.refreshing);
  const error = useRiskStore((s) => s.error);

  const setRiskScores = useRiskStore((s) => s.setRiskScores);
  const upsertRiskScore = useRiskStore((s) => s.upsertRiskScore);
  const upsertRiskScores = useRiskStore((s) => s.upsertRiskScores);
  const removeRiskScore = useRiskStore((s) => s.removeRiskScore);
  const applyRiskEvent = useRiskStore((s) => s.applyRiskEvent);
  const setLoading = useRiskStore((s) => s.setLoading);
  const setRefreshing = useRiskStore((s) => s.setRefreshing);
  const setError = useRiskStore((s) => s.setError);

  const loadRiskScores = useCallback(
    async (opts = {}) => {
      const query = { ...(params || {}), ...(opts.params || {}) };
      const replace = opts.replaceOnLoad ?? replaceOnLoad;
      try {
        setLoading(true);
        setError(null);
        const resp = await riskService.list(query);
        const body = safeGetBody(resp);
        if (Array.isArray(body)) {
          if (replace) setRiskScores(body);
          else upsertRiskScores(body);
        } else if (body == null && Array.isArray(resp)) {
          if (replace) setRiskScores(resp);
          else upsertRiskScores(resp);
        }
        return resp;
      } catch (err) {
        setError(err ?? new Error('Failed to load risk scores'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [params, replaceOnLoad, setError, setLoading, setRiskScores, upsertRiskScores],
  );

  const refresh = useCallback(
    async (opts = {}) => {
      try {
        setRefreshing(true);
        const r = await loadRiskScores(opts);
        return r;
      } finally {
        setRefreshing(false);
      }
    },
    [loadRiskScores, setRefreshing],
  );

  const createRiskScore = useCallback(async (payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await riskService.create(payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertRiskScore(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to create risk score'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertRiskScore]);

  const updateRiskScore = useCallback(async (riskScoreId, payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await riskService.update(riskScoreId, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertRiskScore(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to update risk score'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertRiskScore]);

  const patchRiskScoreApi = useCallback(async (riskScoreId, patch, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await riskService.patch(riskScoreId, patch, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertRiskScore(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to patch risk score'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertRiskScore]);

  const removeRiskScoreApi = useCallback(async (riskScoreId, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await riskService.remove(riskScoreId, opts);
      removeRiskScore(riskScoreId);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to remove risk score'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, removeRiskScore]);

  const recalculate = useCallback(async (riskScoreId, payload = {}, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await riskService.recalculate(riskScoreId, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertRiskScore(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to recalculate risk score'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertRiskScore]);

  const getBreakdown = useCallback((riskScoreId, opts = {}) => riskService.getBreakdown(riskScoreId, opts), []);
  const getDrivers = useCallback((riskScoreId, opts = {}) => riskService.getDrivers(riskScoreId, opts), []);
  const getSnapshot = useCallback((riskScoreId, opts = {}) => riskService.getSnapshot(riskScoreId, opts), []);

  const ws = useWebSocket(wsUrl, {
    autoConnect: Boolean(realtime && wsUrl),
    autoReconnect: true,
    parseJson: true,
    ...wsOptions,
    onMessage: (msg) => {
      if (!msg || typeof msg !== 'object') return;
      try {
        applyRiskEvent(msg);
      } catch (e) {
        // swallow; store surfaces issues
      }
    },
  });

  useEffect(() => {
    if (!autoLoad) return undefined;
    loadRiskScores().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const api = useMemo(
    () => ({
      riskScores,
      loading,
      refreshing,
      error,
      loadRiskScores,
      refresh,
      createRiskScore,
      updateRiskScore,
      patchRiskScore: patchRiskScoreApi,
      removeRiskScore: removeRiskScoreApi,
      recalculate,
      getBreakdown,
      getDrivers,
      getSnapshot,
      ws,
    }),
    [riskScores, loading, refreshing, error, loadRiskScores, refresh, createRiskScore, updateRiskScore, patchRiskScoreApi, removeRiskScoreApi, recalculate, getBreakdown, getDrivers, getSnapshot, ws],
  );

  return api;
}

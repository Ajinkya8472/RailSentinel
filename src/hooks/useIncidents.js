/**
 * Purpose:
 * Hook that encapsulates incident domain operations: loading from the API,
 * synchronizing into the canonical `useIncidentStore`, providing CRUD helpers,
 * and optional realtime ingestion via WebSocket events.
 *
 * Dependencies:
 * - React hooks: `useEffect`, `useCallback`
 * - `src/store/incidentStore` (Zustand) for canonical incident ownership
 * - `src/services/incidentService` for HTTP transport
 * - `src/hooks/useWebSocket` optional for realtime event ingestion
 *
 * Props (options):
 * - `autoLoad` (boolean): load initial list on mount (default: true)
 * - `params` (object): query params passed to `incidentService.list`
 * - `realtime` (boolean): enable WebSocket ingestion (default: false)
 * - `wsUrl` (string): WebSocket URL to connect for realtime events
 * - `wsOptions` (object): options forwarded to `useWebSocket` (optional)
 * - `replaceOnLoad` (boolean): replace store via `setIncidents` (default: true)
 *
 * State (exposed):
 * - `incidents`: array of visible incidents (from the store)
 * - `loading`: boolean for initial load
 * - `refreshing`: boolean for refresh operations
 * - `error`: last error encountered
 *
 * Production-ready features:
 * - Defensive parsing of service responses
 * - Minimal retries can be implemented externally; hook supports WebSocket reconnect via `useWebSocket`
 * - Keeps store as single source of truth; does not duplicate canonical state
 */

import { useCallback, useEffect, useMemo } from 'react';
import useIncidentStore from '../store/incidentStore';
import incidentService from '../services/incidentService';
import useWebSocket from './useWebSocket';

function safeGetBody(resp) {
  // service wrappers typically return parsed JSON; support { items, data } shapes too
  if (resp == null) return null;
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.results)) return resp.results;
    if (Array.isArray(resp.incidents)) return resp.incidents;
  }
  return null;
}

export default function useIncidents(options = {}) {
  const {
    autoLoad = true,
    params = {},
    realtime = false,
    wsUrl = null,
    wsOptions = {},
    replaceOnLoad = true,
  } = options;

  // store selectors
  const incidents = useIncidentStore((s) => s.getVisibleIncidents());
  const loading = useIncidentStore((s) => s.loading);
  const refreshing = useIncidentStore((s) => s.refreshing);
  const error = useIncidentStore((s) => s.error);

  const setLoading = useIncidentStore((s) => s.setLoading);
  const setRefreshing = useIncidentStore((s) => s.setRefreshing);
  const setError = useIncidentStore((s) => s.setError);
  const setIncidents = useIncidentStore((s) => s.setIncidents);
  const upsertIncident = useIncidentStore((s) => s.upsertIncident);
  const upsertIncidents = useIncidentStore((s) => s.upsertIncidents);
  const removeIncident = useIncidentStore((s) => s.removeIncident);
  const applyIncidentEvent = useIncidentStore((s) => s.applyIncidentEvent);

  const loadIncidents = useCallback(
    async (opts = {}) => {
      const query = { ...(params || {}), ...(opts.params || {}) };
      const replace = opts.replaceOnLoad ?? replaceOnLoad;
      try {
        setLoading(true);
        setError(null);
        const resp = await incidentService.list(query);
        const body = safeGetBody(resp);
        if (Array.isArray(body)) {
          if (replace) setIncidents(body);
          else upsertIncidents(body);
        } else if (body == null && Array.isArray(resp)) {
          if (replace) setIncidents(resp);
          else upsertIncidents(resp);
        }
        return resp;
      } catch (err) {
        setError(err ?? new Error('Failed to load incidents'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [params, replaceOnLoad, setError, setIncidents, setLoading, upsertIncidents],
  );

  const refresh = useCallback(
    async (opts = {}) => {
      try {
        setRefreshing(true);
        const r = await loadIncidents(opts);
        return r;
      } finally {
        setRefreshing(false);
      }
    },
    [loadIncidents, setRefreshing],
  );

  const createIncident = useCallback(async (payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await incidentService.create(payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') {
        // API often returns created resource
        upsertIncident(body);
      }
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to create incident'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertIncident]);

  const updateIncident = useCallback(async (incidentId, payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await incidentService.update(incidentId, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') {
        upsertIncident(body);
      }
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to update incident'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertIncident]);

  const patchIncidentApi = useCallback(async (incidentId, patch, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await incidentService.patch(incidentId, patch, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') {
        upsertIncident(body);
      }
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to patch incident'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertIncident]);

  const removeIncidentApi = useCallback(async (incidentId, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await incidentService.remove(incidentId, opts);
      // assume success; reflect in store
      removeIncident(incidentId);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to remove incident'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, removeIncident]);

  // WebSocket: optional realtime ingestion
  const ws = useWebSocket(wsUrl, {
    autoConnect: Boolean(realtime && wsUrl),
    autoReconnect: true,
    parseJson: true,
    ...wsOptions,
    onMessage: (msg) => {
      // expected message shape: { type: 'incident.created'|'incident.updated'|..., payload }
      if (!msg || typeof msg !== 'object') return;
      try {
        applyIncidentEvent(msg);
      } catch (e) {
        // swallow — store will surface errors
      }
    },
  });

  // auto-load on mount
  useEffect(() => {
    if (!autoLoad) return undefined;
    // kick off load; ignore promise
    loadIncidents().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, loadIncidents]);

  const api = useMemo(() => ({
    incidents,
    loading,
    refreshing,
    error,
    loadIncidents,
    refresh,
    createIncident,
    updateIncident,
    patchIncident: patchIncidentApi,
    removeIncident: removeIncidentApi,
    ws,
  }), [incidents, loading, refreshing, error, loadIncidents, refresh, createIncident, updateIncident, patchIncidentApi, removeIncidentApi, ws]);

  return api;
}

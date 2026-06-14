/**
 * Purpose:
 * Hook to manage schedule conflict domain operations: list, create, update,
 * patch, remove, timetable retrieval, optimization actions, and optional
 * realtime ingestion. Integrates with an optional canonical store if provided
 * via options; otherwise maintains local state.
 *
 * Dependencies:
 * - React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
 * - `src/services/scheduleService` for HTTP transport
 * - `src/hooks/useWebSocket` for optional realtime ingestion
 *
 * Props (options):
 * - `autoLoad` (boolean): load initial list on mount (default: true)
 * - `params` (object): query params for `scheduleService.list`
 * - `realtime` (boolean): enable WebSocket ingestion (default: false)
 * - `wsUrl` (string): WebSocket URL for events
 * - `wsOptions` (object): forwarded to `useWebSocket`
 * - `replaceOnLoad` (boolean): replace store/local state on load (default: true)
 * - `store` (object): optional store instance exposing canonical actions/selectors
 *
 * State (exposed):
 * - `schedules`: array of schedule conflict objects
 * - `loading`, `refreshing`, `error`
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import scheduleService from '../services/scheduleService';
import useWebSocket from './useWebSocket';

function safeGetBody(resp) {
  if (resp == null) return null;
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.results)) return resp.results;
    if (Array.isArray(resp.scheduleConflicts)) return resp.scheduleConflicts;
  }
  return null;
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const { type, payload } = event;
  return { type, payload };
}

export default function useSchedules(options = {}) {
  const {
    autoLoad = true,
    params = {},
    realtime = false,
    wsUrl = null,
    wsOptions = {},
    replaceOnLoad = true,
    store = null,
  } = options;

  // local fallback state when a canonical store isn't provided
  const [localSchedules, setLocalSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const hasStore = Boolean(store && typeof store === 'object');

  const getSchedules = useCallback(() => {
    if (hasStore && typeof store.getVisibleSchedules === 'function') {
      return store.getVisibleSchedules();
    }
    return localSchedules;
  }, [hasStore, store, localSchedules]);

  const setSchedules = useCallback((schedules) => {
    if (hasStore && typeof store.setSchedules === 'function') {
      store.setSchedules(schedules);
    } else {
      setLocalSchedules(Array.isArray(schedules) ? schedules : []);
    }
  }, [hasStore, store]);

  const upsertSchedules = useCallback((schedules) => {
    if (hasStore && typeof store.upsertSchedules === 'function') {
      store.upsertSchedules(schedules);
    } else {
      setLocalSchedules((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const s of (Array.isArray(schedules) ? schedules : [])) {
          if (s && s.id) map.set(s.id, { ...(map.get(s.id) || {}), ...s });
        }
        return Array.from(map.values());
      });
    }
  }, [hasStore, store]);

  const upsertSchedule = useCallback((schedule) => {
    if (hasStore && typeof store.upsertSchedule === 'function') {
      store.upsertSchedule(schedule);
    } else if (schedule && schedule.id) {
      upsertSchedules([schedule]);
    }
  }, [hasStore, store, upsertSchedules]);

  const removeSchedule = useCallback((id) => {
    if (!id) return;
    if (hasStore && typeof store.removeSchedule === 'function') {
      store.removeSchedule(id);
    } else {
      setLocalSchedules((prev) => prev.filter((s) => s.id !== id));
    }
  }, [hasStore, store]);

  const applyScheduleEvent = useCallback((event) => {
    const ev = normalizeEvent(event);
    if (!ev) return;
    const { type, payload } = ev;
    switch (type) {
      case 'schedule.created':
      case 'schedule.updated':
      case 'schedule.synced':
        if (Array.isArray(payload)) upsertSchedules(payload);
        else upsertSchedule(payload);
        return;
      case 'schedule.deleted':
        removeSchedule(payload?.id ?? payload?.scheduleId ?? null);
        return;
      default:
        return;
    }
  }, [removeSchedule, upsertSchedule, upsertSchedules]);

  const loadSchedules = useCallback(async (opts = {}) => {
    const query = { ...(params || {}), ...(opts.params || {}) };
    const replace = opts.replaceOnLoad ?? replaceOnLoad;
    try {
      setLoading(true);
      setError(null);
      const resp = await scheduleService.list(query);
      const body = safeGetBody(resp);
      if (Array.isArray(body)) {
        if (replace) setSchedules(body);
        else upsertSchedules(body);
      } else if (body == null && Array.isArray(resp)) {
        if (replace) setSchedules(resp);
        else upsertSchedules(resp);
      }
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to load schedules'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [params, replaceOnLoad, setError, setLoading, setSchedules, upsertSchedules]);

  const refresh = useCallback(async (opts = {}) => {
    try {
      setRefreshing(true);
      const r = await loadSchedules(opts);
      return r;
    } finally {
      setRefreshing(false);
    }
  }, [loadSchedules]);

  const createSchedule = useCallback(async (payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await scheduleService.create(payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertSchedule(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to create schedule'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertSchedule]);

  const updateSchedule = useCallback(async (id, payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await scheduleService.update(id, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertSchedule(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to update schedule'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertSchedule]);

  const patchSchedule = useCallback(async (id, patch, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await scheduleService.patch(id, patch, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertSchedule(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to patch schedule'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertSchedule]);

  const removeScheduleApi = useCallback(async (id, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await scheduleService.remove(id, opts);
      removeSchedule(id);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to remove schedule'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, removeSchedule]);

  const getTimetable = useCallback((id, opts = {}) => scheduleService.getTimetable(id, opts), []);
  const optimize = useCallback((id, payload = {}, opts = {}) => scheduleService.optimize(id, payload, opts), []);
  const resolve = useCallback((id, payload = {}, opts = {}) => scheduleService.resolve(id, payload, opts), []);
  const getTimeline = useCallback((id, opts = {}) => scheduleService.getTimeline(id, opts), []);

  const ws = useWebSocket(wsUrl, {
    autoConnect: Boolean(realtime && wsUrl),
    autoReconnect: true,
    parseJson: true,
    ...wsOptions,
    onMessage: (msg) => {
      if (!msg || typeof msg !== 'object') return;
      try {
        if (hasStore && typeof store.applyScheduleEvent === 'function') {
          store.applyScheduleEvent(msg);
        } else {
          applyScheduleEvent(msg);
        }
      } catch (e) {
        // swallow; store or hook should surface errors
      }
    },
  });

  useEffect(() => {
    if (!autoLoad) return undefined;
    loadSchedules().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const api = useMemo(() => ({
    schedules: getSchedules(),
    loading,
    refreshing,
    error,
    loadSchedules,
    refresh,
    createSchedule,
    updateSchedule,
    patchSchedule,
    removeSchedule: removeScheduleApi,
    getTimetable,
    optimize,
    resolve,
    getTimeline,
    ws,
    applyScheduleEvent,
  }), [getSchedules, loading, refreshing, error, loadSchedules, refresh, createSchedule, updateSchedule, patchSchedule, removeScheduleApi, getTimetable, optimize, resolve, getTimeline, ws, applyScheduleEvent]);

  return api;
}

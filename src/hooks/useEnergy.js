/**
 * Purpose:
 * Hook to manage energy profile domain interactions: listing, CRUD,
 * consumption/forecast retrieval, optimization, and optional realtime
 * ingestion. Integrates with an optional canonical `energyStore` when
 * provided; otherwise uses local state.
 *
 * Dependencies:
 * - React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
 * - `src/services/energyService` for HTTP transport
 * - `src/hooks/useWebSocket` for optional realtime ingestion
 *
 * Props (options):
 * - `autoLoad` (boolean): load initial list on mount (default: true)
 * - `params` (object): query params for `energyService.list`
 * - `realtime` (boolean): enable WebSocket ingestion (default: false)
 * - `wsUrl` (string): WebSocket URL for events
 * - `wsOptions` (object): forwarded to `useWebSocket`
 * - `replaceOnLoad` (boolean): replace store/local state on load (default: true)
 * - `store` (object): optional canonical store exposing energy methods
 *
 * State (exposed):
 * - `profiles`: array of energy profiles
 * - `loading`, `refreshing`, `error`
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import energyService from '../services/energyService';
import useWebSocket from './useWebSocket';

function safeGetBody(resp) {
  if (resp == null) return null;
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.results)) return resp.results;
    if (Array.isArray(resp.energyProfiles)) return resp.energyProfiles;
  }
  return null;
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const { type, payload } = event;
  return { type, payload };
}

export default function useEnergy(options = {}) {
  const {
    autoLoad = true,
    params = {},
    realtime = false,
    wsUrl = null,
    wsOptions = {},
    replaceOnLoad = true,
    store = null,
  } = options;

  const [localProfiles, setLocalProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const hasStore = Boolean(store && typeof store === 'object');

  const getProfiles = useCallback(() => {
    if (hasStore && typeof store.getVisibleEnergyProfiles === 'function') {
      return store.getVisibleEnergyProfiles();
    }
    return localProfiles;
  }, [hasStore, store, localProfiles]);

  const setProfiles = useCallback((profiles) => {
    if (hasStore && typeof store.setEnergyProfiles === 'function') {
      store.setEnergyProfiles(profiles);
    } else {
      setLocalProfiles(Array.isArray(profiles) ? profiles : []);
    }
  }, [hasStore, store]);

  const upsertProfiles = useCallback((profiles) => {
    if (hasStore && typeof store.upsertEnergyProfiles === 'function') {
      store.upsertEnergyProfiles(profiles);
    } else {
      setLocalProfiles((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const p of (Array.isArray(profiles) ? profiles : [])) {
          if (p && p.id) map.set(p.id, { ...(map.get(p.id) || {}), ...p });
        }
        return Array.from(map.values());
      });
    }
  }, [hasStore, store]);

  const upsertProfile = useCallback((profile) => {
    if (hasStore && typeof store.upsertEnergyProfile === 'function') {
      store.upsertEnergyProfile(profile);
    } else if (profile && profile.id) {
      upsertProfiles([profile]);
    }
  }, [hasStore, store, upsertProfiles]);

  const removeProfile = useCallback((id) => {
    if (!id) return;
    if (hasStore && typeof store.removeEnergyProfile === 'function') {
      store.removeEnergyProfile(id);
    } else {
      setLocalProfiles((prev) => prev.filter((p) => p.id !== id));
    }
  }, [hasStore, store]);

  const applyEnergyEvent = useCallback((event) => {
    const ev = normalizeEvent(event);
    if (!ev) return;
    const { type, payload } = ev;
    switch (type) {
      case 'energyProfile.created':
      case 'energyProfile.updated':
      case 'energyProfile.synced':
        if (Array.isArray(payload)) upsertProfiles(payload);
        else upsertProfile(payload);
        return;
      case 'energyProfile.deleted':
        removeProfile(payload?.id ?? payload?.energyProfileId ?? null);
        return;
      default:
        return;
    }
  }, [removeProfile, upsertProfile, upsertProfiles]);

  const loadProfiles = useCallback(async (opts = {}) => {
    const query = { ...(params || {}), ...(opts.params || {}) };
    const replace = opts.replaceOnLoad ?? replaceOnLoad;
    try {
      setLoading(true);
      setError(null);
      const resp = await energyService.list(query);
      const body = safeGetBody(resp);
      if (Array.isArray(body)) {
        if (replace) setProfiles(body);
        else upsertProfiles(body);
      } else if (body == null && Array.isArray(resp)) {
        if (replace) setProfiles(resp);
        else upsertProfiles(resp);
      }
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to load energy profiles'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [params, replaceOnLoad, setError, setLoading, setProfiles, upsertProfiles]);

  const refresh = useCallback(async (opts = {}) => {
    try {
      setRefreshing(true);
      const r = await loadProfiles(opts);
      return r;
    } finally {
      setRefreshing(false);
    }
  }, [loadProfiles]);

  const createProfile = useCallback(async (payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await energyService.create(payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertProfile(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to create energy profile'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertProfile]);

  const updateProfile = useCallback(async (id, payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await energyService.update(id, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertProfile(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to update energy profile'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertProfile]);

  const patchProfile = useCallback(async (id, patch, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await energyService.patch(id, patch, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertProfile(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to patch energy profile'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertProfile]);

  const removeProfileApi = useCallback(async (id, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await energyService.remove(id, opts);
      removeProfile(id);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to remove energy profile'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, removeProfile]);

  const getConsumption = useCallback((id, opts = {}) => energyService.getConsumption(id, opts), []);
  const getForecast = useCallback((id, opts = {}) => energyService.getForecast(id, opts), []);
  const optimize = useCallback((id, payload = {}, opts = {}) => energyService.optimize(id, payload, opts), []);
  const getSavings = useCallback((id, opts = {}) => energyService.getSavings(id, opts), []);
  const getTimeline = useCallback((id, opts = {}) => energyService.getTimeline(id, opts), []);

  const ws = useWebSocket(wsUrl, {
    autoConnect: Boolean(realtime && wsUrl),
    autoReconnect: true,
    parseJson: true,
    ...wsOptions,
    onMessage: (msg) => {
      if (!msg || typeof msg !== 'object') return;
      try {
        if (hasStore && typeof store.applyEnergyEvent === 'function') {
          store.applyEnergyEvent(msg);
        } else {
          applyEnergyEvent(msg);
        }
      } catch (e) {
        // swallow
      }
    },
  });

  useEffect(() => {
    if (!autoLoad) return undefined;
    loadProfiles().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, loadProfiles]);

  const api = useMemo(() => ({
    profiles: getProfiles(),
    loading,
    refreshing,
    error,
    loadProfiles,
    refresh,
    createProfile,
    updateProfile,
    patchProfile,
    removeProfile: removeProfileApi,
    getConsumption,
    getForecast,
    optimize,
    getSavings,
    getTimeline,
    ws,
    applyEnergyEvent,
  }), [getProfiles, loading, refreshing, error, loadProfiles, refresh, createProfile, updateProfile, patchProfile, removeProfileApi, getConsumption, getForecast, optimize, getSavings, getTimeline, ws, applyEnergyEvent]);

  return api;
}

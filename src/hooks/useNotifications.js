/**
 * Purpose:
 * Hook to manage notification domain interactions: listing, CRUD, delivery
 * actions (markRead/markUnread/acknowledge/dismiss), and optional realtime
 * ingestion. Uses `notificationService` for transport and keeps a local
 * canonical collection unless a store is supplied.
 *
 * Dependencies:
 * - React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
 * - `src/services/notificationService` for HTTP transport
 * - `src/hooks/useWebSocket` for optional realtime ingestion
 *
 * Props (options):
 * - `autoLoad` (boolean): load initial list on mount (default: true)
 * - `params` (object): query params for `notificationService.list`
 * - `realtime` (boolean): enable WebSocket ingestion (default: false)
 * - `wsUrl` (string): WebSocket URL for events
 * - `wsOptions` (object): forwarded to `useWebSocket`
 * - `replaceOnLoad` (boolean): replace local/store on load (default: true)
 * - `store` (object): optional canonical store with notification methods
 *
 * State (exposed):
 * - `notifications`: array of notification records
 * - `loading`, `refreshing`, `error` flags
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import notificationService from '../services/notificationService';
import useWebSocket from './useWebSocket';

function safeGetBody(resp) {
  if (resp == null) return null;
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.data)) return resp.data;
    if (Array.isArray(resp.results)) return resp.results;
    if (Array.isArray(resp.notifications)) return resp.notifications;
  }
  return null;
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const { type, payload } = event;
  return { type, payload };
}

export default function useNotifications(options = {}) {
  const {
    autoLoad = true,
    params = {},
    realtime = false,
    wsUrl = null,
    wsOptions = {},
    replaceOnLoad = true,
    store = null,
  } = options;

  const [localNotifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const hasStore = Boolean(store && typeof store === 'object');

  const getNotifications = useCallback(() => {
    if (hasStore && typeof store.getVisibleNotifications === 'function') {
      return store.getVisibleNotifications();
    }
    return localNotifications;
  }, [hasStore, store, localNotifications]);

  const setNotifications = useCallback((notifications) => {
    if (hasStore && typeof store.setNotifications === 'function') {
      store.setNotifications(notifications);
    } else {
      setLocalNotifications(Array.isArray(notifications) ? notifications : []);
    }
  }, [hasStore, store]);

  const upsertNotifications = useCallback((notifications) => {
    if (hasStore && typeof store.upsertNotifications === 'function') {
      store.upsertNotifications(notifications);
      return;
    }

    setLocalNotifications((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]));
      for (const n of (Array.isArray(notifications) ? notifications : [])) {
        if (n && n.id) map.set(n.id, { ...(map.get(n.id) || {}), ...n });
      }
      return Array.from(map.values()).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
    });
  }, [hasStore, store]);

  const upsertNotification = useCallback((notification) => {
    if (hasStore && typeof store.upsertNotification === 'function') {
      store.upsertNotification(notification);
      return;
    }
    if (notification && notification.id) upsertNotifications([notification]);
  }, [hasStore, store, upsertNotifications]);

  const removeNotification = useCallback((id) => {
    if (!id) return;
    if (hasStore && typeof store.removeNotification === 'function') {
      store.removeNotification(id);
      return;
    }
    setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
  }, [hasStore, store]);

  const applyNotificationEvent = useCallback((event) => {
    const ev = normalizeEvent(event);
    if (!ev) return;
    const { type, payload } = ev;
    switch (type) {
      case 'notification.created':
      case 'notification.updated':
      case 'notification.synced':
        if (Array.isArray(payload)) upsertNotifications(payload);
        else upsertNotification(payload);
        return;
      case 'notification.deleted':
        removeNotification(payload?.id ?? payload?.notificationId ?? null);
        return;
      default:
        return;
    }
  }, [removeNotification, upsertNotification, upsertNotifications]);

  const loadNotifications = useCallback(async (opts = {}) => {
    const query = { ...(params || {}), ...(opts.params || {}) };
    const replace = opts.replaceOnLoad ?? replaceOnLoad;
    try {
      setLoading(true);
      setError(null);
      const resp = await notificationService.list(query);
      const body = safeGetBody(resp);
      if (Array.isArray(body)) {
        if (replace) setNotifications(body);
        else upsertNotifications(body);
      } else if (body == null && Array.isArray(resp)) {
        if (replace) setNotifications(resp);
        else upsertNotifications(resp);
      }
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to load notifications'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [params, replaceOnLoad, setError, setLoading, setNotifications, upsertNotifications]);

  const refresh = useCallback(async (opts = {}) => {
    try {
      setRefreshing(true);
      const r = await loadNotifications(opts);
      return r;
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  const createNotification = useCallback(async (payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await notificationService.create(payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertNotification(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to create notification'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertNotification]);

  const updateNotification = useCallback(async (id, payload, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await notificationService.update(id, payload, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertNotification(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to update notification'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertNotification]);

  const patchNotification = useCallback(async (id, patch, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await notificationService.patch(id, patch, opts);
      const body = safeGetBody(resp) ?? resp;
      if (body && typeof body === 'object') upsertNotification(body);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to patch notification'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, upsertNotification]);

  const removeNotificationApi = useCallback(async (id, opts = {}) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await notificationService.remove(id, opts);
      removeNotification(id);
      return resp;
    } catch (err) {
      setError(err ?? new Error('Failed to remove notification'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, removeNotification]);

  const markRead = useCallback(async (id, opts = {}) => {
    const resp = await notificationService.markRead(id, {}, opts);
    // reflect locally
    if (resp && typeof resp === 'object') upsertNotification(resp);
    return resp;
  }, [upsertNotification]);

  const markUnread = useCallback(async (id, opts = {}) => {
    const resp = await notificationService.markUnread(id, {}, opts);
    if (resp && typeof resp === 'object') upsertNotification(resp);
    return resp;
  }, [upsertNotification]);

  const acknowledge = useCallback(async (id, payload = {}, opts = {}) => {
    const resp = await notificationService.acknowledge(id, payload, opts);
    if (resp && typeof resp === 'object') upsertNotification(resp);
    return resp;
  }, [upsertNotification]);

  const dismiss = useCallback(async (id, payload = {}, opts = {}) => {
    const resp = await notificationService.dismiss(id, payload, opts);
    if (resp && typeof resp === 'object') upsertNotification(resp);
    return resp;
  }, [upsertNotification]);

  const getDelivery = useCallback((id, opts = {}) => notificationService.getDelivery(id, opts), []);

  const bulkUpsert = useCallback((items, opts = {}) => notificationService.bulkUpsert(items, opts), []);
  const bulkDelete = useCallback((ids, opts = {}) => notificationService.bulkDelete(ids, opts), []);

  const ws = useWebSocket(wsUrl, {
    autoConnect: Boolean(realtime && wsUrl),
    autoReconnect: true,
    parseJson: true,
    ...wsOptions,
    onMessage: (msg) => {
      if (!msg || typeof msg !== 'object') return;
      try {
        if (hasStore && typeof store.applyNotificationEvent === 'function') {
          store.applyNotificationEvent(msg);
        } else {
          applyNotificationEvent(msg);
        }
      } catch (e) {
        // swallow
      }
    },
  });

  useEffect(() => {
    if (!autoLoad) return undefined;
    loadNotifications().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const api = useMemo(() => ({
    notifications: getNotifications(),
    loading,
    refreshing,
    error,
    loadNotifications,
    refresh,
    createNotification,
    updateNotification,
    patchNotification,
    removeNotification: removeNotificationApi,
    markRead,
    markUnread,
    acknowledge,
    dismiss,
    getDelivery,
    bulkUpsert,
    bulkDelete,
    ws,
    applyNotificationEvent,
  }), [getNotifications, loading, refreshing, error, loadNotifications, refresh, createNotification, updateNotification, patchNotification, removeNotificationApi, markRead, markUnread, acknowledge, dismiss, getDelivery, bulkUpsert, bulkDelete, ws, applyNotificationEvent]);

  return api;
}

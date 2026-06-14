// src/components/common/NotificationCenter.jsx
import React, { memo, useCallback, useId, useMemo, useState } from 'react'; 
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, Info, 
  Radio, RefreshCw, Terminal, ArrowUpRight, Ban, SlidersHorizontal,
  TrendingUp, CalendarDays, Train
} from 'lucide-react';

// Central State Store Imports
import useIncidentStore from '../../store/incidentStore'; 
import useRiskStore from '../../store/riskStore'; 
import useCrowdStore from '../../store/crowdStore'; // ⚡ Correctly import the crowd forecast model

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function renderValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return value;
}

// ---------------------------------------------------------------------------
// ⚡ MULTI-DOMAIN VISUAL TONE REGISTER (Incidents, Risks, and Crowd Surges)
// ---------------------------------------------------------------------------
function getNotificationToneConfig(notification) {
  const type = notification?.sysType;
  const priority = String(notification?.priority || '').toUpperCase();
  const severity = String(notification?.severity || '').toLowerCase();
  const level = String(notification?.level || '').toLowerCase();
  const status = String(notification?.status || '').toLowerCase();

  // Set appropriate context icons based on the subsystem origin
  const BaseIcon = type === 'risk' ? TrendingUp : (type === 'crowd' ? CalendarDays : ShieldAlert);

  if (priority === 'P1' || severity === 'critical' || level === 'high' || notification?.priorityBand === 'urgent' || status === 'breach risks') {
    return {
      icon: BaseIcon,
      text: 'text-red-400',
      badge: 'bg-red-500/10 text-red-400 border-red-500/20',
      border: 'border-red-950/60 shadow-red-950/5',
      laser: 'bg-red-500'
    };
  }
  if (priority === 'P2' || priority === 'P3' || severity === 'high' || level === 'medium' || notification?.priorityBand === 'standard' || status === 'surge zones') {
    return {
      icon: BaseIcon,
      text: 'text-orange-400',
      badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      border: 'border-orange-950/60 shadow-orange-950/5',
      laser: 'bg-orange-400'
    };
  }
  if (status === 'acknowledged' || status === 'delivered' || status === 'resolved' || status === 'read') {
    return {
      icon: CheckCircle2,
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      border: 'border-slate-900',
      laser: 'bg-emerald-500'
    };
  }
  return {
    icon: Info,
    text: 'text-slate-400',
    badge: 'bg-slate-900 text-slate-400 border-slate-800',
    border: 'border-slate-900',
    laser: 'bg-slate-700'
  };
}

// ---------------------------------------------------------------------------
// ⚡ UNIFIED MULTI-SELECT OPTION FILTER DECK
// ---------------------------------------------------------------------------
function NotificationFilters({ filters, onChange }) {
  const channelId = useId();
  const priorityId = useId();
  const statusId = useId();

  const updateFilter = useCallback((key, nextValue) => {
    if (typeof onChange === 'function') {
      onChange({ ...filters, [key]: nextValue || undefined });
    }
  }, [filters, onChange]);

  const selectStyle = "w-full h-8 bg-slate-950 border border-slate-900 rounded-lg px-1.5 text-[10px] font-mono font-bold uppercase text-slate-300 focus:outline-none focus:border-slate-800 transition-colors cursor-pointer truncate";

  return (
    <div className="grid grid-cols-3 gap-2 font-mono text-[9px] font-bold uppercase tracking-wider select-none w-full">
      {/* Channel Bus Stream Selector */}
      <div className="space-y-1 min-w-0">
        <label className="text-slate-500 block pl-0.5 truncate" htmlFor={channelId}>Channel</label>
        <select id={channelId} className={selectStyle} value={filters.channel || ''} onChange={(e) => updateFilter('channel', e.target.value)}>
          <option value="">All Streams</option>
          <option value="dashboard">Dashboard HUD Alert</option>
          <option value="center">Operator Center</option>
          <option value="sms">SMS Gateway</option>
          <option value="email">Mailing Node</option>
          <option value="announcement">PA System</option>
          <option value="broadcast">Control Room</option>
          <option value="report">Authority Rep</option>
          <option value="webhook">Webhook API</option>
        </select>
      </div>

      {/* Priority Level Selection */}
      <div className="space-y-1 min-w-0">
        <label className="text-slate-500 block pl-0.5 truncate" htmlFor={priorityId}>Priority</label>
        <select id={priorityId} className={selectStyle} value={filters.priority || ''} onChange={(e) => updateFilter('priority', e.target.value)}>
          <option value="">All Tiers</option>
          <option value="P1">P1 Critical</option>
          <option value="P2">P2 High</option>
          <option value="P3">P3 Medium</option>
          <option value="P4">P4 Low</option>
          <option value="P5">P5 Info</option>
        </select>
      </div>

      {/* State Machine Status Filter */}
      <div className="space-y-1 min-w-0">
        <label className="text-slate-500 block pl-0.5 truncate" htmlFor={statusId}>Status</label>
        <select id={statusId} className={selectStyle} value={filters.status || ''} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="">All States</option>
          <option value="open">Open / Active</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="read">Read</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="escalated">Escalated</option>
          <option value="suppressed">Suppressed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </div>
  );
}

function NotificationRow({ notification, selected, onSelect, onAcknowledge, onEscalate }) {
  const cfg = getNotificationToneConfig(notification);
  const RowIcon = cfg.icon;
  const rowId = `notification-${notification.id}`;

  const actionBtnStyle = "h-6 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 text-[9px] text-slate-400 hover:text-slate-200 font-bold uppercase rounded transition-all transform active:translate-y-[1px] cursor-pointer";

  return (
    <motion.li className="list-none w-full" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
      <article className={cx('p-3.5 rounded-xl border flex flex-col gap-3 relative overflow-hidden bg-slate-950 shadow-md', selected ? 'border-slate-400 bg-slate-900/40' : cfg.border)}>
        <div className={cx('absolute top-0 left-0 w-0.5 h-full', cfg.laser)} />

        <button type="button" className="text-left w-full block focus:outline-none cursor-pointer pl-1 group" onClick={() => onSelect?.(notification)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cx('h-5 w-5 rounded bg-slate-900 border border-slate-850 flex items-center justify-center flex-shrink-0', cfg.text)}>
                <RowIcon size={11} className="animate-pulse" />
              </div>
              <h3 className="text-xs font-mono font-black text-slate-200 uppercase tracking-tight truncate" id={rowId}>
                {renderValue(notification.title)}
              </h3>
            </div>
            <span className={cx('text-[8px] font-mono font-black px-1.5 py-0.5 rounded border flex-shrink-0 uppercase tracking-widest', cfg.badge)}>
              {notification.priorityDisplay}
            </span>
          </div>

          <p className="text-[11px] font-sans text-slate-400 font-light mt-2.5 leading-normal tracking-wide">
            {renderValue(notification.message)}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-3 border-t border-slate-900/60 pt-2.5">
            <span>Bus Stream: <strong className="text-slate-400 font-black">{notification.sysType}</strong></span>
            <span>Channel: <strong className="text-slate-300 font-black">{notification.channel}</strong></span>
            <span>State: <strong className="text-slate-400 font-black">{notification.status}</strong></span>
            {notification.trains && (
              <span className="text-sky-400 flex items-center gap-1">
                <Train size={10} /> <strong className="font-black text-sky-400/90">{notification.trains}</strong>
              </span>
            )}
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-1 pl-1 pt-0.5">
          <button type="button" className={actionBtnStyle} onClick={() => onAcknowledge?.(notification)}>Acknowledge</button>
          <button type="button" className={actionBtnStyle} onClick={() => onEscalate?.(notification)}>Escalate</button>
          <button type="button" className="h-6 px-2 ml-auto bg-slate-950 hover:bg-slate-900 border border-slate-900 text-[9px] text-slate-500 hover:text-slate-300 font-bold uppercase rounded flex items-center gap-1 cursor-pointer">
            Source <ArrowUpRight size={10} />
          </button>
        </div>
      </article>
    </motion.li>
  );
}

function NotificationCenter({
  systemState = 'ready',
  selectedNotificationId,
  filters: controlledFilters,
  defaultFilters = {},
  onSelectNotification,
  onAcknowledgeNotification,
  onEscalateNotification,
  onOpenLinkedEntity,
  onFiltersChange,
  onClose,
  className,
  ...rest
}) {
  const titleId = useId();
  const filtersId = useId();
  const [internalFilters, setInternalFilters] = useState(defaultFilters);

  // ── ⚡ 1. BOUND STATE MATRICES FROM LIVE DOMAIN STORES ───────────────────
  const incidentsList = useIncidentStore((s) => s.incidents || []);
  const risksList = useRiskStore((s) => s.riskScores || []);
  const crowdsList = useCrowdStore((s) => s.crowdForecasts || []);

  // ── ⚡ 2. HOMOGENIZE VARYING STORE SCHEMA ENTRIES INTO UNIFIED FEEDS ──────
  const unifiedTelemetryStream = useMemo(() => {
    // A. Incident Mapper (M01 Cluster)
    const normalizedIncidents = incidentsList.map(i => ({
      id: i.id,
      sysType: 'incident',
      title: i.title || 'M01 // INCIDENT DISPATCH',
      message: i.description || 'No baseline descriptions found.',
      severity: i.severity || 'high',
      priority: i.priority || 'P1',
      priorityDisplay: i.priority || 'P1',
      status: i.status || 'open',
      channel: i.channel || 'dashboard', // Automatically pairs with filter drop-downs safely
      trains: i.linkedTrainIds?.join(', ') || null
    }));

    // B. Risk Core Intelligence Mapper (M08 Cluster)
    const normalizedRisks = risksList.map(r => ({
      id: r.id,
      sysType: 'risk',
      title: `RISK EXPOSURE CORE // SCORE: ${r.score}%`,
      message: r.explanation?.map(e => `${e.factor} (${e.contribution}%) -> ${e.description}`).join(' // ') || 'Risk profile computation completed.',
      severity: r.level || 'medium',
      priority: r.priorityBand === 'urgent' ? 'P1' : (r.priorityBand === 'standard' ? 'P2' : 'P3'),
      priorityDisplay: `IDX ${r.score}`,
      status: r.priorityBand === 'urgent' ? 'escalated' : 'queued',
      channel: r.channel || 'center', // Feeds safely into the Operator Center track filter
      trains: null
    }));

    // C. Volumetric Crowd Management Mapper (M04 Cluster)
    const normalizedCrowds = crowdsList.map(c => ({
      id: c.id,
      sysType: 'crowd',
      title: `SURGE HORIZON ALERT // STATION: ${c.stationName || c.station}`,
      message: `${c.summary || c.description || 'Pedestrian load density warning thresholds exceeded.'} (Horizon: ${c.horizon || 'N/A'})`,
      severity: c.confidenceBand === 'high' ? 'critical' : 'medium',
      priority: c.confidenceBand === 'high' ? 'P1' : 'P2',
      priorityDisplay: `DENS ${c.confidenceScore || 85}%`,
      status: c.confidenceBand === 'high' ? 'failed' : 'delivered',
      channel: c.channel || 'sms', // Routes directly to SMS filter tags
      trains: c.lineName || null
    }));

    return [...normalizedIncidents, ...normalizedRisks, ...normalizedCrowds];
  }, [incidentsList, risksList, crowdsList]);

  const isControlledFilters = controlledFilters && typeof controlledFilters === 'object';
  const filters = isControlledFilters ? controlledFilters : internalFilters;
  const list = safeArray(unifiedTelemetryStream);

  // ── ⚡ 3. STATE CONTEXT RE-RENDERING MATRIX SWEEPS ───────────────────────
  const derivedNotifications = useMemo(() => {
    return list.filter((n) => {
      // Dynamic fallback check to normalize lowercase queries smoothly
      if (filters.channel && String(n.channel).toLowerCase() !== String(filters.channel).toLowerCase()) return false;
      if (filters.priority && String(n.priority).toLowerCase() !== String(filters.priority).toLowerCase()) return false;
      if (filters.status && String(n.status).toLowerCase() !== String(filters.status).toLowerCase()) return false;
      return true;
    });
  }, [filters, list]);

  const isLoading = systemState === 'loading';
  const isEmpty = !isLoading && derivedNotifications.length === 0;

  const updateFilters = useCallback((nextFilters) => {
    if (!isControlledFilters) setInternalFilters(nextFilters);
    if (typeof onFiltersChange === 'function') onFiltersChange(nextFilters);
  }, [isControlledFilters, onFiltersChange]);

  return (
    <aside className={cx('fixed top-0 bottom-0 right-0 w-full sm:w-[460px] h-full bg-slate-950 border-l border-slate-900 flex flex-col font-mono select-none z-50 shadow-2xl overflow-hidden pr-1.5 sm:pr-0', className)} {...rest}>
      
      <header className="p-5 border-b border-slate-900 bg-slate-950 flex items-center justify-between gap-4 flex-shrink-0 w-full box-border">
        <div className="space-y-0.5 min-w-0">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Radio size={10} className="text-red-500 animate-pulse" />
            <span className="truncate">Unified Telemetry Dispatch Bus</span>
          </div>
          <h2 id={titleId} className="text-sm font-black text-white uppercase tracking-tight truncate">Communication Audit Trail</h2>
        </div>
        <button type="button" className="h-7 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 text-[10px] font-bold text-slate-200 hover:text-white rounded-md uppercase tracking-wider transition-all transform active:scale-95 flex-shrink-0 shadow-sm cursor-pointer mr-1 sm:mr-0" onClick={onClose}>Close</button>
      </header>

      {/* Posture Matrix Summary Counters */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-900/20 border-b border-slate-900 flex-shrink-0 box-border w-full">
        {[
          { label: 'Total Logs', value: list.length },
          { label: 'Filtered', value: derivedNotifications.length },
          { label: 'Incidents', value: incidentsList.length },
          { label: 'Risks / CRD', value: risksList.length + crowdsList.length }
        ].map((sum, i) => (
          <div key={i} className="p-2 bg-slate-950 border border-slate-900 rounded-lg flex flex-col justify-between items-center text-center shadow-inner">
            <div className="text-base font-black tracking-tight leading-none text-white">{sum.value}</div>
            <div className="text-[8px] text-slate-500 font-bold mt-1.5 uppercase tracking-wider truncate w-full">{sum.label}</div>
          </div>
        ))}
      </section>

      {/* Filter Matrices Control Section */}
      <section className="p-4 border-b border-slate-900/60 bg-slate-950 flex-shrink-0 box-border w-full">
        <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5" id={filtersId}>
          <SlidersHorizontal size={10} /> <span>Filter Matrices</span>
        </div>
        <NotificationFilters filters={filters || {}} onChange={updateFilters} />
      </section>

      {/* Real-Time Live Feed Window Viewport */}
      <section className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-950/40 relative box-border w-full">
        {isEmpty && (
          <div className="py-14 text-center border border-dashed border-slate-900 rounded-xl flex flex-col items-center justify-center p-6 gap-2 w-full box-border">
            <Ban size={16} className="text-slate-700" />
            <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wide">No active telemetry vectors mapped</h5>
          </div>
        )}

        {!isLoading && derivedNotifications.length > 0 ? (
          <ul className="space-y-3 m-0 p-0 w-full box-border">
            <AnimatePresence mode="popLayout">
              {derivedNotifications.map((notification, index) => {
                const key = notification.id || `${index}`;
                return (
                  <NotificationRow
                    key={key}
                    notification={notification}
                    selected={key === selectedNotificationId}
                    onSelect={onSelectNotification}
                    onAcknowledge={onAcknowledgeNotification}
                    onEscalate={onEscalateNotification}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        ) : null}
      </section>

      {/* FIXED FOOTER STATUS POSTURE */}
      <footer className="p-3 bg-slate-950 border-t border-slate-900 flex items-center justify-between text-[9px] font-bold text-slate-500 flex-shrink-0 tracking-wider box-border w-full">
        <span>STATE REGISTER: AUTOMATED TRI-STORE INTEGRATION</span>
        <div className="flex items-center gap-1.5 text-emerald-500">
          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" /> 
          <span>METRIC BUS SECURE</span>
        </div>
      </footer>
    </aside>
  );
}

export default memo(NotificationCenter);
export { NotificationCenter };
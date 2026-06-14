// src/pages/SchedulePage.jsx
import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // 🎯 Added for lightning-fast internal SPA transition links
import { 
  Clock, AlertTriangle, ShieldAlert, GitMerge, 
  MapPin, Radio, Activity, HardDrive, ArrowUpRight, Train 
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import useTrainStore from '../store/trainStore';
import useIncidentStore from '../store/incidentStore';
import useRiskStore from '../store/riskStore';

// ---------------------------------------------------------------------------
// Operational Severity Helpers (KEPT EXACTLY SAME)
// ---------------------------------------------------------------------------
const DISRUPTED_STATUS = new Set(['delayed', 'cancelled', 'disrupted', 'conflict', 'fault']);
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function conflictSeverity(train) {
  const status = String(train.status ?? '').toLowerCase();
  if (status === 'cancelled') return { label: 'Critical Hold', mod: 'critical', badge: 'bg-red-50 text-red-600 border-red-100' };
  if (status === 'delayed')   return { label: 'High Delay', mod: 'high', badge: 'bg-amber-50 text-amber-600 border-amber-100' };
  if (status === 'disrupted') return { label: 'Medium Conflict', mod: 'medium', badge: 'bg-blue-50 text-blue-600 border-blue-100' };
  return                             { label: 'Low Deviation', mod: 'low', badge: 'bg-slate-50 text-slate-500 border-slate-200' };
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: Premium Micro-Metric Header Strip (Horizontal Alignment)
// ---------------------------------------------------------------------------
function ScheduleKpiStrip({ conflicts, trainCounts, syncing }) {
  const cancelled = trainCounts.byStatus?.cancelled ?? 0;
  const delayed   = trainCounts.byStatus?.delayed   ?? 0;

  return (
    <div className="flex items-center gap-2.5 font-mono text-[11px] select-none" aria-label="Schedule Matrix KPIs">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
        Bottlenecks: <span className="font-bold text-slate-900">{conflicts.length}</span>
      </div>
      <div className={`border rounded-lg px-3 py-1.5 transition-all ${
        cancelled > 0 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        Cancelled: <span className="font-bold">{cancelled}</span>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-amber-600">
        Delayed: <span className="font-bold text-amber-700">{delayed}</span>
      </div>
      <div className="bg-slate-950 text-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${syncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-slate-400 uppercase text-[10px]">TOTAL FLEET:</span>
        <span className="font-bold text-emerald-400">{trainCounts.total || 0} RUNS</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: Tabular High-Density Operational Conflict Row
// ---------------------------------------------------------------------------
function ConflictRow({ train, isSelected, onSelect }) {
  const sev = conflictSeverity(train);
  const status = String(train.status ?? '').toLowerCase();
  const name = train.name ?? train.number ?? train.id;
  const delay = train.delayMinutes ?? train.delay ?? null;

  return (
    <div
      onClick={() => onSelect(train.id)}
      className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col gap-3 select-none ${
        isSelected 
          ? 'bg-slate-50 border-slate-900 shadow-sm' 
          : 'bg-white border-slate-100 hover:bg-slate-50/50'
      }`}
      role="button"
      aria-pressed={isSelected}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate">
            {name}
          </h3>
          <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            {train.routeName || 'Sector Route Unassigned'}
          </p>
        </div>

        <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border flex-shrink-0 ${sev.badge}`}>
          {sev.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-50 pt-2.5">
        <div className="flex items-center gap-1.5 text-slate-500 font-bold">
          <Clock size={11} className="text-slate-400" />
          <span>STATUS CODE: <span className={`uppercase ${status === 'cancelled' ? 'text-red-500' : 'text-amber-500'}`}>{status}</span></span>
        </div>
        {delay != null && (
          <span className="text-amber-600 bg-amber-50/50 px-1.5 py-0.5 rounded font-black text-[9px]">
            +{delay} Min Deviation
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: Balanced Conflict Sidebar Rail Component
// ---------------------------------------------------------------------------
function ScheduleRail({ scheduleIncidents, topRisks }) {
  const navigate = useNavigate(); // 🎯 Router instance hook initialized

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full overflow-hidden divide-y divide-slate-100">
      
      {/* SECTION 1: INCIDENT INTERRUPTS */}
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <ShieldAlert size={12} className="text-slate-400" />
          <span>Incident Interrupts</span>
        </div>
        <div className="space-y-1.5 font-mono text-[11px]">
          {scheduleIncidents.length === 0 ? (
            <div className="py-6 text-center text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl border border-slate-100 uppercase tracking-wider select-none">
              No Operational Route Holds
            </div>
          ) : (
            scheduleIncidents.slice(0, 3).map((inc) => (
              <div key={inc.id} className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-150 flex justify-between items-center shadow-sm">
                <span className="font-sans font-medium text-slate-700 truncate max-w-[70%]" title={inc.title}>
                  {inc.title ?? inc.id}
                </span>
                <span className="text-[8px] font-mono font-black uppercase text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                  {inc.severity}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: SLOT COLLISION MATRIX RISKS */}
      <div className="p-4 flex flex-col gap-3 min-h-[30%] overflow-hidden">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <GitMerge size={12} className="text-slate-400" />
          <span>Slot Collision Risk</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar font-mono text-[11px]">
          {topRisks.length === 0 ? (
            <div className="py-6 text-center text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl border border-slate-100 uppercase tracking-wider select-none">
              No Slot Collisions Tracked
            </div>
          ) : (
            topRisks.slice(0, 3).map((r) => {
              const isCrit = String(r.severityBand ?? '').toLowerCase() === 'critical';
              return (
                <div key={r.id} className="p-2.5 rounded-lg bg-white border border-slate-100 flex justify-between items-center shadow-sm">
                  <span className="text-slate-600 font-sans font-medium truncate max-w-[70%]" title={r.name}>
                    {r.name ?? r.title ?? r.id}
                  </span>
                  <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 border rounded uppercase ${
                    isCrit ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {r.severityBand}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 3: SYSTEM ANCHOR CONSOLE LOG (Banish Blank Voids) */}
      <div className="flex-1 p-4 flex flex-col justify-end bg-slate-50/10">
        <div className="p-3 bg-slate-900 border border-slate-950 text-slate-200 rounded-xl font-mono text-[10px] space-y-1 mt-auto shadow-md">
          <div className="text-emerald-400 font-black uppercase text-[8px] tracking-widest flex items-center gap-1.5">
            <HardDrive size={10} />
            <span>// Combinatorial Conflict Resolver</span>
          </div>
          <p className="text-slate-400 font-sans text-[11px] font-medium leading-normal">
            Multi-agent slot mapping is calculating alternative grid vectors across all critical network intersections to bypass bottleneck holds.
          </p>
        </div>
      </div>

      {/* FOOTER ACTION SPA NAVIGATION LINK */}
      <div className="p-4 bg-slate-50/80 flex-shrink-0">
        <button 
          type="button" 
          className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-[10px] uppercase tracking-widest rounded-lg transition-all relative z-50 pointer-events-auto active:scale-[0.98] cursor-pointer shadow-md border border-slate-950 flex items-center justify-center gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/incidents');
          }}
        >
          Open Triage Center <ArrowUpRight size={12} className="text-slate-400" />
        </button>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Integrated View Port Workspace
// ---------------------------------------------------------------------------
const SchedulePage = memo(function SchedulePage() {
  const loading          = useTrainStore((s) => s.loading);
  const syncing          = useTrainStore((s) => s.syncing);
  const error            = useTrainStore((s) => s.error);
  const selectedTrainId  = useTrainStore((s) => s.selectedTrainId);
  const getVisibleTrains = useTrainStore((s) => s.getVisibleTrains);
  const getTrainCounts   = useTrainStore((s) => s.getTrainCounts);
  const selectTrain      = useTrainStore((s) => s.selectTrain);

  const getVisibleIncidents    = useIncidentStore((s) => s.getVisibleIncidents);
  const getVisibleRiskScores   = useRiskStore((s) => s.getVisibleRiskScores);

  const trainCounts = useMemo(() => getTrainCounts(), [getTrainCounts]);

  const conflicts = useMemo(() =>
    getVisibleTrains()
      .filter((t) => DISRUPTED_STATUS.has(String(t.status ?? '').toLowerCase()))
      .sort((a, b) => {
        const sa = conflictSeverity(a);
        const sb = conflictSeverity(b);
        return (SEVERITY_RANK[sb.mod] ?? 0) - (SEVERITY_RANK[sa.mod] ?? 0);
      }),
  [getVisibleTrains]);

  const scheduleIncidents = useMemo(() =>
    getVisibleIncidents()
      .filter((i) => i.type === 'schedule' || i.category === 'schedule' || i.type === 'delay')
      .slice(0, 4),
    [getVisibleIncidents]);

  const topRisks = useMemo(() =>
    getVisibleRiskScores()
      .filter((r) => String(r.category ?? r.domain ?? '').toLowerCase().includes('schedule'))
      .slice(0, 3),
    [getVisibleRiskScores]);

  const isEmpty   = !loading && !error && conflicts.length === 0;
  const isSuccess = !loading && !error;

  return (
    <DashboardLayout
      // 🚀 DESIGN SIGNATURE ALIGNMENT: Unified title and metric strip wrap layout
      title={
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mb-0.5">
              <span>SCHEDULING SUITE</span>
              <span>//</span>
              <span className="text-orange-600">COLLISION MATRIX</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Dynamic Timetable & Conflict Resolution Matrix
            </h1>
          </div>
          <div className="flex-shrink-0">
            <ScheduleKpiStrip conflicts={conflicts} trainCounts={trainCounts} syncing={syncing} />
          </div>
        </div>
      }
      subtitle="Real-time multi-agent slot collision detection, track capacity optimization vectors, and automated terminal rerouting handles."
      loading={loading}
      empty={isEmpty}
      error={Boolean(error)}
      success={isSuccess}
      primary={
        <div className="space-y-3.5 overflow-y-auto pr-1 max-h-[calc(100vh-280px)]" aria-label="Schedule conflicts">
          {conflicts.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200 shadow-inner">
              [ SYSTEM_SECURE // NO_SCHEDULE_CONFLICTS_QUEUED ]
            </div>
          ) : (
            conflicts.map((t) => (
              <ConflictRow
                key={t.id}
                train={t}
                isSelected={t.id === selectedTrainId}
                onSelect={selectTrain}
              />
            ))
          )}
        </div>
      }
      secondary={
        <div className="h-full">
          <ScheduleRail scheduleIncidents={scheduleIncidents} topRisks={topRisks} />
        </div>
      }
    />
  );
});

export default SchedulePage;
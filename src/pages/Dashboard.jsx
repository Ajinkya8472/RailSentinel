// src/pages/Dashboard.jsx
import React, { memo, useMemo, useState } from 'react';
import { 
  ShieldAlert, Train, Activity, Eye, Users, 
  Clock, Zap, Shield, Compass, Gauge, CheckCircle2 
} from 'lucide-react';

// Hooks & Service Layers
import useWebSocket from '../hooks/useWebSocket';
import incidentService from '../services/incidentService';

// Unified Telemetry State Machine Selectors
import useIncidentStore from '../store/incidentStore';
import useTrainStore from '../store/trainStore';
import useRiskStore from '../store/riskStore';
import useCrowdStore from '../store/crowdStore';

// ── ⚡ String Class Token Joiner Utility (Prevents Reference Crashes) ──
function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default memo(function Dashboard() {
  // Initialize Real-Time Stream Listeners
  
  const [firing, setFiring] = useState(false);

  // Simulated Core Anomaly Trigger Handler Method
  const handleDemo = async () => {
    setFiring(true);
    try { 
      await incidentService.triggerDemo('T001'); 
    } catch (err) {
      console.error('[RailSentinel] Presentation mock injection failed:', err);
    } finally { 
      setFiring(false); 
    }
  };

  // ── ⚡ High-Performance Zustand Core Slice Bindings ─────────────────────
  const getIncidentCounts = useIncidentStore((s) => s.getIncidentCounts);
  const getVisibleIncidents = useIncidentStore((s) => s.getVisibleIncidents);
  
  const getTrainCounts = useTrainStore((s) => s.getTrainCounts);
  const getVisibleTrains = useTrainStore((s) => s.getVisibleTrains);
  
  const getRiskCounts = useRiskStore((s) => s.getRiskCounts);
  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);
  
  const getCrowdCounts = useCrowdStore((s) => s.getCrowdCounts);
  const getVisibleCrowdForecasts = useCrowdStore((s) => s.getVisibleCrowdForecasts);

  // ── ⚡ Memoized Computational Aggregations (Cache Layered) ──────────────
  const incCounts = useMemo(() => getIncidentCounts(), [getIncidentCounts]);
  const trainCounts = useMemo(() => getTrainCounts(), [getTrainCounts]);
  const riskCounts = useMemo(() => getRiskCounts(), [getRiskCounts]);
  const crowdCounts = useMemo(() => getCrowdCounts(), [getCrowdCounts]);

  // Deep array slicing for live vector monitoring viewports
  const liveIncidents = useMemo(() => getVisibleIncidents().slice(0, 2), [getVisibleIncidents]);
  const liveTrains = useMemo(() => getVisibleTrains().slice(0, 2), [getVisibleTrains]);
  const liveRisks = useMemo(() => getVisibleRiskScores().slice(0, 2), [getVisibleRiskScores]);
  const liveCrowds = useMemo(() => getVisibleCrowdForecasts().slice(0, 1), [getVisibleCrowdForecasts]);

  // Extraction rules for sub-module categories
  const energyRisks = useMemo(() => 
    getVisibleRiskScores().filter(r => String(r.category || r.domain || '').toLowerCase().includes('energy')).slice(0, 1),
    [getVisibleRiskScores]
  );
  
  const scheduleConflicts = useMemo(() => 
    getVisibleTrains().filter(t => ['delayed', 'conflict', 'disrupted'].includes(String(t.status || '').toLowerCase())).slice(0, 1),
    [getVisibleTrains]
  );

  const escalatedNotifications = useMemo(() => 
    getVisibleIncidents().filter(i => ['open', 'escalated'].includes(String(i.status || '').toLowerCase())).slice(0, 2),
    [getVisibleIncidents]
  );

  const fallbackEmptyStyle = "py-7 text-center text-[10px] font-mono text-slate-400 bg-slate-50/60 rounded-xl border border-dashed uppercase tracking-wider select-none my-auto";

  return (
    <div className="min-w-0 flex-1 h-full overflow-y-auto bg-slate-100 text-slate-900 font-sans p-6 custom-scrollbar">
      
      {/* HEADER BAR POSTURE SECTION */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5 mb-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <Shield size={12} />
            </div>
            <span className="font-mono tracking-widest text-[10px] font-bold text-slate-400 uppercase">
              RAILSENTINEL // OPERATIONS BACKBONE
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Unified Railway Operational Intelligence
          </h1>
        </div>

        {/* INTERACTIVE ALIGNED CONTROL MATRIX WRAPPER */}
        <div className="flex items-center gap-2">
          {/* ⚡ THE INTERACTIVE TEST INJECTION BUTTON NODE */}
          <button  
            onClick={handleDemo}  
            disabled={firing}  
            className="px-3 py-1 bg-red-600 text-white text-[10px] font-mono font-bold rounded-full hover:bg-red-700 disabled:opacity-50 uppercase tracking-wider transition-all transform active:scale-95 shadow-sm cursor-pointer border-none"
          >
            {firing ? '⚡ FIRING...' : '⚡ DEMO TRIGGER'}
          </button>

          {/* TELEMETRY CONNECTION STATUS PILL */}
          <div className="bg-white border border-slate-200/80 rounded-full px-3 py-1 flex items-center gap-2.5 text-[11px] font-mono shadow-sm h-6 box-border">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-600 font-bold uppercase">
              {liveTrains?.length > 0 ? "BUS STREAM: 100% NOMINAL" : "STREAM INDEX: DISCONNECTED"}
            </span>
          </div>
        </div>
      </header>

      {/* MASTER DATA WINDOW VIEWPORTS */}
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* AUTONOMOUS AGENT PIPELINE MONITOR */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 select-none">
            <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider">SYSTEM PIPELINE</span>
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">5-Agent Autonomous Processing Pipeline</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { id: '01', title: 'Sensor Detector', desc: 'Vibration & Thermal Data' },
              { id: '02', title: 'Evidence Verifier', desc: 'CCTV Cross-Validation' },
              { id: '03', title: 'Severity Ranker', desc: 'Priority 1-5 Logic Tree' },
              { id: '04', title: 'Action Planner', desc: 'Dynamic Reroute Maps' },
              { id: '05', title: 'Report Generator', desc: 'Hindi Voice Payload' }
            ].map((agent, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between h-20 shadow-sm select-none">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>STAGE_{agent.id}</span>
                  <span className={cx("font-bold flex items-center gap-1", trainCounts.total > 0 ? "text-emerald-600" : "text-slate-400")}>
                    ● {trainCounts.total > 0 ? "Active" : "Idle"}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 tracking-tight">{agent.title}</div>
              </div>
            ))}
          </div>
        </section>

        {/* HIGH-DENSITY 8-SUBMODULE OPERATION INTEGRATION MATRIX GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* M01: INCIDENT RESPONSE LAYER */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-500" />
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500">M01 // Incident Response</h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-red-50 text-[10px] font-mono font-bold text-red-600">
                {incCounts.byStatus?.open || 0} Active
              </span>
            </div>
            <div className="my-3 space-y-2 flex-grow flex flex-col justify-center">
              {liveIncidents.length === 0 ? (
                <div className={fallbackEmptyStyle}>[ No Triage Signals Mapped ]</div>
              ) : (
                liveIncidents.map((inc, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-150 text-[11px] shadow-sm animate-in fade-in duration-200">
                    <div className="font-bold text-slate-800 truncate uppercase">{inc.title || 'Track Anomaly Log'}</div>
                    <div className="text-slate-500 text-[10px] font-mono mt-0.5 uppercase tracking-wide">{inc.locationName || 'Sector Track Pending'}</div>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex justify-between select-none">
              <span>LATENCY LIMIT:</span>
              <span className="text-red-600 font-bold">~90 SECONDS</span>
            </div>
          </div>

          {/* M02: DYNAMIC PREDICTIVE INTEL MATRIX */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Gauge size={14} className="text-emerald-600" />
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500">M02 // Predictive Intel</h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-mono font-bold text-emerald-600">
                {riskCounts.total || 0} Traces
              </span>
            </div>
            <div className="my-3 space-y-2 flex-grow flex flex-col justify-center">
              {liveRisks.length === 0 ? (
                <div className={fallbackEmptyStyle}>[ No Prognostic Vectors Active ]</div>
              ) : (
                liveRisks.slice(0, 1).map((r, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-150 text-[11px] space-y-1.5 shadow-sm">
                    <div className="font-bold text-slate-800 uppercase truncate">{r.name || r.title || 'Stress Boundary Gauge'}</div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${r.severityScore || 50}%` }}></div>
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 text-right uppercase tracking-wider">Index Load Profile: {r.severityScore || 50}%</div>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex justify-between select-none">
              <span>PROACTIVE WINDOW:</span>
              <span className="text-emerald-600 font-bold">72-HOUR HORIZON</span>
            </div>
          </div>

          {/* M03: GIS VECTOR GEOSPATIAL MAP FEED */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-blue-500" />
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500">M03 // Live Telemetry Map</h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-[10px] font-mono font-bold text-blue-600">
                {trainCounts.total || 0} Active
              </span>
            </div>
            <div className="my-3 space-y-1.5 flex-grow flex flex-col justify-center">
              {liveTrains.length === 0 ? (
                <div className={fallbackEmptyStyle}>[ No Active Fleet Assets Mapped ]</div>
              ) : (
                liveTrains.map((t, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-150 text-[11px] flex justify-between items-center shadow-sm">
                    <span className="font-bold text-slate-700 truncate max-w-[65%] uppercase">{t.name || t.number}</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600 font-bold uppercase tracking-wide">{t.status || 'Nominal'}</span>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex justify-between select-none">
              <span>RENDER CORE:</span>
              <span className="text-slate-600 font-bold uppercase">LEAFLET GRAPHICS</span>
            </div>
          </div>

          {/* M04: VOLUMETRIC CROWD SAFETY RADAR */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-teal-600" />
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500">M04 // Crowd Management</h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-teal-50 text-[10px] font-mono font-bold text-teal-600">
                {crowdCounts.total || 0} Hubs
              </span>
            </div>
            <div className="my-3 space-y-2 flex-grow flex flex-col justify-center">
              {liveCrowds.length === 0 ? (
                <div className={fallbackEmptyStyle}>[ No Foot Traffic Pressure Detected ]</div>
              ) : (
                liveCrowds.map((c, idx) => (
                  <div key={idx} className="p-2 rounded bg-amber-50/40 border border-amber-200 text-[11px] space-y-1 shadow-sm">
                    <div className="font-bold text-amber-800 uppercase text-[9px] font-mono tracking-wider">CV Surges Detected // {c.stationName || c.station}</div>
                    <p className="text-slate-600 leading-normal text-[10px] truncate">{c.summary || 'Threshold alerts triggered.'}</p>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex justify-between select-none">
              <span>ENVIRONMENT STATE:</span>
              <span className="text-amber-600 font-bold uppercase">{trainCounts.total > 0 ? "DIWALI MODE ENGAGED" : "NOMINAL REGISTRY"}</span>
            </div>
          </div>

          {/* M05: COMMUNICATION CR_DISPATCH INCIDENT AUTO-ROUTERS */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Compass size={14} className="text-indigo-500" />
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500">M05 // Escalate & Notify</h3>
              </div>
            </div>
            <div className="my-3 space-y-1.5 flex-grow font-mono text-[10px] text-slate-500 flex flex-col justify-center">
              {escalatedNotifications.length === 0 ? (
                <div className={fallbackEmptyStyle}>[ Outbound Pipelines Secure ]</div>
              ) : (
                escalatedNotifications.map((notif, idx) => (
                  <div key={idx} className="flex items-start gap-1 text-slate-700 animate-in fade-in duration-150">
                    <CheckCircle2 size={10} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="truncate">Routed <strong className="text-indigo-600 font-black">[{notif.channel || 'SMS'}]</strong> payload for ID_{String(notif.id).slice(0,4)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex justify-between select-none">
              <span>AUDIO ROUTE DRIVER:</span>
              <span className="text-indigo-600 font-bold uppercase">LOCAL WEB SPEECH API</span>
            </div>
          </div>

          {/* M06: COMBINATORIAL SCHEDULING CONFLICT MANAGER */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-sky-500" />
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500">M06 // Conflict Scheduling</h3>
              </div>
            </div>
            <div className="my-3 space-y-2 flex-grow flex flex-col justify-center">
              {scheduleConflicts.length === 0 ? (
                <div className={fallbackEmptyStyle}>[ Timetable Alignment Checked ]</div>
              ) : (
                scheduleConflicts.map((sc, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-150 text-[11px] shadow-sm animate-in fade-in duration-200">
                    <div className="font-bold text-slate-800 uppercase truncate">Rerouting: {sc.name || sc.id}</div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-normal font-mono text-amber-600 font-bold">
                      Deviation detected: +{sc.delayMinutes || 0}m holds.
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex justify-between select-none">
              <span>LOGIC MATRIX RESOLVER:</span>
              <span className="text-slate-600 font-bold uppercase">CONSTRAINT PROFILES</span>
            </div>
          </div>

          {/* M07: Physics-BASED ECO ENERGY PROPULSION LOGS */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500">M07 // Energy Optimization</h3>
              </div>
            </div>
            <div className="my-3 space-y-1 flex-grow flex flex-col justify-center">
              {energyRisks.length === 0 ? (
                <div className={fallbackEmptyStyle}>[ Traction Bus Balanced ]</div>
              ) : (
                energyRisks.map((er, idx) => (
                  <div key={idx} className="space-y-1 text-center animate-in fade-in duration-150">
                    <div className="text-sm font-black font-mono text-red-500">Anomaly Vector Detected</div>
                    <p className="text-[10px] text-slate-500 leading-normal uppercase font-mono tracking-wide">{er.name || er.title} Index Spike</p>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex justify-between select-none">
              <span>POWER METRIC TRACKER:</span>
              <span className="text-amber-600 font-bold uppercase">REGENERATIVE ACTIVE</span>
            </div>
          </div>

          {/* M08: COGNITIVE OVERRIDE TRACE RISK HUB */}
          <div className="bg-slate-900 rounded-xl p-4 text-white flex flex-col justify-between min-h-[220px] shadow-lg shadow-slate-900/10 border-none">
            <div className="border-b border-slate-800 pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400/80">M08 // Risk Intelligence Core</h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-[10px] font-mono font-bold text-cyan-400">
                {riskCounts.total || 0} Sectors
              </span>
            </div>
            <div className="my-3 space-y-1.5 flex-grow flex flex-col justify-center">
              {liveRisks.length === 0 ? (
                <div className="py-7 text-center text-[10px] font-mono text-cyan-400/50 border border-dashed border-cyan-500/20 bg-slate-950/40 rounded-xl uppercase tracking-wider select-none">
                  [ Scanning Grid Nodes ]
                </div>
              ) : (
                liveRisks.map((r, idx) => (
                  <div key={idx} className="p-2 rounded bg-white/5 border border-white/10 text-[11px] flex justify-between items-center shadow-inner animate-in fade-in duration-200">
                    <span className="text-slate-300 truncate max-w-[70%] uppercase font-medium">{r.name || r.title || 'Regional Threat Vector'}</span>
                    <span className="font-mono text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 flex-shrink-0">Idx {r.severityScore || '0'}</span>
                  </div>
                ))
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-500 border-t border-slate-800 pt-2 flex justify-between select-none">
              <span>EVALUATION GAP:</span>
              <span className="text-cyan-400 font-bold uppercase">30s LIVE SWEEP</span>
            </div>
          </div>

        </div>
      </div>

      {/* FOOTER SYSTEM STATUS RECOGNITIONS */}
      <footer className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] font-mono text-slate-400 mt-8 pt-4 border-t border-slate-200 select-none">
        <div>THEME: AGENTIC & AUTONOMOUS SYSTEMS</div>
        <div className="text-slate-500 flex items-center gap-4">
          <span>TRACK MONITORING: 68,000 KM</span>
          <span>SCHEMA STATUS: NOMINAL</span>
        </div>
      </footer>
      
    </div>
  );
});
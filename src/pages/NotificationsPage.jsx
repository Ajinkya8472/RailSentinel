// src/pages/NotificationsPage.jsx
import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // 🎯 Added for fast internal SPA link transitions
import { 
  Volume2, MessageSquare, Mail, ShieldAlert, 
  AlertTriangle, Users, MapPin, ArrowUpRight, Server 
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import useRiskStore from '../store/riskStore';
import useIncidentStore from '../store/incidentStore';
import useCrowdStore from '../store/crowdStore';

// ---------------------------------------------------------------------------
// Stratified Priority Mapping Logic (KEPT EXACTLY SAME)
// ---------------------------------------------------------------------------
const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function priorityLabel(severity) {
  const map = { critical: 'P1', high: 'P2', medium: 'P3', low: 'P4' };
  return map[String(severity ?? '').toLowerCase()] ?? 'P4';
}

function channelConfig(severity) {
  const sev = String(severity ?? '').toLowerCase();
  if (sev === 'critical') {
    return [
      { label: 'PA HUD', icon: Volume2, style: 'bg-red-50 text-red-600 border-red-200' },
      { label: 'SMS Gateway', icon: MessageSquare, style: 'bg-amber-50 text-amber-600 border-amber-200' },
      { label: 'Mailing Node', icon: Mail, style: 'bg-slate-100 text-slate-600 border-slate-200' }
    ];
  }
  if (sev === 'high') {
    return [
      { label: 'SMS Gateway', icon: MessageSquare, style: 'bg-amber-50 text-amber-600 border-amber-200' },
      { label: 'Mailing Node', icon: Mail, style: 'bg-slate-100 text-slate-600 border-slate-200' }
    ];
  }
  return [
    { label: 'Mailing Node', icon: Mail, style: 'bg-slate-100 text-slate-600 border-slate-200' }
  ];
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: Premium Micro-Metric Header Strip (Horizontal Alignment)
// ---------------------------------------------------------------------------
function NotifKpiStrip({ incidents, risks, crowds, syncing }) {
  const critInc = useMemo(() => incidents.filter((i) => String(i.severity ?? '').toLowerCase() === 'critical').length, [incidents]);
  const critRisk = useMemo(() => risks.filter((r) => String(r.severityBand ?? '').toLowerCase() === 'critical').length, [risks]);
  const breachCrd = useMemo(() => crowds.filter((c) => Number(c.breachProbability ?? 0) >= 0.7).length, [crowds]);
  const total = incidents.length + critRisk + breachCrd;

  return (
    <div className="flex items-center gap-2.5 font-mono text-[11px] select-none" aria-label="Notification KPIs">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
        Broadcasts: <span className="font-bold text-slate-900">{total}</span>
      </div>
      <div className={`border rounded-lg px-3 py-1.5 transition-all ${
        critInc > 0 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        Critical Signals: <span className="font-bold">{critInc}</span>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-amber-600">
        Infrastructure Risks: <span className="font-bold text-amber-700">{critRisk}</span>
      </div>
      <div className="bg-slate-950 text-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${syncing ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500 animate-pulse'}`} />
        <span className="text-slate-400 uppercase text-[10px]">SURGE EVAC:</span>
        <span className="font-bold text-emerald-400">{breachCrd} ACTIVE</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: High-Density Tabular Dispatch Row
// ---------------------------------------------------------------------------
function NotificationCandidateRow({ incident }) {
  const sev = String(incident.severity ?? '').toLowerCase();
  const priority = priorityLabel(incident.severity);
  const channels = channelConfig(incident.severity);
  const name = incident.title ?? incident.description ?? incident.id;

  const isCritical = sev === 'critical';
  const isHigh = sev === 'high';

  return (
    <div className="p-4 rounded-xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-slate-100 hover:bg-slate-50/50 select-none">
      <div className="flex items-center gap-3.5 min-w-0">
        <span className={`h-8 w-8 rounded-lg font-mono text-xs font-black flex items-center justify-center flex-shrink-0 border ${
          isCritical 
            ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
            : isHigh 
            ? 'bg-amber-50 text-amber-600 border-amber-200' 
            : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {priority}
        </span>
        
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate" title={name}>
            {name}
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            {incident.locationName && (
              <span className="flex items-center gap-0.5 text-slate-500">
                <MapPin size={10} /> {incident.locationName}
              </span>
            )}
            {incident.locationName && <span className="text-slate-300">//</span>}
            <span className={isCritical ? 'text-red-500' : isHigh ? 'text-amber-500' : 'text-slate-400'}>
              {sev} Alert Class
            </span>
          </div>
        </div>
      </div>

      {/* Embedded Communication Path Channels Output Array */}
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end flex-shrink-0 border-t sm:border-t-0 border-slate-50 pt-2 sm:pt-0">
        {channels.map((ch, i) => (
          <div key={i} className={`px-2 py-1 rounded border text-[9px] font-mono font-black flex items-center gap-1.5 shadow-sm ${ch.style}`}>
            <ch.icon size={11} />
            <span className="uppercase tracking-wider">{ch.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: High-Fidelity Balanced Dispatch Sidebar Rail Component
// ---------------------------------------------------------------------------
function AlertRail({ riskAlerts, crowdAlerts }) {
  const navigate = useNavigate(); // 🎯 Initialize client router engine instance

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full overflow-hidden divide-y divide-slate-100">
      
      {/* SECTION 1: STRUCTURAL RISK SIGNALS */}
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <AlertTriangle size={12} className="text-slate-400" />
          <span>Risk Core Relays</span>
        </div>
        <div className="space-y-1.5 font-mono text-[11px]">
          {riskAlerts.length === 0 ? (
            <div className="p-4 text-center text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl border border-slate-100 uppercase tracking-wider">
              No Pending Risk Signals
            </div>
          ) : (
            riskAlerts.slice(0, 3).map((r) => {
              const isCrit = String(r.severityBand ?? '').toLowerCase() === 'critical';
              return (
                <div key={r.id} className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-150 flex justify-between items-center shadow-sm">
                  <span className="font-sans font-medium text-slate-700 truncate max-w-[70%]" title={r.name}>
                    {r.name ?? r.title ?? r.id}
                  </span>
                  <span className={`text-[8px] font-mono font-black uppercase px-1.5 py-0.5 border rounded ${
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

      {/* SECTION 2: CROWD THREAT SURGE VECTORS */}
      <div className="p-4 flex flex-col gap-3 min-h-[25%] overflow-hidden">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <Users size={12} className="text-slate-400" />
          <span>Crowd Threat Vectors</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar font-mono text-[11px]">
          {crowdAlerts.length === 0 ? (
            <div className="p-4 text-center text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl border border-slate-100 uppercase tracking-wider">
              No Perimeter Surge Flags
            </div>
          ) : (
            crowdAlerts.slice(0, 3).map((c) => (
              <div key={c.id} className="p-2.5 rounded-lg bg-white border border-slate-100 flex justify-between items-center shadow-sm">
                <span className="font-sans text-slate-600 font-medium truncate max-w-[65%]" title={c.stationName}>
                  {c.stationName ?? c.station ?? c.id}
                </span>
                <span className="text-red-500 font-black bg-red-50 px-1.5 py-0.5 rounded text-[10px] border border-red-100 flex-shrink-0">
                  {Math.round(Number(c.breachProbability ?? 0) * 100)}% Surge
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: SYSTEM ANCHOR TELEMETRY PANEL (Kills Blank Empty Space) */}
      <div className="flex-1 p-4 flex flex-col justify-end bg-slate-50/10">
        <div className="p-3 bg-slate-900 border border-slate-950 text-slate-200 rounded-xl font-mono text-[10px] space-y-1 shadow-md">
          <div className="text-emerald-400 font-black uppercase text-[8px] tracking-widest flex items-center gap-1.5">
            <Server size={10} />
            <span>// Comms Infrastructure Gateway</span>
          </div>
          <p className="text-slate-400 font-sans text-[11px] font-medium leading-normal">
            Automated crisis escalation trees, cross-channel communication triggers, and remote hardware systems are live via Twilio + AWS SES pipelines.
          </p>
        </div>
      </div>

      {/* FOOTER INSTANT SPA ROUTER TRANSITION BUTTON */}
      <div className="p-4 bg-slate-50/80 flex-shrink-0">
        <button 
          type="button" 
          className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-[10px] uppercase tracking-widest rounded-lg transition-all relative z-50 pointer-events-auto active:scale-[0.98] cursor-pointer shadow-md border border-slate-950 flex items-center justify-center gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/incidents'); // 🎯 Fluid router page shifting with no white reload flash
          }}
        >
          Open Triage Center <ArrowUpRight size={12} className="text-slate-400" />
        </button>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Integrated Page Export Wrapper
// ---------------------------------------------------------------------------
const NotificationsPage = memo(function NotificationsPage() {
  const incLoading = useIncidentStore((s) => s.loading);
  const incSyncing = useIncidentStore((s) => s.syncing);
  const incError = useIncidentStore((s) => s.error);
  const getVisibleIncidents = useIncidentStore((s) => s.getVisibleIncidents);

  const riskLoading = useRiskStore((s) => s.loading);
  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);

  const crowdLoading = useCrowdStore((s) => s.loading);
  const getVisibleCrowdForecasts = useCrowdStore((s) => s.getVisibleCrowdForecasts);

  const openIncidents = useMemo(() =>
    getVisibleIncidents()
      .filter((i) => !['resolved','closed'].includes(String(i.status ?? '').toLowerCase()))
      .sort((a, b) => (SEV_RANK[String(b.severity ?? '').toLowerCase()] ?? 0) - (SEV_RANK[String(a.severity ?? '').toLowerCase()] ?? 0)),
    [getVisibleIncidents]
  );

  const riskAlerts = useMemo(() =>
    getVisibleRiskScores()
      .filter((r) => ['critical','high'].includes(String(r.severityBand ?? '').toLowerCase()))
      .slice(0, 6),
    [getVisibleRiskScores]
  );

  const crowdAlerts = useMemo(() =>
    getVisibleCrowdForecasts()
      .filter((c) => Number(c.breachProbability ?? 0) >= 0.5)
      .sort((a, b) => Number(b.breachProbability ?? 0) - Number(a.breachProbability ?? 0))
      .slice(0, 4),
    [getVisibleCrowdForecasts]
  );

  const isLoading = incLoading || riskLoading || crowdLoading;
  const isEmpty = !isLoading && openIncidents.length === 0 && riskAlerts.length === 0 && crowdAlerts.length === 0;

  return (
    <DashboardLayout
      // 🚀 FIXED STYLE MATRIX: Nesting layout parameters directly inside title flex row
      title={
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mb-0.5">
              <span>COMMS SYSTEM FRAME</span>
              <span>//</span>
              <span className="text-orange-600">DISPATCH GATEWAY</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Automated Broadcast & Dispatch Registry
            </h1>
          </div>
          <div className="flex-shrink-0">
            <NotifKpiStrip
              incidents={openIncidents}
              risks={riskAlerts}
              crowds={crowdAlerts}
              syncing={incSyncing}
            />
          </div>
        </div>
      }
      subtitle="Real-time multi-agent crisis escalation trees, cross-channel communication triggers, and remote hardware PA voice synthesis status logs."
      loading={isLoading}
      empty={isEmpty}
      error={Boolean(incError)}
      success={!isLoading && !incError}
      primary={
        <div className="space-y-3.5 overflow-y-auto pr-1 max-h-[calc(100vh-240px)]" aria-label="Notification candidates">
          {openIncidents.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200 shadow-inner">
              [ NO_PENDING_BROADCAST_PAYLOADS_QUEUED ]
            </div>
          ) : (
            openIncidents.map((inc) => (
              <NotificationCandidateRow key={inc.id} incident={inc} />
            ))
          )}
        </div>
      }
      secondary={
        <div className="h-full">
          <AlertRail riskAlerts={riskAlerts} crowdAlerts={crowdAlerts} />
        </div>
      }
    />
  );
});

export default NotificationsPage;
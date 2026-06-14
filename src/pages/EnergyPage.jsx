// src/pages/EnergyPage.jsx
import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // 🎯 Added for fast internal SPA link redirection
import { 
  Zap, AlertTriangle, ShieldAlert, Cpu, 
  MapPin, ArrowUpRight, Activity, BatteryCharging 
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import useTrainStore from '../store/trainStore';
import useRiskStore from '../store/riskStore';
import useIncidentStore from '../store/incidentStore';

// ---------------------------------------------------------------------------
// Energy Efficiency Rating & Color Mapping Utilities (KEPT EXACTLY SAME)
// ---------------------------------------------------------------------------
function efficiencyConfig(pct) {
  const n = Number(pct ?? 0);
  if (n >= 90) return { label: 'Optimal Peak', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', barColor: 'bg-emerald-500' };
  if (n >= 70) return { label: 'Good Nominal', color: 'bg-blue-50 text-blue-600 border-blue-100', barColor: 'bg-blue-500' };
  if (n >= 50) return { label: 'Fair Deviation', color: 'bg-amber-50 text-amber-600 border-amber-100', barColor: 'bg-amber-400' };
  return              { label: 'Critical Loss', color: 'bg-red-50 text-red-600 border-red-100', barColor: 'bg-red-500 animate-pulse' };
}

function formatKwh(val) {
  const n = Number(val ?? 0);
  if (n >= 1000) return `${(n / 1000).toFixed(1)} MWh`;
  return `${n.toFixed(0)} kWh`;
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: Premium Micro-Metric Header Strip (Horizontal Alignment)
// ---------------------------------------------------------------------------
function EnergyKpiStrip({ trains, syncing }) {
  const withData = useMemo(() => trains.filter((t) => t.energyConsumption != null || t.consumption != null), [trains]);
  const totalKwh = useMemo(() => withData.reduce((s, t) => s + Number(t.energyConsumption ?? t.consumption ?? 0), 0), [withData]);
  const anomalies = useMemo(() => trains.filter((t) => t.energyAnomaly || t.hasEnergyAnomaly).length, [trains]);
  const avgEff = useMemo(() => {
    if (withData.length === 0) return 0;
    return Math.round(withData.reduce((s, t) => s + Number(t.energyEfficiency ?? t.efficiency ?? 75), 0) / withData.length);
  }, [withData]);

  return (
    <div className="flex items-center gap-2.5 font-mono text-[11px] select-none" aria-label="Energy KPIs">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
        Network: <span className="font-bold text-slate-900">{formatKwh(totalKwh)}</span>
      </div>
      <div className={`border rounded-lg px-3 py-1.5 transition-all ${
        anomalies > 0 ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        Anomalies: <span className="font-bold">{anomalies}</span>
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-emerald-600">
        System Efficiency: <span className="font-bold text-emerald-700">{avgEff}%</span>
      </div>
      <div className="bg-slate-950 text-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${syncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-slate-400 uppercase text-[10px]">MONITORED:</span>
        <span className="font-bold text-emerald-400">{trains.length} UNITS</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: Tabular High-Density Propulsion Load Row Item
// ---------------------------------------------------------------------------
function TrainEnergyRow({ train, isSelected, onSelect }) {
  const rawEfficiency = train.energyEfficiency ?? train.efficiency ?? 75;
  const eff = efficiencyConfig(rawEfficiency);
  const name = train.name ?? train.number ?? train.id;
  const kwh = train.energyConsumption ?? train.consumption ?? null;
  const hasAnom = train.energyAnomaly || train.hasEnergyAnomaly;

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
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate flex items-center gap-1.5">
            {name}
          </h3>
          <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            {train.routeName || 'Traction Sector Path Pending'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasAnom && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider border bg-red-50 text-red-600 border-red-200 animate-pulse">
              Leak / Spike ⚠️
            </span>
          )}
          <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border flex-shrink-0 ${eff.color}`}>
            {eff.label}
          </span>
        </div>
      </div>

      {/* Volumetric Efficiency Bar Overlay */}
      <div className="space-y-1 w-full border-t border-slate-50 pt-2.5">
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/10">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${eff.barColor}`}
            style={{ width: `${Math.min(100, Number(rawEfficiency))}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          <span>COACHING RATING CURVE MATRIX</span>
          <span className="text-slate-600 font-black flex items-center gap-2">
            {kwh != null && <span className="text-slate-400 border-r pr-2">{formatKwh(kwh)} LOAD</span>}
            <span>{rawEfficiency}% EFF</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⚡ IMPROVED: High-Fidelity Balanced Energy Sidebar Rail Component
// ---------------------------------------------------------------------------
function EnergyRail({ anomalyTrains, energyRisks, energyIncidents }) {
  const navigate = useNavigate(); // 🎯 SPA link router handling instance

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full overflow-hidden divide-y divide-slate-100">
      
      {/* SECTION 1: GRID SPIKES WATCH PANEL */}
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <AlertTriangle size={12} className="text-amber-500" />
          <span>Grid Spikes</span>
        </div>
        <div className="space-y-1.5 font-sans text-xs">
          {anomalyTrains.length === 0 ? (
            <div className="py-4 text-center text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl border border-slate-100 uppercase tracking-wider select-none">
              No Current Consumption Leaks
            </div>
          ) : (
            anomalyTrains.slice(0, 3).map((t) => (
              <div key={t.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 font-medium text-slate-700 shadow-sm flex items-center gap-2 truncate">
                <span className="h-1 w-1 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="truncate uppercase font-bold text-slate-600 text-[11px] font-mono">{t.name ?? t.number ?? t.id}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: TRACTION ASSET RISKS */}
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <Activity size={12} className="text-slate-400" />
          <span>Traction Asset Risks</span>
        </div>
        <div className="space-y-1.5">
          {energyRisks.length === 0 ? (
            <div className="py-4 text-center text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl border border-slate-100 uppercase tracking-wider select-none">
              No High Risk Grid Vectors
            </div>
          ) : (
            energyRisks.slice(0, 3).map((r) => {
              const isCrit = String(r.severityBand ?? '').toLowerCase() === 'critical';
              return (
                <div key={r.id} className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-150 flex justify-between items-center text-xs font-mono shadow-sm">
                  <span className="font-sans font-medium text-slate-700 truncate max-w-[70%]" title={r.name}>{r.name ?? r.title ?? r.id}</span>
                  <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 border rounded uppercase flex-shrink-0 ${
                    isCrit ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>{r.severityBand}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 3: OHE GRID HOLDUP ALERTS */}
      <div className="p-4 flex flex-col gap-3 min-h-[20%] overflow-hidden">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <ShieldAlert size={12} className="text-slate-400" />
          <span>OHE Grid Holdup Alerts</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar font-mono text-[11px]">
          {energyIncidents.length === 0 ? (
            <div className="py-6 text-center text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl border border-slate-100 uppercase tracking-wider select-none">
              No Line Breaker Interrupts
            </div>
          ) : (
            energyIncidents.slice(0, 3).map((i) => (
              <div key={i.id} className="p-2.5 rounded-lg border border-red-100 bg-red-50/20 text-red-700 truncate font-sans font-medium flex items-center gap-2 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <span className="truncate uppercase font-mono text-[11px] font-black tracking-tight">{i.title ?? i.id}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 4: SYSTEM ANCHOR TELEMETRY PANEL (Kills Blank Empty Space) */}
      <div className="flex-1 p-4 flex flex-col justify-end bg-slate-50/10">
        <div className="p-3 bg-slate-900 border border-slate-950 text-slate-200 rounded-xl font-mono text-[10px] space-y-1 shadow-md">
          <div className="text-emerald-400 font-black uppercase text-[8px] tracking-widest flex items-center gap-1.5">
            <BatteryCharging size={10} />
            <span>// Optimizer Core Pipeline</span>
          </div>
          <p className="text-slate-400 font-sans text-[11px] font-medium leading-normal">
            Real-time sub-station regenerative power logs and physics-driven eco-cruise guidelines are streaming nominal Fourier grid analytics into the network telemetry array.
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
            navigate('/incidents'); // Fluid router page shifting with no white reload flash
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
const EnergyPage = memo(function EnergyPage() {
  const loading        = useTrainStore((s) => s.loading);
  const syncing        = useTrainStore((s) => s.syncing);
  const error          = useTrainStore((s) => s.error);
  const selectedId     = useTrainStore((s) => s.selectedTrainId);
  const getVisibleTrains = useTrainStore((s) => s.getVisibleTrains);
  const selectTrain      = useTrainStore((s) => s.selectTrain);

  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);
  const getVisibleIncidents  = useIncidentStore((s) => s.getVisibleIncidents);

  const trains = useMemo(() =>
    getVisibleTrains()
      .sort((a, b) => Number(b.energyConsumption ?? b.consumption ?? 0) - Number(a.energyConsumption ?? a.consumption ?? 0)),
  [getVisibleTrains]);

  const anomalyTrains = useMemo(() =>
    trains.filter((t) => t.energyAnomaly || t.hasEnergyAnomaly),
  [trains]);

  const energyRisks = useMemo(() =>
    getVisibleRiskScores()
      .filter((r) => String(r.category ?? r.domain ?? '').toLowerCase().includes('energy'))
      .slice(0, 3),
  [getVisibleRiskScores]);

  const energyIncidents = useMemo(() =>
    getVisibleIncidents()
      .filter((i) => i.type === 'energy' || i.category === 'energy'),
  [getVisibleIncidents]);

  const isEmpty   = !loading && !error && trains.length === 0;
  const isSuccess = !loading && !error;

  return (
    <DashboardLayout
      // 🚀 FIXED STYLE ARCHITECTURE: Bundling text and KPI strip into a responsive horizontal split container
      title={
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mb-0.5">
              <span>PROPULSION MATRIX</span>
              <span>//</span>
              <span className="text-orange-600">REGENERATIVE POWER</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Propulsion Core & Energy Optimization
            </h1>
          </div>
          <div className="flex-shrink-0">
            <MeshKpiStrip trains={trains} syncing={syncing} />
          </div>
        </div>
      }
      subtitle="Real-time sub-station regenerative power logs, real-time current spike analytics, and physics-driven eco-cruise driver guidelines."
      loading={loading}
      empty={isEmpty}
      error={Boolean(error)}
      success={isSuccess}
      primary={
        <div className="space-y-3.5 overflow-y-auto pr-1 max-h-[calc(100vh-280px)]" aria-label="Train energy profiles">
          {trains.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200 shadow-inner">
              [ NO_PROPULSION_METRICS_LOGGED_IN_BUS ]
            </div>
          ) : (
            trains.map((t) => (
              <TrainEnergyRow
                key={t.id}
                train={t}
                isSelected={t.id === selectedId}
                onSelect={selectTrain}
              />
            ))
          )}
        </div>
      }
      secondary={
        <div className="h-full">
          <EnergyRail
            anomalyTrains={anomalyTrains}
            energyRisks={energyRisks}
            energyIncidents={energyIncidents}
          />
        </div>
      }
    />
  );
});

// Alias alignment reference block to match internal layout declarations smoothly
const MeshKpiStrip = EnergyKpiStrip;

export default EnergyPage;
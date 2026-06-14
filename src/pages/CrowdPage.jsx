// src/pages/CrowdPage.jsx
import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ShieldAlert, Radio, MapPin, Activity, 
  ArrowUpRight, BarChart3, TrendingUp 
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import useCrowdStore from '../store/crowdStore';
import useIncidentStore from '../store/incidentStore';

// ---------------------------------------------------------------------------
// Operational Volumetric Helpers
// ---------------------------------------------------------------------------
function crowdLevelConfig(densityPct) {
  const pct = Number(densityPct ?? 0);
  if (pct >= 90) return { label: 'Surge Active', color: 'bg-red-50 text-red-600 border-red-100', barColor: 'bg-red-500', dot: 'bg-red-500' };
  if (pct >= 75) return { label: 'High Density', color: 'bg-amber-50 text-amber-600 border-amber-100', barColor: 'bg-amber-500', dot: 'bg-amber-400' };
  if (pct >= 50) return { label: 'Moderate', color: 'bg-blue-50 text-blue-600 border-blue-100', barColor: 'bg-blue-500', dot: 'bg-blue-400' };
  return { label: 'Optimal / Low', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', barColor: 'bg-emerald-500', dot: 'bg-emerald-500' };
}

function breachRiskLabel(prob) {
  const p = Number(prob ?? 0);
  if (p >= 0.8) return { label: 'Imminent', mod: 'critical', text: 'text-red-600 border-red-200 bg-red-50' };
  if (p >= 0.5) return { label: 'High', mod: 'high', text: 'text-amber-600 border-amber-200 bg-amber-50' };
  if (p >= 0.2) return { label: 'Moderate', mod: 'medium', text: 'text-blue-600 border-blue-100 bg-blue-50' };
  return { label: 'Minimal', mod: 'low', text: 'text-slate-400 border-slate-100 bg-slate-50' };
}

// ---------------------------------------------------------------------------
// 🛠️ FIXED: Premium Micro-Metric Header Strip (Aligned exactly to First Image)
// ---------------------------------------------------------------------------
function CrowdKpiStrip({ forecasts, syncing }) {
  const total = forecasts.length;
  const breaches = useMemo(() => forecasts.filter((f) => Number(f.breachProbability ?? 0) >= 0.5).length, [forecasts]);
  const surges = useMemo(() => forecasts.filter((f) => Number(f.crowdDensityPct ?? f.densityPct ?? 0) >= 90).length, [forecasts]);
  const avgDens = useMemo(() => {
    if (total === 0) return 0;
    const sum = forecasts.reduce((s, f) => s + Number(f.crowdDensityPct ?? f.densityPct ?? 0), 0);
    return Math.round(sum / total);
  }, [forecasts, total]);

  return (
    <div className="flex items-center gap-2.5 font-mono text-[11px] select-none">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
        Nodes: <span className="font-bold text-slate-900">{total}</span>
      </div>
      <div className={`border rounded-lg px-3 py-1.5 text-red-600 ${breaches > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
        Breach Risks: <span className="font-bold">{breaches}</span>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-amber-600">
        Surge Zones: <span className="font-bold text-amber-700">{surges}</span>
      </div>
      <div className="bg-slate-950 text-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${syncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-slate-400 uppercase text-[10px]">AVG DENSITY:</span>
        <span className="font-bold text-emerald-400">{avgDens}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// High-Density Operational Node Row
// ---------------------------------------------------------------------------
function ForecastRow({ forecast, isSelected, onSelect }) {
  const rawDensity = forecast.crowdDensityPct ?? forecast.densityPct ?? 0;
  const dns = crowdLevelConfig(rawDensity);
  const brc = breachRiskLabel(forecast.breachProbability);
  const station = forecast.stationName ?? forecast.station ?? forecast.locationName ?? forecast.id;
  const platform = forecast.platformId ?? forecast.platform ?? null;

  return (
    <div
      onClick={() => onSelect(forecast.id)}
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
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate">
            {station}
          </h4>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            {platform && <span className="text-slate-500">Platform {platform}</span>}
            <span className="text-slate-300">//</span>
            <span>Risk Probability: {Math.round((forecast.breachProbability ?? 0) * 100)}%</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border ${dns.color}`}>
            {dns.label}
          </span>
          <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border ${brc.text}`}>
            {brc.label}
          </span>
        </div>
      </div>

      <div className="space-y-1 w-full border-t border-slate-50 pt-2.5">
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/20">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${dns.barColor}`}
            style={{ width: `${Math.min(100, Number(rawDensity))}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          <span>VOLUMETRIC PRESSURE CAPACITY INDEX</span>
          <span className="text-slate-600 font-black">{rawDensity}% LOAD</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balanced Analytical Sidebar Rail Component
// ---------------------------------------------------------------------------
function CrowdRail({ topBreaches, linkedIncidents, forecasts }) {
  const navigate = useNavigate();

  const metricsSummary = useMemo(() => {
    const criticalZones = forecasts.filter(f => Number(f.crowdDensityPct ?? f.densityPct ?? 0) >= 90).length;
    const cautionZones = forecasts.filter(f => {
      const dens = Number(f.crowdDensityPct ?? f.densityPct ?? 0);
      return dens >= 75 && dens < 90;
    }).length;
    return { criticalZones, cautionZones };
  }, [forecasts]);

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full overflow-hidden divide-y divide-slate-100">
      
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <BarChart3 size={12} className="text-slate-400" />
          <span>Breach Watch Vector</span>
        </div>
        <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden bg-white">
          {topBreaches.slice(0, 4).map((f) => {
            const brc = breachRiskLabel(f.breachProbability);
            const station = f.stationName ?? f.station ?? f.id;
            return (
              <div key={f.id} className="p-3 flex items-center justify-between text-xs font-sans hover:bg-slate-50/50 transition-colors">
                <span className="font-bold text-slate-700 truncate max-w-[65%]" title={station}>{station}</span>
                <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 border rounded-md uppercase tracking-wider ${brc.text}`}>
                  {brc.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 min-h-[30%] overflow-hidden">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <ShieldAlert size={12} className="text-slate-500" />
          <span>Linked Safety Anomaly holds</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          {linkedIncidents.length === 0 ? (
            <div className="py-8 text-center text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded-xl uppercase tracking-wider">
              [ SECURE // NO_LINKED_SURGE_HOLDS ]
            </div>
          ) : (
            linkedIncidents.slice(0, 3).map((inc) => (
              <div key={inc.id} className="p-3.5 rounded-xl border border-red-200 bg-red-50/30 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-[8px] font-mono font-black uppercase tracking-wider text-red-700 border border-red-200">
                    {inc.severity || 'HIGH'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 font-bold">ID_{String(inc.id || '00').slice(0, 5)}</span>
                </div>
                <div className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug">{inc.title ?? inc.id}</div>
                {inc.locationName && (
                  <div className="text-[10px] font-mono text-slate-400 tracking-tight flex items-center gap-1 pt-0.5">
                    <MapPin size={9} /> {inc.locationName}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto bg-slate-50/30">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 select-none">
          Dynamic Surge Distribution
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
          <div className="p-2.5 bg-white border border-slate-150 rounded-xl flex flex-col gap-0.5 shadow-sm">
            <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Critical Loops</span>
            <span className={`text-sm font-black ${metricsSummary.criticalZones > 0 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
              {metricsSummary.criticalZones} Sectors
            </span>
          </div>
          <div className="p-2.5 bg-white border border-slate-150 rounded-xl flex flex-col gap-0.5 shadow-sm">
            <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Caution Nodes</span>
            <span className={`text-sm font-black ${metricsSummary.cautionZones > 0 ? 'text-amber-500' : 'text-slate-700'}`}>
              {metricsSummary.cautionZones} Platforms
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-950 text-slate-200 rounded-xl font-mono text-[10px] space-y-1 mt-auto shadow-md">
          <div className="text-emerald-400 font-black uppercase text-[8px] tracking-widest">// Model Protocol Anchor</div>
          <p className="text-slate-400 font-sans text-[11px] font-medium leading-normal">
            Pedestrian volumetric frame matrices are verifying live threshold margins using computer vision occupancy algorithms.
          </p>
        </div>
      </div>

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
// Main Integrated View Port Mount Workspace Component
// ---------------------------------------------------------------------------
const CrowdPage = memo(function CrowdPage() {
  const loading = useCrowdStore((s) => s.loading);
  const syncing = useCrowdStore((s) => s.syncing);
  const error = useCrowdStore((s) => s.error);
  const selectedId = useCrowdStore((s) => s.selectedCrowdForecastId);
  const getVisibleCrowdForecasts = useCrowdStore((s) => s.getVisibleCrowdForecasts);
  const selectCrowdForecast = useCrowdStore((s) => s.selectCrowdForecast);
  const getVisibleIncidents = useIncidentStore((s) => s.getVisibleIncidents);

  const forecasts = useMemo(() =>
    getVisibleCrowdForecasts()
      .sort((a, b) => Number(b.breachProbability ?? 0) - Number(a.breachProbability ?? 0)),
    [getVisibleCrowdForecasts]
  );

  const topBreaches = useMemo(() =>
    forecasts.filter((f) => Number(f.breachProbability ?? 0) >= 0.2),
    [forecasts]
  );

  const linkedIncidents = useMemo(() =>
    getVisibleIncidents()
      .filter((i) => i.type === 'crowd' || i.category === 'crowd' || String(i.title).toLowerCase().includes('crowd')),
    [getVisibleIncidents]
  );

  const isEmpty = !loading && !error && forecasts.length === 0;
  const isSuccess = !loading && !error;

  return (
    <DashboardLayout
      // 💡 FIXED: Bundled layout definitions directly into custom custom headers to prevent wrapping drops!
      title={
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mb-0.5">
              <span>CROWD INTEL FRAME</span>
              <span>//</span>
              <span className="text-orange-600">SURGE COUNTERS</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Volumetric Crowd Intelligence & Surge Array
            </h1>
          </div>
          <div className="flex-shrink-0">
            <CrowdKpiStrip forecasts={forecasts} syncing={syncing} />
          </div>
        </div>
      }
      subtitle="Real-time multi-agent pedestrian load tracking, computer vision platform occupancy forecasts, and perimeter overflow warning holds."
      loading={loading}
      empty={isEmpty}
      error={Boolean(error)}
      success={isSuccess}
      primary={
        <div className="space-y-3.5 overflow-y-auto pr-1 max-h-[calc(100vh-280px)]" aria-label="Crowd forecasts">
          {forecasts.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200 shadow-inner">
              [ NO_PEDESTRIAN_OVERFLOW_TRAFFIC_LOGGED ]
            </div>
          ) : (
            forecasts.map((f) => (
              <ForecastRow
                key={f.id}
                forecast={f}
                isSelected={f.id === selectedId}
                onSelect={selectCrowdForecast}
              />
            ))
          )}
        </div>
      }
      secondary={
        <div className="h-full">
          <CrowdRail topBreaches={topBreaches} linkedIncidents={linkedIncidents} forecasts={forecasts} />
        </div>
      }
    />
  );
});

export default CrowdPage;
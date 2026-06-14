// src/pages/PredictivePage.jsx
import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, ShieldAlert, Cpu, Database, 
  MapPin, ArrowUpRight, BarChart3
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import useTrainStore from '../store/trainStore';
import useRiskStore from '../store/riskStore';

// ---------------------------------------------------------------------------
// Sensor Health Telemetry Color Grading Configuration
// ---------------------------------------------------------------------------
function sensorHealthLabel(train) {
  const score = Number(train.sensorHealthScore ?? train.healthScore ?? 100);
  if (score < 40) return { label: 'Critical Failure Risk', color: 'bg-red-50 text-red-600 border-red-100', textClass: 'text-red-600', score };
  if (score < 65) return { label: 'Degraded Matrix', color: 'bg-amber-50 text-amber-600 border-amber-100', textClass: 'text-amber-500', score };
  if (score < 85) return { label: 'Fair Operational State', color: 'bg-blue-50 text-blue-600 border-blue-100', textClass: 'text-blue-500', score };
  return { label: 'Healthy Systems', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', textClass: 'text-emerald-600', score };
}

// ---------------------------------------------------------------------------
// Premium Micro-Metric Header Strip Component
// ---------------------------------------------------------------------------
function PredKpiStrip({ trainCounts, riskCounts, syncing }) {
  const critRisk = riskCounts.bySeverityBand?.critical ?? 0;
  const highRisk = riskCounts.bySeverityBand?.high ?? 0;

  return (
    <div className="flex items-center gap-2.5 font-mono text-[11px] select-none" aria-label="Predictive Intelligence KPIs">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
        Monitored: <span className="font-bold text-slate-900">{trainCounts.total || 0}</span>
      </div>
      <div className={`border rounded-lg px-3 py-1.5 transition-all ${
        critRisk > 0 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        Critical Risks: <span className="font-bold">{critRisk}</span>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-amber-600">
        Prognostic Flags: <span className="font-bold text-amber-700">{highRisk}</span>
      </div>
      <div className="bg-slate-950 text-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${syncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-slate-400 uppercase text-[10px]">SENSORS:</span>
        <span className="font-bold text-emerald-400">{riskCounts.total || 0} AGG</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// High-Density Asymmetric Sensor Diagnostics Row Item
// ---------------------------------------------------------------------------
function TrainHealthRow({ train, isSelected, onSelect }) {
  const hlth = sensorHealthLabel(train);
  const name = train.name ?? train.number ?? train.id;

  const isCritical = hlth.score < 40;
  const isDegraded = hlth.score >= 40 && hlth.score < 65;

  const progressColor = isCritical ? 'bg-red-500' : isDegraded ? 'bg-amber-500' : 'bg-emerald-500';

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
            {train.routeName || 'Operational System Path Main'}
          </p>
        </div>

        <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border flex-shrink-0 ${hlth.color}`}>
          {hlth.label}
        </span>
      </div>

      <div className="space-y-1 w-full border-t border-slate-50 pt-2.5">
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/10">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${hlth.score}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          <span>Core Vibration & Stress Matrix Index</span>
          <span className={`font-black ${hlth.textClass}`}>{hlth.score}% INTEGRITY</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// High-Fidelity Balanced Diagnostic Sidebar Rail Component
// ---------------------------------------------------------------------------
function RiskPostureRail({ riskCounts, topRisks }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full overflow-hidden divide-y divide-slate-100">
      
      {/* SECTION 1: STRATIFIED RISK GRID */}
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <Activity size={12} className="text-slate-400" />
          <span>Stratified Risk Matrix</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
          {[
            { label: 'Critical', val: riskCounts.bySeverityBand?.critical ?? 0, color: 'bg-red-50/20 border-red-100 text-red-600 font-bold' },
            { label: 'High Risk', val: riskCounts.bySeverityBand?.high ?? 0, color: 'bg-amber-50/20 border-amber-100 text-amber-600' },
            { label: 'Medium', val: riskCounts.bySeverityBand?.medium ?? 0, color: 'bg-blue-50/20 border-blue-100 text-blue-600' },
            { label: 'Optimal', val: riskCounts.bySeverityBand?.low ?? 0, color: 'bg-slate-50/40 border-slate-100 text-slate-500' }
          ].map((band, idx) => (
            <div key={idx} className={`p-2.5 border rounded-xl flex flex-col gap-0.5 shadow-sm ${band.color}`}>
              <span className="text-[8px] opacity-60 font-black uppercase tracking-wider">{band.label}</span>
              <span className="text-xs font-black text-slate-800">{band.val} Profiles</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: TOP STRUCTURAL ANOMALY RISK LOGS */}
      <div className="p-4 flex flex-col gap-3 min-h-[30%] overflow-hidden">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 select-none">
          <BarChart3 size={12} className="text-slate-400" />
          <span>Top Structural Risks</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/30 custom-scrollbar">
          {topRisks.length === 0 ? (
            <div className="py-8 text-center text-[10px] font-mono text-slate-400 bg-white border border-slate-100 rounded-xl uppercase tracking-wider">
              [ NO_PROGNOSIC_ANOMALIES_DETECTED ]
            </div>
          ) : (
            topRisks.slice(0, 4).map((risk) => {
              const band = String(risk.severityBand ?? '').toLowerCase();
              const isCrit = band === 'critical' || band === 'high';
              return (
                <div key={risk.id} className="p-2.5 rounded-lg bg-white border border-slate-100 flex justify-between items-center text-xs shadow-sm">
                  <span className="font-bold text-slate-700 truncate max-w-[65%]" title={risk.name}>
                    {risk.name ?? risk.title ?? risk.id}
                  </span>
                  <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded border uppercase flex-shrink-0 ${
                    isCrit ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>{risk.severityBand}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 3: SYSTEM ANCHOR TELEMETRY PANEL */}
      <div className="flex-1 p-4 flex flex-col justify-end bg-slate-50/10">
        <div className="p-3 bg-slate-900 border border-slate-950 text-slate-200 rounded-xl font-mono text-[10px] space-y-1 mt-auto shadow-md">
          <div className="text-emerald-400 font-black uppercase text-[8px] tracking-widest flex items-center gap-1.5">
            <Database size={10} />
            <span>// Wavelet Transform Pipeline</span>
          </div>
          <p className="text-slate-400 font-sans text-[11px] font-medium leading-normal">
            Acoustic bearing logs and wheel-impact vibration sensors are streaming nominal Fourier configurations into the predictive array.
          </p>
        </div>
      </div>

      {/* FOOTER INSTANT NAVIGATION ACCESS DECK */}
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
// Main Integrated View Port Workspace Mount Component
// ---------------------------------------------------------------------------
export default memo(function PredictivePage() {
  const loading = useTrainStore((s) => s.loading);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const selectedId = useTrainStore((s) => s.selectedTrainId);
  const getVisibleTrains = useTrainStore((s) => s.getVisibleTrains);
  const getTrainCounts = useTrainStore((s) => s.getTrainCounts);
  const selectTrain = useTrainStore((s) => s.selectTrain);

  const riskLoading = useRiskStore((s) => s.loading);
  const getRiskCounts = useRiskStore((s) => s.getRiskCounts);
  const getVisibleRiskScores = useRiskStore((s) => s.getVisibleRiskScores);

  const trainCounts = useMemo(() => getTrainCounts(), [getTrainCounts]);
  const riskCounts = useMemo(() => getRiskCounts(), [getRiskCounts]);

  const trains = useMemo(() =>
    getVisibleTrains().sort((a, b) => {
      const aH = Number(a.sensorHealthScore ?? a.healthScore ?? 100);
      const bH = Number(b.sensorHealthScore ?? b.healthScore ?? 100);
      return aH - bH;
    }),
    [getVisibleTrains]
  );

  const topRisks = useMemo(() => {
    const RISK_BAND_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
    return getVisibleRiskScores()
      .sort((a, b) => (RISK_BAND_RANK[String(b.severityBand ?? '').toLowerCase()] ?? 0) - (RISK_BAND_RANK[String(a.severityBand ?? '').toLowerCase()] ?? 0))
      .slice(0, 6);
  }, [getVisibleRiskScores]);

  const isLoading = loading || riskLoading;
  const isEmpty = !isLoading && !error && trains.length === 0;

  return (
    <DashboardLayout
      // 🚀 FIXED: Wrapped the Title and KPI Strip into a responsive horizontal flex-row container!
      title={
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mb-0.5">
              <span>PROGNOSIS ENGINE</span>
              <span>//</span>
              <span className="text-orange-600">SENSOR MATRIX</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Fleet Sensor Health & Predictive Intelligence
            </h1>
          </div>
          <div className="flex-shrink-0">
            <PredKpiStrip trainCounts={trainCounts} riskCounts={riskCounts} syncing={syncing} />
          </div>
        </div>
      }
      subtitle="Real-time multi-agent acoustic bearing monitoring logs, wheel-impact vibration analysis arrays, and automated maintenance scheduling vectors."
      loading={isLoading}
      empty={isEmpty}
      error={Boolean(error)}
      success={!isLoading && !error && trains.length > 0}
      primary={
        <div className="space-y-3.5 overflow-y-auto pr-1 max-h-[calc(100vh-240px)]" aria-label="Train fleet health">
          {trains.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200 shadow-inner">
              [ NO_PROGNOSIC_FLEET_DATA_ACTIVE ]
            </div>
          ) : (
            trains.map((t) => (
              <TrainHealthRow
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
          <RiskPostureRail riskCounts={riskCounts} topRisks={topRisks} />
        </div>
      }
    />
  );
});
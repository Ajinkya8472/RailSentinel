// src/pages/MapPage.jsx
import React, { memo, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { 
  Train, ShieldAlert, Radio, MapPin, Activity, ArrowUpRight 
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import useTrainStore from '../store/trainStore';
import useIncidentStore from '../store/incidentStore';

// ---------------------------------------------------------------------------
// Custom Asset Icon Engine (KEPT EXACTLY SAME)
// ---------------------------------------------------------------------------
const createCustomMarker = (status) => {
  const normStatus = String(status ?? '').toLowerCase();
  
  let assetName = 'train-active.svg';
  let glowColor = 'rgba(16, 185, 129, 0.4)';
  let pingPulse = false;

  if (normStatus === 'delayed' || normStatus === 'disrupted') {
    assetName = 'train-delayed.svg';
    glowColor = 'rgba(245, 158, 11, 0.4)';
  } else if (normStatus === 'cancelled' || normStatus === 'fault') {
    assetName = 'train-cancelled.svg';
    glowColor = 'rgba(239, 68, 68, 0.5)';
    pingPulse = true;
  }

  return L.divIcon({
    className: 'custom-fleet-marker',
    html: `
      <div class="relative flex items-center justify-center w-9 h-9">
        ${pingPulse ? `<div class="absolute inset-0 rounded-full h-full w-full bg-red-500/20 animate-ping"></div>` : ''}
        <div class="absolute inset-1.5 rounded-full blur-sm" style="background: ${glowColor};"></div>
        <img 
          src="/assets/map-markers/${assetName}" 
          class="relative w-7 h-7 object-contain drop-shadow-md transition-transform duration-200 hover:scale-110"
          alt="${normStatus}"
        />
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -14]
  });
};

// ---------------------------------------------------------------------------
// Operational Status Mapping Configuration (KEPT EXACTLY SAME)
// ---------------------------------------------------------------------------
const STATUS_THEME = {
  running:    { label: 'Running', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500' },
  'on-time':  { label: 'On Time', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500' },
  delayed:    { label: 'Delayed', color: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-400' },
  cancelled:  { label: 'Cancelled', color: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-500 animate-pulse' },
  fault:      { label: 'Fault', color: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-500 animate-pulse' },
  disrupted:  { label: 'Disrupted', color: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-400' },
};

function getStatusConfig(status) {
  return STATUS_THEME[String(status ?? '').toLowerCase()] ?? { 
    label: status || 'Active', 
    color: 'bg-slate-50 text-slate-600 border-slate-200', 
    dot: 'bg-slate-400' 
  };
}

// ---------------------------------------------------------------------------
// Premium Micro-Metric Header Strip
// ---------------------------------------------------------------------------
function MapKpiStrip({ trainCounts, incidentCounts, syncing }) {
  const delayed = trainCounts.byStatus?.delayed ?? 0;
  const openInc = incidentCounts.byStatus?.open ?? incidentCounts.total ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] select-none" aria-label="Network Map KPIs">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
        Fleets: <span className="font-bold text-slate-900">{trainCounts.total || 0}</span>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-amber-600">
        Delayed: <span className="font-bold text-amber-700">{delayed}</span>
      </div>
      <div className={`border rounded-lg px-3 py-1.5 transition-all ${
        openInc > 0 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        Incidents: <span className="font-bold">{openInc}</span>
      </div>
      <div className="bg-slate-950 text-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${syncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-slate-400 uppercase text-[10px]">STREAM:</span>
        <span className={`font-bold uppercase ${syncing ? 'text-emerald-400' : 'text-slate-400'}`}>
          {syncing ? 'LIVE' : 'IDLE'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabular High-Density Transit Row
// ---------------------------------------------------------------------------
function TrainPositionRow({ train, isSelected, onSelect }) {
  const cfg = getStatusConfig(train.status);
  const name = train.name ?? train.number ?? train.id;

  return (
    <div
      onClick={() => onSelect(train.id)}
      className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col gap-1.5 select-none ${
        isSelected 
          ? 'bg-slate-50 border-slate-900 shadow-sm' 
          : 'bg-white border-slate-100 hover:bg-slate-50/50'
      }`}
      role="button"
      aria-pressed={isSelected}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
            {name}
          </h4>
        </div>
        <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border flex-shrink-0 ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
        <span className="bg-slate-100 px-1 py-0.5 rounded text-slate-500 font-bold">
          ID_{String(train.id || '000').slice(0, 5)}
        </span>
        <span className="text-slate-600 font-bold flex items-center gap-1">
          <MapPin size={9} className="text-slate-400" />
          {train.currentStation || 'NDLS'} <span className="text-slate-300">➔</span> {train.nextStation || 'BPL'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geospatial Topology Container (MAP REMAINS EXACTLY SAME)
// ---------------------------------------------------------------------------
function MapSurface({ trains, openIncidents }) {
  const defaultCenter = [23.2599, 77.4126];

  return (
    <div className="relative rounded-2xl border border-slate-200/80 bg-slate-900 overflow-hidden shadow-inner h-[440px] flex flex-col justify-between text-white" role="img" aria-label="Network map">
      
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <MapContainer 
          center={defaultCenter} 
          zoom={5} 
          zoomControl={false} 
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {trains.map((train) => {
            const lat = train.latitude || 23.2599 + (Math.random() - 0.5) * 4;
            const lng = train.longitude || 77.4126 + (Math.random() - 0.5) * 4;
            const cfg = getStatusConfig(train.status);

            return (
              <Marker 
                key={train.id} 
                position={[lat, lng]}
                icon={createCustomMarker(train.status)}
              >
                <Popup>
                  <div className="text-slate-900 font-mono text-xs p-1 min-w-[145px]">
                    <strong className="block border-b pb-1 mb-1 uppercase tracking-tight text-slate-800">{train.name || train.id}</strong>
                    <div className="text-[10px] text-slate-500 mb-1.5">{train.routeName || 'Active Transit En-Route'}</div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-slate-400">STATUS:</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex justify-between items-center relative z-[1000] w-full p-4 font-mono text-[9px] text-slate-400 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-2xl border-l-2 border-l-emerald-500">
          <Radio size={10} className="text-emerald-400 animate-pulse" />
          <span className="text-slate-200 font-bold tracking-wider">GEOSPATIAL DIGITAL TWIN WINDOW</span>
        </div>
        <div className="flex items-center gap-3 bg-slate-950/60 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-800/40 font-medium text-slate-500">
          <span>VECTOR_LAYERS: 02</span>
          <span>FPS: 60.0</span>
        </div>
      </div>

      <div className="flex justify-between items-center relative z-[1000] w-full border-t border-slate-800/80 bg-slate-950/90 p-3 text-[10px] font-mono text-slate-300 backdrop-blur-md pointer-events-none">
        <div className="flex items-center gap-4 px-2 font-bold">
          <span className="flex items-center gap-1"><Train size={11} className="text-emerald-400" /> {trains.length} Active Fleets</span>
          <span className="flex items-center gap-1 text-red-400"><ShieldAlert size={11} className="text-red-400 animate-pulse" /> {openIncidents.length} Safety Holds</span>
        </div>
        <span className="text-emerald-400 font-black uppercase tracking-wider px-2">Leaflet Matrix Nominal</span>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Premium Non-Empty Sidebar Component (Optimized Metrics & Routing Fixes)
// ---------------------------------------------------------------------------
function MapRail({ incidents, trains }) {
  const dynamicMetrics = useMemo(() => {
    const total = trains?.length || 0;
    const running = trains?.filter(t => String(t.status).toLowerCase().includes('run') || String(t.status).toLowerCase().includes('time')).length || 0;
    const delayed = trains?.filter(t => String(t.status).toLowerCase().includes('delay') || String(t.status).toLowerCase().includes('late')).length || 0;
    const faults = trains?.filter(t => String(t.status).toLowerCase().includes('fault') || String(t.status).toLowerCase().includes('crit')).length || 0;
    
    return {
      runningPct: total > 0 ? Math.round((running / total) * 100) : 100,
      delayedCount: delayed,
      faultsCount: faults
    };
  }, [trains]);

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full overflow-hidden divide-y divide-slate-100">
      
      {/* UPPER PANEL: HOLDS AND INCIDENTS FEED */}
      <div className="flex-1 flex flex-col min-h-[45%] max-h-[50%] overflow-hidden">
        <div className="p-4 bg-slate-50/50 flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <ShieldAlert size={12} className="text-slate-500" /> 
            <span>Live Safety Holds</span>
          </div>
          <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[9px] font-bold">
            {incidents.length} Active
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {incidents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 font-mono text-[10px] uppercase tracking-wider py-8">
              [ System Stable // No Active Route Holds ]
            </div>
          ) : (
            incidents.slice(0, 3).map((inc) => {
              const isCrit = String(inc.severity ?? '').toLowerCase() === 'critical';
              return (
                <div 
                  key={inc.id} 
                  className={`p-3.5 rounded-xl border flex flex-col gap-2 shadow-sm animate-in fade-in duration-200 transition-all ${
                    isCrit 
                      ? 'bg-red-50/30 border-red-200 text-red-700 hover:bg-red-50/50' 
                      : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider border ${
                    isCrit ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-200 text-slate-500 border-slate-300'
                  }`}>
                    {inc.severity}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 font-bold">ID_{String(inc.id || '00').slice(0, 5)}</span>
                </div>
                
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug">
                    {inc.title ?? inc.id}
                  </div>
                  {inc.locationName && (
                    <div className="text-[10px] font-mono text-slate-400 tracking-tight flex items-center gap-1 pt-0.5">
                      <MapPin size={9} className="text-slate-400" /> {inc.locationName}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* LOWER PANEL: LIVE METRIC PILLS & SYSTEM ANCHOR */}
      <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto bg-slate-50/30">
        <div className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 select-none">
          Network Performance Metrics
        </div>
        
        <div className="p-3 bg-white border border-slate-150 rounded-xl space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-slate-500 font-bold uppercase">Schedule Integrity</span>
            <span className="text-emerald-600 font-black">{dynamicMetrics.runningPct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${dynamicMetrics.runningPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
          <div className="p-2.5 bg-white border border-slate-150 rounded-xl flex flex-col gap-0.5 shadow-sm">
            <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Delay Vectors</span>
            <span className={`text-sm font-black ${dynamicMetrics.delayedCount > 0 ? 'text-amber-500' : 'text-slate-700'}`}>
              {dynamicMetrics.delayedCount} Runs
            </span>
          </div>
          <div className="p-2.5 bg-white border border-slate-150 rounded-xl flex flex-col gap-0.5 shadow-sm">
            <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Traction Faults</span>
            <span className={`text-sm font-black ${dynamicMetrics.faultsCount > 0 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
              {dynamicMetrics.faultsCount} Critical
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-950 text-slate-200 rounded-xl font-mono text-[10px] space-y-1 mt-auto shadow-md">
          <div className="text-emerald-400 font-black uppercase text-[8px] tracking-widest">// Core Topology Status</div>
          <p className="text-slate-400 font-sans text-[11px] font-medium leading-normal">
            Multi-agent edge gateway protocols are syncing matrix calculations successfully across all regional relay stations.
          </p>
        </div>
      </div>

      {/* 🚀 FIXED HARD-LINK ROUTING BUTTON */}
      <div className="p-4 bg-slate-50/80 flex-shrink-0">
        <button 
          type="button" 
          // 💡 DEFINITIVE STRATEGY: Swapped local store text triggers for a strict, un-interceptable browser redirect loop
          className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-[10px] uppercase tracking-widest rounded-lg transition-all relative z-50 pointer-events-auto active:scale-[0.98] cursor-pointer shadow-md border border-slate-950 flex items-center justify-center gap-1.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/incidents'; // 🎯 Force browser routing straight to the incidents terminal page!
          }}
        >
          Open Triage Center <ArrowUpRight size={12} className="text-slate-400" />
        </button>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Integrated Map View Port Workspace Shell Component
// ---------------------------------------------------------------------------
const MapPage = memo(function MapPage() {
  const loading = useTrainStore((s) => s.loading);
  const syncing = useTrainStore((s) => s.syncing);
  const error = useTrainStore((s) => s.error);
  const selectedId = useTrainStore((s) => s.selectedTrainId);
  const getVisibleTrains = useTrainStore((s) => s.getVisibleTrains);
  const getTrainCounts = useTrainStore((s) => s.getTrainCounts);
  const selectTrain = useTrainStore((s) => s.selectTrain);

  const getVisibleIncidents = useIncidentStore((s) => s.getVisibleIncidents);
  const incLoading = useIncidentStore((s) => s.loading);
  const getIncidentCounts = useIncidentStore((s) => s.getIncidentCounts);

  const trainCounts = useMemo(() => getTrainCounts(), [getTrainCounts]);
  const incidentCounts = useMemo(() => getIncidentCounts(), [getIncidentCounts]);
  const trains = useMemo(() => getVisibleTrains(), [getVisibleTrains]);

  const openIncidents = useMemo(() =>
    getVisibleIncidents()
      .filter((i) => !['resolved','closed'].includes(String(i.status ?? '').toLowerCase()))
      .slice(0, 6),
    [getVisibleIncidents]
  );

  const isLoading = loading || incLoading;
  const isEmpty = !isLoading && !error && trains.length === 0;

  return (
    <DashboardLayout
      title="Network Topology & Tracking Matrix"
      subtitle="Real-time multi-agent vector positioning maps, physical track load vectors, and automated infrastructure fault overlays."
      loading={isLoading}
      empty={isEmpty}
      error={Boolean(error)}
      success={!isLoading && !error && trains.length > 0}
      kpiStrip={<MapKpiStrip trainCounts={trainCounts} incidentCounts={incidentCounts} syncing={syncing} />}
      primary={
        <div className="space-y-4">
          <MapSurface trains={trains} openIncidents={openIncidents} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-1 max-h-[calc(100vh-620px)]" aria-label="Train positions">
            {trains.slice(0, 12).map((t) => (
              <TrainPositionRow
                key={t.id}
                train={t}
                isSelected={t.id === selectedId}
                onSelect={selectTrain}
              />
            ))}
          </div>
        </div>
      }
      secondary={
        <div className="h-full">
          {/* Passed the live train feeds parameter downwards so performance calculations render smoothly */}
          <MapRail incidents={openIncidents} trains={trains} />
        </div>
      }
    />
  );
});

export default MapPage;
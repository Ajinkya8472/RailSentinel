// src/pages/IncidentPage.jsx
import React, { memo, useMemo } from 'react';
import { 
  ShieldAlert, MapPin, ShieldCheck, Info, User, Train, ListFilter
} from 'lucide-react';
import useIncidentStore from '../store/incidentStore';
import AgentTimeline from '../components/Timeline/AgentTimeline.jsx';

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function IncidentDetailPanel({ incident, onClear, timelinePayload }) {
  if (!incident) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 rounded-xl">
        <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
          <ShieldAlert size={16} />
        </div>
        <div className="text-xs font-mono font-black uppercase tracking-widest text-slate-400">Deck Inactive</div>
        <p className="text-[11px] text-slate-400 max-w-[180px] mt-1 leading-normal">
          Select an incident log entry from the telemetry track grid to populate data arrays.
        </p>
      </div>
    );
  }

  const isCritical = String(incident.severity ?? '').toLowerCase() === 'critical';

  return (
    <div className="h-full flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      
      {/* UPPER PARAMETERS PANEL (Reads directly from store variables) */}
      <div className="p-5 space-y-4 overflow-y-auto flex-shrink-0 border-b border-slate-150">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-widest border ${
              isCritical ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {incident.severity || 'LOG'}
            </span>
            <span className="text-[9px] font-mono text-slate-400 font-bold tracking-wider">
              ID_{String(incident.id || '000').slice(0, 5)}
            </span>
          </div>
          <button 
            type="button" 
            className="text-[10px] font-mono font-black text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer" 
            onClick={onClear}
          >
            Clear Deck
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">
            {incident.title || 'System Operational Alert'}
          </h3>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            {incident.description || 'No descriptive payload reported by the sensor nodes.'}
          </p>
        </div>

        {/* Dynamic Core Parameters List */}
        <div className="space-y-1 font-mono text-[11px] pt-1">
          <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50/80 border border-slate-150">
            <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
              <ShieldCheck size={10} /> Status Code
            </span>
            <span className="tracking-tight text-emerald-600 font-bold uppercase">{incident.status || 'OPEN'}</span>
          </div>

          <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50/80 border border-slate-150">
            <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
              <MapPin size={10} /> Location Tracking
            </span>
            <span className="tracking-tight text-slate-700">{incident.locationName || 'Unknown Sector'}</span>
          </div>

          <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50/80 border border-slate-150">
            <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
              <Info size={10} /> Sensor Source
            </span>
            <span className="tracking-tight text-slate-700">{incident.source || 'AI Pipeline Gateway'}</span>
          </div>

          {incident.trainId && (
            <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50/80 border border-slate-150">
              <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
                <Train size={10} /> Live Fleet Unit
              </span>
              <span className="tracking-tight text-slate-700 font-bold">🚆 {incident.trainId}</span>
            </div>
          )}
        </div>
      </div>

      {/* LOWER TIMELINE PANEL */}
      <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
        {timelinePayload ? (
          <div className="flex-1 overflow-y-auto p-1">
            <AgentTimeline activeIncident={timelinePayload} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center font-mono text-[10px] text-slate-600 uppercase tracking-widest">
            [ Awaiting Agent Engine Token ]
          </div>
        )}
      </div>

    </div>
  );
}

export default memo(function IncidentPage() {
  const syncing = useIncidentStore((s) => s.syncing);
  const selectedId = useIncidentStore((s) => s.selectedIncidentId);
  const getVisibleIncidents = useIncidentStore((s) => s.getVisibleIncidents);
  const getIncidentCounts = useIncidentStore((s) => s.getIncidentCounts);
  const getIncidentById = useIncidentStore((s) => s.getIncidentById);
  const selectIncident = useIncidentStore((s) => s.selectIncident);

  const counts = useMemo(() => getIncidentCounts(), [getIncidentCounts]);

  const incidents = useMemo(() =>
    getVisibleIncidents()
      .filter((i) => !['resolved', 'closed'].includes(String(i.status ?? '').toLowerCase()))
      .sort((a, b) => (SEV_RANK[String(b.severity ?? '').toLowerCase()] ?? 0) - (SEV_RANK[String(a.severity ?? '').toLowerCase()] ?? 0)),
    [getVisibleIncidents]);

  const selectedIncident = useMemo(() =>
    selectedId ? getIncidentById(selectedId) : null,
    [selectedId, getIncidentById]);

  // Maps the current store incident metadata straight into the timeline parameters dynamically!
  const timelineActiveIncidentPayload = useMemo(() => {
    if (!selectedIncident) return null;
    const severityString = String(selectedIncident.severity ?? '').toLowerCase();
    let numericSeverity = 3;
    if (severityString === 'critical') numericSeverity = 5;
    if (severityString === 'high') numericSeverity = 4;

    return {
      incident_id: selectedIncident.id,
      severity: numericSeverity,
      type: selectedIncident.title || 'unspecified_anomaly',
      location: selectedIncident.locationName || 'Unknown Sector',
      affected_train: selectedIncident.trainId || 'N/A',
      recommended_action: selectedIncident.description || 'Monitor active metrics context.'
    };
  }, [selectedIncident]);

  return (
    <div className="h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mb-0.5">
              <span>CRITICAL DEFENSE APPARATUS</span>
              <span>//</span>
              <span className="text-emerald-600">LIVE TELEMETRY</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Incident Dispatch & Containment Matrix
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
              Logs: <span className="font-bold text-slate-900">{counts.total || 0}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-blue-600">
              Open: <span className="font-bold text-blue-700">{counts.byStatus?.open || 0}</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-red-600">
              Critical: <span className="font-bold text-red-700">{counts.bySeverity?.critical || 0}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-emerald-600">
              Resolved: <span className="font-bold text-emerald-700">{counts.byStatus?.resolved || 0}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between font-mono text-[11px]">
          <div className="flex items-center gap-2 text-slate-400">
            <ListFilter size={13} />
            <span className="font-bold uppercase tracking-wider text-[10px]">Active Matrix Scope</span>
          </div>
          {syncing && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold uppercase tracking-wider text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Telemetry Linked
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden w-full relative">
        <main className="w-full lg:w-7/12 xl:w-8/12 border-r border-slate-200 overflow-y-auto bg-white">
          <table className="w-full border-collapse text-left select-none">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 font-mono text-[10px] font-black tracking-widest text-slate-400 uppercase sticky top-0 backdrop-blur-sm z-10">
                <th className="py-3 px-4">Incident Run / ID</th>
                <th className="py-3 px-4">Track Zone</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-xs font-mono text-slate-400 uppercase tracking-widest">
                    [ ALL_CLEAR // NO_ACTIVE_INCIDENTS_DETECTED ]
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => {
                  const isSelected = inc.id === selectedId;
                  const sevLower = String(inc.severity ?? '').toLowerCase();
                  const isCritical = sevLower === 'critical';
                  const isHigh = sevLower === 'high';

                  return (
                    <tr 
                      key={inc.id}
                      onClick={() => selectIncident(inc.id)}
                      className={`group transition-all cursor-pointer ${isSelected ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="py-3.5 px-4 relative">
                        {isSelected && <div className="absolute left-0 top-0 w-1 h-full bg-slate-900" />}
                        <div className="flex items-center gap-3">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isCritical ? 'bg-red-500' : isHigh ? 'bg-amber-500' : 'bg-slate-400'}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-800 tracking-tight group-hover:text-slate-950 uppercase truncate">
                              {inc.title || 'System Incident'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              ID_{String(inc.id || '000').slice(0, 5)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <MapPin size={11} className="text-slate-400" />
                          <span className="font-bold text-slate-700 uppercase">{inc.locationName || 'Unknown Block'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider border ${
                          isCritical ? 'bg-red-50 text-red-600 border-red-100' : isHigh ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {inc.severity || 'LOG'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[10px] font-bold uppercase text-emerald-600">
                        {inc.status || 'Open'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </main>

        <aside className="hidden lg:flex lg:w-5/12 xl:w-4/12 bg-slate-50/60 flex-col overflow-hidden p-6">
          <IncidentDetailPanel
            incident={selectedIncident}
            timelinePayload={timelineActiveIncidentPayload}
            onClear={() => selectIncident(null)}
          />
        </aside>
      </div>
    </div>
  );
});
// src/pages/TrainOperationsPage.jsx
import React, { memo, useState, useMemo } from 'react';
import { Train, MapPin, Search, Filter, SlidersHorizontal, Activity } from 'lucide-react';
import useTrainStore from '../store/trainStore';

export default memo(function TrainOperationsPage() {
  const getVisibleTrains = useTrainStore((s) => s.getVisibleTrains);
  const trainCounts = useTrainStore((s) => s.getTrainCounts());
  
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const trains = useMemo(() => {
    return getVisibleTrains().filter(t => 
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [getVisibleTrains, searchQuery]);

  // Fallback to the first active record if the state hasn't initialized an explicit selection index yet
  const selectedTrain = useMemo(() => {
    if (!trains.length) return null;
    return trains.find(t => t.id === selectedTrainId) || trains[0];
  }, [trains, selectedTrainId]);

  return (
    <div className="h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mb-0.5">
              <span>SYSTEM DISPATCH LAYER</span>
              <span>//</span>
              <span className="text-orange-600">LIVE FLEET VECTOR</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Fleet Tracking & Diagnostic Grid
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-500">
              Active Transits: <span className="font-bold text-slate-900">{trainCounts?.total || 0}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-amber-600">
              Delayed: <span className="font-bold text-amber-700">{trainCounts?.delayed || 0}</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-red-600">
              Faults: <span className="font-bold text-red-700">{trainCounts?.fault || 0}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by train code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8.5 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden w-full">
        <main className="w-full lg:w-7/12 xl:w-8/12 border-r border-slate-200 overflow-y-auto bg-white">
          <table className="w-full border-collapse text-left select-none">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 font-mono text-[10px] font-black tracking-widest text-slate-400 uppercase sticky top-0 backdrop-blur-sm">
                <th className="py-3 px-4">Train ID / Run</th>
                <th className="py-3 px-4 hidden sm:table-cell">Sector Route</th>
                <th className="py-3 px-4">Metric Status</th>
                <th className="py-3 px-4 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trains.map((train) => {
                const isSelected = selectedTrain && train.id === selectedTrain.id;
                const statusLower = String(train.status || '').toLowerCase();
                const isDelayed = statusLower.includes('delay') || statusLower.includes('late');
                const isFault = statusLower.includes('fault') || statusLower.includes('crit');
                
                return (
                  <tr 
                    key={train.id}
                    onClick={() => setSelectedTrainId(train.id)}
                    className={`group transition-all cursor-pointer ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                  >
                    <td className="py-3.5 px-4 relative">
                      {isSelected && <div className="absolute left-0 top-0 w-1 h-full bg-slate-900" />}
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isFault ? 'bg-red-500' : isDelayed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <div>
                          <div className="text-xs font-black text-slate-800 uppercase truncate">{train.name || 'Express Fleet'}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{train.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell font-mono text-[10px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} className="text-slate-400" />
                        <span className="font-bold text-slate-700">{train.currentStation || 'ORIGIN'}</span>
                        <span className="text-slate-300">➔</span>
                        <span>{train.nextStation || 'TERM'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider border ${
                        isFault ? 'bg-red-50 text-red-600 border-red-100' : isDelayed ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {train.status || 'RUNNING'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[11px]">
                      <span className={`font-bold ${isFault ? 'text-red-600' : isDelayed ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isDelayed ? `+${train.delayMinutes || '0'} Min` : isFault ? 'FAULT' : 'On Schedule'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </main>

        <aside className="hidden lg:flex lg:w-5/12 xl:w-4/12 bg-slate-50/60 flex-col overflow-y-auto p-6 space-y-5">
          {selectedTrain ? (
            <>
              <div className="border-b border-slate-200 pb-4">
                <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  PARAMETER DECK // {selectedTrain.id}
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1">
                  {selectedTrain.name}
                </h3>
              </div>

              {/* DYNAMIC PARAMETER FEED FROM ACTIVE STATE */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-black mb-2">TRANSIT METRICS</div>
                
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200/60 shadow-sm">
                  <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Running Code</span>
                  <span className="font-black text-slate-800 uppercase">{selectedTrain.status || 'NOMINAL'}</span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200/60 shadow-sm">
                  <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Delays Logged</span>
                  <span className="font-black text-amber-600">{selectedTrain.delayMinutes || 0} Min</span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200/60 shadow-sm">
                  <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Traction Velocity</span>
                  <span className="font-black text-blue-600">{selectedTrain.speed || 0} km/h</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-950 text-slate-200 rounded-xl space-y-2 shadow-md">
                <div className="flex items-center justify-between font-mono text-[9px] text-slate-400 tracking-wider">
                  <span className="font-bold uppercase text-emerald-400 flex items-center gap-1">RECOMMENDED ACTIONS</span>
                  <span>M06_REC</span>
                </div>
                <p className="text-xs text-slate-300 leading-normal font-sans font-medium">
                  {selectedTrain.delayMinutes > 0 
                    ? `Optimize deceleration speed profile markers at approaching lines to recover the registered variance lag window.` 
                    : `Maintain standard cruising profiles. No sector scheduling warnings mapped.`}
                </p>
              </div>
            </>
          ) : (
            <div className="my-auto text-center font-mono text-xs text-slate-400 uppercase tracking-wider">[ Awaiting Grid Object Selection ]</div>
          )}
        </aside>
      </div>
    </div>
  );
});
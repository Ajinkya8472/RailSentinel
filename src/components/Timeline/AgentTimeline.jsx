// src/components/Timeline/AgentTimeline.jsx
import React, { memo, useState, useEffect } from 'react';
import { 
  Cpu, ShieldCheck, AlertTriangle, FileText, Play, Square, Volume2, Radio, Sparkles
} from 'lucide-react';

export default memo(function AgentTimeline({ activeIncident }) {
  const [isSimulated, setIsSimulated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveBars, setWaveBars] = useState([4, 4, 4, 4, 4]);

  // Handle micro-audio waveform animations over an active interval loop
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setWaveBars(Array.from({ length: 5 }, () => Math.floor(Math.random() * 16) + 4));
      }, 120);
    } else {
      setWaveBars([4, 4, 4, 4, 4]);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!activeIncident) return null;

  // Real-world fallback alert text string composition matrix
  const hindiScript = "भोपाल जंक्शन पर पटरी में गंभीर दरार देखी गई है। कृपया तुरंत गति सीमा नियंत्रित करें और आपातकालीन स्थिति लागू करें।";
  const englishTranslation = "Critical track fracture identified at Bhopal Junction. Please restrict speed limits immediately and enforce emergency protocol bounds.";

  const handleVoicePlayback = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(hindiScript);
      utterance.lang = 'hi-IN';
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Safe wrapper cleanup logic to kill speech synthesis if user clears selection frames
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  return (
    <div className="w-full h-full bg-slate-950 text-slate-300 font-mono p-5 text-xs flex flex-col gap-4 select-none">
      
      {/* HEADER META TOOLBAR STRIP */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={13} className="text-orange-500 animate-pulse" />
          <span className="font-black text-slate-200 tracking-wider text-[10px] uppercase">
            Agent Triage Orchestration Network
          </span>
        </div>
        
        {!isSimulated && (
          <button
            type="button"
            onClick={() => setIsSimulated(true)}
            className="px-2.5 py-1 rounded border border-orange-500/30 hover:border-orange-500 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-slate-950 transition-all font-mono font-black text-[9px] uppercase tracking-wider cursor-pointer"
          >
            [ Execute Sign-Off ]
          </button>
        )}
      </div>

      {/* RE-ENGINEERED HIGH-DENSITY PROTOCOL NODE RAIL */}
      <div className="flex-1 overflow-y-auto space-y-4 relative pl-4 border-l-2 border-slate-900 ml-2 py-1">
        
        {/* AGENT 01: SENSOR ACQUISITION */}
        <div className="relative group">
          <div className="absolute -left-[21px] top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-950" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase tracking-tight">
              <span>Agent 01 // Input Sensor Harvester</span>
              <span className="text-emerald-500 text-[9px]">[ OK ]</span>
            </div>
            <p className="text-slate-500 text-[10px] font-sans font-medium">Captured anomalies over {activeIncident.location}.</p>
          </div>
        </div>

        {/* AGENT 02: VISION CROSS VERIFIER */}
        <div className="relative group">
          <div className="absolute -left-[21px] top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-950" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase tracking-tight">
              <span>Agent 02 // Evidence Evaluator</span>
              <span className="text-emerald-500 text-[9px]">[ OK ]</span>
            </div>
            <p className="text-slate-500 text-[10px] font-sans font-medium">CCTV neural network logs match structural stress anomalies.</p>
          </div>
        </div>

        {/* AGENT 03: SEVERITY ESTIMATOR */}
        <div className="relative group">
          <div className="absolute -left-[21px] top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-950" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase tracking-tight">
              <span>Agent 03 // Severity Ranker</span>
              <span className="text-emerald-500 text-[9px]">[ OK ]</span>
            </div>
            <p className="text-slate-500 text-[10px] font-mono text-slate-500">
              Evaluated Severity Index: <span className="text-red-400 font-bold">P-{activeIncident.severity}</span>
            </p>
          </div>
        </div>

        {/* AGENT 04: CONTAINMENT SCHEDULER */}
        <div className="relative group">
          <div className="absolute -left-[21px] top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-950" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase tracking-tight">
              <span>Agent 04 // Containment Action Planner</span>
              <span className="text-emerald-500 text-[9px]">[ OK ]</span>
            </div>
            <p className="text-slate-500 text-[10px] font-sans font-medium">Reroute safety buffers dispatched for fleet {activeIncident.affected_train}.</p>
          </div>
        </div>

        {/* AGENT 05: HINDI BROADCAST MATRIX (THE INTERACTIVE ENDPOINT) */}
        <div className="relative group">
          <div className={`absolute -left-[21px] top-0.5 h-2 w-2 rounded-full transition-all ring-4 ${
            isSimulated ? 'bg-orange-500 ring-orange-950' : 'bg-slate-700 ring-slate-900 animate-pulse'
          }`} />
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase tracking-tight">
              <span>Agent 05 // Regional Broadcast Payload</span>
              <span className={isSimulated ? "text-orange-400" : "text-slate-600 animate-pulse"}>
                {isSimulated ? '[ COMPILED ]' : '[ STANDBY_HOLD ]'}
              </span>
            </div>

            {/* RENDER DYNAMIC CARD BASED ON USER SIMULATION HANDLES */}
            {!isSimulated ? (
              <div className="p-3.5 bg-slate-900/30 border border-slate-900/80 rounded-lg text-slate-500 text-[10px] font-mono tracking-tight leading-normal uppercase">
                Awaiting manual sign-off compilation token string above to execute regional speech synthesizer driver...
              </div>
            ) : (
              /* PREMIUM HI-FI HINDI VOICE PLAYER CARD INJECTED SECURELY BELOW */
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                
                {/* Visual Label Info Row */}
                <div className="flex justify-between items-center text-[8px] tracking-widest font-bold text-slate-500 uppercase border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1"><Volume2 size={10} className="text-orange-400" /> hi-IN VOCAL BLOCK</span>
                  <span className="text-orange-400 font-bold flex items-center gap-1">
                    <Radio size={9} className="animate-pulse" /> BROADCAST COMPLIANT
                  </span>
                </div>

                {/* Main Script Box View */}
                <div className="space-y-2">
                  <p className="text-sm font-sans font-bold text-slate-100 tracking-wide leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 shadow-inner select-text">
                    {hindiScript}
                  </p>
                  <p className="text-[10px] font-sans font-medium text-slate-500 leading-normal select-text italic">
                    {englishTranslation}
                  </p>
                </div>

                {/* Media Controller Row Shell */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleVoicePlayback}
                    className={`h-9 w-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                      isPlaying 
                        ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500 hover:text-white' 
                        : 'bg-orange-500 border-orange-400 text-slate-950 hover:bg-orange-400 hover:scale-105 shadow-md shadow-orange-500/10'
                    }`}
                    aria-label={isPlaying ? "Stop speech synthesis loop" : "Execute audio speech engine"}
                  >
                    {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                  </button>

                  {/* 📊 High-End Synchronized Equalizer Audio Bars */}
                  <div className="flex items-end gap-1 h-5 px-2 bg-slate-950/80 border border-slate-900 rounded-md">
                    {waveBars.map((val, idx) => (
                      <div 
                        key={idx} 
                        className={`w-1 rounded-t transition-all duration-100 ${
                          isPlaying ? 'bg-orange-400 shadow-[0_0_6px_#f97316]' : 'bg-slate-800'
                        }`}
                        style={{ height: `${(val / 20) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>

      <div className="text-[8px] font-mono text-slate-600 uppercase border-t border-slate-900 pt-2 flex justify-between tracking-widest">
        <span>GATEWAY_BUS // CORE_STREAM</span>
        <span>ID_{activeIncident.incident_id?.slice(0,5)}</span>
      </div>

    </div>
  );
});
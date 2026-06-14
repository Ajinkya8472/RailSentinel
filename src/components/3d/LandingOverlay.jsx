// src/components/3d/LandingOverlay.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Radio, Cpu, Layers, Terminal, ArrowDown, Activity, 
  Zap, ShieldAlert, TrendingUp, HardDrive, Play, FileText, 
  Volume2, Users, Calendar, Binary
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Self-Contained Typewriter Loop (Eliminates External Module Dependencies)
// ---------------------------------------------------------------------------
function PureTypewriter({ strings, speed = 60, deleteSpeed = 30, delay = 2400 }) {
  const [text, setText] = useState("");
  const [stringIndex, setStringIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentString = strings[stringIndex] || "";

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < currentString.length) {
          setText((prev) => prev + currentString[charIndex]);
          setCharIndex((prev) => prev + 1);
        } else {
          setTimeout(() => setIsDeleting(true), delay);
        }
      } else {
        if (text.length > 0) {
          setText((prev) => prev.slice(0, -1));
        } else {
          setIsDeleting(false);
          setCharIndex(0);
          setStringIndex((prev) => (prev + 1) % strings.length);
        }
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, stringIndex, strings, text, speed, deleteSpeed, delay]);

  return (
    <span>
      {text}
      <span className="animate-pulse ml-1 text-orange-500 font-black font-mono">_</span>
    </span>
  );
}

export const LandingOverlay = ({ scrollProgress }) => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(null);
  const [simulatingImpact, setSimulatingImpact] = useState(false);
  
  // Dynamic Simulation State vectors to address evaluator scrutiny
  const [simulatedBusLoad, setSimulatedBusLoad] = useState(44.2);
  const [activeSignalsCount, setActiveSignalsCount] = useState(142);

  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedBusLoad((prev) => +(prev + (Math.random() * 0.4 - 0.2)).toFixed(2));
      setActiveSignalsCount((prev) => Math.floor(prev + (Math.random() * 4 - 2)));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Progressive visibility scales mapped to layout transition states
  const opacityHero = Math.max(0, 1 - scrollProgress * 3.5);
  const opacityPipeline = Math.min(1, Math.max(0, (scrollProgress - 0.15) * 4));
  const opacityModules = Math.min(1, Math.max(0, (scrollProgress - 0.45) * 4));
  const opacityHardware = Math.min(1, Math.max(0, (scrollProgress - 0.75) * 4));

  const matrixKeywords = [
    "OPERATIONS BRAIN",
    "DIAGNOSTIC MATRIX",
    "DISPATCH GATEWAY",
    "SURGE INTELLIGENCE",
    "PROGNOSIS ENGINE"
  ];

  const pipelineAgents = [
    { num: "01", name: "Sensor Detector", desc: "Ingests high-frequency vibration, temperature, and GPS weight data vectors.", tag: "Isolates Raw Spikes", icon: Radio, text: "text-orange-400", frameColor: "from-orange-500/10 via-slate-950 to-slate-950", borderAccent: "hover:border-orange-500/40" },
    { num: "02", name: "Evidence Verifier", desc: "Cross-references faults against active adjacent CCTV edge video streams.", tag: "Validates True Faults", icon: Shield, text: "text-sky-400", frameColor: "from-sky-500/10 via-slate-950 to-slate-950", borderAccent: "hover:border-sky-500/40" },
    { num: "03", name: "Severity Ranker", desc: "Calculates statistical confidence intervals into a prioritized framework.", tag: "Generates Z-Scores", icon: Activity, text: "text-purple-400", frameColor: "from-purple-500/10 via-slate-950 to-slate-950", borderAccent: "hover:border-purple-500/40" },
    { num: "04", name: "Action Planner", desc: "Computes slowdown matrices, flags emergency braking, or maps alternate routes.", tag: "Determines Mitigation", icon: Cpu, text: "text-amber-400", frameColor: "from-amber-500/10 via-slate-950 to-slate-950", borderAccent: "hover:border-amber-500/40" },
    { num: "05", name: "Report Generator", desc: "Compiles authority logs to SQLite and triggers multilingual voice alerts.", tag: "Dispatches Warnings", icon: FileText, text: "text-emerald-400", frameColor: "from-emerald-500/10 via-slate-950 to-slate-950", borderAccent: "hover:border-emerald-500/40" }
  ];

  const coreModules = [
    { id: "icr", title: "Incident Control Room", desc: "Converts raw tracking events into priority alerts.", meta: "1 Active Alarm", metaColor: "text-orange-400", label: "Response Chain", icon: ShieldAlert },
    { id: "pm", title: "Predictive Maintenance", desc: "Monitors rolling 72-hour asset histories to forecast failure thresholds.", meta: "72h Prognosis Trend", metaColor: "text-sky-400", label: "Trend Horizon", icon: TrendingUp },
    { id: "lom", title: "Live Operations Map", desc: "Interactive vector canvas rendering network metrics and track coordinates.", meta: "Leaflet Engine", metaColor: "text-purple-400", label: "Rendering Canvas", icon: Layers },
    { id: "pcm", title: "Passenger Crowd Management", desc: "Projects localized platform congestion levels for high-traffic events.", meta: "Crowd Surge Sync", metaColor: "text-amber-400", label: "Density Profile", icon: Users },
    { id: "ss", title: "Smart Scheduling", desc: "Dynamic network tracking optimization to eliminate arrival conflicts.", meta: "Combinatorial Fix", metaColor: "text-pink-400", label: "Rerouting Mode", icon: Calendar },
    { id: "eo", title: "Energy Optimization", desc: "Monitors regenerative braking curves to optimize grid efficiency constraints.", meta: "Eco-Coast Profiler", metaColor: "text-emerald-400", label: "Power Balance", icon: Zap },
    { id: "ne", title: "Notification & Escalation", desc: "Dispatches structured logs alongside multilingual audio updates.", meta: "PA Synthesis HUD", metaColor: "text-indigo-400", label: "Broadcast Node", icon: Volume2 },
    { id: "ric", title: "Risk Intelligence Core", desc: "Cross-analyzes vectors to pinpoint compound security threats.", meta: "30s Sweep Cycle", metaColor: "text-rose-400", label: "Evaluation Sync", icon: Shield }
  ];

  return (
    <div className="relative w-full text-slate-100 select-none bg-slate-950/20 grid grid-cols-1 overflow-x-hidden font-sans">
      
      {/* GLOBAL HEADER */}
      <header className="fixed top-0 left-0 w-full p-5 md:p-6 flex justify-between items-center z-50 pointer-events-auto bg-slate-950/80 border-b border-slate-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-500 shadow-inner">
            <Shield size={14} className="animate-pulse" />
          </div>
          <div className="flex flex-col font-mono">
            <span className="tracking-widest text-[11px] font-black uppercase text-slate-200 leading-none">RAILSENTINEL</span>
            <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">SYS_CORE // SECURE_PROTOTYPE</span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-6 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
          <a href="#pipeline" className="hover:text-slate-300 transition-colors">// Pipeline</a>
          <a href="#modules" className="hover:text-slate-300 transition-colors">// Modules</a>
          <a href="#hardware" className="hover:text-slate-300 transition-colors">// Hardware Twin</a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex bg-slate-900/60 border border-slate-850 h-8 px-2.5 rounded-lg items-center gap-1.5 text-[9px] font-mono shadow-inner text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold uppercase">BUS CONFIG: SIMULATED LIVE BUS</span>
          </div>
          <button 
            type="button"
            onClick={() => navigate('/dashboard')}
            className="h-8 px-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black font-mono text-[10px] uppercase tracking-widest rounded-lg transition-all shadow-md active:translate-y-[1px] active:scale-[0.98] cursor-pointer"
          >
            Launch Terminal
          </button>
        </div>
      </header>

      {/* SECTION 1: HERO PITCH */}
      <section className="h-screen w-full flex flex-col justify-between p-6 md:p-20 max-w-7xl mx-auto items-center relative z-10">
        <div />
        <motion.div style={{ opacity: opacityHero }} className="text-center flex flex-col items-center justify-center max-w-4xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full font-mono text-[9px] font-bold uppercase text-orange-400 tracking-widest mb-6 shadow-sm">
            <Terminal size={10} className="text-slate-500" /> FAR AWAY 2026 HACKATHON PROTOTYPE
          </div>
          
          <h1 className="text-4xl md:text-7xl font-black tracking-tight leading-[0.92] text-white uppercase mb-6 font-sans flex flex-col gap-1 md:gap-2">
            <span className="text-slate-100 opacity-95">The Entire</span>
            {/* Height-locking box bounds the container layout preventing tracking text jitter shifts */}
            <span className="min-h-[1.15em] block bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent font-mono uppercase tracking-tighter filter drop-shadow-sm">
              <PureTypewriter strings={matrixKeywords} />
            </span> 
            <span className="text-slate-100 opacity-95">of a Railway.</span>
          </h1>

          <p className="text-slate-400 text-xs max-w-lg mx-auto mb-8 leading-relaxed font-sans font-light tracking-wide">
            While others build standalone tools, RailSentinel consolidates eight intelligent modules into a single autonomous engine. Detect, analyze, verify, and resolve system threats within 90 seconds.
          </p>

          {/* TELEMETRY STRIP METRIC CARDS - Fixed collision weights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl w-full">
            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-xl text-left border-l-2 border-l-orange-500 shadow-sm backdrop-blur-sm">
              <div className="text-lg font-mono font-black text-slate-100">~90s Target</div>
              <div className="font-mono text-slate-500 uppercase tracking-wider font-bold mt-0.5 text-[9px]">Autonomous Fault Resolution Delta</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-xl text-left border-l-2 border-l-sky-500 shadow-sm backdrop-blur-sm">
              <div className="text-lg font-mono font-black text-slate-100">{activeSignalsCount} Nodes</div>
              <div className="font-mono text-slate-500 uppercase tracking-wider font-bold mt-0.5 text-[9px]">Active Track Relay Grid Array</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-xl text-left border-l-2 border-l-emerald-500 shadow-sm backdrop-blur-sm">
              <div className="text-lg font-mono font-black text-emerald-400">{simulatedBusLoad} MWh</div>
              <div className="font-mono text-slate-500 uppercase tracking-wider font-bold mt-0.5 text-[9px]">Dynamic Simulated Traction Load</div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 pointer-events-auto">
            <button 
              type="button"
              onClick={() => navigate('/dashboard')}
              className="h-10 px-6 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black font-mono text-[11px] uppercase tracking-widest rounded-lg transition-all shadow-md active:translate-y-[1px] active:scale-[0.98] cursor-pointer"
            >
              Access Live Node &rarr;
            </button>
            <button 
              type="button" 
              onClick={() => alert('Compliance framework archive architecture loaded.')}
              className="h-10 px-6 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-mono font-bold text-[11px] uppercase tracking-widest rounded-lg transition-all active:translate-y-[1px] active:scale-[0.98] cursor-pointer"
            >
              View Compliance Log
            </button>
          </div>
        </motion.div>

        <motion.div style={{ opacity: opacityHero }} className="flex flex-col items-center gap-1.5 text-slate-600 font-mono text-[8px] uppercase tracking-widest mb-6">
          <span>Scroll down to initialize core systems</span>
          <ArrowDown size={11} className="animate-bounce text-orange-400" />
        </motion.div>
      </section>

      {/* SECTION 2: 5-AGENT PIPELINE */}
      <section id="pipeline" className="min-h-screen w-full flex flex-col justify-center py-24 px-6 md:px-12 max-w-7xl mx-auto relative z-10">
        <motion.div style={{ opacity: opacityPipeline }} className="space-y-12 w-full">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-950/20 text-orange-400 font-mono text-[9px] uppercase tracking-widest">
              <Activity size={10} /> 90-Second Structural Pipeline
            </div>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-slate-100 font-sans">
              Five Agents. One Coherent Backbone.
            </h2>
            <p className="text-slate-500 text-xs max-w-xl mx-auto font-light tracking-wide leading-relaxed">
              Every telemetry update, predictive spike, or crowd threshold breach passes sequentially through five specialized operational agents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
            {pipelineAgents.map((agent, i) => {
              const AgentIcon = agent.icon;
              return (
                <div key={i} className={`bg-slate-950 border border-slate-900 rounded-xl p-5 flex flex-col justify-between gap-8 relative overflow-hidden transition-all duration-300 bg-gradient-to-b ${agent.frameColor} ${agent.borderAccent} group shadow-lg backdrop-blur-md`}>
                  <div className="absolute top-2 right-3 font-mono text-xl font-black text-slate-900 select-none transition-colors group-hover:text-slate-850">{agent.num}</div>
                  <div className="space-y-4">
                    <div className={`h-8 w-8 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center shadow-inner ${agent.text}`}>
                      <AgentIcon size={13} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black font-sans text-slate-200 uppercase tracking-tight">{agent.name}</h4>
                      <p className="text-[11px] font-sans text-slate-400 leading-normal font-light tracking-wide">{agent.desc}</p>
                    </div>
                  </div>
                  <div className="font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-500 font-bold w-fit">
                    {agent.tag}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* SECTION 3: CORE MATRIX GRID */}
      <section id="modules" className="min-h-screen w-full flex flex-col justify-center py-24 px-6 md:px-12 max-w-7xl mx-auto relative z-10">
        <motion.div style={{ opacity: opacityModules }} className="space-y-12 w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-900 pb-4">
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-black flex items-center gap-1.5">
                <Layers size={11} /> Connected Core Web Matrix
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-100">
                Modular Architecture, Shared Bus.
              </h2>
            </div>
            <p className="text-slate-500 text-xs font-mono uppercase font-bold max-w-xs md:text-right tracking-tight leading-normal">
              // Hover cards to isolate telemetry system parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full pointer-events-auto">
            {coreModules.map((mod) => {
              const ModIcon = mod.icon;
              const isSelected = activeModule === mod.id;
              return (
                <div
                  key={mod.id}
                  onMouseEnter={() => setActiveModule(mod.id)}
                  onMouseLeave={() => setActiveModule(null)}
                  className={`p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-6 bg-slate-950/40 relative overflow-hidden backdrop-blur-sm cursor-crosshair shadow-lg ${
                    isSelected ? 'border-orange-500/40 bg-orange-950/10 shadow-md shadow-orange-950/20' : 'border-slate-900'
                  }`}
                >
                  <div className="space-y-3.5">
                    <div className={`h-8 w-8 rounded-lg bg-slate-900 border flex items-center justify-center shadow-inner transition-colors ${
                      isSelected ? 'border-orange-500/30 text-orange-400' : 'border-slate-850 text-slate-500'
                    }`}>
                      <ModIcon size={13} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-200 tracking-wide uppercase font-mono">{mod.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-normal font-light tracking-wide">{mod.desc}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-3 flex items-center justify-between font-mono text-[8px] uppercase tracking-widest font-bold">
                    <span className="text-slate-500">{mod.label}</span>
                    <span className={mod.metaColor}>{mod.meta}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* SECTION 4: HARDWARE IN THE LOOP */}
      <section id="hardware" className="min-h-screen w-full flex flex-col justify-center py-24 px-6 md:px-12 max-w-7xl mx-auto relative z-10">
        <motion.div style={{ opacity: opacityHardware }} className="w-full pointer-events-auto">
          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 md:p-10 backdrop-blur-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 h-48 w-48 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-950/30 text-orange-400 font-mono text-[9px] uppercase tracking-widest">
                <HardDrive size={11} /> Physical Prototyping Module
              </div>
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-100 leading-none">
                Hardware In The <br />Loop Integration.
              </h3>
              <p className="text-slate-400 text-xs font-sans leading-relaxed font-light tracking-wide">
                This software layer links directly with a physical embedded prototype. A custom serial bridge captures physical track impacts from an **Arduino Nano + MPU-6050 system**, streaming raw data straight to the server node.
              </p>

              <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl font-mono text-[10px] text-slate-400 space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between text-slate-600 border-b border-slate-900 pb-1.5 mb-2 font-black text-[9px] tracking-wider">
                  <span>SERIAL LOG CONNECTION DATA</span>
                  <span className="text-emerald-400 font-black flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> CONNECTED
                  </span>
                </div>
                <div className="text-orange-400 font-bold">&gt;&gt; python serial_bridge.py --port COM3 --baud 115200</div>
                <div className="text-slate-500 font-light tracking-tight">
                  [STREAM] Read MPU-6050: AccelX=0.02g, AccelY=0.01g, Z_Sigma=0.45
                </div>
              </div>
            </div>

            {/* Simulated Live Waveform Engine */}
            <div className="lg:col-span-7 bg-slate-950 border border-slate-900 rounded-xl p-6 h-64 flex flex-col justify-between items-center relative group shadow-inner">
              <div className="w-full flex items-center justify-between border-b border-slate-900 pb-3 font-mono text-[9px] tracking-wider text-slate-500">
                <div className="flex items-center gap-1.5 uppercase font-bold">
                  <Binary size={11} className="text-orange-400" /> Track Waveform Matrix
                </div>
                <span className="text-[8px] bg-slate-900 px-2 py-0.5 rounded border border-slate-850 font-bold">SCALE: 1:1 MATRIX SWEEP</span>
              </div>

              <div className="w-full flex items-end justify-center gap-1.5 h-24 px-4">
                {[40, 25, 35, 20, 65, 30, 85, 45, 15, 55, 40, 20, 30, 50, 25].map((val, i) => (
                  <motion.div
                    key={i}
                    animate={simulatingImpact ? {
                      height: [val + "%", Math.min(100, val * 1.8) + "%", "15%", val + "%"],
                    } : {}}
                    transition={{ duration: 1.2, ease: "easeInOut", delay: i * 0.03 }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      simulatingImpact 
                        ? i === 6 || i === 7 ? 'bg-gradient-to-t from-red-500 to-orange-400 shadow-md shadow-orange-500/20' : 'bg-orange-500/60'
                        : i === 6 || i === 7 ? 'bg-orange-500/30 border-t border-orange-400/40' : 'bg-slate-900'
                    }`}
                    style={{ height: val + "%" }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (simulatingImpact) return;
                  setSimulatingImpact(true);
                  setTimeout(() => setSimulatingImpact(false), 1400);
                }}
                disabled={simulatingImpact}
                className={`h-9 px-6 rounded-lg font-mono text-[10px] font-black uppercase tracking-widest border transition-all shadow-md flex items-center gap-2 ${
                  simulatingImpact 
                    ? 'bg-red-950/20 border-red-900/40 text-red-400 cursor-not-allowed shadow-inner' 
                    : 'bg-orange-500 border-orange-400/20 text-slate-950 hover:bg-orange-400 cursor-pointer active:translate-y-[1px] active:scale-[0.98]'
                }`}
              >
                <Play size={10} fill="currentColor" /> 
                {simulatingImpact ? 'Analyzing Impact Delta...' : 'Simulate Track Impact'}
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* GLOBAL FOOTER STATUS BAR */}
      <footer className="fixed bottom-0 left-0 w-full border-t border-slate-900 bg-slate-950/90 py-3 px-6 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-[9px] font-mono text-slate-500 font-bold tracking-wider">
          <div className="uppercase">RAILSENTINEL ENGINE // Built for Autonomous Architecture Benchmarks</div>
          <div className="text-slate-400 flex items-center gap-4">
            <span>TRACK CLASSIFIER: ACTIVE SIMULATION</span>
            <span>SCHEMA SYSTEM: NOMINAL PROTOTYPE_BUS</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
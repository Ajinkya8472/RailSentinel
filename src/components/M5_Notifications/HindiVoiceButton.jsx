import React, { memo, useState, useRef, useCallback, useEffect, useId } from 'react';
import { Play, Square, Pause, Volume2, AlertCircle, RefreshCw } from 'lucide-react';
import { 
  speak, 
  stopSpeaking, 
  isSpeechSupported, 
  getLanguageMetadata 
} from '../../utils/hindiVoice.js';

/**
 * VOICE_STATE — Canonical state machine for audio synthesis lifecycle.
 */
const VOICE_STATE = {
  IDLE: 'idle',
  SPEAKING: 'speaking',
  PAUSED: 'paused',
  ERROR: 'error',
};

/**
 * HindiVoiceButton — Operational Audio Telemetry Dispatch Interface.
 * Handles Devanagari payloads, waveform visualizations, and synthesis states.
 */
const HindiVoiceButton = memo(({
  notification = null,
  text = null,
  label = null, // English translation fallback
  autoPlay = false,
  lang = 'hi-IN',
  rate = 0.9,
  pitch = 1,
  volume = 1,
  size = 'md',
  statusLine = 'Last sent to: Maintenance Crew #7 — 2 min ago',
}) => {
  const [voiceState, setVoiceState] = useState(VOICE_STATE.IDLE);
  const [errorMsg, setErrorMsg] = useState(null);
  const btnId = useId();

  // ── Resolve Text Payloads ────────────────────────────────────────────────
  const resolvedText = text || notification?.body || notification?.title || "";
  const langMeta = getLanguageMetadata(lang);

  // ── Handlers ─────────────────────────────────────────────────────────────
  
  /**
   * Orchestrates the speaking sequence using the hindiVoice utility.
   */
  const handleSpeak = useCallback(() => {
    if (!isSpeechSupported()) {
      setVoiceState(VOICE_STATE.ERROR);
      setErrorMsg('Speech synthesis unsupported');
      return;
    }

    if (!resolvedText) {
      setVoiceState(VOICE_STATE.ERROR);
      setErrorMsg('No script available');
      return;
    }

    speak(resolvedText, {
      langCode: lang,
      rate,
      pitch,
      volume,
      onStart: () => setVoiceState(VOICE_STATE.SPEAKING),
      onEnd: () => setVoiceState(VOICE_STATE.IDLE),
      onError: (e) => {
        setVoiceState(VOICE_STATE.ERROR);
        setErrorMsg(e.error || 'Synthesis error');
      }
    });
  }, [resolvedText, lang, rate, pitch, volume]);

  const handleStop = useCallback(() => {
    stopSpeaking();
    setVoiceState(VOICE_STATE.IDLE);
  }, []);

  const handlePauseResume = useCallback(() => {
    if (voiceState === VOICE_STATE.SPEAKING) {
      window.speechSynthesis.pause();
      setVoiceState(VOICE_STATE.PAUSED);
    } else if (voiceState === VOICE_STATE.PAUSED) {
      window.speechSynthesis.resume();
      setVoiceState(VOICE_STATE.SPEAKING);
    }
  }, [voiceState]);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoPlay && resolvedText && isSpeechSupported()) {
      handleSpeak();
    }
    return () => stopSpeaking();
  }, [autoPlay, resolvedText, handleSpeak]);

  // ── Render Helpers ───────────────────────────────────────────────────────
  const isSpeaking = voiceState === VOICE_STATE.SPEAKING;
  const isPaused = voiceState === VOICE_STATE.PAUSED;
  const isError = voiceState === VOICE_STATE.ERROR;

  if (!isSpeechSupported()) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/20 border border-red-900/50 text-red-400 text-xs font-mono">
        <AlertCircle size={14} />
        <span>VOICE ANNOUNCEMENTS UNAVAILABLE IN THIS BROWSER</span>
      </div>
    );
  }

  return (
    <div 
      className="w-full p-5 rounded-2xl bg-[#0D1525] border border-slate-800 text-[#F1F5F9] shadow-xl font-sans"
      role="group"
      aria-label="Hindi voice announcement controls"
    >
      {/* 1. SCRIPT DISPLAY */}
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-bold text-emerald-400 leading-snug">
          {resolvedText}
        </h2>
        {label && (
          <p className="text-sm text-slate-400 font-medium italic">
            {label}
          </p>
        )}
      </div>

      {/* 2. PRIMARY CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-y border-slate-800/60">
        <div className="flex items-center gap-4">
          <button
            id={btnId}
            type="button"
            onClick={isSpeaking || isPaused ? handleStop : handleSpeak}
            className={`h-16 w-16 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg border ${
              isSpeaking || isPaused
                ? 'bg-red-600 border-red-500 hover:bg-red-500'
                : 'bg-blue-600 border-blue-500 hover:bg-blue-500'
            }`}
            aria-label={isSpeaking ? "Stop speech" : "Start speech"}
          >
            {isSpeaking || isPaused ? (
              <Square className="fill-white" size={24} />
            ) : (
              <Play className="fill-white ml-1" size={26} />
            )}
          </button>

          {/* Waveform Visualization */}
          <div className="h-8 flex items-end gap-1 px-2 overflow-hidden">
            {isSpeaking ? (
              [...Array(5)].map((_, i) => (
                <span 
                  key={i} 
                  className="w-1.5 bg-emerald-400 rounded-full animate-waveform"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))
            ) : (
              <Volume2 className="text-slate-700" size={20} />
            )}
          </div>
        </div>

        {/* SECONDARY CONTROLS */}
        <div className="flex gap-3">
          {(isSpeaking || isPaused) && (
            <button
              onClick={handlePauseResume}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
            >
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}
          
          <button
            onClick={handleSpeak}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-xs font-mono font-bold uppercase tracking-wider transition-colors"
          >
            <RefreshCw size={14} />
            <span>Replay</span>
          </button>
        </div>
      </div>

      {/* 3. STATUS FOOTER */}
      <div className="mt-4 flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
        <span className="truncate max-w-[80%]">{statusLine}</span>
        <span className="flex items-center gap-1.5 text-emerald-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {langMeta.code}
        </span>
      </div>

      {/* ERROR DISPLAY */}
      {isError && (
        <div className="mt-4 p-2 bg-red-950/40 border border-red-900/50 rounded text-red-400 text-[10px] font-mono text-center">
          ERROR: {errorMsg}
        </div>
      )}

      {/* INJECTED ANIMATION */}
      <style>{`
        @keyframes waveform {
          0%, 100% { height: 4px; }
          50% { height: 28px; }
        }
        .animate-waveform {
          animation: waveform 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
});

export default HindiVoiceButton;
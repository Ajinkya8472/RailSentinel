// src/App.jsx
import React, { Component, memo, useEffect } from 'react';
import { ShieldAlert, RefreshCw, RotateCcw } from 'lucide-react';
import AppRouter from './routes/index.jsx';
import { bootstrapDemoData } from './mock/bootstrapDemoData.js';
import useWebSocket from './hooks/useWebSocket.js';

import incidentService from './services/incidentService';
import crowdService from './services/crowdService';
import scheduleService from './services/scheduleService';
import riskService from './services/riskService';
import trainService from './services/trainService';
import notificationService from './services/notificationService';

import useIncidentStore from './store/incidentStore';
import useCrowdStore from './store/crowdStore';
import useRiskStore from './store/riskStore';
import useTrainStore from './store/trainStore';

// ---------------------------------------------------------------------------
// Global Premium Style Injection 
// (Internalized so it remains idempotent and safe across hot module reloads)
// ---------------------------------------------------------------------------
const GLOBAL_STYLE_ID = 'rs-app-global-styles';

function injectGlobalStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(GLOBAL_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    /* ── Hard Reset Matrix ───────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      background: #f1f5f9; 
      color: #0f172a;
      overflow-x: hidden;
    }

    /* ── PageLoader Animation ────────────────────────────────────── */
    @keyframes rs-bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40%            { transform: scale(1.0); opacity: 1;   }
    }

    /* ── Smooth Scrollbar Matrix ─────────────────────────────────── */
    ::-webkit-scrollbar       { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #e2e8f0; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* ── Focus Rings ────────────────────────────────────────────── */
    :focus-visible {
      outline: 2px solid #10b981;
      outline-offset: 2px;
      border-radius: 4px;
    }

    /* ── Accessibility Reduced Motion ────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Premium Light-Themed ErrorBoundary Component
// ---------------------------------------------------------------------------
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RailSentinel] Uncaught render error:', error, errorInfo);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (!hasError) {
      return children;
    }

    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-100 font-sans">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-8 shadow-xl flex flex-col items-center text-center gap-5">
          <div className="h-12 w-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shadow-sm animate-pulse">
            <ShieldAlert size={22} />
          </div>

          <div className="space-y-1.5">
            <span className="font-mono text-[9px] font-black uppercase tracking-widest text-slate-400">
              RAILSENTINEL // EXCEPTION ISOLATION
            </span>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              App Shell Render Interrupted
            </h1>
          </div>

          <p className="text-xs text-slate-500 font-light leading-relaxed max-w-sm">
            A state translation conflict occurred inside the presentation container tree. Underlying multi-agent databases and live telemetry streams remain secure.
          </p>

          {import.meta.env.DEV && error && (
            <div className="w-full space-y-1 text-left">
              <span className="font-mono text-[8px] font-bold text-slate-400 uppercase tracking-wider">Exception Trace Logs:</span>
              <pre className="w-full p-3 bg-slate-950 rounded-xl border border-slate-900 font-mono text-[10px] text-red-400 overflow-x-auto max-h-36 shadow-inner">
                {error?.toString()}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2.5 w-full pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-mono text-[10px] uppercase font-bold tracking-widest transition-all border border-slate-900 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={12} /> Hot Recover
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 font-mono text-[10px] uppercase font-bold tracking-widest transition-all border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={12} /> Hard Reload
            </button>
          </div>
        </div>
      </main>
    );
  }
}

// ---------------------------------------------------------------------------
// Root App Component (Clean default-only component module)
// ---------------------------------------------------------------------------
function App() {
  injectGlobalStyles();

  useWebSocket(); // single persistent WS connection across all routes

  useEffect(() => {
    const isMockActive = import.meta.env.VITE_ENABLE_MOCK_DATA === 'true';

    if (isMockActive) {
      console.info('🛰️ [RailSentinel Core]: Seeding mock data engines...');
      bootstrapDemoData();
    } else {
      console.info('📡 [RailSentinel Core]: Mock data bypassed. Fetching initial REST snapshot...');

      (async () => {
        try {
          const trains = await trainService.getLive();
          useTrainStore.getState().setTrains(trains);
        } catch (e) {
          console.error('[Init] Failed to load trains:', e);
        }

        try {
          const incidents = await incidentService.getAll();
          useIncidentStore.getState().setIncidents(incidents);
        } catch (e) {
          console.error('[Init] Failed to load incidents:', e);
        }

        try {
          const forecast = await crowdService.getForecast();
          useCrowdStore.getState().setCrowdForecasts(forecast);
        } catch (e) {
          console.error('[Init] Failed to load crowd forecast:', e);
        }

        try {
          const composite = await riskService.getComposite();
          useRiskStore.getState().setRiskData(composite);
        } catch (e) {
          console.error('[Init] Failed to load risk composite:', e);
        }
      })();
    }

    console.log('API BASE URL:', import.meta.env.VITE_API_BASE_URL);
  }, []);

  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}

export default memo(App);
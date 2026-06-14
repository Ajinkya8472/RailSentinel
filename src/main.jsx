// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';

// ── Leaflet GIS Asset Compatibility Wrapper Cascades ────────────────────────
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

// ── Global Design System Tokens ─────────────────────────────────────────────
import './index.css';
import App from './App.jsx';

// ---------------------------------------------------------------------------
// Root Target Element Guard
// Surfaces an on-brand, premium failure screen directly in the DOM if the 
// mounting target point has been mutated or removed.
// ---------------------------------------------------------------------------
const rootElement = document.getElementById('root');

if (!rootElement) {
  const message =
    '[RailSentinel] Mount failed: no element with id="root" found in the ' +
    'document. Verify that public/index.html contains ' +
    '<div id="root"></div> and has not been modified.';

  if (import.meta.env.DEV) {
    // Structural Light-Themed HUD Injection for Initial Workspace Failures
    document.body.innerHTML = `
      <main style="
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:100vh;background:#f1f5f9;
        color:#0f172a;font-family:system-ui,-apple-system,sans-serif;padding:2rem;
        text-align:center;gap:1.5rem;">
        
        <div style="
          background:#fff;border:1px solid #e2e8f0;padding:2.5rem;
          border-radius:16px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);
          max-w:38rem;width:100%;display:flex;flex-direction:column;align-items:center;gap:1.25rem;">
          
          <div style="
            height:3rem;width:3rem;background:#fef2f2;border:1px solid #fee2e2;
            border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ef4444;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          
          <div style="display:flex;flex-direction:column;gap:0.35rem;">
            <span style="font-family:monospace;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;">
              System Crash // Initializer Error
            </span>
            <h1 style="margin:0;font-size:1.25rem;font-weight:900;letter-spacing:-0.025em;text-transform:uppercase;">
              Root Mount Anchor Point Missing
            </h1>
          </div>
          
          <p style="margin:0;font-size:12px;color:#64748b;font-weight:300;line-height:1.6;max-w:28rem;">
            The core engine could not bind to the document body. Ensure your target distribution index contains a valid structural root division token.
          </p>
          
          <pre style="
            background:#0f172a;padding:1rem;border-radius:12px;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);
            font-family:monospace;font-size:11px;max-w:100%;white-space:pre-wrap;
            color:#f87171;text-align:left;line-height:1.5;margin:0;border:1px solid #1e293b;">${message}</pre>
        </div>
      </main>`;
  }

  console.error(message);
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Concurrent Root Initialization
// ---------------------------------------------------------------------------
const root = ReactDOM.createRoot(rootElement);

// Mount with full strict rules enabled
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ---------------------------------------------------------------------------
// Dev Compilation Metrics Console Output
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
  console.info(
    '%cRailSentinel%c dev core ready',
    'color:#10b981;font-weight:900;font-size:1.15em;text-transform:uppercase;font-family:monospace;',
    'color:#64748b;font-size:0.95em;',
  );
  console.info(
    'Mode Matrix:', import.meta.env.MODE,
    '| Base Path:', import.meta.env.BASE_URL,
    '| Routing Hub API:', import.meta.env.VITE_API_BASE_URL ?? '(active default fallback mock dynamic bus)',
  );
}
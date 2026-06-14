/**
 * vite.config.js
 * 
 * Purpose:
 * Canonical Vite configuration for the RailSentinel React application.
 * Configures the build pipeline, React plugin, environment variable parsing,
 * and essential path aliases (e.g., '@' pointing to 'src') to keep cross-module
 * imports clean and resilient to refactoring.
 * 
 * Dependencies:
 * - @vitejs/plugin-react
 * - path (Node.js native)
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // React plugin for fast refresh, JSX transformation, and Babel integration
  plugins: [react()],
  
  // Path Aliases to support absolute imports (e.g., import { ... } from '@/constants/statuses')
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Local Development Server defaults
  server: {
    port: 3000,
    strictPort: false,
    host: true, // Listen on all local IPs for external device testing
  },

  // Production Build Optimization
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'esnext',
    chunkSizeWarningLimit: 1000, // Slightly elevated to account for heavy telemetry/charting libraries
  },
});

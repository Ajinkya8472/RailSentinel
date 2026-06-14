/**
 * tailwind.config.js
 *
 * Purpose:
 * Canonical Tailwind CSS configuration for RailSentinel. Integrates the strict
 * JS-based design token system (from `src/design/colors.js`) directly into
 * the Tailwind theme, ensuring utility classes (e.g., `bg-surface-shell` or 
 * `text-brand-primary`) perfectly match our programmatic chart/canvas colors.
 *
 * Dependencies:
 * - `src/design/colors.js` (Canonical token source)
 */

import colors from './src/design/colors.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./public/**/*.html"
  ],
  theme: {
    extend: {
      // -----------------------------------------------------------------------
      // Color Token Integration
      // -----------------------------------------------------------------------
      colors: {
        brand: colors.BRAND,
        semantic: colors.SEMANTIC,
        surface: colors.SURFACE,
        text: colors.TEXT,
        border: colors.BORDER,
        risk: colors.RISK,
        status: colors.STATUS,
        overlay: colors.OVERLAY,
        zone: colors.ZONE
      },
      
      // -----------------------------------------------------------------------
      // Typography
      // -----------------------------------------------------------------------
      fontFamily: {
        // Main application font optimized for high-density dashboards
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Used for telemetry data, logs, and train numbers
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      // -----------------------------------------------------------------------
      // Shadows & Elevation (Dark-mode optimized)
      // -----------------------------------------------------------------------
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
        'glow-brand': '0 0 15px -3px rgba(59, 130, 246, 0.4)',
        'glow-critical': '0 0 15px -3px rgba(239, 68, 68, 0.4)',
      },

      // -----------------------------------------------------------------------
      // Micro-animations & Transitions
      // -----------------------------------------------------------------------
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}

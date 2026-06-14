import React, { memo } from 'react';

/**
 * Purpose:
 * ChatQuickActions — contextual one-tap prompt shortcuts for the RailSentinel
 * Chat Assistant. Renders a horizontal scrollable row of quick-action chips
 * that inject pre-formatted prompt text into the chat input on click.
 *
 * Actions are context-aware:
 *   - Default actions: always visible
 *   - Context actions: visible when an entity reference is attached
 *     (entityType determines which quick actions to show)
 *   - Module actions: caller can supply custom action sets per active module
 *
 * This component does NOT own or resolve entity data.
 * It only uses `entityType` to determine which prompts to surface.
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `onAction`       (fn)         — called with prompt string on chip click (required)
 * - `entityType`     (string|null) — current attached entity type (default: null)
 * - `activeModule`   (string|null) — from uiStore.activeModule (default: null)
 * - `customActions`  (object[])   — [{ label, prompt, icon? }] (default: [])
 * - `compact`        (boolean)    (default: false)
 * - `disabled`       (boolean)    (default: false)
 *
 * State: none — pure display.
 */

// ---------------------------------------------------------------------------
// Action definitions
// ---------------------------------------------------------------------------

const DEFAULT_ACTIONS = [
  { id: 'summary',   label: 'Summary',           icon: '📋', prompt: 'Give me a system status summary.' },
  { id: 'alerts',    label: 'Active Alerts',      icon: '🚨', prompt: 'What are the current active alerts?' },
  { id: 'delay',     label: 'Delay Analysis',     icon: '⏱',  prompt: 'Analyse current train delays and their causes.' },
  { id: 'crowd',     label: 'Crowd Status',       icon: '👥', prompt: 'What is the crowd status across stations?' },
  { id: 'energy',    label: 'Energy Overview',    icon: '⚡', prompt: 'Summarise energy consumption and savings.' },
  { id: 'recommend', label: 'Recommendations',    icon: '💡', prompt: 'What are the top operational recommendations?' },
];

const ENTITY_ACTIONS = {
  incident: [
    { id: 'inc-summary',  label: 'Incident Summary',   icon: '🚨', prompt: 'Summarise this incident and its impact.' },
    { id: 'inc-resolve',  label: 'Resolution Steps',   icon: '✓',  prompt: 'What are the recommended resolution steps for this incident?' },
    { id: 'inc-impact',   label: 'Impact Analysis',    icon: '📊', prompt: 'Analyse the operational impact of this incident.' },
  ],
  train: [
    { id: 'trn-status',  label: 'Train Status',   icon: '🚆', prompt: 'What is the current status of this train?' },
    { id: 'trn-delay',   label: 'Delay Reason',   icon: '⏱',  prompt: 'Explain the delay for this train.' },
    { id: 'trn-energy',  label: 'Energy Usage',   icon: '⚡', prompt: 'Summarise energy usage for this train.' },
  ],
  crowdForecast: [
    { id: 'crowd-hot',   label: 'Hotspots',        icon: '👥', prompt: 'Identify crowd hotspots and recommended actions.' },
    { id: 'crowd-surge', label: 'Surge Risk',      icon: '⚠',  prompt: 'Assess crowd surge risk for the next hour.' },
  ],
  riskScore: [
    { id: 'risk-explain', label: 'Explain Risk',   icon: '⚠',  prompt: 'Explain this risk score and its key drivers.' },
    { id: 'risk-action',  label: 'Mitigations',    icon: '🛡',  prompt: 'What mitigations are recommended for this risk?' },
  ],
  energyProfile: [
    { id: 'nrg-opt',   label: 'Optimisations',     icon: '⚡', prompt: 'List energy optimisation recommendations for this profile.' },
    { id: 'nrg-trend', label: 'Trend Analysis',    icon: '📈', prompt: 'Analyse the energy trend for this profile.' },
  ],
  scheduleConflict: [
    { id: 'sched-resolve', label: 'Resolve Conflict', icon: '📅', prompt: 'How can this schedule conflict be resolved?' },
    { id: 'sched-impact',  label: 'Conflict Impact',  icon: '📊', prompt: 'What is the impact of this scheduling conflict?' },
  ],
  sensorReading: [
    { id: 'sensor-diagnose', label: 'Diagnose',    icon: '📡', prompt: 'Diagnose the anomaly in this sensor reading.' },
  ],
  notification: [
    { id: 'notif-audience', label: 'Audience',     icon: '🔔', prompt: 'Who should receive this notification and through which channel?' },
  ],
};

const MODULE_ACTIONS = {
  incidents:     [{ id: 'mod-inc-triage', label: 'Triage Queue', icon: '📋', prompt: 'Show me the incident triage priority order.' }],
  trains:        [{ id: 'mod-trn-sched',  label: 'Schedule',     icon: '📅', prompt: 'Summarise the current train schedule status.' }],
  crowd:         [{ id: 'mod-crowd-fcst', label: 'Forecast',     icon: '👥', prompt: 'What does the crowd forecast look like for the next 2 hours?' }],
  risk:          [{ id: 'mod-risk-posture',label: 'Posture',     icon: '⚠',  prompt: 'What is the current overall risk posture?' }],
  energy:        [{ id: 'mod-nrg-save',   label: 'Savings',      icon: '⚡', prompt: 'How much energy savings can we achieve today?' }],
  schedule:      [{ id: 'mod-sched-conf', label: 'Conflicts',    icon: '📅', prompt: 'List unresolved schedule conflicts.' }],
  notifications: [{ id: 'mod-notif-pend', label: 'Pending',      icon: '🔔', prompt: 'What notifications are pending delivery?' }],
  sensors:       [{ id: 'mod-sens-pred',  label: 'Predictions',  icon: '📡', prompt: 'What are the current failure predictions from sensors?' }],
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ChatQuickActions({
  onAction      = () => {},
  entityType    = null,
  activeModule  = null,
  customActions = [],
  compact       = false,
  disabled      = false,
}) {
  const entityActions  = (entityType ? ENTITY_ACTIONS[entityType] : null) ?? [];
  const moduleActions  = (activeModule ? MODULE_ACTIONS[activeModule] : null) ?? [];

  // Priority: customActions > entityActions > moduleActions > defaultActions
  const allActions = [
    ...customActions,
    ...entityActions,
    ...moduleActions,
    ...DEFAULT_ACTIONS.filter((da) => !customActions.some((ca) => ca.id === da.id)),
  ];

  if (allActions.length === 0) return null;

  return (
    <div
      className={[
        'chat-quick-actions',
        compact  ? 'chat-quick-actions--compact'  : null,
        disabled ? 'chat-quick-actions--disabled' : null,
      ].filter(Boolean).join(' ')}
      role="group"
      aria-label="Quick action prompts"
    >
      <div className="chat-quick-actions__scroll" role="list">
        {allActions.map((action) => (
          <button
            key={action.id ?? action.label}
            type="button"
            id={`chat-qa-${action.id ?? action.label?.replace(/\s+/g, '-').toLowerCase()}`}
            className="chat-quick-actions__chip"
            role="listitem"
            disabled={disabled}
            aria-label={`Quick action: ${action.label}`}
            onClick={() => !disabled && onAction(action.prompt)}
            title={action.prompt}
          >
            {action.icon && <span className="chat-quick-actions__icon" aria-hidden="true">{action.icon}</span>}
            <span className="chat-quick-actions__label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

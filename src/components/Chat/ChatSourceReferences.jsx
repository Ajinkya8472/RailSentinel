import React, { memo } from 'react';

/**
 * Purpose:
 * ChatSourceReferences — entity reference citation panel for the RailSentinel
 * Chat Assistant. Renders the structured list of entity references cited by
 * the most recent or selected assistant message.
 *
 * Architecture rule:
 *   This component renders entity TYPE + ID reference chips ONLY.
 *   It does NOT resolve, fetch, or own any entity data.
 *   Caller passes `{ entityType, entityId, label, description? }[]`.
 *   Clicking a chip fires `onReferenceClick({ entityType, entityId })`.
 *   The caller is responsible for routing that click to the appropriate module.
 *
 * Supported entity types: incident, train, crowdForecast, riskScore,
 * notification, scheduleConflict, energyProfile, sensorReading.
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `references`         (object[])  — [{ entityType, entityId, label, description }] (default: [])
 * - `title`              (string)    (default: 'Sources')
 * - `compact`            (boolean)   (default: false)
 * - `onReferenceClick`   (fn|null)   — called with { entityType, entityId }
 *
 * State: none — pure display.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ENTITY_CONFIG = {
  incident:         { label: 'Incident',         icon: '🚨', cssModifier: 'incident'          },
  train:            { label: 'Train',             icon: '🚆', cssModifier: 'train'             },
  crowdForecast:    { label: 'Crowd Forecast',    icon: '👥', cssModifier: 'crowd-forecast'    },
  riskScore:        { label: 'Risk Score',        icon: '⚠',  cssModifier: 'risk-score'        },
  notification:     { label: 'Notification',      icon: '🔔', cssModifier: 'notification'      },
  scheduleConflict: { label: 'Schedule Conflict', icon: '📅', cssModifier: 'schedule-conflict' },
  energyProfile:    { label: 'Energy Profile',    icon: '⚡', cssModifier: 'energy-profile'    },
  sensorReading:    { label: 'Sensor Reading',    icon: '📡', cssModifier: 'sensor-reading'    },
};

function entityCfg(type) {
  return ENTITY_CONFIG[type] ?? { label: String(type ?? 'Reference'), icon: '·', cssModifier: 'generic' };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ChatSourceReferences({
  references       = [],
  title            = 'Sources',
  compact          = false,
  onReferenceClick = null,
}) {
  if (references.length === 0) return null;

  const isInteractive = typeof onReferenceClick === 'function';

  return (
    <aside
      className={[
        'chat-source-references',
        compact ? 'chat-source-references--compact' : null,
      ].filter(Boolean).join(' ')}
      aria-label={title}
    >
      {!compact && (
        <div className="chat-source-references__title">{title} ({references.length})</div>
      )}

      <ol className="chat-source-references__list" role="list">
        {references.map((ref, idx) => {
          const cfg   = entityCfg(ref.entityType);
          const label = ref.label ?? `${cfg.label} ${ref.entityId ?? idx + 1}`;

          const inner = (
            <>
              <span className="chat-source-references__icon" aria-hidden="true">{cfg.icon}</span>
              <span className="chat-source-references__type">{cfg.label}</span>
              <span className="chat-source-references__label">{label}</span>
              {!compact && ref.description && (
                <span className="chat-source-references__description">{ref.description}</span>
              )}
            </>
          );

          return (
            <li key={idx}
              className={`chat-source-references__item chat-source-references__item--${cfg.cssModifier}`}
              role="listitem">
              {isInteractive ? (
                <button
                  type="button"
                  className="chat-source-references__btn"
                  aria-label={`View ${label}`}
                  onClick={() => onReferenceClick({ entityType: ref.entityType, entityId: ref.entityId })}
                >
                  <span className="chat-source-references__index" aria-hidden="true">{idx + 1}</span>
                  {inner}
                </button>
              ) : (
                <div className="chat-source-references__static">
                  <span className="chat-source-references__index" aria-hidden="true">{idx + 1}</span>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
});

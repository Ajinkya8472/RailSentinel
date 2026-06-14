import React, { memo } from 'react';
import useUiStore from '../../store/uiStore';

/**
 * Purpose:
 * ChatContextPanel — operational context sidebar for the RailSentinel Chat
 * Assistant. Reads the current selected entity reference and active module
 * from uiStore to display the conversation context.
 *
 * Architecture rules:
 *   - Reads uiStore selectors ONLY: `selectedEntityType`, `selectedEntityId`,
 *     `activePage`, `activeModule`, per-domain selected IDs.
 *   - Does NOT resolve or own entity data for any domain.
 *   - Renders entity references as labels/chips only.
 *   - "Attach to Chat" button fires the `onAttachContext` callback with
 *     `{ entityType, entityId }` — the caller decides what to do.
 *   - "Clear Context" button fires `onClearContext`.
 *
 * Context sections:
 *   1. Active Module    — current module name from uiStore.activeModule
 *   2. Active Page      — uiStore.activePage
 *   3. Selected Entity  — type + id chip from uiStore.selectedEntityType/Id
 *   4. Domain References — all per-domain selectedXxxId fields as chips
 *   5. Actions          — Attach to Chat / Clear Context
 *
 * Dependencies:
 * - React (memo)
 * - `src/store/uiStore` (read-only selectors)
 *
 * Props:
 * - `onAttachContext`  (fn|null) — called with { entityType, entityId } (default: null)
 * - `onClearContext`   (fn|null) — clears attached context (default: null)
 * - `attachedContext`  (object|null) — currently attached { entityType, entityId } (default: null)
 * - `compact`          (boolean) (default: false)
 * - `title`            (string)  (default: 'Context')
 *
 * State: none local — all from uiStore.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DOMAIN_REFS = [
  { key: 'selectedIncidentId',         entityType: 'incident',         icon: '🚨', label: 'Incident'          },
  { key: 'selectedTrainId',            entityType: 'train',            icon: '🚆', label: 'Train'             },
  { key: 'selectedCrowdForecastId',    entityType: 'crowdForecast',    icon: '👥', label: 'Crowd Forecast'    },
  { key: 'selectedRiskScoreId',        entityType: 'riskScore',        icon: '⚠',  label: 'Risk Score'        },
  { key: 'selectedNotificationId',     entityType: 'notification',     icon: '🔔', label: 'Notification'      },
  { key: 'selectedScheduleConflictId', entityType: 'scheduleConflict', icon: '📅', label: 'Schedule Conflict' },
  { key: 'selectedEnergyProfileId',    entityType: 'energyProfile',    icon: '⚡', label: 'Energy Profile'    },
  { key: 'selectedSensorReadingId',    entityType: 'sensorReading',    icon: '📡', label: 'Sensor Reading'    },
];

const MODULE_LABELS = {
  dashboard:     '📊 Dashboard',
  incidents:     '🚨 Incidents',
  trains:        '🚆 Trains',
  crowd:         '👥 Crowd Intel',
  sensors:       '📡 Sensors',
  notifications: '🔔 Notifications',
  schedule:      '📅 Scheduling',
  energy:        '⚡ Energy',
  risk:          '⚠ Risk Intel',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EntityChip({ icon, label, entityId, entityType, isAttached, onAttach }) {
  return (
    <div
      className={[
        'chat-context-panel__entity-chip',
        `chat-context-panel__entity-chip--${String(entityType ?? '').toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`,
        isAttached ? 'chat-context-panel__entity-chip--attached' : null,
      ].filter(Boolean).join(' ')}
      aria-label={`${label}: ${entityId}`}
    >
      <span className="chat-context-panel__chip-icon" aria-hidden="true">{icon}</span>
      <div className="chat-context-panel__chip-body">
        <span className="chat-context-panel__chip-type">{label}</span>
        <span className="chat-context-panel__chip-id" title={entityId}>{entityId}</span>
      </div>
      {isAttached && (
        <span className="chat-context-panel__chip-attached" aria-label="Attached to chat">✓</span>
      )}
      {!isAttached && typeof onAttach === 'function' && (
        <button type="button" className="chat-context-panel__chip-attach"
          aria-label={`Attach ${label} ${entityId} to chat`}
          onClick={() => onAttach({ entityType, entityId })}>
          ＋
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ChatContextPanel({
  onAttachContext = null,
  onClearContext  = null,
  attachedContext = null,
  compact         = false,
  title           = 'Context',
}) {
  // ── Store reads (read-only) ─────────────────────────────────────────────
  const activeModule      = useUiStore((s) => s.activeModule);
  const activePage        = useUiStore((s) => s.activePage);
  const selectedEntityType = useUiStore((s) => s.selectedEntityType);
  const selectedEntityId   = useUiStore((s) => s.selectedEntityId);

  // Per-domain selected IDs
  const domainSelections = useUiStore((s) => ({
    selectedIncidentId:         s.selectedIncidentId,
    selectedTrainId:            s.selectedTrainId,
    selectedCrowdForecastId:    s.selectedCrowdForecastId,
    selectedRiskScoreId:        s.selectedRiskScoreId,
    selectedNotificationId:     s.selectedNotificationId,
    selectedScheduleConflictId: s.selectedScheduleConflictId,
    selectedEnergyProfileId:    s.selectedEnergyProfileId,
    selectedSensorReadingId:    s.selectedSensorReadingId,
  }));

  const activeDomainRefs = DOMAIN_REFS.filter((d) => Boolean(domainSelections[d.key]));

  const isAttached = (entityType, entityId) =>
    attachedContext?.entityType === entityType && attachedContext?.entityId === entityId;

  const hasContext = activeDomainRefs.length > 0 || Boolean(selectedEntityId);

  return (
    <aside
      className={[
        'chat-context-panel',
        compact ? 'chat-context-panel--compact' : null,
        hasContext ? 'chat-context-panel--has-context' : 'chat-context-panel--empty',
      ].filter(Boolean).join(' ')}
      aria-label={title}
    >
      {/* Title */}
      <div className="chat-context-panel__title">{title}</div>

      {/* Active module */}
      {activeModule && (
        <section className="chat-context-panel__section" aria-label="Active Module">
          {!compact && <h4 className="chat-context-panel__section-title">Module</h4>}
          <div className="chat-context-panel__module-pill">
            {MODULE_LABELS[activeModule] ?? activeModule}
          </div>
        </section>
      )}

      {/* Active page */}
      {!compact && activePage && activePage !== activeModule && (
        <section className="chat-context-panel__section" aria-label="Active Page">
          <h4 className="chat-context-panel__section-title">Page</h4>
          <div className="chat-context-panel__page-label">{activePage}</div>
        </section>
      )}

      {/* Primary selected entity */}
      {selectedEntityId && selectedEntityType && (
        <section className="chat-context-panel__section" aria-label="Selected Entity">
          {!compact && <h4 className="chat-context-panel__section-title">Selected</h4>}
          <EntityChip
            icon={(DOMAIN_REFS.find((d) => d.entityType === selectedEntityType)?.icon) ?? '·'}
            label={(DOMAIN_REFS.find((d) => d.entityType === selectedEntityType)?.label) ?? selectedEntityType}
            entityId={selectedEntityId}
            entityType={selectedEntityType}
            isAttached={isAttached(selectedEntityType, selectedEntityId)}
            onAttach={onAttachContext}
          />
        </section>
      )}

      {/* All domain references */}
      {activeDomainRefs.length > 0 && (
        <section className="chat-context-panel__section" aria-label="Domain References">
          {!compact && <h4 className="chat-context-panel__section-title">References</h4>}
          <div className="chat-context-panel__ref-list">
            {activeDomainRefs.map((d) => {
              const entityId = domainSelections[d.key];
              if (!entityId || (d.entityType === selectedEntityType && entityId === selectedEntityId)) return null;
              return (
                <EntityChip
                  key={d.key}
                  icon={d.icon}
                  label={d.label}
                  entityId={entityId}
                  entityType={d.entityType}
                  isAttached={isAttached(d.entityType, entityId)}
                  onAttach={onAttachContext}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* No context state */}
      {!hasContext && (
        <div className="chat-context-panel__no-context" role="note">
          <span className="chat-context-panel__no-context-icon" aria-hidden="true">🔍</span>
          <span>Select an entity from any module to attach it as context.</span>
        </div>
      )}

      {/* Actions */}
      {(attachedContext || hasContext) && (
        <div className="chat-context-panel__actions">
          {attachedContext && typeof onClearContext === 'function' && (
            <button type="button" className="chat-context-panel__clear-btn"
              aria-label="Clear attached context"
              onClick={onClearContext}>
              ✕ Clear Context
            </button>
          )}
        </div>
      )}
    </aside>
  );
});

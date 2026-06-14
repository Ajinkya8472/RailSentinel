import React, { memo } from 'react';

/**
 * Purpose:
 * ChatSuggestionPanel — AI-generated follow-up suggestion chips for the
 * RailSentinel Chat Assistant. Renders `suggestions[]` surfaced by the
 * assistant response as quick-tap prompts the operator can send immediately.
 *
 * Suggestions are purely text strings (or { label, prompt } objects).
 * This component owns no domain data and makes no store reads.
 * Clicking a chip fires `onSuggest(promptText)` for the caller to inject
 * into the input or send directly.
 *
 * Variants:
 *   - 'chips'  (default) — horizontal scrollable chip row
 *   - 'list'             — vertical bullet list (better for long suggestions)
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `suggestions`    (string[]|object[]) — suggestion strings or { label, prompt } (default: [])
 * - `onSuggest`      (fn)               — called with prompt string on click (required)
 * - `title`          (string|null)       (default: 'Suggested follow-ups')
 * - `variant`        ('chips'|'list')   (default: 'chips')
 * - `compact`        (boolean)          (default: false)
 * - `disabled`       (boolean)          (default: false)
 * - `maxVisible`     (number)           (default: 6)
 *
 * State: none — pure display.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseSuggestion(s, idx) {
  if (typeof s === 'string') return { label: s, prompt: s, id: `sug-${idx}` };
  return { label: s.label ?? s.prompt, prompt: s.prompt ?? s.label, id: s.id ?? `sug-${idx}` };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ChatSuggestionPanel({
  suggestions = [],
  onSuggest   = () => {},
  title       = 'Suggested follow-ups',
  variant     = 'chips',
  compact     = false,
  disabled    = false,
  maxVisible  = 6,
}) {
  if (suggestions.length === 0) return null;

  const normalised = suggestions.slice(0, maxVisible).map(normaliseSuggestion);

  return (
    <div
      className={[
        'chat-suggestion-panel',
        `chat-suggestion-panel--${variant}`,
        compact  ? 'chat-suggestion-panel--compact'  : null,
        disabled ? 'chat-suggestion-panel--disabled' : null,
      ].filter(Boolean).join(' ')}
      aria-label={title ?? 'Suggestions'}
      role="group"
    >
      {!compact && title && (
        <div className="chat-suggestion-panel__title" aria-hidden="true">{title}</div>
      )}

      {variant === 'chips' ? (
        <div className="chat-suggestion-panel__chips" role="list">
          {normalised.map((sug) => (
            <button
              key={sug.id}
              type="button"
              id={sug.id}
              className="chat-suggestion-panel__chip"
              role="listitem"
              disabled={disabled}
              aria-label={`Follow-up: ${sug.label}`}
              onClick={() => !disabled && onSuggest(sug.prompt)}
              title={sug.prompt !== sug.label ? sug.prompt : undefined}
            >
              <span className="chat-suggestion-panel__chip-icon" aria-hidden="true">→</span>
              {sug.label}
            </button>
          ))}
        </div>
      ) : (
        <ol className="chat-suggestion-panel__list" role="list">
          {normalised.map((sug, idx) => (
            <li key={sug.id} className="chat-suggestion-panel__list-item" role="listitem">
              <button
                type="button"
                id={sug.id}
                className="chat-suggestion-panel__list-btn"
                disabled={disabled}
                aria-label={`Follow-up: ${sug.label}`}
                onClick={() => !disabled && onSuggest(sug.prompt)}
              >
                <span className="chat-suggestion-panel__list-index" aria-hidden="true">{idx + 1}.</span>
                {sug.label}
              </button>
            </li>
          ))}
        </ol>
      )}

      {suggestions.length > maxVisible && (
        <div className="chat-suggestion-panel__overflow" role="note">
          +{suggestions.length - maxVisible} more suggestions
        </div>
      )}
    </div>
  );
});

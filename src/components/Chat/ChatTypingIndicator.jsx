import React, { memo } from 'react';

/**
 * Purpose:
 * ChatTypingIndicator — animated "assistant is typing" indicator for the
 * RailSentinel Chat Assistant. Shows three pulsing dots when the assistant
 * is generating a response.
 *
 * Designed to be inserted at the bottom of ChatMessageList during streaming
 * or async response generation. Animates continuously via CSS keyframes
 * (no JS timers). Disappears completely when `isTyping` is false.
 *
 * Dependencies:
 * - React (memo)
 *
 * Props:
 * - `isTyping`  (boolean)       — show / hide indicator (default: false)
 * - `label`     (string)        — screen-reader label (default: 'RailSentinel is responding…')
 * - `size`      ('sm'|'md'|'lg') (default: 'md')
 * - `className` (string|null)   (default: null)
 *
 * State: none — pure CSS animation.
 */
export default memo(function ChatTypingIndicator({
  isTyping  = false,
  label     = 'RailSentinel is responding…',
  size      = 'md',
  className = null,
}) {
  if (!isTyping) return null;

  return (
    <div
      className={[
        'chat-typing-indicator',
        `chat-typing-indicator--${size}`,
        className,
      ].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Three animated dots */}
      <span className="chat-typing-indicator__bubble" aria-hidden="true">
        <span className="chat-typing-indicator__dot chat-typing-indicator__dot--1" />
        <span className="chat-typing-indicator__dot chat-typing-indicator__dot--2" />
        <span className="chat-typing-indicator__dot chat-typing-indicator__dot--3" />
      </span>
      <span className="chat-typing-indicator__label">{label}</span>
    </div>
  );
});

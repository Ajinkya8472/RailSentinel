import React, { memo, useState } from 'react';

/**
 * Purpose:
 * ChatConversationHistory — conversation session list sidebar for the
 * RailSentinel Chat Assistant. Displays past and current conversation
 * sessions so the operator can switch between them or start a new one.
 *
 * A "conversation session" is a lightweight metadata object:
 *   { id, title, lastMessage, lastMessageAt, messageCount, isActive }
 *
 * This component owns NO domain entity data and makes NO store reads.
 * All data is passed via props. Callbacks:
 *   - `onSelectConversation(id)` — switch to conversation
 *   - `onNewConversation()`      — create new session
 *   - `onDeleteConversation(id)` — delete a session
 *   - `onRenameConversation(id, newTitle)` — rename (inline edit)
 *
 * Features:
 *   1. Active conversation highlighted
 *   2. Session list with last message preview and timestamp
 *   3. Inline rename (double-click title)
 *   4. Delete confirmation via single delete button (no modal)
 *   5. New Conversation button (top)
 *   6. Search/filter by session title
 *
 * Dependencies:
 * - React (memo, useState)
 *
 * Props:
 * - `conversations`           (object[])  — session array (default: [])
 * - `activeConversationId`    (string|null) (default: null)
 * - `loading`                 (boolean)   (default: false)
 * - `compact`                 (boolean)   (default: false)
 * - `onSelectConversation`    (fn|null)   — (id) => void
 * - `onNewConversation`       (fn|null)   — () => void
 * - `onDeleteConversation`    (fn|null)   — (id) => void
 * - `onRenameConversation`    (fn|null)   — (id, newTitle) => void
 *
 * State:
 * - `searchQuery`   — session filter text
 * - `renamingId`    — id of session being renamed
 * - `renameValue`   — current rename input value
 * - `deletingId`    — id pending delete confirmation
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    const mins  = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function ChatConversationHistory({
  conversations           = [],
  activeConversationId    = null,
  loading                 = false,
  compact                 = false,
  onSelectConversation    = null,
  onNewConversation       = null,
  onDeleteConversation    = null,
  onRenameConversation    = null,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId,  setRenamingId]  = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId,  setDeletingId]  = useState(null);

  const filtered = conversations.filter((c) =>
    !searchQuery.trim() ||
    String(c.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(c.lastMessage ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  function startRename(conv) {
    setRenamingId(conv.id);
    setRenameValue(conv.title ?? '');
  }

  function commitRename(id) {
    if (typeof onRenameConversation === 'function' && renameValue.trim()) {
      onRenameConversation(id, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }

  function handleRenameKeyDown(e, id) {
    if (e.key === 'Enter')  { e.preventDefault(); commitRename(id); }
    if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
  }

  function handleDelete(id) {
    if (deletingId === id) {
      if (typeof onDeleteConversation === 'function') onDeleteConversation(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  }

  return (
    <nav
      className={[
        'chat-conversation-history',
        compact ? 'chat-conversation-history--compact' : null,
      ].filter(Boolean).join(' ')}
      aria-label="Conversation history"
    >
      {/* New conversation */}
      {typeof onNewConversation === 'function' && (
        <button
          type="button"
          id="chat-new-conversation-btn"
          className="chat-conversation-history__new-btn"
          aria-label="Start new conversation"
          onClick={onNewConversation}
        >
          <span aria-hidden="true">＋</span>
          {!compact && <span>New Conversation</span>}
        </button>
      )}

      {/* Search */}
      {!compact && conversations.length > 4 && (
        <div className="chat-conversation-history__search">
          <input
            type="search"
            className="chat-conversation-history__search-input"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search conversation history"
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && conversations.length === 0 && (
        <div className="chat-conversation-history__skeleton" aria-label="Loading conversations" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="chat-conversation-history__skeleton-row" aria-hidden="true" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && conversations.length === 0 && (
        <div className="chat-conversation-history__empty" role="status">
          No conversations yet.
        </div>
      )}

      {/* Conversation list */}
      {filtered.length > 0 && (
        <ol className="chat-conversation-history__list" role="list">
          {filtered.map((conv) => {
            const isActive   = conv.id === activeConversationId;
            const isRenaming = renamingId === conv.id;
            const isDeleting = deletingId === conv.id;
            const relTime    = formatRelative(conv.lastMessageAt);

            return (
              <li
                key={conv.id}
                className={[
                  'chat-conversation-history__item',
                  isActive   ? 'chat-conversation-history__item--active'   : null,
                  isDeleting ? 'chat-conversation-history__item--deleting' : null,
                ].filter(Boolean).join(' ')}
                role="listitem"
                aria-current={isActive ? 'true' : undefined}
              >
                {/* Main select area */}
                <button
                  type="button"
                  className="chat-conversation-history__item-btn"
                  aria-label={`Open conversation: ${conv.title ?? 'Untitled'}`}
                  onClick={() => typeof onSelectConversation === 'function' && onSelectConversation(conv.id)}
                  onDoubleClick={() => !compact && startRename(conv)}
                >
                  {/* Title / rename input */}
                  {isRenaming ? (
                    <input
                      className="chat-conversation-history__rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                      onBlur={() => commitRename(conv.id)}
                      autoFocus
                      aria-label="Rename conversation"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="chat-conversation-history__item-title">
                      {conv.title ?? 'Untitled Conversation'}
                    </div>
                  )}

                  {/* Last message preview */}
                  {!compact && !isRenaming && conv.lastMessage && (
                    <div className="chat-conversation-history__item-preview">
                      {String(conv.lastMessage).slice(0, 60)}
                      {conv.lastMessage.length > 60 ? '…' : ''}
                    </div>
                  )}

                  {/* Meta row */}
                  {!compact && !isRenaming && (
                    <div className="chat-conversation-history__item-meta">
                      {relTime && <span className="chat-conversation-history__item-time">{relTime}</span>}
                      {conv.messageCount != null && (
                        <span className="chat-conversation-history__item-count">{conv.messageCount} msgs</span>
                      )}
                    </div>
                  )}
                </button>

                {/* Actions: delete */}
                {typeof onDeleteConversation === 'function' && !compact && (
                  <div className="chat-conversation-history__item-actions">
                    <button
                      type="button"
                      className={`chat-conversation-history__delete-btn ${isDeleting ? 'chat-conversation-history__delete-btn--confirm' : ''}`}
                      aria-label={isDeleting ? 'Confirm delete' : 'Delete conversation'}
                      onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                    >
                      {isDeleting ? '✓ Confirm' : '✕'}
                    </button>
                    {isDeleting && (
                      <button type="button" className="chat-conversation-history__cancel-btn"
                        aria-label="Cancel delete"
                        onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}>
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* No results for search */}
      {filtered.length === 0 && conversations.length > 0 && searchQuery && (
        <div className="chat-conversation-history__no-results" role="status">
          No conversations match "{searchQuery}".
        </div>
      )}
    </nav>
  );
});

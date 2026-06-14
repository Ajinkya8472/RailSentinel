import React, { memo, useMemo } from 'react';

/**
 * Purpose:
 * Canonical audit timeline for RailSentinel. It presents time-ordered operator
 * actions, notifications, state changes, and other auditable events in a clear
 * chronological view for investigation and compliance review.
 *
 * Dependencies:
 * - React only
 * - Approved design-system classes supplied externally
 * - Audit event data supplied by approved domain-model consumers
 *
 * Props:
 * - items: array of audit events
 * - title: timeline heading
 * - loading: indicates live synchronization
 * - empty: indicates no audit records are available
 * - error: indicates a recoverable failure state
 * - success: indicates content is synchronized
 * - onSelectItem: event selection callback
 * - onRetry: optional retry action for error states
 * - className / ...rest: container props
 *
 * State:
 * - Presentation state for loading, empty, error, and success
 * - Derived event normalization for safe chronological rendering
 * - The timeline remains presentational; data ownership stays in upstream stores
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean).map((item, index) => ({
    id: item.id ?? item.key ?? item.eventId ?? `${index}`,
    timestamp: item.timestamp ?? item.at ?? item.time ?? '',
    label: item.label ?? item.title ?? item.action ?? 'Audit event',
    description: item.description ?? item.detail ?? '',
    tone: item.tone ?? 'neutral',
    badge: item.badge ?? item.status ?? null,
    actor: item.actor ?? item.user ?? '',
    meta: item.meta ?? item.type ?? '',
    icon: item.icon ?? null,
    onClick: item.onClick ?? null,
    ariaLabel: item.ariaLabel ?? item.label ?? item.title ?? 'Audit event',
  }));
}

function StateMessage({ tone, title, description, actionLabel, onAction }) {
  return (
    <section className={cx('audit-timeline__state', tone ? `audit-timeline__state--${tone}` : null)} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      <div className="audit-timeline__state-title">{title}</div>
      {description ? <div className="audit-timeline__state-description">{description}</div> : null}
      {actionLabel ? (
        <button type="button" className="audit-timeline__state-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function TimelineItem({ item, onSelectItem }) {
  const content = (
    <>
      <div className="audit-timeline__item-header">
        {item.icon ? (
          <span className="audit-timeline__icon" aria-hidden="true">
            {item.icon}
          </span>
        ) : null}
        <span className="audit-timeline__label">{item.label}</span>
        {item.badge ? <span className={cx('audit-timeline__badge', `audit-timeline__badge--${item.tone}`)}>{item.badge}</span> : null}
      </div>

      <div className="audit-timeline__meta">
        {item.timestamp ? <span className="audit-timeline__timestamp">{item.timestamp}</span> : null}
        {item.actor ? <span className="audit-timeline__actor">{item.actor}</span> : null}
        {item.meta ? <span className="audit-timeline__type">{item.meta}</span> : null}
      </div>

      {item.description ? <div className="audit-timeline__description">{item.description}</div> : null}
    </>
  );

  if (typeof item.onClick === 'function' || typeof onSelectItem === 'function') {
    return (
      <button
        type="button"
        className={cx('audit-timeline__item', `audit-timeline__item--${item.tone}`)}
        onClick={(event) => {
          if (typeof item.onClick === 'function') {
            item.onClick(event, item);
            return;
          }
          onSelectItem?.(item, event);
        }}
        aria-label={item.ariaLabel}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={cx('audit-timeline__item', `audit-timeline__item--${item.tone}`)} aria-label={item.ariaLabel}>
      {content}
    </article>
  );
}

function AuditTimeline({
  items = [],
  title = 'Audit timeline',
  loading = false,
  empty = false,
  error = false,
  success = false,
  onSelectItem,
  onRetry,
  className,
  ...rest
}) {
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const state = loading ? 'loading' : error ? 'error' : empty ? 'empty' : success ? 'success' : 'ready';
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isEmpty = state === 'empty' || (!isLoading && !isError && normalizedItems.length === 0);
  const isSuccess = state === 'success' || state === 'ready';

  return (
    <section
      className={cx(
        'audit-timeline',
        isLoading ? 'audit-timeline--loading' : null,
        isEmpty ? 'audit-timeline--empty' : null,
        isError ? 'audit-timeline--error' : null,
        isSuccess ? 'audit-timeline--success' : null,
        className
      )}
      aria-label={title}
      aria-busy={isLoading || undefined}
      data-state={state}
      {...rest}
    >
      <header className="audit-timeline__header">
        <div className="audit-timeline__title">{title}</div>
        <div className="audit-timeline__subtitle">Chronological record of auditable operational events.</div>
      </header>

      {isLoading ? (
        <StateMessage
          tone="loading"
          title="Loading audit timeline…"
          description="Event history is synchronizing."
        />
      ) : null}

      {isError ? (
        <StateMessage
          tone="error"
          title="Audit timeline unavailable"
          description="The chronological event history could not be loaded."
          actionLabel={typeof onRetry === 'function' ? 'Retry' : null}
          onAction={onRetry}
        />
      ) : null}

      {isEmpty ? (
        <StateMessage
          tone={isSuccess ? 'success' : 'empty'}
          title={isSuccess ? 'No matching audit events' : 'No audit events available'}
          description={
            isSuccess
              ? 'Adjust the current scope or wait for new activity.'
              : 'The current view does not expose any audit records.'
          }
        />
      ) : null}

      {!isLoading && !isError && normalizedItems.length > 0 ? (
        <div className="audit-timeline__list" role="list">
          {normalizedItems.map((item) => (
            <TimelineItem key={item.id} item={item} onSelectItem={onSelectItem} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default memo(AuditTimeline);
export { AuditTimeline };

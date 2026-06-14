import React, { memo, useMemo } from 'react';

/**
 * Purpose:
 * Canonical entity rail for RailSentinel. It surfaces related domain entities,
 * contextual links, and supporting evidence in a compact side-rail pattern for
 * drilldown, comparison, and audit review.
 *
 * Dependencies:
 * - React only
 * - Approved design-system classes supplied externally
 * - Related entity data supplied by approved domain-model consumers
 *
 * Props:
 * - title: rail heading
 * - items: array of related entity objects
 * - loading: indicates live data synchronization
 * - empty: indicates no rail items are available
 * - error: indicates a recoverable failure state
 * - success: indicates content is synchronized
 * - onSelectItem: item selection callback
 * - onRetry: optional retry action for error states
 * - className / ...rest: container props
 *
 * State:
 * - Presentation state for loading, empty, error, and success
 * - Normalized item rendering state for safe accessibility
 * - The rail stays presentational; navigation remains shell/page owned
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean).map((item, index) => ({
    id: item.id ?? item.key ?? item.entityId ?? `${index}`,
    label: item.label ?? item.title ?? item.name ?? 'Entity',
    description: item.description ?? item.detail ?? '',
    tone: item.tone ?? 'neutral',
    badge: item.badge ?? item.status ?? null,
    icon: item.icon ?? null,
    meta: item.meta ?? item.type ?? '',
    onClick: item.onClick ?? null,
    ariaLabel: item.ariaLabel ?? item.label ?? item.title ?? item.name ?? 'Related entity',
  }));
}

function StateMessage({ tone, title, description, actionLabel, onAction }) {
  return (
    <section className={cx('entity-rail__state', tone ? `entity-rail__state--${tone}` : null)} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      <div className="entity-rail__state-title">{title}</div>
      {description ? <div className="entity-rail__state-description">{description}</div> : null}
      {actionLabel ? (
        <button type="button" className="entity-rail__state-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function EntityItem({ item, onSelectItem }) {
  const content = (
    <>
      {item.icon ? (
        <span className="entity-rail__icon" aria-hidden="true">
          {item.icon}
        </span>
      ) : null}
      <span className="entity-rail__text">
        <span className="entity-rail__label">{item.label}</span>
        {item.description ? <span className="entity-rail__description">{item.description}</span> : null}
        {item.meta ? <span className="entity-rail__meta">{item.meta}</span> : null}
      </span>
      {item.badge ? <span className={cx('entity-rail__badge', `entity-rail__badge--${item.tone}`)}>{item.badge}</span> : null}
    </>
  );

  if (typeof item.onClick === 'function' || typeof onSelectItem === 'function') {
    return (
      <button
        type="button"
        className={cx('entity-rail__item', `entity-rail__item--${item.tone}`)}
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
    <article className={cx('entity-rail__item', `entity-rail__item--${item.tone}`)} aria-label={item.ariaLabel}>
      {content}
    </article>
  );
}

function EntityRail({
  title = 'Related context',
  items = [],
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
    <aside
      className={cx(
        'entity-rail',
        isLoading ? 'entity-rail--loading' : null,
        isEmpty ? 'entity-rail--empty' : null,
        isError ? 'entity-rail--error' : null,
        isSuccess ? 'entity-rail--success' : null,
        className
      )}
      aria-label={title}
      aria-busy={isLoading || undefined}
      data-state={state}
      {...rest}
    >
      <header className="entity-rail__header">
        <div className="entity-rail__title">{title}</div>
        <div className="entity-rail__subtitle">Cross-module context and evidence.</div>
      </header>

      {isLoading ? (
        <StateMessage
          tone="loading"
          title="Loading related entities…"
          description="Contextual links are synchronizing."
        />
      ) : null}

      {isError ? (
        <StateMessage
          tone="error"
          title="Related context unavailable"
          description="The entity rail could not load supporting items."
          actionLabel={typeof onRetry === 'function' ? 'Retry' : null}
          onAction={onRetry}
        />
      ) : null}

      {isEmpty ? (
        <StateMessage
          tone={isSuccess ? 'success' : 'empty'}
          title={isSuccess ? 'No related items match the current scope' : 'No related entities available'}
          description={
            isSuccess
              ? 'Adjust the selected entity or wait for more live context.'
              : 'The current view does not expose any supporting records.'
          }
        />
      ) : null}

      {!isLoading && !isError && normalizedItems.length > 0 ? (
        <div className="entity-rail__list">
          {normalizedItems.map((item) => (
            <EntityItem key={item.id} item={item} onSelectItem={onSelectItem} />
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export default memo(EntityRail);
export { EntityRail };

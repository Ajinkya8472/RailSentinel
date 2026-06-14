import React, { memo, useMemo } from 'react';
import { motion } from 'motion/react';

/**
 * Purpose:
 * Canonical KPI strip for RailSentinel. It presents compact, high-priority
 * operational metrics across the dashboard and shell in a consistent summary band.
 *
 * Dependencies:
 * - React only
 * - Approved design-system classes supplied externally
 * - Metric values supplied by approved domain-model consumers and selectors
 *
 * Props:
 * - items: array of KPI objects
 * - title: accessible section title
 * - loading: indicates live data synchronization
 * - empty: indicates no KPI data is available
 * - error: indicates a recoverable failure state
 * - success: indicates content is synchronized
 * - onRetry: optional retry action for error states
 * - className / ...rest: container props
 *
 * State:
 * - Presentation state for loading, empty, error, and success
 * - Derived item normalization for safe rendering
 * - KPI cards remain purely presentational and data-driven
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean).map((item, index) => ({
    id: item.id ?? item.key ?? `${index}`,
    label: item.label ?? item.title ?? 'KPI',
    value: item.value ?? '—',
    detail: item.detail ?? item.description ?? '',
    tone: item.tone ?? 'neutral',
    trend: item.trend ?? null,
    icon: item.icon ?? null,
    onClick: item.onClick ?? null,
    ariaLabel: item.ariaLabel ?? item.label ?? item.title ?? 'KPI item',
  }));
}

function StateMessage({ tone, title, description, actionLabel, onAction }) {
  return (
    <section className={cx('kpi-strip__state', tone ? `kpi-strip__state--${tone}` : null)} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      <div className="kpi-strip__state-title">{title}</div>
      {description ? <div className="kpi-strip__state-description">{description}</div> : null}
      {actionLabel ? (
        <button type="button" className="kpi-strip__state-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function KPICard({ item }) {
  const content = (
    <>
      <div className="kpi-strip__card-head">
        {item.icon ? (
          <span className="kpi-strip__icon" aria-hidden="true">
            {item.icon}
          </span>
        ) : null}
        <span className="kpi-strip__label">{item.label}</span>
      </div>
      <motion.div 
        key={item.value}
        className="kpi-strip__value"
        initial={{ opacity: 0.4, color: '#f8fafc' }}
        animate={{ opacity: 1, color: '' }}
        transition={{ duration: 0.2, ease: "linear" }}
      >
        {item.value}
      </motion.div>
      {item.detail ? <div className="kpi-strip__detail">{item.detail}</div> : null}
      {item.trend ? <div className="kpi-strip__trend">{item.trend}</div> : null}
    </>
  );

  if (typeof item.onClick === 'function') {
    return (
      <button type="button" className={cx('kpi-strip__card', `kpi-strip__card--${item.tone}`)} onClick={item.onClick} aria-label={item.ariaLabel}>
        {content}
      </button>
    );
  }

  return (
    <article className={cx('kpi-strip__card', `kpi-strip__card--${item.tone}`)} aria-label={item.ariaLabel}>
      {content}
    </article>
  );
}

function KPIStrip({
  items = [],
  title = 'Operational KPIs',
  loading = false,
  empty = false,
  error = false,
  success = false,
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
        'kpi-strip',
        isLoading ? 'kpi-strip--loading' : null,
        isEmpty ? 'kpi-strip--empty' : null,
        isError ? 'kpi-strip--error' : null,
        isSuccess ? 'kpi-strip--success' : null,
        className
      )}
      aria-label={title}
      aria-busy={isLoading || undefined}
      data-state={state}
      {...rest}
    >
      <header className="kpi-strip__header">
        <div className="kpi-strip__title">{title}</div>
        <div className="kpi-strip__subtitle">High-priority operational summary.</div>
      </header>

      {isLoading ? (
        <StateMessage
          tone="loading"
          title="Loading KPIs…"
          description="Live operational metrics are synchronizing."
        />
      ) : null}

      {isError ? (
        <StateMessage
          tone="error"
          title="KPI summary unavailable"
          description="The dashboard metrics could not be loaded."
          actionLabel={typeof onRetry === 'function' ? 'Retry' : null}
          onAction={onRetry}
        />
      ) : null}

      {isEmpty ? (
        <StateMessage
          tone={isSuccess ? 'success' : 'empty'}
          title={isSuccess ? 'No KPIs match the current scope' : 'No KPI data available'}
          description={
            isSuccess
              ? 'Adjust filters or wait for the next live update.'
              : 'The current view does not expose any KPI records.'
          }
        />
      ) : null}

      {!isLoading && !isError && normalizedItems.length > 0 ? (
        <div className="kpi-strip__grid">
          {normalizedItems.map((item) => (
            <KPICard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default memo(KPIStrip);
export { KPIStrip };

import React, { memo } from 'react';

/**
 * Purpose:
 * Canonical status badge for RailSentinel. It presents compact, accessible
 * operational state labels for entities, priorities, warnings, acknowledgments,
 * and live system conditions.
 *
 * Dependencies:
 * - React only
 * - Approved design-system classes supplied externally
 * - Status and risk values supplied by approved domain-model consumers
 *
 * Props:
 * - label: visible badge text
 * - tone: semantic tone such as neutral, success, warning, error, info, critical
 * - variant: pill | outline | solid | subtle
 * - size: sm | md | lg
 * - icon: optional leading icon or symbol
 * - title: optional assistive hover title
 * - ariaLabel: explicit accessible label override
 * - live: boolean to mark live-updating status
 * - className / ...rest: container props
 *
 * State:
 * - Pure presentation state derived from props
 * - Live announcement behavior when live is true
 * - Disabled-like appearance may be expressed via tone or className outside
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function StatusBadge({
  label,
  tone = 'neutral',
  variant = 'pill',
  size = 'md',
  icon,
  title,
  ariaLabel,
  live = false,
  className,
  ...rest
}) {
  const text = label ?? '—';
  const accessibleLabel = ariaLabel || (typeof text === 'string' ? text : 'Status');

  return (
    <span
      className={cx(
        'status-badge',
        `status-badge--${tone}`,
        `status-badge--${variant}`,
        `status-badge--${size}`,
        live ? 'status-badge--live' : null,
        className
      )}
      title={title || accessibleLabel}
      aria-label={accessibleLabel}
      aria-live={live ? 'polite' : undefined}
      data-tone={tone}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {icon ? (
        <span className="status-badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="status-badge__label">{text}</span>
    </span>
  );
}

export default memo(StatusBadge);
export { StatusBadge };

import React, { memo } from 'react';

/**
 * Purpose:
 * Canonical loading state for RailSentinel. It provides a reusable accessible
 * loading surface for shells, layouts, panels, and module-level regions.
 *
 * Dependencies:
 * - React only
 * - Approved design-system classes supplied externally
 * - Loading context supplied by approved page, layout, or store consumers
 *
 * Props:
 * - title: primary loading label
 * - description: optional supporting text
 * - size: sm | md | lg
 * - tone: neutral | info | warning | critical
 * - inline: whether the loader should render inline
 * - showSpinner: whether to render the spinner glyph
 * - ariaLabel: accessible label override
 * - className / ...rest: container props
 *
 * State:
 * - Pure presentation state derived from props
 * - Loading is represented through semantic live region markup
 * - No local state is required; the component remains fully declarative
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function LoadingState({
  title = 'Loading…',
  description,
  size = 'md',
  tone = 'neutral',
  inline = false,
  showSpinner = true,
  ariaLabel,
  className,
  ...rest
}) {
  const label = ariaLabel || title;

  return (
    <div
      className={cx(
        'loading-state',
        `loading-state--${size}`,
        `loading-state--${tone}`,
        inline ? 'loading-state--inline' : null,
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
      {...rest}
    >
      {showSpinner ? (
        <span className="loading-state__spinner" aria-hidden="true" />
      ) : null}

      <span className="loading-state__content">
        <span className="loading-state__title">{title}</span>
        {description ? (
          <span className="loading-state__description">{description}</span>
        ) : null}
      </span>
    </div>
  );
}

export default memo(LoadingState);
export { LoadingState };

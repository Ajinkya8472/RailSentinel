import React, { memo, useMemo } from 'react';
import { SplitPanelLayout } from '../../layouts/SplitPanelLayout';
import { DetailLayout } from '../../layouts/DetailLayout';

/**
 * Purpose:
 * NotificationTemplatePanel — template analytics surface for M5. Derives
 * template usage, performance, and localization coverage from the `template`
 * and `locale` fields on Notification entities.
 *
 * Sections:
 *   1. Template Usage Ranking — templates sorted by usage count, showing
 *                              per-template: usage count, delivery success
 *                              rate, priority distribution, locale coverage.
 *   2. Locale Coverage        — locales in use with per-locale counts and
 *                              delivery success rates.
 *   3. Template Detail        — when a single `template` name is supplied,
 *                              shows all notifications using that template
 *                              with full delivery and status context.
 *
 * DetailLayout is the primary usage. SplitPanelLayout is secondary.
 *
 * Dependencies:
 * - React (memo, useMemo)
 * - `src/layouts/DetailLayout.jsx`
 * - `src/layouts/SplitPanelLayout.jsx`
 *
 * Props:
 * - `notifications`    (object[])     (default: [])
 * - `templateFilter`   (string|null)  — scope to single template (default: null)
 * - `layout`           ('detail'|'split'|null) (default: null)
 * - `title`            (string|null)  (default: null)
 * - `loading`          (boolean)      (default: false)
 * - `syncing`          (boolean)      (default: false)
 * - `isStale`          (boolean)      (default: false)
 * - `error`            (any)          (default: null)
 * - `maxTemplates`     (number)       (default: 15)
 * - `compact`          (boolean)      (default: false)
 * - `onRetry`          (fn|null)      (default: null)
 */

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function computeTemplateStats(notifications) {
  const templateMap = {};
  const localeMap   = {};

  for (const n of notifications) {
    const tmpl     = n.template ?? '(none)';
    const locale   = n.locale   ?? 'en';
    const priority = String(n.priority ?? 'low').toLowerCase();
    const delivery = String(n.deliveryStatus ?? 'pending').toLowerCase();

    if (!templateMap[tmpl]) {
      templateMap[tmpl] = { template: tmpl, count: 0, delivered: 0, failed: 0, priorities: {}, locales: new Set() };
    }
    templateMap[tmpl].count    += 1;
    if (delivery === 'delivered') templateMap[tmpl].delivered += 1;
    if (delivery === 'failed')    templateMap[tmpl].failed    += 1;
    templateMap[tmpl].priorities[priority] = (templateMap[tmpl].priorities[priority] ?? 0) + 1;
    templateMap[tmpl].locales.add(locale);

    if (!localeMap[locale]) localeMap[locale] = { locale, count: 0, delivered: 0 };
    localeMap[locale].count    += 1;
    if (delivery === 'delivered') localeMap[locale].delivered += 1;
  }

  const templates = Object.values(templateMap)
    .map((t) => ({ ...t, locales: Array.from(t.locales), successRate: t.count > 0 ? Math.round((t.delivered / t.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const locales = Object.values(localeMap)
    .map((l) => ({ ...l, successRate: l.count > 0 ? Math.round((l.delivered / l.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return { templates, locales };
}

function formatWhen(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPills({ loading, syncing, isStale, error }) {
  if (!loading && !syncing && !isStale && !error) return null;
  return (
    <div className="notification-template-panel__pills" aria-live="polite" aria-atomic="true">
      {loading && <span className="train-pill" role="status">Loading</span>}
      {syncing && <span className="train-pill train-pill--live"  role="status">Live</span>}
      {isStale && <span className="train-pill train-pill--stale" role="status">Stale</span>}
      {error   && <span className="train-pill train-pill--error" role="alert">Error</span>}
    </div>
  );
}

function TemplateRow({ t, compact }) {
  return (
    <li className="notification-template-panel__template-row"
      aria-label={`${t.template}: ${t.count} uses, ${t.successRate}% success`}>
      <div className="notification-template-panel__template-identity">
        <span className="notification-template-panel__template-name">{t.template}</span>
        <span className="notification-template-panel__template-count">{t.count} uses</span>
      </div>
      {!compact && (
        <div className="notification-template-panel__template-meta">
          <span className="notification-template-panel__template-success">{t.successRate}% delivered</span>
          {t.failed > 0 && <span className="notification-template-panel__template-failed">{t.failed} failed</span>}
          <span className="notification-template-panel__template-locales">{t.locales.join(', ')}</span>
        </div>
      )}
    </li>
  );
}

function LocaleRow({ l, compact }) {
  return (
    <li className="notification-template-panel__locale-row"
      aria-label={`${l.locale}: ${l.count} notifications, ${l.successRate}% delivered`}>
      <span className="notification-template-panel__locale-code">{l.locale}</span>
      <span className="notification-template-panel__locale-count">{l.count}</span>
      {!compact && <span className="notification-template-panel__locale-success">{l.successRate}%</span>}
    </li>
  );
}

function TemplateRailSummary({ stats }) {
  return (
    <div className="notification-template-panel__rail" aria-label="Template summary">
      <div className="notification-template-panel__rail-title">Template Summary</div>
      <dl className="notification-template-panel__rail-dl">
        <dt>Templates</dt><dd>{stats.templates.length}</dd>
        <dt>Locales</dt><dd>{stats.locales.length}</dd>
        {stats.templates[0] && <><dt>Top Template</dt><dd>{stats.templates[0].template}</dd></>}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function NotificationTemplatePanel({
  notifications  = [],
  templateFilter = null,
  layout         = null,
  title          = null,
  loading        = false,
  syncing        = false,
  isStale        = false,
  error          = null,
  maxTemplates   = 15,
  compact        = false,
  onRetry        = null,
}) {
  const filtered = useMemo(() => {
    if (!templateFilter) return notifications;
    return notifications.filter((n) => (n.template ?? '(none)') === templateFilter);
  }, [notifications, templateFilter]);

  const stats   = useMemo(() => computeTemplateStats(notifications), [notifications]);
  const isEmpty = notifications.length === 0 && !loading;
  const resolvedTitle = title ?? (templateFilter ? `Template: ${templateFilter}` : 'Notification Templates');

  const body = (
    <div
      className={[
        'notification-template-panel',
        compact ? 'notification-template-panel--compact' : null,
        isStale ? 'notification-template-panel--stale'   : null,
        error   ? 'notification-template-panel--error'   : null,
        syncing ? 'notification-template-panel--live'    : null,
      ].filter(Boolean).join(' ')}
      aria-label={resolvedTitle}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {!layout && <StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} />}

      {isEmpty ? (
        <div className="notification-template-panel__empty" role="status">No template data.</div>
      ) : (
        <>
          <section className="notification-template-panel__section" aria-label="Template Usage">
            <h3 className="notification-template-panel__section-title">Template Usage</h3>
            <ul className="notification-template-panel__template-list" aria-label={`${stats.templates.length} templates`}>
              {stats.templates.slice(0, maxTemplates).map((t) => (
                <TemplateRow key={t.template} t={t} compact={compact} />
              ))}
            </ul>
            {stats.templates.length > maxTemplates && (
              <div className="notification-template-panel__overflow">+{stats.templates.length - maxTemplates} more templates</div>
            )}
          </section>

          {!compact && (
            <section className="notification-template-panel__section" aria-label="Locale Coverage">
              <h3 className="notification-template-panel__section-title">Locale Coverage</h3>
              <ul className="notification-template-panel__locale-list" aria-label={`${stats.locales.length} locales`}>
                {stats.locales.map((l) => (
                  <LocaleRow key={l.locale} l={l} compact={compact} />
                ))}
              </ul>
            </section>
          )}

          {templateFilter && filtered.length > 0 && (
            <section className="notification-template-panel__section" aria-label={`Notifications using ${templateFilter}`}>
              <h3 className="notification-template-panel__section-title">
                {templateFilter} <span className="notification-template-panel__section-count">{filtered.length}</span>
              </h3>
              <ul className="notification-template-panel__detail-list">
                {filtered.slice(0, 10).map((n) => (
                  <li key={n.id} className="notification-template-panel__detail-row">
                    <span className="notification-template-panel__detail-title">{n.title}</span>
                    <span className={`notification-template-panel__detail-status notification-template-panel__detail-status--${String(n.deliveryStatus ?? 'pending').toLowerCase()}`}>
                      {n.deliveryStatus ?? 'pending'}
                    </span>
                    {n.sentAt && <span className="notification-template-panel__detail-ts">{formatWhen(n.sentAt)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );

  if (layout === 'detail') {
    return (
      <DetailLayout
        title={resolvedTitle}
        summary={<div>{stats.templates.length} templates · {stats.locales.length} locales<StatusPills loading={loading} syncing={syncing} isStale={isStale} error={error} /></div>}
        body={body}
        rail={<TemplateRailSummary stats={stats} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
        success={!loading && !error && !isEmpty}
        onRetry={onRetry}
      />
    );
  }

  if (layout === 'split') {
    return (
      <SplitPanelLayout
        title={resolvedTitle}
        left={body}
        right={<TemplateRailSummary stats={stats} />}
        loading={loading}
        empty={isEmpty}
        error={Boolean(error)}
      />
    );
  }

  return body;
});

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useFormat } from '@/lib/i18n/useFormat';
import { listRowsOf } from '@/lib/schedule';
import { Card } from './Card';
import { Icon } from './Icon';
import { ScheduleList } from './ScheduleList';

/** A link under "right now" to what the plan leaves out ("12 more new leads"). */
export interface DayPlanLink {
  key: string;
  to: string;
  text: string;
}

/** The plan's filter buttons: `all` and one per kind, each with its count. */
export interface DayPlanFilters<T, F extends string> {
  /** Names the button group ("Show"). */
  label: string;
  options: readonly { value: F | 'all'; label: string }[];
  /** Which button an item counts under. */
  of: (item: T) => F;
}

export interface DayPlanProps<T, F extends string> {
  /** The heading's id (the card is labelled by it). */
  id: string;
  title: string;
  subtitle?: string | undefined;
  /** What has no hour of its own or is already due: on top, as "right now", in this order. */
  due: readonly T[];
  /** The rest of the day by hour (items that keep their hour once past stay here). */
  timed: readonly T[];
  keyOf: (item: T) => string;
  /** When a timed item starts and is over (ms). */
  timeOf: (item: T) => number;
  endOf: (item: T) => number;
  /** One item as an `<li>`; `due` in the "right now" section. */
  renderItem: (item: T, due: boolean) => ReactNode;
  filters?: DayPlanFilters<T, F> | undefined;
  /** Names the "right now" section for screen readers (it has no heading on screen). */
  nowTitle: string;
  /** Under "right now", for the filter on screen. */
  links?: ((filter: F | 'all') => DayPlanLink[]) | undefined;
  /** Free time at least this long, still ahead, gets a hint between two items. */
  freeMinutes?: number;
  /** Inside the free-time hint. Without it, no hints. */
  renderFree?: ((free: { from: number; minutes: number }) => ReactNode) | undefined;
  /** Nothing at all today. */
  empty: string;
  /** Under the plan (links to the full calendar or list). */
  footer?: ReactNode;
  /** Beside the title: moving to another day. */
  nav?: ReactNode;
  /** The plan is today's: the line at now and the free-time hints only show then. */
  today?: boolean;
  /** Instead of the list while another day loads. */
  loading?: ReactNode;
  /** "Right now" rows shown before "show all". */
  shown?: number;
  now: number;
}

/**
 * A day's plan (the seller's "Today" first): what is due now or has no time of its own on top
 * as "right now", then the rest of the day by the hour on the schedule's list shape, with a line
 * at now and hints where long free time is ahead. Filter buttons with counts narrow it to one
 * kind. Any page that shows one person's day builds on it with its own items and rows.
 */
export function DayPlan<T, F extends string>({
  id,
  title,
  subtitle,
  due,
  timed,
  keyOf,
  timeOf,
  endOf,
  renderItem,
  filters,
  nowTitle,
  links,
  freeMinutes = 90,
  renderFree,
  empty,
  footer,
  nav,
  today = true,
  loading,
  shown = 5,
  now,
}: DayPlanProps<T, F>) {
  const { t } = useTranslation();
  const f = useFormat();
  const [filter, setFilter] = useState<F | 'all'>('all');
  const [expanded, setExpanded] = useState(false);

  const all = [...due, ...timed];
  const shows = (item: T) => filter === 'all' || filters?.of(item) === filter;
  const count = (value: F | 'all') =>
    value === 'all' ? all.length : all.filter((item) => filters?.of(item) === value).length;
  const dueNow = due.filter(shows);
  const later = timed.filter(shows);
  const dueShown = expanded ? dueNow : dueNow.slice(0, shown);
  const more = links?.(filter) ?? [];

  return (
    <Card aria-labelledby={id} className="flex min-w-0 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={id}
            aria-live={nav ? 'polite' : undefined}
            className="m-0 font-display text-xl font-bold"
          >
            {title}
          </h2>
          {subtitle && <span className="text-sm text-text-2">{subtitle}</span>}
        </div>
        {nav}
      </div>

      {/* The filters sit with the list they narrow, so the header keeps room for the day. */}
      {filters && (
        <div
          role="group"
          aria-label={filters.label}
          className="flex flex-wrap gap-0.5 self-start rounded-full bg-canvas p-0.5"
        >
          {filters.options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              // Small to the eye; the tap area still reaches 44px (`after`).
              className={`relative inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap after:absolute after:inset-x-0 after:-inset-y-1.5 ${
                filter === option.value
                  ? 'bg-surface text-text shadow-panel'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              {option.label}
              <span className="text-[11px] text-text-2 tabular-nums">
                {f.number(count(option.value))}
              </span>
            </button>
          ))}
        </div>
      )}

      {(dueNow.length > 0 || more.length > 0) && (
        <section
          aria-label={nowTitle}
          className="flex flex-col gap-2 rounded-2xl bg-danger-tint/50 p-3 lg:p-4"
        >
          {dueNow.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {dueShown.map((item) => renderItem(item, true))}
            </ul>
          )}
          {dueNow.length > shown && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="min-h-11 self-start rounded-xl px-3 text-sm font-semibold text-primary-text hover:bg-surface"
            >
              {expanded
                ? t('dayPlan.showLess')
                : t('dayPlan.showAll', { n: f.number(dueNow.length) })}
            </button>
          )}
          {more.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-x-4 p-0">
              {more.map((link) => (
                <li key={link.key}>
                  <Link
                    to={link.to}
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text"
                  >
                    {link.text}
                    <Icon name="chevronEnd" size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {loading ? (
        loading
      ) : all.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-text-2">{empty}</p>
      ) : dueNow.length === 0 && later.length === 0 && more.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-text-2">{t('dayPlan.filteredEmpty')}</p>
      ) : (
        <ScheduleList
          rows={listRowsOf(later, now, {
            at: timeOf,
            end: endOf,
            freeMinutes: renderFree && today ? freeMinutes : Infinity,
          }).filter((row) => today || row.kind !== 'now')}
          now={now}
          keyOf={keyOf}
          timeOf={timeOf}
          renderItem={(item) => <ul className="m-0 list-none p-0">{renderItem(item, false)}</ul>}
          renderFree={(free) => renderFree?.(free)}
        />
      )}

      {footer && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 shadow-[inset_0_1px_0_var(--hair)]">
          {footer}
        </div>
      )}
    </Card>
  );
}

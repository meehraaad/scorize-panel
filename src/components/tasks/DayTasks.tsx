import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useFormat } from '@/lib/i18n/useFormat';

/** Chips shown on a day before «+N more». */
const SHOWN = 3;

/** What a chip's dot says: my own task, a colleague's request, a customer's follow-up call. */
const TONE = { mine: 'var(--cal-5)', request: 'var(--cal-1)', call: 'var(--text-2)' } as const;

/** Something due on a day with no hour: a chip on the calendar's «کارها» row. */
export interface DayTask {
  key: string;
  text: string;
  tone: keyof typeof TONE;
  done: boolean;
  /** Where it opens (its list on the tasks page, the customer's page); none in a picker. */
  to?: string | undefined;
}

/**
 * A day's tasks with no hour on the calendar's «کارها» row (canvas 4A): a chip each (its dot, done
 * ones struck), the first few and «+N more» to the tasks page on that day; on a past day the open
 * ones are late. A narrow day shows only how many are open. Nothing due: nothing.
 * Needs the `tasks` namespace on the route.
 */
export function DayTasks({
  items,
  compact,
  late,
  moreTo,
}: {
  items: readonly DayTask[];
  compact: boolean;
  /** The day has passed: what is still open is late. */
  late: boolean;
  /** The tasks page on that day; none in a picker, where the chips only show what is there. */
  moreTo?: string | undefined;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  if (items.length === 0) return null;
  const open = items.filter((item) => !item.done).length;
  if (compact && !moreTo)
    return (
      <span
        title={t('calendar.openCount', { n: f.number(open) })}
        className="flex min-h-11 items-center justify-center text-xs font-bold text-text-2"
      >
        {f.number(open)}
      </span>
    );
  if (compact && moreTo)
    return (
      <Link
        to={moreTo}
        aria-label={t('calendar.dayCount', { n: f.number(open) })}
        className="flex min-h-11 items-center justify-center rounded-md text-xs font-bold text-text-2 hover:bg-tint focus-visible:outline-2 focus-visible:outline-focus"
      >
        {f.number(open)}
      </Link>
    );
  const hidden = items.length - SHOWN;
  return (
    <ul className="m-0 flex min-w-0 list-none flex-col gap-1 p-0">
      {items.slice(0, hidden > 0 ? SHOWN : items.length).map((item) => (
        <li key={item.key} className="min-w-0">
          {item.to ? (
            <Link to={item.to} title={item.text} className={chipClass(item, late, true)}>
              <ChipBody item={item} />
            </Link>
          ) : (
            <span title={item.text} className={chipClass(item, late, false)}>
              <ChipBody item={item} />
            </span>
          )}
        </li>
      ))}
      {hidden > 0 && !moreTo && (
        <li className="flex min-h-8 items-center px-2 text-xs font-semibold text-text-2">
          {t('calendar.more', { n: f.number(hidden) })}
        </li>
      )}
      {hidden > 0 && moreTo && (
        <li>
          <Link
            to={moreTo}
            className="flex min-h-8 items-center px-2 text-xs font-semibold text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {t('calendar.more', { n: f.number(hidden) })}
          </Link>
        </li>
      )}
    </ul>
  );
}

function chipClass(item: DayTask, late: boolean, link: boolean) {
  const hover = link
    ? item.done
      ? 'hover:bg-tint'
      : late
        ? 'hover:brightness-95'
        : 'hover:bg-tint'
    : '';
  return `flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-focus ${
    item.done
      ? 'text-text-2 line-through'
      : late
        ? 'bg-warn-tint text-urgent'
        : 'bg-canvas text-text'
  } ${hover}`;
}

function ChipBody({ item }: { item: DayTask }) {
  const { t } = useTranslation('tasks');
  return (
    <>
      <span
        aria-hidden="true"
        className="size-2 flex-none rounded-full"
        style={{ background: item.done ? 'var(--good)' : TONE[item.tone] }}
      />
      <span className="truncate">{item.text}</span>
      {item.done && <span className="sr-only">{t('calendar.chipDone')}</span>}
    </>
  );
}

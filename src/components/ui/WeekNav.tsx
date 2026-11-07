import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, toCalendar } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { IconButton } from './IconButton';

/** "12 to 18 Aban 1405": a week's first and last day, the month said once when they share it. */
function useWeekTitle() {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  return (week: Date) => {
    const end = addDays(week, 6);
    const sameMonth = toCalendar(week, cal.kind).month === toCalendar(end, cal.kind).month;
    return t('weekCalendar.range', {
      from: sameMonth ? cal.number.format(toCalendar(week, cal.kind).day) : f.dateShort(week),
      to: f.date(end),
    });
  };
}

/**
 * Moving a schedule a week at a time, like a calendar app's toolbar: "this week", previous and
 * next, and the week's dates (read out as they change). `min` / `max` stop it at a first and last
 * week; `children` sit after the title (filters, counts).
 */
export function WeekNav({
  week,
  onWeekChange,
  thisWeek,
  min,
  max,
  heading = 'h3',
  large = true,
  children,
}: {
  week: Date;
  onWeekChange: (week: Date) => void;
  /** The week holding today: "this week" goes there. */
  thisWeek: Date;
  /** The first week one may go to. */
  min?: Date | undefined;
  /** The last week one may go to. */
  max?: Date | undefined;
  heading?: 'h2' | 'h3';
  /** The title at page size (off: a smaller one, for a narrow schedule). */
  large?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const title = useWeekTitle();
  const Heading = heading;
  return (
    <>
      <button
        type="button"
        disabled={week.getTime() === thisWeek.getTime()}
        onClick={() => onWeekChange(thisWeek)}
        className="min-h-11 rounded-full bg-surface px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-canvas disabled:opacity-50"
      >
        {t('weekCalendar.thisWeek')}
      </button>
      <span className="flex">
        <IconButton
          icon="chevronStart"
          aria-label={t('weekCalendar.previous')}
          disabled={min !== undefined && week <= min}
          onClick={() => onWeekChange(addDays(week, -7))}
        />
        <IconButton
          icon="chevronEnd"
          aria-label={t('weekCalendar.next')}
          disabled={max !== undefined && week >= max}
          onClick={() => onWeekChange(addDays(week, 7))}
        />
      </span>
      <Heading
        aria-live="polite"
        className={`m-0 font-display font-bold ${large ? 'text-lg' : 'text-base'}`}
      >
        {title(week)}
      </Heading>
      {children}
    </>
  );
}

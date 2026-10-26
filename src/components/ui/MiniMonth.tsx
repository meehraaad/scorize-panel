import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  addMonths,
  fromCalendar,
  monthGrid,
  sameDay,
  toCalendar,
  type CalendarDay,
} from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { Icon } from './Icon';

/**
 * A small month beside a week calendar, like a calendar app's: the week on screen shaded, days
 * with something free in bold (in `color`), today filled. Picking a day shows its week.
 */
export function MiniMonth({
  week,
  marked,
  onPick,
  color,
  min,
  max,
}: {
  /** The first day of the week on screen. */
  week: Date;
  /** Days with something free. */
  marked: (date: Date) => boolean;
  onPick: (date: Date) => void;
  /** The marked days' colour (a CSS colour). */
  color: string;
  /** First and last day one may pick. */
  min: Date;
  max: Date;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const [today] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [shown, setShown] = useState<CalendarDay | null>(null);
  // Follows the week on screen until the arrows move it.
  const month = shown ?? { ...toCalendar(week, cal.kind), day: 1 };
  const first = fromCalendar({ ...month, day: 1 }, cal.kind);
  const weeks = monthGrid(month.year, month.month, cal.kind);
  const step = (months: number) => setShown(addMonths({ ...month, day: 1 }, months, cal.kind));
  const lastOfMonth = addDays(
    fromCalendar(addMonths({ ...month, day: 1 }, 1, cal.kind), cal.kind),
    -1,
  );

  return (
    <section
      aria-label={f.monthYear(first)}
      style={{ '--event': color } as CSSProperties}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center justify-between ps-2">
        <span className="text-sm font-bold">{`${cal.month.format(first)} ${cal.year.format(first)}`}</span>
        <span className="flex">
          <button
            type="button"
            aria-label={t('datePicker.previousMonth')}
            disabled={first <= min}
            onClick={() => step(-1)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-canvas disabled:text-text-3"
          >
            <Icon name="chevronStart" size={18} />
          </button>
          <button
            type="button"
            aria-label={t('datePicker.nextMonth')}
            disabled={lastOfMonth >= max}
            onClick={() => step(1)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-canvas disabled:text-text-3"
          >
            <Icon name="chevronEnd" size={18} />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7">
        {weeks[0]?.map((date) => (
          <span
            key={date.getDay()}
            aria-hidden="true"
            className="flex h-7 items-center justify-center text-[11px] font-semibold text-text-2"
          >
            {cal.weekday.format(date)}
          </span>
        ))}
      </div>
      {weeks.map((row) => {
        const current = row[0] !== undefined && sameDay(row[0], week);
        if (row.every((date) => toCalendar(date, cal.kind).month !== month.month)) return null;
        return (
          <div
            key={row[0]?.toDateString()}
            className={`grid grid-cols-7 rounded-full ${current ? 'bg-canvas' : ''}`}
          >
            {row.map((date) => {
              const inMonth = toCalendar(date, cal.kind).month === month.month;
              const open = date >= min && date <= max;
              const isToday = sameDay(date, today);
              return (
                <span key={date.toDateString()} className="flex h-9 items-center justify-center">
                  {inMonth && (
                    <button
                      type="button"
                      aria-label={f.date(date)}
                      aria-current={isToday ? 'date' : undefined}
                      disabled={!open}
                      onClick={() => onPick(date)}
                      className={`flex size-8 items-center justify-center rounded-full text-[13px] tabular-nums hover:enabled:bg-tint ${
                        isToday
                          ? 'bg-primary font-bold text-on-primary'
                          : marked(date)
                            ? 'font-extrabold text-[color-mix(in_srgb,var(--event)_70%,var(--text))]'
                            : 'text-text-3'
                      }`}
                    >
                      {cal.number.format(toCalendar(date, cal.kind).day)}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

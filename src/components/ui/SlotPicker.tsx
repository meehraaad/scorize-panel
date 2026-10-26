import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  addMonths,
  fromCalendar,
  monthGrid,
  sameDay,
  toCalendar,
  toValue,
  weekStart,
  type CalendarDay,
} from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { Icon } from './Icon';

/** A time that can be booked: its start (ISO, as the API sends it) and, when known, seats left. */
export interface Slot {
  at: string;
  left?: number | undefined;
}

interface SlotPickerProps {
  /** What is being booked ("Consultation time"): names the picker for screen readers. */
  label: string;
  /** Free times, any order. Days without one can't be picked. */
  slots: readonly Slot[];
  /** The chosen slot's `at`; null before a choice. */
  value: string | null;
  onChange: (at: string) => void;
  /** Length of one booking, for "10:20 to 10:40" and the day's line. */
  minutes?: number | undefined;
  /** The month's times are on their way (shapes instead of times; days not pickable yet). */
  loading?: boolean;
  /** The month on screen changed (from, to: `YYYY-MM-DD`): load its times. */
  onMonthChange?: ((range: { from: string; to: string }) => void) | undefined;
  /** Last day one may browse to (`YYYY-MM-DD`); without it, the month of the last slot. */
  until?: string | undefined;
}

type Part = 'morning' | 'afternoon' | 'evening';
const PARTS: readonly Part[] = ['morning', 'afternoon', 'evening'];
const partOf = (date: Date): Part =>
  date.getHours() < 12 ? 'morning' : date.getHours() < 17 ? 'afternoon' : 'evening';

/** The day key of a date (local time). */
const dayKey = (date: Date) => toValue(date, false);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Booking a time, like a calendar app's booking page: a month (Jalali in Persian) whose days with
 * free times stand out, and the chosen day's times as buttons grouped by morning, afternoon and
 * evening. Side by side when there is room (container width, so it fits a side column or a
 * dialog too), stacked on phones. Shows the nearest free day when the month on screen has none.
 * Keyboard: arrows move over the days (PageUp/PageDown by month); the times are radio buttons.
 */
export function SlotPicker({
  label,
  slots,
  value,
  onChange,
  minutes,
  loading = false,
  onMonthChange,
  until,
}: SlotPickerProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const id = useId();
  const grid = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());
  const today = startOfDay(now);

  // The slots by day, each day's in time order.
  const byDay = new Map<string, { slot: Slot; date: Date }[]>();
  for (const slot of [...slots].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const date = new Date(slot.at);
    const key = dayKey(date);
    byDay.set(key, [...(byDay.get(key) ?? []), { slot, date }]);
  }
  const freeDays = [...byDay.keys()].sort();
  const firstFree = freeDays[0] ? new Date(byDay.get(freeDays[0])?.[0]?.date ?? now) : null;
  const lastFree = freeDays.at(-1)
    ? new Date(byDay.get(freeDays.at(-1) ?? '')?.[0]?.date ?? now)
    : null;
  const chosen = value ? new Date(value) : null;

  const start = chosen ?? firstFree ?? today;
  const [month, setMonth] = useState<CalendarDay>(() => toCalendar(start, cal.kind));
  const [picked, setPicked] = useState<Date | null>(chosen ? startOfDay(chosen) : null);
  const [focus, setFocus] = useState<Date>(startOfDay(start));
  const [moved, setMoved] = useState(false);

  const inMonth = (date: Date) => {
    const day = toCalendar(date, cal.kind);
    return day.year === month.year && day.month === month.month;
  };
  // The day whose times show: the one picked when it is in this month and free, else this
  // month's first free day (a month change or new times move it there by themselves).
  const day =
    picked && inMonth(picked) && byDay.has(dayKey(picked))
      ? picked
      : (freeDays.map((key) => byDay.get(key)?.[0]?.date).find((date) => date && inMonth(date)) ??
        null);
  const times = day ? (byDay.get(dayKey(day)) ?? []) : [];
  // Every time of the day is as tall as one with a "last spot" line, so the rows stay even.
  const noted = times.some(({ slot }) => slot.left === 1);
  const monthIndex = month.year * 12 + month.month;
  // With nothing free this month: the first free day after it.
  const nextFree =
    day === null
      ? freeDays
          .map((key) => byDay.get(key)?.[0]?.date)
          .find((date) => date !== undefined && fromMonth(date) > monthIndex)
      : undefined;

  function fromMonth(date: Date) {
    const { year, month } = toCalendar(date, cal.kind);
    return year * 12 + month;
  }
  const earliest = fromMonth(firstFree && firstFree < today ? firstFree : today);
  const latest = until
    ? fromMonth(new Date(`${until}T00:00`))
    : onMonthChange
      ? Infinity
      : fromMonth(lastFree ?? today);

  const showMonth = (next: CalendarDay) => {
    setMonth(next);
    if (onMonthChange) {
      const first = fromCalendar({ ...next, day: 1 }, cal.kind);
      const last = addDays(fromCalendar(addMonths({ ...next, day: 1 }, 1, cal.kind), cal.kind), -1);
      onMonthChange({ from: dayKey(first), to: dayKey(last) });
    }
  };
  const step = (months: number) => showMonth(addMonths({ ...month, day: 1 }, months, cal.kind));

  const goTo = (date: Date) => {
    const target = toCalendar(date, cal.kind);
    if (target.year * 12 + target.month < earliest || target.year * 12 + target.month > latest)
      return;
    setFocus(date);
    setMoved(true);
    if (!inMonth(date)) showMonth(target);
  };

  const pickDay = (date: Date) => {
    if (loading || !byDay.has(dayKey(date))) return;
    setPicked(date);
    setFocus(date);
  };

  // After a key moved the focus: put it on that day's button.
  useEffect(() => {
    if (!moved) return;
    grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [focus, moved]);

  const onKey = (event: KeyboardEvent) => {
    const forward = cal.rtl ? -1 : 1;
    const startDay = weekStart(cal.kind);
    const keys: Record<string, () => Date> = {
      ArrowRight: () => addDays(focus, forward),
      ArrowLeft: () => addDays(focus, -forward),
      ArrowDown: () => addDays(focus, 7),
      ArrowUp: () => addDays(focus, -7),
      Home: () => addDays(focus, -((focus.getDay() - startDay + 7) % 7)),
      End: () => addDays(focus, 6 - ((focus.getDay() - startDay + 7) % 7)),
      PageDown: () => fromCalendar(addMonths(toCalendar(focus, cal.kind), 1, cal.kind), cal.kind),
      PageUp: () => fromCalendar(addMonths(toCalendar(focus, cal.kind), -1, cal.kind), cal.kind),
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    goTo(next());
  };

  const weeks = monthGrid(month.year, month.month, cal.kind);
  const firstOfMonth = fromCalendar({ ...month, day: 1 }, cal.kind);
  const title = `${cal.month.format(firstOfMonth)} ${cal.year.format(firstOfMonth)}`;
  // The keyboard's day: the focused one when on screen, else the shown day or the 1st.
  const tabDay = inMonth(focus) ? focus : (day ?? firstOfMonth);
  const end = (date: Date) => (minutes ? new Date(date.getTime() + minutes * 60_000) : null);
  const chosenEnd = chosen ? end(chosen) : null;

  return (
    <section aria-label={label} aria-busy={loading || undefined} className="@container">
      <div className="grid gap-x-6 gap-y-5 @xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        {/* The month */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 ps-1 font-display text-base font-bold" aria-live="polite">
              {title}
            </h3>
            <div className="flex">
              <MonthButton
                icon="chevronStart"
                label={t('datePicker.previousMonth')}
                disabled={monthIndex <= earliest}
                onClick={() => step(-1)}
              />
              <MonthButton
                icon="chevronEnd"
                label={t('datePicker.nextMonth')}
                disabled={monthIndex >= latest}
                onClick={() => step(1)}
              />
            </div>
          </div>
          <div
            ref={grid}
            role="grid"
            aria-label={title}
            onKeyDown={onKey}
            className="flex flex-col"
          >
            <div role="row" className="grid grid-cols-7">
              {weeks[0]?.map((date) => (
                <span
                  key={date.getDay()}
                  role="columnheader"
                  aria-label={cal.weekdayLong.format(date)}
                  className="flex h-8 items-center justify-center text-xs font-semibold text-text-2"
                >
                  {cal.weekday.format(date)}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={dayKey(week[0] ?? now)} role="row" className="grid grid-cols-7">
                {week.map((date) => {
                  if (!inMonth(date))
                    return <span key={dayKey(date)} role="gridcell" className="h-11" />;
                  const count = loading ? 0 : (byDay.get(dayKey(date))?.length ?? 0);
                  const isDay = day !== null && sameDay(date, day);
                  const isToday = sameDay(date, today);
                  return (
                    <span
                      key={dayKey(date)}
                      role="gridcell"
                      aria-selected={isDay}
                      className="flex items-center justify-center"
                    >
                      <button
                        type="button"
                        tabIndex={sameDay(date, tabDay) ? 0 : -1}
                        aria-label={
                          count
                            ? t('slotPicker.dayFree', { date: f.date(date), n: f.number(count) })
                            : t('slotPicker.dayFull', { date: f.date(date) })
                        }
                        aria-current={isToday ? 'date' : undefined}
                        aria-disabled={!count || undefined}
                        onClick={() => pickDay(date)}
                        className={`relative flex size-11 items-center justify-center rounded-full text-[15px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${
                          isDay
                            ? 'bg-primary font-bold text-on-primary'
                            : count
                              ? 'bg-tint font-bold text-primary-text hover:shadow-[inset_0_0_0_1.5px_var(--primary)]'
                              : 'cursor-default text-text-3'
                        }`}
                      >
                        {cal.number.format(toCalendar(date, cal.kind).day)}
                        {isToday && (
                          <span
                            aria-hidden="true"
                            className={`absolute bottom-1.5 size-1 rounded-full ${isDay ? 'bg-on-primary' : 'bg-text-2'}`}
                          />
                        )}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* The day's times */}
        <div className="flex min-w-0 flex-col gap-4 @xl:border-s @xl:border-hair @xl:ps-6">
          {loading ? (
            <TimeBones />
          ) : day ? (
            <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
              <legend className="m-0 mb-4 flex flex-col gap-0.5 p-0">
                <span className="font-display text-lg font-bold">{f.weekday(day)}</span>
                <span className="text-sm text-text-2">
                  {minutes
                    ? t('slotPicker.freeWithLength', {
                        n: f.number(times.length),
                        minutes: f.number(minutes),
                      })
                    : t('slotPicker.free', { n: f.number(times.length) })}
                </span>
              </legend>
              {PARTS.map((part) => {
                const inPart = times.filter(({ date }) => partOf(date) === part);
                if (!inPart.length) return null;
                return (
                  <div key={part} className="flex flex-col gap-2">
                    <span id={`${id}-${part}`} className="text-xs font-semibold text-text-2">
                      {t(`slotPicker.${part}`)}
                    </span>
                    <div
                      role="group"
                      aria-labelledby={`${id}-${part}`}
                      className="grid grid-cols-3 gap-2 @sm:grid-cols-4"
                    >
                      {inPart.map(({ slot, date }) => (
                        <label
                          key={slot.at}
                          className={`flex ${noted ? 'h-14' : 'h-12'} cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[15px] font-semibold tabular-nums shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors hover:shadow-[inset_0_0_0_1.5px_var(--primary)] has-checked:bg-primary has-checked:text-on-primary has-checked:shadow-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus`}
                        >
                          <input
                            type="radio"
                            name={id}
                            value={slot.at}
                            checked={value === slot.at}
                            onChange={() => onChange(slot.at)}
                            className="sr-only"
                          />
                          {f.time(date)}
                          {slot.left === 1 && (
                            <span className="text-[11px] leading-4 font-medium opacity-80">
                              {t('slotPicker.lastSeat')}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </fieldset>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-canvas p-5">
              <span className="text-text-2">
                <Icon name="calendar" />
              </span>
              <p className="m-0 text-sm leading-7 text-text-2">
                {freeDays.length ? t('slotPicker.noneThisMonth') : t('slotPicker.none')}
              </p>
              {nextFree && (
                <button
                  type="button"
                  onClick={() => {
                    showMonth(toCalendar(nextFree, cal.kind));
                    setPicked(startOfDay(nextFree));
                    setFocus(startOfDay(nextFree));
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-primary-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-tint"
                >
                  {t('slotPicker.nearest', { day: f.weekday(nextFree) })}
                  <Icon name="chevronEnd" size={16} />
                </button>
              )}
            </div>
          )}

          {chosen && (
            <p
              aria-live="polite"
              className="m-0 mt-auto flex items-center gap-2.5 rounded-2xl bg-tint px-4 py-3 text-sm text-text"
            >
              <span className="text-primary-text">
                <Icon name="clock" size={18} />
              </span>
              <span>
                {chosenEnd
                  ? t('slotPicker.chosenRange', {
                      day: f.weekday(chosen),
                      from: f.time(chosen),
                      to: f.time(chosenEnd),
                    })
                  : t('slotPicker.chosen', { day: f.weekday(chosen), time: f.time(chosen) })}
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MonthButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: 'chevronStart' | 'chevronEnd';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-text hover:bg-canvas disabled:text-text-3 disabled:hover:bg-transparent"
    >
      <Icon name={icon} />
    </button>
  );
}

/** The times' shape while the month loads. */
function TimeBones() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <span className="block h-6 w-40 animate-pulse rounded-full bg-track" />
      <span className="block h-4 w-28 animate-pulse rounded-full bg-track" />
      <div className="grid grid-cols-3 gap-2 @sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className="block h-11 animate-pulse rounded-xl bg-track" />
        ))}
      </div>
    </div>
  );
}

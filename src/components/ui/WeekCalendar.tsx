import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, sameDay, toCalendar } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { Icon } from './Icon';

/** A scheduled time: its start (ISO, as the API sends it), seats left (0: full) and capacity. */
export interface CalendarTime {
  at: string;
  left: number;
  capacity: number;
}

interface WeekCalendarProps {
  /** What is being booked ("Consultation times"): names the calendar. */
  label: string;
  /** The first day shown (local midnight, the calendar's week start). */
  week: Date;
  onWeekChange: (week: Date) => void;
  /** The week holding today: "this week" goes there, and nothing before it. */
  firstWeek: Date;
  /** The last week one may go to. */
  lastWeek: Date;
  /** The times of one kind of booking, any range: this week's are drawn. */
  times: readonly CalendarTime[];
  /** Length of one booking: a block is as tall as it. */
  minutes: number;
  /** The blocks' colour (a CSS colour, e.g. a `--cal-*` token). */
  color: string;
  /** The chosen time's `at`; null before a choice. */
  value: string | null;
  onChange: (at: string | null) => void;
  /** Beside the chosen time on a wide calendar (a calendar event's card); under the day when narrow. */
  details?: ReactNode;
  /** This week's times are on their way: shapes instead of blocks. */
  loading?: boolean;
  /** Over the grid when nothing in the week is free ("go to next week"). */
  empty?: ReactNode;
  /** Now, for the current-time line (tests set it). */
  now?: Date;
}

/** From this container width (px) the whole week shows; below it, one day at a time. */
const WEEK_WIDTH = 720;
const DEFAULT_FROM = 9;
const DEFAULT_TO = 18;
/** Wide: one hour's height, px. */
const HOUR = 72;
/** Narrow: the shortest booking still gets a finger-sized block. */
const MIN_BLOCK = 46;

const dayKey = (date: Date) =>
  `${String(date.getFullYear())}-${String(date.getMonth())}-${String(date.getDate())}`;
const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** Whether the element is wide enough for the week (measured before paint; unknown width: wide). */
function useWide(ref: RefObject<HTMLElement | null>) {
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWide(element.clientWidth === 0 || element.clientWidth >= WEEK_WIDTH);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return wide;
}

interface Day {
  date: Date;
  times: { time: CalendarTime; start: Date }[];
  free: number;
  full: number;
}

/**
 * Booking a time like a calendar app: a week of days with each time as a block as long as the
 * booking, free, with a few seats left (seat dots, "2 left") or full (striped, can't be picked).
 * Days without times shrink to a narrow column. Picking a block opens `details` beside it, like a
 * calendar event's card. Narrow containers (phones, side columns; measured, so only one layout is
 * drawn) get a week strip and the chosen day's timeline with blocks a finger can hit. Times in local time; Jalali weeks in Persian.
 */
export function WeekCalendar({
  label,
  week,
  onWeekChange,
  firstWeek,
  lastWeek,
  times,
  minutes,
  color,
  value,
  onChange,
  details,
  loading = false,
  empty,
  now: givenNow,
}: WeekCalendarProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const [now] = useState(() => givenNow ?? new Date());
  const root = useRef<HTMLElement>(null);
  const wide = useWide(root);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const days: Day[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week, index);
    const list = times
      .map((time) => ({ time, start: new Date(time.at) }))
      .filter(({ start }) => sameDay(start, date))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return {
      date,
      times: list,
      free: list.filter(({ time }) => time.left > 0).length,
      full: list.filter(({ time }) => time.left === 0).length,
    };
  });
  const all = days.flatMap((day) => day.times);
  // The hours the week's times take (a working day when it has none).
  const from = all.length
    ? Math.min(...all.map(({ start }) => Math.floor(minutesOf(start) / 60)))
    : DEFAULT_FROM;
  const to = all.length
    ? Math.max(from + 3, ...all.map(({ start }) => Math.ceil((minutesOf(start) + minutes) / 60)))
    : DEFAULT_TO;
  const freeThisWeek = days.some((day) => day.free > 0);
  const chosen = value ? new Date(value) : null;

  const end = addDays(week, 6);
  const sameMonth = toCalendar(week, cal.kind).month === toCalendar(end, cal.kind).month;
  const title = t('weekCalendar.range', {
    from: sameMonth ? cal.number.format(toCalendar(week, cal.kind).day) : f.dateShort(week),
    to: f.date(end),
  });

  const style = { '--event': color } as CSSProperties;

  return (
    <section ref={root} aria-label={label} aria-busy={loading || undefined} style={style}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={week.getTime() === firstWeek.getTime()}
            onClick={() => onWeekChange(firstWeek)}
            className="min-h-11 rounded-full px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-canvas disabled:opacity-50"
          >
            {t('weekCalendar.thisWeek')}
          </button>
          <span className="flex">
            <WeekButton
              icon="chevronStart"
              label={t('weekCalendar.previous')}
              disabled={week <= firstWeek}
              onClick={() => onWeekChange(addDays(week, -7))}
            />
            <WeekButton
              icon="chevronEnd"
              label={t('weekCalendar.next')}
              disabled={week >= lastWeek}
              onClick={() => onWeekChange(addDays(week, 7))}
            />
          </span>
          <h3
            aria-live="polite"
            className={`m-0 font-display font-bold ${wide ? 'text-lg' : 'text-base'}`}
          >
            {title}
          </h3>
        </div>
        <ul
          className={`m-0 list-none items-center gap-4 p-0 text-xs text-text-2 ${wide ? 'flex' : 'hidden'}`}
        >
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2.5 w-3.5 rounded-[3px] ${TONE.free}`} />
            {t('weekCalendar.legendFree')}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2.5 w-3.5 rounded-[3px] ${TONE.few}`} />
            {t('weekCalendar.legendFew')}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2.5 w-3.5 rounded-[3px] ${TONE.full}`} />
            {t('weekCalendar.legendFull')}
          </li>
        </ul>
      </div>

      {wide ? (
        <WeekGrid
          days={days}
          from={from}
          to={to}
          minutes={minutes}
          chosen={chosen}
          now={now}
          today={today}
          onChange={onChange}
          details={details}
          loading={loading}
          empty={!loading && !freeThisWeek ? empty : undefined}
        />
      ) : (
        <DayView
          key={dayKey(week)}
          days={days}
          minutes={minutes}
          chosen={chosen}
          today={today}
          onChange={onChange}
          details={details}
          loading={loading}
          empty={!loading && !freeThisWeek ? empty : undefined}
        />
      )}
    </section>
  );
}

/** The blocks' looks: free, a few seats left, full, chosen. */
const TONE = {
  free: 'bg-[color-mix(in_srgb,var(--event)_15%,var(--surface))] text-[color-mix(in_srgb,var(--event)_62%,var(--text))]',
  few: 'bg-[color-mix(in_srgb,var(--event)_15%,var(--surface))] text-[color-mix(in_srgb,var(--event)_62%,var(--text))] shadow-[inset_0_0_0_1.5px_var(--cal-few)]',
  full: 'cursor-not-allowed bg-[repeating-linear-gradient(135deg,var(--track)_0_4px,var(--surface)_4px_8px)] text-text-3 shadow-[inset_0_0_0_1px_var(--hair)]',
  chosen: 'z-10 bg-[var(--event)] text-on-primary shadow-[0_6px_16px_rgb(27_16_32/0.22)]',
};

function toneOf(time: CalendarTime, isChosen: boolean) {
  if (isChosen) return TONE.chosen;
  if (time.left === 0) return TONE.full;
  return time.left < time.capacity ? TONE.few : TONE.free;
}

/** The parts every block shows: time, seats left, seat dots. */
function useBlock(minutes: number) {
  const { t } = useTranslation();
  const f = useFormat();
  return ({ time, start }: Day['times'][number], isChosen: boolean, long: boolean) => {
    const finish = new Date(start.getTime() + minutes * 60_000);
    const full = time.left === 0;
    const few = !full && time.left < time.capacity;
    const range = t('weekCalendar.timeRange', { from: f.time(start), to: f.time(finish) });
    const state = full
      ? t('weekCalendar.full')
      : few
        ? t('weekCalendar.left', { n: f.number(time.left) })
        : '';
    return {
      full,
      aria: [f.weekday(start), range, state].filter(Boolean).join('، '),
      label: long ? range : f.time(start),
      state,
      dots:
        time.capacity > 1 && time.capacity <= 5
          ? Array.from({ length: time.capacity }, (_, index) => index < time.left)
          : [],
      tone: toneOf(time, isChosen),
    };
  };
}

function Seats({ dots, chosen }: { dots: boolean[]; chosen: boolean }) {
  if (!dots.length) return null;
  return (
    <span aria-hidden="true" className="flex gap-0.5">
      {dots.map((open, index) => (
        <span
          key={index}
          className={`size-1.5 rounded-full ${
            chosen
              ? open
                ? 'bg-on-primary'
                : 'bg-on-primary/35'
              : open
                ? 'bg-[var(--event)]'
                : 'opacity-55 shadow-[inset_0_0_0_1.3px_var(--event)]'
          }`}
        />
      ))}
    </span>
  );
}

function WeekGrid({
  days,
  from,
  to,
  minutes,
  chosen,
  now,
  today,
  onChange,
  details,
  loading,
  empty,
}: {
  days: Day[];
  from: number;
  to: number;
  minutes: number;
  chosen: Date | null;
  now: Date;
  today: Date;
  onChange: (at: string | null) => void;
  details: ReactNode;
  loading: boolean;
  empty: ReactNode;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const block = useBlock(minutes);
  const height = (to - from) * HOUR;
  const hours = Array.from({ length: to - from - 1 }, (_, index) => from + index + 1);
  const lines = {
    backgroundImage: `repeating-linear-gradient(to bottom, var(--hair) 0 1px, transparent 1px ${String(HOUR)}px)`,
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && chosen) onChange(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--hair)]">
      <div className="flex border-b border-hair">
        <span className="w-14 flex-none" />
        {days.map((day) => {
          const narrow = !loading && day.times.length === 0;
          const isToday = sameDay(day.date, today);
          return (
            <div
              key={dayKey(day.date)}
              className={`flex flex-col items-center justify-center gap-1 border-s border-hair py-2.5 ${
                narrow ? 'w-16 flex-none bg-canvas/60' : 'min-w-0 flex-1'
              }`}
            >
              <span
                className={`text-xs font-semibold ${isToday ? 'text-primary-text' : narrow ? 'text-text-3' : 'text-text-2'}`}
              >
                {cal.weekdayLong.format(day.date)}
              </span>
              <span
                className={`flex items-center justify-center rounded-full tabular-nums ${
                  narrow ? 'size-8 text-sm' : 'size-10 text-xl'
                } ${
                  isToday
                    ? 'bg-primary font-bold text-on-primary'
                    : narrow
                      ? 'text-text-3'
                      : 'font-bold text-text'
                }`}
              >
                {cal.number.format(toCalendar(day.date, cal.kind).day)}
              </span>
              {cal.kind === 'persian' && (
                <span dir="ltr" className="text-[11px] leading-4 text-text-3">
                  {cal.gregorianDay.format(day.date)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative flex" style={{ height }} onKeyDown={onKey}>
        <div aria-hidden="true" className="relative w-14 flex-none">
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute end-2 text-[11px] text-text-3 tabular-nums"
              style={{ top: (hour - from) * HOUR - 8 }}
            >
              {f.time(new Date(2000, 0, 1, hour))}
            </span>
          ))}
        </div>
        {days.map((day, column) => {
          const narrow = !loading && day.times.length === 0;
          const isToday = sameDay(day.date, today);
          const holiday = cal.kind === 'persian' && day.date.getDay() === 5;
          return (
            <div
              key={dayKey(day.date)}
              role="group"
              aria-label={f.weekday(day.date)}
              className={`relative border-s border-hair ${narrow ? 'w-16 flex-none bg-canvas/60' : 'min-w-0 flex-1'}`}
              style={lines}
            >
              {narrow && (
                <span className="absolute inset-x-1 top-3 text-center text-[11px] leading-5 font-semibold text-text-3">
                  {isToday
                    ? t('weekCalendar.today')
                    : holiday
                      ? t('weekCalendar.holiday')
                      : day.date < today
                        ? ''
                        : t('weekCalendar.noTimes')}
                </span>
              )}
              {loading && day.date > today && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 animate-pulse rounded-lg bg-track"
                  style={{ top: HOUR, height: HOUR * 2 }}
                />
              )}
              {!loading &&
                day.times.map((item) => {
                  const isChosen = chosen !== null && item.start.getTime() === chosen.getTime();
                  const top = ((minutesOf(item.start) - from * 60) / 60) * HOUR;
                  const tall = (minutes / 60) * HOUR - 3;
                  const b = block(item, isChosen, minutes >= 45);
                  return (
                    <button
                      key={item.time.at}
                      type="button"
                      aria-label={b.aria}
                      aria-pressed={isChosen}
                      disabled={b.full}
                      onClick={() => onChange(isChosen ? null : item.time.at)}
                      className={`absolute inset-x-1 flex justify-between gap-1.5 overflow-hidden rounded-lg px-2 text-xs font-bold tabular-nums transition-[filter] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus hover:enabled:brightness-95 ${
                        tall > 34 ? 'items-start pt-1.5' : 'items-center'
                      } ${b.tone}`}
                      style={{ top: top + 1, height: tall }}
                    >
                      <span className={b.full ? 'line-through decoration-text-3/40' : ''}>
                        {b.label}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {b.state && <span className="text-[11px] font-extrabold">{b.state}</span>}
                        <Seats dots={b.dots} chosen={isChosen} />
                      </span>
                    </button>
                  );
                })}
              {isToday && minutesOf(now) > from * 60 && minutesOf(now) < to * 60 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 z-20 h-0.5 bg-danger"
                  style={{ top: ((minutesOf(now) - from * 60) / 60) * HOUR }}
                >
                  <span className="absolute -start-1.5 -top-[5px] size-3 rounded-full bg-danger" />
                </span>
              )}
              {details && chosen && sameDay(chosen, day.date) && (
                <div
                  className={`absolute z-30 w-80 ${column >= 4 ? 'end-full me-2' : 'start-full ms-2'}`}
                  style={{
                    top: Math.max(
                      8,
                      Math.min(((minutesOf(chosen) - from * 60) / 60) * HOUR - 40, height - 320),
                    ),
                  }}
                >
                  {details}
                </div>
              )}
            </div>
          );
        })}
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto">{empty}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function DayView({
  days,
  minutes,
  chosen,
  today,
  onChange,
  details,
  loading,
  empty,
}: {
  days: Day[];
  minutes: number;
  chosen: Date | null;
  today: Date;
  onChange: (at: string | null) => void;
  details: ReactNode;
  loading: boolean;
  empty: ReactNode;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const block = useBlock(minutes);
  const firstFree = days.find((day) => day.free > 0) ?? null;
  const [picked, setPicked] = useState<Date | null>(
    chosen && days.some((day) => sameDay(day.date, chosen)) ? chosen : null,
  );
  const current =
    (picked && days.find((day) => sameDay(day.date, picked) && day.times.length)) ?? firstFree;
  // A finger-sized block for the shortest booking.
  const hour = Math.max(96, Math.ceil((MIN_BLOCK + 3) * (60 / minutes)));
  const first = current?.times[0];
  const last = current?.times.at(-1);
  const from = first ? Math.floor(minutesOf(first.start) / 60) : DEFAULT_FROM;
  const to = last ? Math.ceil((minutesOf(last.start) + minutes) / 60) : from + 3;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label={t('weekCalendar.days')}
        className="flex border-b border-hair pb-2"
      >
        {days.map((day) => {
          const open = !loading && day.free > 0;
          const isCurrent = current !== null && sameDay(day.date, current.date);
          const isToday = sameDay(day.date, today);
          return (
            <button
              key={dayKey(day.date)}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              aria-label={`${f.weekday(day.date)}، ${
                open
                  ? t('weekCalendar.freeCount', { n: f.number(day.free) })
                  : t('weekCalendar.noTimes')
              }`}
              disabled={!open}
              onClick={() => setPicked(day.date)}
              className={`flex min-w-0 flex-col items-center gap-1 py-1 ${open ? 'flex-[1.6]' : 'flex-[0.8]'}`}
            >
              <span
                className={`text-[11px] font-semibold ${isToday ? 'text-primary-text' : open ? 'text-text-2' : 'text-text-3'}`}
              >
                {cal.weekday.format(day.date)}
              </span>
              <span
                className={`flex items-center justify-center rounded-full tabular-nums ${
                  open || isToday ? 'size-10 text-base' : 'size-7 text-xs'
                } ${
                  isCurrent
                    ? 'bg-[var(--event)] font-bold text-on-primary'
                    : isToday
                      ? 'font-bold text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]'
                      : open
                        ? 'font-bold text-text'
                        : 'text-text-3'
                }`}
              >
                {cal.number.format(toCalendar(day.date, cal.kind).day)}
              </span>
              {cal.kind === 'persian' && (open || isToday) && (
                <span dir="ltr" className="text-[10px] leading-3 whitespace-nowrap text-text-2">
                  {cal.gregorianDay.format(day.date)}
                </span>
              )}
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${open && !isCurrent ? 'bg-[var(--event)]' : 'bg-transparent'}`}
              />
            </button>
          );
        })}
      </div>

      {loading ? (
        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="block h-12 animate-pulse rounded-xl bg-track" />
          ))}
        </div>
      ) : current ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-bold">{f.weekday(current.date)}</span>
            <span className="text-xs text-text-2">
              {current.full
                ? t('weekCalendar.dayLineFull', {
                    free: f.number(current.free),
                    full: f.number(current.full),
                  })
                : t('weekCalendar.freeCount', { n: f.number(current.free) })}
            </span>
          </div>
          <div
            role="group"
            aria-label={f.weekday(current.date)}
            className="relative ms-12"
            style={{
              height: (to - from) * hour + 8,
              backgroundImage: `repeating-linear-gradient(to bottom, var(--hair) 0 1px, transparent 1px ${String(hour)}px)`,
            }}
          >
            {Array.from({ length: to - from }, (_, index) => from + index).map((h) => (
              <span
                key={h}
                aria-hidden="true"
                className="absolute -start-12 text-[11px] text-text-3 tabular-nums"
                style={{ top: (h - from) * hour - 2 }}
              >
                {f.time(new Date(2000, 0, 1, h))}
              </span>
            ))}
            {current.times.map((item) => {
              const isChosen = chosen !== null && item.start.getTime() === chosen.getTime();
              const b = block(item, isChosen, true);
              return (
                <button
                  key={item.time.at}
                  type="button"
                  aria-label={b.aria}
                  aria-pressed={isChosen}
                  disabled={b.full}
                  onClick={() => onChange(isChosen ? null : item.time.at)}
                  className={`absolute inset-x-0 flex items-center justify-between gap-2 rounded-xl px-3 text-sm font-bold tabular-nums ${b.tone}`}
                  style={{
                    top: ((minutesOf(item.start) - from * 60) / 60) * hour + 4,
                    height: (minutes / 60) * hour - 3,
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    {isChosen && <Icon name="check" size={16} />}
                    <span className={b.full ? 'line-through decoration-text-3/40' : ''}>
                      {b.label}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {b.state && <span className="text-xs">{b.state}</span>}
                    <Seats dots={b.dots} chosen={isChosen} />
                  </span>
                </button>
              );
            })}
          </div>
          {details && chosen && (
            <div className="sticky bottom-[calc(var(--panel-bottom,0px)+0.75rem)] z-20">
              {details}
            </div>
          )}
        </>
      ) : (
        empty
      )}
    </div>
  );
}

function WeekButton({
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

import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, sameDay, toCalendar } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { WEEK_WIDTH, useWide } from './useWide';

/** How an event looks: its state, as a calendar app shows it. */
export type EventLook = 'done' | 'need' | 'live' | 'soon' | 'upcoming' | 'call';

export interface CalendarEvent {
  /** Unique among the events shown. */
  id: string;
  start: Date;
  minutes: number;
  /** Its kind's colour (a CSS colour, e.g. a `--cal-*` token). */
  color: string;
  look: EventLook;
  /** Bold first line (who). */
  title: string;
  /** Second line, when the block is tall enough (when, what). */
  meta: string;
  /** Read out for the block. */
  aria: string;
  /** Before the title (how it is held). */
  lead?: ReactNode;
  /** After the title (a quiet marker). */
  trail?: ReactNode;
  /** A small tag under the title on tall blocks ("not logged"). */
  tag?: string | undefined;
  /** A thin red edge: something to do before it (a missing form). */
  warn?: boolean;
}

interface EventCalendarProps {
  /** What the calendar holds ("My consultations"). */
  label: string;
  /** The first day shown (local midnight, the calendar's week start). */
  week: Date;
  events: readonly CalendarEvent[];
  /** The chosen event's `id`. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** The chosen event's card: beside it on a wide calendar, under the day when narrow. */
  details?: ReactNode;
  loading?: boolean;
  /** Now (tests set it). */
  now?: Date;
}

const DEFAULT_FROM = 9;
const DEFAULT_TO = 18;
/** Wide: one hour's height, px. Narrow: tall enough for a finger on a 20-minute event. */
const HOUR = 66;
const HOUR_NARROW = 132;
/** The shortest block, px. */
const MIN_BLOCK = 22;

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();
const dayKey = (date: Date) => date.toDateString();

/** Side-by-side lanes for events that overlap, like a calendar app's day. */
function layOut(events: readonly CalendarEvent[]) {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.minutes - a.minutes,
  );
  const placed: { event: CalendarEvent; lane: number; lanes: number }[] = [];
  let group: typeof placed = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const entry of group) entry.lanes = laneEnds.length;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const event of sorted) {
    const start = event.start.getTime();
    const end = start + Math.max(event.minutes, 20) * 60_000;
    if (start >= groupEnd) close();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    group.push({ event, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return placed;
}

const LOOK: Record<EventLook, string> = {
  done: 'bg-track text-text-2',
  need: 'bg-warn-tint text-text shadow-[inset_0_0_0_1.5px_var(--cal-few)]',
  live: 'z-10 bg-[var(--event)] text-on-primary shadow-[0_6px_16px_rgb(27_16_32/0.22)]',
  soon: 'bg-[color-mix(in_srgb,var(--event)_15%,var(--surface))] text-[color-mix(in_srgb,var(--event)_62%,var(--text))] shadow-[inset_0_0_0_1.5px_var(--event)]',
  upcoming:
    'bg-[color-mix(in_srgb,var(--event)_15%,var(--surface))] text-[color-mix(in_srgb,var(--event)_62%,var(--text))]',
  call: 'bg-surface text-text shadow-[inset_0_0_0_1px_var(--line-3)]',
};

/**
 * A week of events like a calendar app (a seller's consultations and follow-ups): each event a
 * block as long as it lasts, in its kind's colour and its state's look; overlapping ones side by
 * side; a line at now; days with nothing shrink. Picking a block opens `details` beside it. Narrow
 * containers (measured, one layout drawn) get a day strip and that day's timeline.
 */
export function EventCalendar({
  label,
  week,
  events,
  value,
  onChange,
  details,
  loading = false,
  now: givenNow,
}: EventCalendarProps) {
  const [now] = useState(() => givenNow ?? new Date());
  const root = useRef<HTMLElement>(null);
  const wide = useWide(root, WEEK_WIDTH);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week, index);
    return { date, events: events.filter((event) => sameDay(event.start, date)) };
  });
  const props = { days, value, onChange, details, loading, now };
  return (
    <section ref={root} aria-label={label} aria-busy={loading || undefined}>
      {wide ? <Week {...props} /> : <Day key={dayKey(week)} {...props} />}
    </section>
  );
}

interface ViewProps {
  days: { date: Date; events: readonly CalendarEvent[] }[];
  value: string | null;
  onChange: (id: string | null) => void;
  details: ReactNode;
  loading: boolean;
  now: Date;
}

/** The hours the events take (a working day around them). */
function hoursOf(events: readonly CalendarEvent[]) {
  const from = Math.min(
    DEFAULT_FROM,
    ...events.map((event) => Math.floor(minutesOf(event.start) / 60)),
  );
  const to = Math.max(
    DEFAULT_TO,
    ...events.map((event) => Math.ceil((minutesOf(event.start) + event.minutes) / 60)),
  );
  return { from, to };
}

function Block({
  event,
  lane,
  lanes,
  from,
  hour,
  chosen,
  onChange,
  large = false,
}: {
  event: CalendarEvent;
  lane: number;
  lanes: number;
  from: number;
  hour: number;
  chosen: boolean;
  onChange: (id: string | null) => void;
  large?: boolean;
}) {
  const top = ((minutesOf(event.start) - from * 60) / 60) * hour;
  const height = Math.max(large ? 44 : MIN_BLOCK, (event.minutes / 60) * hour - 3);
  const tall = height > 34;
  const style = {
    '--event': event.color,
    top: top + 1,
    height,
    insetInlineStart: `calc(${String((lane * 100) / lanes)}% + 3px)`,
    width: `calc(${String(100 / lanes)}% - 6px)`,
  } as CSSProperties;
  return (
    <button
      type="button"
      aria-label={event.aria}
      aria-pressed={chosen}
      onClick={() => onChange(chosen ? null : event.id)}
      style={style}
      className={`absolute flex flex-col gap-0.5 overflow-hidden rounded-lg text-start font-bold transition-[filter] hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${
        tall ? 'justify-start px-2 py-1' : 'justify-center px-2'
      } ${large ? 'rounded-xl px-3 text-[13.5px]' : 'text-xs'} ${LOOK[event.look]} ${
        event.warn && event.look !== 'live' ? 'shadow-[inset_0_0_0_1.5px_var(--danger)]' : ''
      } ${chosen ? 'z-20 outline-2 outline-offset-1 outline-text' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {event.lead && <span className="flex flex-none">{event.lead}</span>}
        <span className="min-w-0 flex-1 truncate">{event.title}</span>
        {event.trail && <span className="flex flex-none">{event.trail}</span>}
      </span>
      {tall && <span className="truncate text-[11px] font-semibold opacity-85">{event.meta}</span>}
      {event.tag && height > 50 && (
        <span className="self-start rounded-full bg-[var(--cal-few)] px-2 text-[10.5px] font-extrabold text-hero">
          {event.tag}
        </span>
      )}
    </button>
  );
}

function NowLine({ now, from, hour }: { now: Date; from: number; hour: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 z-30 h-0.5 bg-danger"
      style={{ top: ((minutesOf(now) - from * 60) / 60) * hour }}
    >
      <span className="absolute -start-1.5 -top-[5px] size-3 rounded-full bg-danger" />
    </span>
  );
}

function Week({ days, value, onChange, details, loading, now }: ViewProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const { from, to } = hoursOf(days.flatMap((day) => day.events));
  const height = (to - from) * HOUR;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lines = {
    backgroundImage: `repeating-linear-gradient(to bottom, var(--hair) 0 1px, transparent 1px ${String(HOUR)}px)`,
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && value) onChange(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--hair)]">
      <div className="flex border-b border-hair">
        <span className="w-14 flex-none" />
        {days.map((day) => {
          const narrow = !loading && day.events.length === 0;
          const isToday = sameDay(day.date, today);
          const holiday = cal.kind === 'persian' && day.date.getDay() === 5;
          return (
            <div
              key={dayKey(day.date)}
              className={`flex flex-col items-center justify-center gap-0.5 border-s border-hair py-2 ${
                narrow ? 'w-16 flex-none bg-canvas/60' : 'min-w-0 flex-1'
              }`}
            >
              <span
                className={`text-xs font-semibold ${isToday ? 'text-primary-text' : holiday ? 'text-danger' : narrow ? 'text-text-3' : 'text-text-2'}`}
              >
                {cal.weekdayLong.format(day.date)}
              </span>
              <span
                className={`flex items-center justify-center rounded-full tabular-nums ${narrow ? 'size-7 text-sm' : 'size-9 text-lg'} ${
                  isToday
                    ? 'bg-primary font-bold text-on-primary'
                    : day.date < today
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
          {Array.from({ length: to - from - 1 }, (_, index) => from + index + 1).map((hour) => (
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
          const narrow = !loading && day.events.length === 0;
          const isToday = sameDay(day.date, today);
          const holiday = cal.kind === 'persian' && day.date.getDay() === 5;
          const chosen = day.events.find((event) => event.id === value);
          return (
            <div
              key={dayKey(day.date)}
              role="group"
              aria-label={f.weekday(day.date)}
              className={`relative border-s border-hair ${narrow ? 'w-16 flex-none bg-canvas/60' : 'min-w-0 flex-1'} ${
                !narrow && day.date < today ? 'bg-canvas/30' : ''
              }`}
              style={lines}
            >
              {narrow && (
                <span className="absolute inset-x-1 top-3 text-center text-[11px] leading-5 font-semibold text-text-3">
                  {holiday ? t('eventCalendar.holiday') : t('eventCalendar.nothing')}
                </span>
              )}
              {loading && day.date >= today && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 animate-pulse rounded-lg bg-track"
                  style={{ top: HOUR, height: HOUR * 2 }}
                />
              )}
              {!loading &&
                layOut(day.events).map(({ event, lane, lanes }) => (
                  <Block
                    key={event.id}
                    event={event}
                    lane={lane}
                    lanes={lanes}
                    from={from}
                    hour={HOUR}
                    chosen={event.id === value}
                    onChange={onChange}
                  />
                ))}
              {isToday && minutesOf(now) > from * 60 && minutesOf(now) < to * 60 && (
                <NowLine now={now} from={from} hour={HOUR} />
              )}
              {details && chosen && (
                <div
                  className={`absolute z-40 w-80 ${column >= 4 ? 'end-full me-2' : 'start-full ms-2'}`}
                  style={{
                    top: Math.max(
                      8,
                      Math.min(
                        ((minutesOf(chosen.start) - from * 60) / 60) * HOUR - 40,
                        height - 360,
                      ),
                    ),
                  }}
                >
                  {details}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Day({ days, value, onChange, details, loading, now }: ViewProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [picked, setPicked] = useState<Date | null>(null);
  const current =
    (picked && days.find((day) => sameDay(day.date, picked))) ??
    days.find((day) => sameDay(day.date, today)) ??
    days.find((day) => day.events.length) ??
    days[0];
  if (!current) return null;
  const { from, to } = current.events.length
    ? hoursOf(current.events)
    : { from: DEFAULT_FROM, to: DEFAULT_FROM + 3 };
  const chosen = current.events.find((event) => event.id === value);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label={t('eventCalendar.days')}
        className="flex border-b border-hair pb-2"
      >
        {days.map((day) => {
          const any = day.events.length > 0;
          const isCurrent = sameDay(day.date, current.date);
          const isToday = sameDay(day.date, today);
          return (
            <button
              key={dayKey(day.date)}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              aria-label={`${f.weekday(day.date)}، ${t('eventCalendar.count', { n: f.number(day.events.length) })}`}
              onClick={() => setPicked(day.date)}
              className={`flex min-w-0 flex-col items-center gap-1 py-1 ${any || isToday ? 'flex-[1.4]' : 'flex-[0.7]'}`}
            >
              <span
                className={`text-[11px] font-semibold ${isToday ? 'text-primary-text' : any ? 'text-text-2' : 'text-text-3'}`}
              >
                {cal.weekday.format(day.date)}
              </span>
              <span
                className={`flex items-center justify-center rounded-full tabular-nums ${
                  any || isToday ? 'size-10 text-base' : 'size-7 text-xs'
                } ${
                  isCurrent
                    ? 'bg-primary font-bold text-on-primary'
                    : isToday
                      ? 'font-bold text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]'
                      : any
                        ? 'font-bold text-text'
                        : 'text-text-3'
                }`}
              >
                {cal.number.format(toCalendar(day.date, cal.kind).day)}
              </span>
              <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                {day.events.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    style={{ '--event': event.color } as CSSProperties}
                    className={`size-1.5 rounded-full ${
                      event.look === 'call'
                        ? 'shadow-[inset_0_0_0_1.3px_var(--text-2)]'
                        : event.look === 'need'
                          ? 'bg-[var(--cal-few)]'
                          : 'bg-[var(--event)]'
                    }`}
                  />
                ))}
              </span>
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
      ) : current.events.length === 0 ? (
        <p className="m-0 rounded-2xl bg-canvas p-5 text-sm text-text-2">
          {t('eventCalendar.nothingDay', { day: f.weekday(current.date) })}
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-bold">{f.weekday(current.date)}</span>
            <span className="text-xs text-text-2">
              {t('eventCalendar.count', { n: f.number(current.events.length) })}
            </span>
          </div>
          <div
            role="group"
            aria-label={f.weekday(current.date)}
            className="relative ms-12"
            style={{
              height: (to - from) * HOUR_NARROW + 8,
              backgroundImage: `repeating-linear-gradient(to bottom, var(--hair) 0 1px, transparent 1px ${String(HOUR_NARROW)}px)`,
            }}
          >
            {Array.from({ length: to - from }, (_, index) => from + index).map((hour) => (
              <span
                key={hour}
                aria-hidden="true"
                className="absolute -start-12 text-[11px] text-text-3 tabular-nums"
                style={{ top: (hour - from) * HOUR_NARROW - 2 }}
              >
                {f.time(new Date(2000, 0, 1, hour))}
              </span>
            ))}
            {layOut(current.events).map(({ event, lane, lanes }) => (
              <Block
                key={event.id}
                event={event}
                lane={lane}
                lanes={lanes}
                from={from}
                hour={HOUR_NARROW}
                chosen={event.id === value}
                onChange={onChange}
                large
              />
            ))}
            {sameDay(current.date, today) &&
              minutesOf(now) > from * 60 &&
              minutesOf(now) < to * 60 && <NowLine now={now} from={from} hour={HOUR_NARROW} />}
          </div>
          {details && chosen && (
            <div className="sticky bottom-[calc(var(--panel-bottom,0px)+0.75rem)] z-40">
              {details}
            </div>
          )}
        </>
      )}
    </div>
  );
}

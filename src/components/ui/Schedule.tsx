import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, sameDay, toCalendar } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { WEEK_WIDTH, useWide } from './useWide';

/** How big a block is drawn, for what it shows inside. */
export interface BlockShape {
  /** Its height, px. */
  height: number;
  /** Tall enough for a second line. */
  tall: boolean;
  /** On the narrow day timeline (finger-sized). */
  large: boolean;
  /** Whether it is the chosen one. */
  chosen: boolean;
}

/**
 * One thing at a time on the schedule: a session, a follow-up call, a free time to book. The
 * schedule places it; the item says how it looks and what it shows.
 */
export interface ScheduleItem {
  /** Unique among the items shown. */
  id: string;
  start: Date;
  minutes: number;
  /** Its kind's colour (a CSS colour, e.g. a `--cal-*` token), as `--event` inside the block. */
  color: string;
  /** Read out for the block. */
  aria: string;
  /** Can't be picked (a full time): still drawn, still counted, never chosen. */
  disabled?: boolean | undefined;
  /** The block's look (colours, padding, type size); the schedule adds its place and focus ring. */
  look: (shape: BlockShape) => string;
  /** What the block shows. */
  content: (shape: BlockShape) => ReactNode;
  /** Its dot on the narrow day strip (a background class); default its colour. */
  dot?: string | undefined;
}

/** A row above the hours with a brief of each day (its tasks), like a calendar app's all-day row. */
export interface DayRow {
  /** Beside the row, and read out for it ("Tasks"). */
  label: string;
  /** A day's brief; `compact` on a day shrunk for having no items. Null leaves it empty. */
  cell: (day: Date, compact: boolean) => ReactNode;
}

/** A day as the schedule sees it. */
export interface ScheduleDay {
  date: Date;
  items: readonly ScheduleItem[];
  /** Items one can pick (not disabled). */
  open: number;
}

export interface ScheduleProps {
  /** What the schedule holds ("My consultations", "Consultation times"): names it. */
  label: string;
  /** The first day shown (local midnight, the calendar's week start). */
  week: Date;
  /** Any range: this week's are drawn. */
  items: readonly ScheduleItem[];
  /** The chosen item's `id`; null before a choice. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** The chosen item's card: beside it on a wide schedule, under the day when narrow. */
  details?: ReactNode;
  /** A brief of each day above the hours (wide), or above the day's timeline (narrow). */
  dayRow?: DayRow | undefined;
  /** This week's items are on their way: shapes instead of blocks. */
  loading?: boolean;
  /** Over the grid (or in place of the day, narrow) when nothing this week can be picked. */
  empty?: ReactNode;
  /**
   * Which hours show. `workday` (seeing a week): at least 9 to 18, wider when items fall outside.
   * `fit` (picking a time): only the hours the week's items take, at least three.
   */
  hours?: 'workday' | 'fit';
  /** Wide: one hour's height, px. */
  hourHeight?: number;
  /** Narrow: one hour's height, px (tall enough for a finger on the shortest item). */
  narrowHourHeight?: number;
  /** Narrow: only days with something to pick can be chosen, and the first of them opens. */
  pickableDaysOnly?: boolean;
  /** A day's count, under its name on the narrow timeline and read out on the day strip. */
  daySummary: (day: ScheduleDay) => string;
  /** The word in a wide column for a day with nothing ("Holiday", "Nothing"); '' for none. */
  emptyColumn: (date: Date, today: Date) => string;
  /** Narrow: shown for a chosen day with nothing on it. */
  emptyDay?: (date: Date) => ReactNode;
  /** Above the grid, inside the schedule (week buttons, a legend); told whether it is wide. */
  toolbar?: (wide: boolean) => ReactNode;
  /** The chosen day's colour on the narrow day strip (a CSS colour); default the primary. */
  color?: string;
  /** Now, for the current-time line (tests set it). */
  now?: Date;
}

const DEFAULT_FROM = 9;
const DEFAULT_TO = 18;
/** The shortest block, px. */
const MIN_BLOCK = 22;

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();
const dayKey = (date: Date) => date.toDateString();

/** Side-by-side lanes for items that overlap, like a calendar app's day. */
function layOut(items: readonly ScheduleItem[]) {
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.minutes - a.minutes,
  );
  const placed: { item: ScheduleItem; lane: number; lanes: number }[] = [];
  let group: typeof placed = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const entry of group) entry.lanes = laneEnds.length;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    const start = item.start.getTime();
    const end = start + Math.max(item.minutes, 20) * 60_000;
    if (start >= groupEnd) close();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    group.push({ item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return placed;
}

/** The hours some items take: a working day around them, or just theirs (at least three). */
function hoursOf(items: readonly ScheduleItem[], mode: 'workday' | 'fit') {
  const starts = items.map((item) => Math.floor(minutesOf(item.start) / 60));
  const ends = items.map((item) => Math.ceil((minutesOf(item.start) + item.minutes) / 60));
  if (mode === 'workday')
    return { from: Math.min(DEFAULT_FROM, ...starts), to: Math.max(DEFAULT_TO, ...ends) };
  if (!items.length) return { from: DEFAULT_FROM, to: DEFAULT_TO };
  const from = Math.min(...starts);
  return { from, to: Math.max(from + 3, ...ends) };
}

/**
 * The one schedule every calendar in the panel is drawn with: a week of days with each item as a
 * block as long as it lasts, overlapping ones side by side, a line at now, days with nothing
 * shrunk to a narrow column, a day row of briefs, and `details` (the chosen item's card) beside
 * the block. Narrow containers (phones, side columns, popups; measured, so only one layout is
 * drawn) get a day strip and that day's timeline with finger-sized blocks. What is on it (sessions,
 * calls, free times) and how each looks comes from `items`; `EventCalendar` (seeing) and
 * `WeekCalendar` (picking a time) are its two shapes so far.
 */
export function Schedule({
  label,
  week,
  items,
  value,
  onChange,
  details,
  dayRow,
  loading = false,
  empty,
  hours = 'workday',
  hourHeight = 66,
  narrowHourHeight = 132,
  pickableDaysOnly = false,
  daySummary,
  emptyColumn,
  emptyDay,
  toolbar,
  color = 'var(--primary)',
  now: givenNow,
}: ScheduleProps) {
  const [now] = useState(() => givenNow ?? new Date());
  const root = useRef<HTMLElement>(null);
  const wide = useWide(root, WEEK_WIDTH);
  const days: ScheduleDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week, index);
    const list = items
      .filter((item) => sameDay(item.start, date))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return { date, items: list, open: list.filter((item) => !item.disabled).length };
  });
  const nothingOpen = !loading && !days.some((day) => day.open > 0);
  const props: ViewProps = {
    days,
    value,
    onChange,
    details,
    dayRow,
    loading,
    now,
    hours,
    empty: nothingOpen ? empty : undefined,
    daySummary,
  };
  return (
    <section
      ref={root}
      aria-label={label}
      aria-busy={loading || undefined}
      style={{ '--event': color } as CSSProperties}
    >
      {toolbar?.(wide)}
      {wide ? (
        <Week {...props} hour={hourHeight} emptyColumn={emptyColumn} />
      ) : (
        <Day
          key={dayKey(week)}
          {...props}
          hour={narrowHourHeight}
          pickableDaysOnly={pickableDaysOnly}
          emptyDay={emptyDay}
        />
      )}
    </section>
  );
}

interface ViewProps {
  days: ScheduleDay[];
  value: string | null;
  onChange: (id: string | null) => void;
  details: ReactNode;
  dayRow: DayRow | undefined;
  loading: boolean;
  now: Date;
  hours: 'workday' | 'fit';
  empty: ReactNode;
  daySummary: (day: ScheduleDay) => string;
}

function Block({
  item,
  lane,
  lanes,
  from,
  hour,
  chosen,
  onChange,
  large = false,
}: {
  item: ScheduleItem;
  lane: number;
  lanes: number;
  from: number;
  hour: number;
  chosen: boolean;
  onChange: (id: string | null) => void;
  large?: boolean;
}) {
  const top = ((minutesOf(item.start) - from * 60) / 60) * hour;
  const height = Math.max(large ? 44 : MIN_BLOCK, (item.minutes / 60) * hour - 3);
  const shape: BlockShape = { height, tall: height > 34, large, chosen };
  const style = {
    '--event': item.color,
    top: top + 1,
    height,
    insetInlineStart: `calc(${String((lane * 100) / lanes)}% + 3px)`,
    width: `calc(${String(100 / lanes)}% - 6px)`,
  } as CSSProperties;
  return (
    <button
      type="button"
      aria-label={item.aria}
      aria-pressed={chosen}
      disabled={item.disabled}
      onClick={() => onChange(chosen ? null : item.id)}
      style={style}
      className={`absolute overflow-hidden text-start focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${item.look(shape)}`}
    >
      {item.content(shape)}
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

const hourLines = (hour: number) => ({
  backgroundImage: `repeating-linear-gradient(to bottom, var(--hair) 0 1px, transparent 1px ${String(hour)}px)`,
});

function Week({
  days,
  value,
  onChange,
  details,
  dayRow,
  loading,
  now,
  hours,
  empty,
  hour,
  emptyColumn,
}: ViewProps & { hour: number; emptyColumn: (date: Date, today: Date) => string }) {
  const f = useFormat();
  const cal = useCalendar();
  const { from, to } = hoursOf(
    days.flatMap((day) => day.items),
    hours,
  );
  const height = (to - from) * hour;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && value) onChange(null);
  };
  const narrowOf = (day: ScheduleDay) => !loading && day.items.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--hair)]">
      <div className="flex border-b border-hair">
        <span className="w-14 flex-none" />
        {days.map((day) => {
          const narrow = narrowOf(day);
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
      {dayRow && (
        <div role="group" aria-label={dayRow.label} className="flex border-b border-hair">
          <span className="flex w-14 flex-none items-center justify-end pe-2 text-[11px] font-semibold text-text-3">
            {dayRow.label}
          </span>
          {days.map((day) => {
            const narrow = narrowOf(day);
            return (
              <div
                key={dayKey(day.date)}
                className={`flex min-h-12 flex-col justify-center border-s border-hair p-1 ${
                  narrow ? 'w-16 flex-none bg-canvas/60' : 'min-w-0 flex-1'
                }`}
              >
                {!loading && dayRow.cell(day.date, narrow)}
              </div>
            );
          })}
        </div>
      )}
      <div className="relative flex" style={{ height }} onKeyDown={onKey}>
        <div aria-hidden="true" className="relative w-14 flex-none">
          {Array.from({ length: to - from - 1 }, (_, index) => from + index + 1).map((h) => (
            <span
              key={h}
              className="absolute end-2 text-[11px] text-text-3 tabular-nums"
              style={{ top: (h - from) * hour - 8 }}
            >
              {f.time(new Date(2000, 0, 1, h))}
            </span>
          ))}
        </div>
        {days.map((day, column) => {
          const narrow = narrowOf(day);
          const isToday = sameDay(day.date, today);
          const chosen = day.items.find((item) => item.id === value && !item.disabled);
          return (
            <div
              key={dayKey(day.date)}
              role="group"
              aria-label={f.weekday(day.date)}
              className={`relative border-s border-hair ${narrow ? 'w-16 flex-none bg-canvas/60' : 'min-w-0 flex-1'} ${
                !narrow && day.date < today ? 'bg-canvas/60' : ''
              }`}
              style={hourLines(hour)}
            >
              {narrow && (
                <span className="absolute inset-x-1 top-3 text-center text-[11px] leading-5 font-semibold text-text-3">
                  {emptyColumn(day.date, today)}
                </span>
              )}
              {loading && day.date >= today && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 animate-pulse rounded-lg bg-track"
                  style={{ top: hour, height: hour * 2 }}
                />
              )}
              {!loading &&
                layOut(day.items).map(({ item, lane, lanes }) => (
                  <Block
                    key={item.id}
                    item={item}
                    lane={lane}
                    lanes={lanes}
                    from={from}
                    hour={hour}
                    chosen={item.id === value && !item.disabled}
                    onChange={onChange}
                  />
                ))}
              {isToday && minutesOf(now) > from * 60 && minutesOf(now) < to * 60 && (
                <NowLine now={now} from={from} hour={hour} />
              )}
              {details && chosen && (
                <div
                  className={`absolute z-40 w-80 ${column >= 4 ? 'end-full me-2' : 'start-full ms-2'}`}
                  style={{
                    top: Math.max(
                      8,
                      Math.min(
                        ((minutesOf(chosen.start) - from * 60) / 60) * hour - 40,
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
        {empty && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <div className="pointer-events-auto">{empty}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Day({
  days,
  value,
  onChange,
  details,
  dayRow,
  loading,
  now,
  hours,
  empty,
  daySummary,
  hour,
  pickableDaysOnly,
  emptyDay,
}: ViewProps & {
  hour: number;
  pickableDaysOnly: boolean;
  emptyDay: ((date: Date) => ReactNode) | undefined;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const chosenDay = value
    ? days.find((day) => day.items.some((item) => item.id === value))?.date
    : undefined;
  const [picked, setPicked] = useState<Date | null>(chosenDay ?? null);
  const canPick = (day: ScheduleDay) => !pickableDaysOnly || (!loading && day.open > 0);
  const pickedDay = picked && days.find((day) => sameDay(day.date, picked) && canPick(day));
  const current = pickableDaysOnly
    ? (pickedDay ?? days.find((day) => day.open > 0))
    : (pickedDay ??
      days.find((day) => sameDay(day.date, today)) ??
      days.find((day) => day.items.length) ??
      days[0]);
  const { from, to } = current?.items.length
    ? hoursOf(current.items, hours)
    : { from: DEFAULT_FROM, to: DEFAULT_FROM + 3 };
  const chosen = current?.items.find((item) => item.id === value && !item.disabled);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label={t('schedule.days')}
        className="flex border-b border-hair pb-2"
      >
        {days.map((day) => {
          const any = pickableDaysOnly ? !loading && day.open > 0 : day.items.length > 0;
          const isCurrent = current !== undefined && sameDay(day.date, current.date);
          const isToday = sameDay(day.date, today);
          return (
            <button
              key={dayKey(day.date)}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              aria-label={`${f.weekday(day.date)}، ${daySummary(day)}`}
              disabled={!canPick(day)}
              onClick={() => setPicked(day.date)}
              className={`flex min-w-0 flex-col items-center gap-1 py-1 ${any || isToday ? 'flex-[2]' : 'flex-1'}`}
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
                    ? 'bg-[var(--event)] font-bold text-on-primary'
                    : isToday
                      ? 'font-bold text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]'
                      : any
                        ? 'font-bold text-text'
                        : 'text-text-3'
                }`}
              >
                {cal.number.format(toCalendar(day.date, cal.kind).day)}
              </span>
              {pickableDaysOnly && cal.kind === 'persian' && (any || isToday) && (
                <span dir="ltr" className="text-[10px] leading-3 whitespace-nowrap text-text-2">
                  {cal.gregorianDay.format(day.date)}
                </span>
              )}
              <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                {!isCurrent &&
                  day.items
                    .filter((item) => !item.disabled)
                    .slice(0, pickableDaysOnly ? 1 : 3)
                    .map((item) => (
                      <span
                        key={item.id}
                        style={{ '--event': item.color } as CSSProperties}
                        className={`size-1.5 rounded-full ${item.dot ?? 'bg-[var(--event)]'}`}
                      />
                    ))}
              </span>
            </button>
          );
        })}
      </div>

      {dayRow && !loading && current && dayRow.cell(current.date, false)}

      {loading ? (
        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="block h-12 animate-pulse rounded-xl bg-track" />
          ))}
        </div>
      ) : !current ? (
        empty
      ) : current.items.length === 0 ? (
        emptyDay?.(current.date)
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-bold">{f.weekday(current.date)}</span>
            <span className="text-xs text-text-2">{daySummary(current)}</span>
          </div>
          <div
            role="group"
            aria-label={f.weekday(current.date)}
            className="relative ms-12"
            style={{ height: (to - from) * hour + 8, ...hourLines(hour) }}
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
            {layOut(current.items).map(({ item, lane, lanes }) => (
              <Block
                key={item.id}
                item={item}
                lane={lane}
                lanes={lanes}
                from={from}
                hour={hour}
                chosen={item.id === value && !item.disabled}
                onChange={onChange}
                large
              />
            ))}
            {sameDay(current.date, today) &&
              minutesOf(now) > from * 60 &&
              minutesOf(now) < to * 60 && <NowLine now={now} from={from} hour={hour} />}
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

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { Icon } from './Icon';
import { Schedule, type BlockShape, type ScheduleItem } from './Schedule';
import { WeekNav } from './WeekNav';

/** A scheduled time: its start (ISO, as the API sends it), seats left (0: full) and capacity. */
export interface CalendarTime {
  /** Tells apart times that start together (two consultants at 11); default `at`. */
  id?: string;
  at: string;
  /** Who or where (a consultant), read out and shown on the day's timeline. */
  note?: string;
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
  /** The chosen time's `id` (its `at` when it has none); null before a choice. */
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

/** Narrow: the shortest booking still gets a finger-sized block. */
const MIN_BLOCK = 46;

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

/** Bookable times as blocks of the schedule: the time, seats left and seat dots. */
function useTimeItems(minutes: number, color: string) {
  const { t } = useTranslation();
  const f = useFormat();
  return (times: readonly CalendarTime[]): ScheduleItem[] =>
    times.map((time) => {
      const start = new Date(time.at);
      const finish = new Date(start.getTime() + minutes * 60_000);
      const full = time.left === 0;
      const few = !full && time.left < time.capacity;
      const range = t('weekCalendar.timeRange', { from: f.time(start), to: f.time(finish) });
      const state = full
        ? t('weekCalendar.full')
        : few
          ? t('weekCalendar.left', { n: f.number(time.left) })
          : '';
      const dots =
        time.capacity > 1 && time.capacity <= 5
          ? Array.from({ length: time.capacity }, (_, index) => index < time.left)
          : [];
      return {
        id: time.id ?? time.at,
        start,
        minutes,
        color,
        disabled: full,
        aria: [f.weekday(start), range, time.note, state].filter(Boolean).join('، '),
        look: ({ tall, large, chosen }: BlockShape) =>
          large
            ? `flex items-center justify-between gap-2 rounded-xl px-3 text-sm font-bold tabular-nums ${toneOf(time, chosen)}`
            : `flex justify-between gap-1.5 rounded-lg px-2 text-xs font-bold tabular-nums transition-[filter] hover:enabled:brightness-95 ${
                tall ? 'items-start pt-1.5' : 'items-center'
              } ${toneOf(time, chosen)}`,
        content: ({ large, chosen }: BlockShape) => (
          <>
            <span className="flex items-center gap-1.5">
              {large && chosen && <Icon name="check" size={16} />}
              <span className={full ? 'line-through decoration-text-3/40' : ''}>
                {large || minutes >= 45 ? range : f.time(start)}
              </span>
            </span>
            <span className={`flex items-center ${large ? 'gap-2' : 'gap-1.5'}`}>
              {state ? (
                <span className={large ? 'text-xs' : 'text-[11px] font-extrabold'}>{state}</span>
              ) : (
                large &&
                time.note && <span className="truncate text-xs font-semibold">{time.note}</span>
              )}
              <Seats dots={dots} chosen={chosen} />
            </span>
          </>
        ),
      };
    });
}

/**
 * Booking a time like a calendar app: the schedule in its "picking a time" shape. A week of days
 * with each time as a block as long as the booking, free, with a few seats left (seat dots,
 * "2 left") or full (striped, can't be picked). Days without times shrink to a narrow column.
 * Picking a block opens `details` beside it, like a calendar event's card. Narrow containers
 * (phones, side columns, popups) get a week strip and the chosen day's timeline with blocks a
 * finger can hit. Times in local time; Jalali weeks in Persian.
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
  now,
}: WeekCalendarProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const items = useTimeItems(minutes, color)(times);

  return (
    <Schedule
      toolbar={(wide) => (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
          <div className="flex items-center gap-2">
            <WeekNav
              week={week}
              onWeekChange={onWeekChange}
              thisWeek={firstWeek}
              min={firstWeek}
              max={lastWeek}
              large={wide}
            />
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
      )}
      label={label}
      week={week}
      items={items}
      value={value}
      onChange={onChange}
      details={details}
      loading={loading}
      empty={empty}
      color={color}
      hours="fit"
      hourHeight={72}
      narrowHourHeight={Math.max(96, Math.ceil((MIN_BLOCK + 3) * (60 / minutes)))}
      pickableDaysOnly
      daySummary={(day) => {
        if (day.open === 0) return t('weekCalendar.noTimes');
        const full = day.items.length - day.open;
        return full
          ? t('weekCalendar.dayLineFull', { free: f.number(day.open), full: f.number(full) })
          : t('weekCalendar.freeCount', { n: f.number(day.open) });
      }}
      emptyColumn={(date, today) =>
        date.getTime() === today.getTime()
          ? t('weekCalendar.today')
          : cal.kind === 'persian' && date.getDay() === 5
            ? t('weekCalendar.holiday')
            : date < today
              ? ''
              : t('weekCalendar.noTimes')
      }
      {...(now ? { now } : {})}
    />
  );
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

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { Schedule, type BlockShape, type DayRow, type ScheduleItem } from './Schedule';

export type { DayRow } from './Schedule';

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
  /** Can be dragged to another time (with the calendar's `onMove`). */
  movable?: boolean;
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
  /** A brief of each day above the hours (wide), or above the day's timeline (narrow). */
  dayRow?: DayRow | undefined;
  loading?: boolean;
  /** Now (tests set it). */
  now?: Date;
  /** Clicking an empty spot: that time, to add something there (see `Schedule`). */
  onSlotPick?: ((start: Date) => void) | undefined;
  /** A `movable` event dragged to a new start (see `Schedule`). */
  onMove?: ((id: string, start: Date) => void) | undefined;
  /** One hour's height, px, wide and narrow (smaller inside a dialog). */
  hourHeight?: number;
  narrowHourHeight?: number;
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

const DOT: Partial<Record<EventLook, string>> = {
  call: 'shadow-[inset_0_0_0_1.5px_var(--primary)]',
  need: 'bg-[var(--cal-few)]',
};

/** An event as a block of the schedule: who, a quiet second line, and its state's look. */
function eventItem(event: CalendarEvent): ScheduleItem {
  return {
    id: event.id,
    start: event.start,
    minutes: event.minutes,
    color: event.color,
    aria: event.aria,
    dot: DOT[event.look],
    movable: event.movable,
    look: ({ tall, large, chosen }: BlockShape) =>
      `flex flex-col gap-0.5 rounded-lg font-bold ${tall ? 'px-2 py-1' : 'justify-center px-2'} ${
        large ? 'rounded-xl px-3 text-[13px]' : 'text-xs'
      } ${LOOK[event.look]} ${
        event.warn && event.look !== 'live' ? 'shadow-[inset_0_0_0_1.5px_var(--danger)]' : ''
      } ${chosen ? 'z-20 outline-2 outline-offset-1 outline-focus' : ''}`,
    content: ({ tall, height }: BlockShape) => (
      <>
        <span className="flex min-w-0 items-center gap-1.5">
          {event.lead && <span className="flex flex-none">{event.lead}</span>}
          <span className="min-w-0 flex-1 truncate">{event.title}</span>
          {event.trail && <span className="flex flex-none">{event.trail}</span>}
        </span>
        {tall && (
          <span className="truncate text-[11px] font-semibold opacity-80">{event.meta}</span>
        )}
        {event.tag && height > 50 && (
          <span className="self-start rounded-full bg-[var(--cal-few)] px-2 text-[11px] font-extrabold text-hero">
            {event.tag}
          </span>
        )}
      </>
    ),
  };
}

/**
 * A week of events like a calendar app (a seller's consultations and follow-ups): the schedule in
 * its "seeing" shape. Each event a block as long as it lasts, in its kind's colour and its state's
 * look; overlapping ones side by side; a line at now; days with nothing shrink. Picking a block
 * opens `details` beside it. Narrow containers get a day strip and that day's timeline.
 */
export function EventCalendar({
  label,
  week,
  events,
  value,
  onChange,
  details,
  dayRow,
  loading = false,
  now,
  onSlotPick,
  onMove,
  hourHeight,
  narrowHourHeight,
}: EventCalendarProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  // Friday, the weekend in Iran.
  const isHoliday = (date: Date) => cal.kind === 'persian' && date.getDay() === 5;
  return (
    <Schedule
      label={label}
      week={week}
      items={events.map(eventItem)}
      value={value}
      onChange={onChange}
      details={details}
      dayRow={dayRow}
      loading={loading}
      daySummary={(day) => t('eventCalendar.count', { n: f.number(day.items.length) })}
      emptyColumn={(date) =>
        isHoliday(date) ? t('eventCalendar.holiday') : t('eventCalendar.nothing')
      }
      emptyDay={(date) => (
        <p className="m-0 rounded-2xl bg-canvas p-5 text-sm text-text-2">
          {t('eventCalendar.nothingDay', { day: f.weekday(date) })}
        </p>
      )}
      onSlotPick={onSlotPick}
      onMove={onMove}
      {...(now ? { now } : {})}
      {...(hourHeight ? { hourHeight } : {})}
      {...(narrowHourHeight ? { narrowHourHeight } : {})}
    />
  );
}

import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCalendar, type CalendarEvent } from '@/components/ui/EventCalendar';
import { WeekNav } from '@/components/ui/WeekNav';
import { addDays, parseValue, toValue, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CalendarTaskRow, TaskCalendarData } from '@/lib/tasks/calendar';
import { toast } from '@/lib/toast';
import { DayTasks, type DayTask } from './DayTasks';

/** A task with an hour on a calendar: drawn this long, in its own colour (every panel's calendar). */
export const TASK_MINUTES = 30;
export const TASK_COLOR = 'var(--cal-5)';

const PICKED = 'picked';

/** How far ahead the picker's weeks go. */
const WEEKS_AHEAD = 8;

/** A picker of a time on someone's week, as a task composer's «از تقویم» window shows it. */
export interface SlotsProps {
  /** `YYYY-MM-DDTHH:mm` (a time field's value); '' before a pick. */
  value: string;
  onChange: (value: string) => void;
  /** A day with no hour picked on the «کارها» row (`YYYY-MM-DD`); without it that row only shows. */
  onDayPick?: ((day: string) => void) | undefined;
}

/** Each panel's own picker: whose week it reads (the seller's sessions, my tasks). */
export type Slots = ComponentType<SlotsProps>;

/**
 * Picking a time on a week (the calendar's schedule): what is already there that week shows
 * (`busyOf` its `query`, the same request as that calendar's page), and a tap on a free spot from
 * now on picks that time. Opens on the picked time's week, else this one. Beside a time field,
 * which stays the keyboard way.
 */
export function CalendarSlots<T, K extends QueryKey>({
  value,
  onChange,
  onDayPick,
  query,
  untimedOf,
  busyOf,
  label,
  hint,
  pickedTitle,
  pickedAria,
  past,
  minutes,
}: SlotsProps & {
  query: (week: Date) => UseQueryOptions<T, Error, T, K>;
  /** The week's blocks from its data. */
  busyOf: (data: T | undefined) => CalendarEvent[];
  /** The week's tasks with no hour, shown on the «کارها» row above the days. */
  untimedOf?: ((data: T | undefined) => readonly CalendarTaskRow[]) | undefined;
  /** The week's name, read out ("My week, to pick a follow-up time"). */
  label: string;
  hint: string;
  /** The picked time's block ("New follow-up"), and how it is read out. */
  pickedTitle: string;
  pickedAria: (at: Date) => string;
  /** Said when a passed time is tapped. */
  past: string;
  /** How long the picked block is drawn. */
  minutes: number;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, startDay);
  const picked = parseValue(value);
  const [week, setWeek] = useState(() => weekOf(picked ?? now, startDay));
  const { data, isPending } = useQuery(query(week));
  const busy = busyOf(data);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayTasks = new Map<string, DayTask[]>();
  for (const row of untimedOf?.(data) ?? []) {
    const day = toValue(new Date(row.due_at), false);
    dayTasks.set(day, [
      ...(dayTasks.get(day) ?? []),
      { key: String(row.id), text: row.text, tone: row.kind, done: row.done },
    ]);
  }
  const events = picked
    ? [
        ...busy,
        {
          id: PICKED,
          start: picked,
          minutes,
          color: 'var(--primary)',
          look: 'live' as const,
          title: pickedTitle,
          meta: f.time(picked),
          aria: pickedAria(picked),
        },
      ]
    : busy;

  return (
    <div className="flex flex-col gap-2">
      <WeekNav
        week={week}
        onWeekChange={setWeek}
        thisWeek={thisWeek}
        min={thisWeek}
        max={addDays(thisWeek, 7 * WEEKS_AHEAD)}
        large={false}
      />
      <p className="m-0 text-xs text-text-2">{hint}</p>
      <EventCalendar
        label={label}
        week={week}
        events={events}
        value={picked ? PICKED : null}
        // Choosing a block only shows it: the time is picked on a free spot.
        onChange={() => undefined}
        loading={isPending}
        now={now}
        hourHeight={44}
        narrowHourHeight={52}
        onSlotPick={(start) => {
          if (start.getTime() < Date.now()) toast.error(past);
          else onChange(toValue(start, true));
        }}
        dayRow={
          untimedOf
            ? {
                label: t('calendar.row'),
                cell: (day, compact) => (
                  <DayTasks
                    items={dayTasks.get(toValue(day, false)) ?? []}
                    compact={compact}
                    late={day < today}
                  />
                ),
                onAdd: onDayPick && ((day) => onDayPick(toValue(day, false))),
                addLabel: (day) => t('calendar.pickDay', { day: f.weekday(day) }),
                addButton: true,
              }
            : undefined
        }
      />
    </div>
  );
}

/**
 * Picking a new task's time on my week of a panel's calendar (HR, marketing): my open tasks with
 * an hour show, from `query`, the same request as that panel's calendar page.
 * Needs the `tasks` namespace on the route.
 */
export function TaskSlots<T extends TaskCalendarData, K extends QueryKey>({
  value,
  onChange,
  onDayPick,
  query,
}: SlotsProps & { query: (week: Date) => UseQueryOptions<T, Error, T, K> }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  return (
    <CalendarSlots
      value={value}
      onChange={onChange}
      onDayPick={onDayPick}
      query={query}
      untimedOf={(data) => (data?.task_rows ?? []).filter((row) => !row.timed)}
      busyOf={(data) =>
        (data?.task_rows ?? [])
          .filter((row) => row.timed && !row.done)
          .map((row) => {
            const start = new Date(row.due_at);
            return {
              id: `t${String(row.id)}`,
              start,
              minutes: TASK_MINUTES,
              color: TASK_COLOR,
              look: 'call' as const,
              title: row.text,
              meta: f.time(start),
              aria: [row.text, f.time(start), t('calendar.task')].join('، '),
            };
          })
      }
      label={t('slots.label')}
      hint={t('slots.hint')}
      pickedTitle={t('new.title')}
      pickedAria={(at) => t('slots.picked', { day: f.weekday(at), time: f.time(at) })}
      past={t('slots.past')}
      minutes={TASK_MINUTES}
    />
  );
}

/**
 * A chip after a `ChoiceGroup`'s choices (its `extra`) that opens a picker's window («از تقویم»);
 * pressed once something is picked there.
 */
export function PickChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-haspopup="dialog"
      className={`inline-flex min-h-11 flex-none cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        on
          ? 'bg-hero text-on-hero'
          : 'text-primary-text shadow-[inset_0_0_0_1px_var(--primary)] hover:bg-tint'
      }`}
    >
      {children}
    </button>
  );
}

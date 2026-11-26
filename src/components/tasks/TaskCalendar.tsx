import { Suspense, lazy, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { EventCalendar, type CalendarEvent } from '@/components/ui/EventCalendar';
import { Icon } from '@/components/ui/Icon';
import { WeekNav } from '@/components/ui/WeekNav';
import { toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import type { TaskCalendarData } from '@/lib/tasks/calendar';
import type { TasksPanel } from '@/lib/tasks/api';
import { TASK_COLOR, TASK_MINUTES, type Slots } from './CalendarSlots';
import { DayTasks } from './DayTasks';

export { DayTasks, type DayTask } from './DayTasks';

// Only when a day is clicked.
const NewTaskDialog = lazy(() =>
  import('./NewTask').then((module) => ({ default: module.NewTaskDialog })),
);

/** Something above a day besides my tasks (a first day of work, a campaign starting). */
export interface DayMark {
  id: string;
  /** A `--cal-*` colour, the same as its legend entry. */
  color: string;
  /** Short text on the day ("Starts: Canada webinar"). */
  text: string;
  /** The full line, as a tooltip ("Campaign starts · Canada webinar"). */
  title: string;
  /** Where it opens; without one it is plain text. */
  to?: string;
}

export interface LegendItem {
  key: string;
  color: string;
  label: string;
}

/**
 * A panel's week of my tasks (the HR and marketing calendars; the sales calendar adds calls and
 * consultations on its own): my tasks with an hour on the week, and above each day the panel's own
 * marks and my tasks of that day with no hour (canvas 4A). «+ کار کل‌روز» on a day adds one due
 * that day with no hour; an empty future hour, one due then. The page owns the week and its
 * query, so the route's loader can start the first week with the page.
 * Needs the `tasks` namespace on the route.
 */
export function TaskCalendar({
  label,
  dayRowLabel,
  week,
  thisWeek,
  onWeekChange,
  now,
  data,
  loading,
  panel,
  tasksPath,
  legend,
  marksOf,
  slots,
  onCreated,
}: {
  /** The calendar's name (the page's title). */
  label: string;
  /** The row above the days, for screen readers ("Staff days and tasks"). */
  dayRowLabel: string;
  week: Date;
  thisWeek: Date;
  onWeekChange: (week: Date) => void;
  now: Date;
  data: TaskCalendarData | undefined;
  loading: boolean;
  /** Whose tasks the composer adds. */
  panel: TasksPanel;
  /** The panel's tasks page: a day's count links to it with `?view=&day=`. */
  tasksPath: string;
  /** The panel's own kinds of marks; "my task" is added after them. */
  legend: readonly LegendItem[];
  /** The marks above a day (`YYYY-MM-DD`). */
  marksOf: (day: string) => readonly DayMark[];
  /** The composer's «از تقویم»: the panel's week picker. */
  slots?: Slots | undefined;
  /** After a task is created from the calendar (refresh the week). */
  onCreated: () => void;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const [chosen, setChosen] = useState<string | null>(null);
  /** The composer is open: due at an hour, or on a day with no hour. */
  const [newTask, setNewTask] = useState<{ due: Date } | { day: Date } | null>(null);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const events: CalendarEvent[] = (data?.task_rows ?? [])
    .filter((row) => row.timed)
    .map((row) => {
      const start = new Date(row.due_at);
      const meta = f.time(start);
      return {
        id: `t${String(row.id)}`,
        start,
        minutes: TASK_MINUTES,
        color: TASK_COLOR,
        look: row.done ? ('done' as const) : ('call' as const),
        title: row.text,
        meta,
        aria: [row.text, meta, t('calendar.task')].join('، '),
        lead: <Icon name="check" size={12} />,
      };
    });

  const dayCell = (day: Date, compact: boolean) => {
    const value = toValue(day, false);
    const marks = marksOf(value);
    const tasks = (data?.task_rows ?? []).filter(
      (row) => !row.timed && toValue(new Date(row.due_at), false) === value,
    );
    if (marks.length === 0 && tasks.length === 0) return null;
    const dayOf = (view: 'mine' | 'requests') =>
      `${tasksPath}?${new URLSearchParams({ view, day: value }).toString()}`;
    const chips = (
      <DayTasks
        compact={compact}
        late={day < today}
        moreTo={dayOf(tasks.every((row) => row.kind === 'request') ? 'requests' : 'mine')}
        items={tasks.map((row) => ({
          key: String(row.id),
          text: row.text,
          tone: row.kind,
          done: row.done,
          to: dayOf(row.kind === 'request' ? 'requests' : 'mine'),
        }))}
      />
    );
    if (compact)
      return marks.length > 0 ? (
        <span className="flex min-h-11 items-center justify-center text-xs font-bold text-text-2">
          {f.number(marks.length + tasks.filter((row) => !row.done).length)}
        </span>
      ) : (
        chips
      );
    return (
      <div className="flex min-w-0 flex-col gap-1 py-1">
        {marks.map((mark) => {
          const body = (
            <>
              <span
                aria-hidden="true"
                className="size-2 flex-none rounded-full"
                style={{ background: mark.color }}
              />
              <span className="truncate">{mark.text}</span>
            </>
          );
          return mark.to ? (
            <Link
              key={mark.id}
              to={mark.to}
              title={mark.title}
              className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-bold hover:bg-canvas"
            >
              {body}
            </Link>
          ) : (
            <span
              key={mark.id}
              title={mark.title}
              className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-bold"
            >
              {body}
            </span>
          );
        })}
        {chips}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <WeekNav week={week} onWeekChange={onWeekChange} thisWeek={thisWeek} heading="h2" />
      </div>
      <Card className="min-w-0 p-3 lg:p-5">
        <ul className="m-0 mb-3 flex list-none flex-wrap items-center justify-end gap-x-4 gap-y-1.5 p-0 text-xs text-text-2">
          {legend.map((item) => (
            <Legend key={item.key} color={item.color}>
              {item.label}
            </Legend>
          ))}
          <Legend color={TASK_COLOR}>{t('calendar.task')}</Legend>
        </ul>
        <EventCalendar
          label={label}
          week={week}
          events={events}
          value={chosen}
          onChange={setChosen}
          loading={loading}
          now={now}
          onSlotPick={(start) => start.getTime() >= Date.now() && setNewTask({ due: start })}
          dayRow={{
            label: dayRowLabel,
            cell: dayCell,
            onAdd: (day) => setNewTask({ day }),
            addLabel: (day) => t('calendar.add', { day: f.weekday(day) }),
            addButton: true,
            keepsWide: (day) => marksOf(toValue(day, false)).length > 0,
          }}
        />
      </Card>
      {newTask && (
        <Suspense fallback={null}>
          <NewTaskDialog
            open
            {...newTask}
            panel={panel}
            slots={slots}
            onClose={() => setNewTask(null)}
            onCreated={onCreated}
          />
        </Suspense>
      )}
    </>
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
      {children}
    </li>
  );
}

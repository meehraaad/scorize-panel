import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { EventCalendar, type CalendarEvent } from '@/components/ui/EventCalendar';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { WeekNav } from '@/components/ui/WeekNav';
import { toValue, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { tasksQuery } from '@/lib/tasks/api';
import { calendarQuery, HR_KEY, type HrCalendar, type HrEventKind } from './api';
import { EVENT_COLOR } from './format';
import { hrPath, personPath } from './paths';

const TASK_MINUTES = 30;
const TASK_COLOR = 'var(--cal-5)';
/** A task added on a day without a time is due at this hour (or the next full hour, today). */
const TASK_HOUR = 10;
const KINDS: readonly HrEventKind[] = ['entry', 'exit', 'trial_end', 'contract_end', 'birthday'];

// Only when a day is clicked.
const NewTaskDialog = lazy(() =>
  import('@/components/tasks/NewTask').then((module) => ({ default: module.NewTaskDialog })),
);

const dueOn = (day: Date, now: Date) => {
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), TASK_HOUR);
  if (at > now) return at;
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next;
};

/**
 * HR's calendar (canvas "تقویم منابع انسانی"), the sales calendar's shape: my tasks with an hour
 * on the week, and above each day what HR keeps an eye on (first and last days, trials and
 * contracts ending, birthdays) with that day's tasks. A click on a day or an empty hour adds a task.
 */
export default function CalendarPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const cal = useCalendar();
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, weekStart(cal.kind));
  const [week, setWeek] = useState(thisWeek);
  const [chosen, setChosen] = useState<string | null>(null);
  const [newTaskOn, setNewTaskOn] = useState<Date | null>(null);
  const { data, isPending } = useQuery(calendarQuery(week));
  const colleagues = useQuery({ ...tasksQuery('hr'), enabled: newTaskOn !== null });
  const client = useQueryClient();

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

  return (
    <PageStack>
      <PageHeader title={t('calendar.title')} subtitle={t('calendar.subtitle')} />
      <div className="flex flex-wrap items-center gap-2.5">
        <WeekNav week={week} onWeekChange={setWeek} thisWeek={thisWeek} heading="h2" />
      </div>
      <Card className="min-w-0 p-3 lg:p-5">
        <ul className="m-0 mb-3 flex list-none flex-wrap items-center justify-end gap-x-4 gap-y-1.5 p-0 text-xs text-text-2">
          {KINDS.map((kind) => (
            <Legend key={kind} color={EVENT_COLOR[kind]}>
              {t(`calendar.kind.${kind}`)}
            </Legend>
          ))}
          <Legend color={TASK_COLOR}>{t('calendar.task')}</Legend>
        </ul>
        <EventCalendar
          label={t('calendar.title')}
          week={week}
          events={events}
          value={chosen}
          onChange={setChosen}
          loading={isPending}
          now={now}
          onSlotPick={(start) => start.getTime() >= Date.now() && setNewTaskOn(start)}
          dayRow={{
            label: t('calendar.dayRow'),
            cell: (day, compact) => <DayCell day={day} data={data} compact={compact} />,
            onAdd: (day) => setNewTaskOn(dueOn(day, new Date())),
            addLabel: (day) => t('calendar.add', { day: f.weekday(day) }),
            keepsWide: (day) =>
              (data?.events ?? []).some((event) => event.day === toValue(day, false)),
          }}
        />
      </Card>
      {newTaskOn && (
        <Suspense fallback={null}>
          <NewTaskDialog
            open
            due={newTaskOn}
            colleagues={colleagues.data?.colleagues ?? []}
            onClose={() => setNewTaskOn(null)}
            onCreated={() => void client.invalidateQueries({ queryKey: [...HR_KEY, 'calendar'] })}
          />
        </Suspense>
      )}
    </PageStack>
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

/** A day's HR events (each linking to the person) and how many of my tasks are left that day. */
function DayCell({
  day,
  data,
  compact,
}: {
  day: Date;
  data: HrCalendar | undefined;
  compact: boolean;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const value = toValue(day, false);
  const events = (data?.events ?? []).filter((event) => event.day === value);
  const tasks = data?.tasks.find((row) => row.day === value);
  const open = tasks ? tasks.mine + tasks.requests : 0;
  if (events.length === 0 && open === 0) return null;
  if (compact)
    return (
      <span className="flex min-h-11 items-center justify-center text-xs font-bold text-text-2">
        {f.number(events.length + open)}
      </span>
    );
  return (
    <span className="flex min-w-0 flex-col gap-1 py-1">
      {events.map((event) => (
        <Link
          key={event.id}
          to={personPath(event.staff.id)}
          title={`${t(`calendar.kind.${event.kind}`)} · ${event.staff.name}`}
          className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-bold hover:bg-canvas"
        >
          <span
            aria-hidden="true"
            className="size-2 flex-none rounded-full"
            style={{ background: EVENT_COLOR[event.kind] }}
          />
          <span className="truncate">
            {t(`calendar.short.${event.kind}`, { name: event.staff.name })}
          </span>
        </Link>
      ))}
      {open > 0 && (
        <Link
          to={`${hrPath('tasks')}?${new URLSearchParams({ view: tasks && tasks.mine === 0 ? 'requests' : 'mine', day: value }).toString()}`}
          className="flex min-h-11 items-center gap-1 rounded-md bg-tint px-1.5 text-[11px] font-bold text-primary-text"
        >
          <Icon name="check" size={12} />
          {t('calendar.tasks', { n: f.number(open) })}
        </Link>
      )}
    </span>
  );
}

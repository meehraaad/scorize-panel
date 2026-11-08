import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { TogglePill } from '@/components/ui/Choices';
import { FilterTabs } from '@/components/ui/Filters';
import { EventCalendar, type CalendarEvent, type EventLook } from '@/components/ui/EventCalendar';
import { Icon } from '@/components/ui/Icon';
import { MiniMonth } from '@/components/ui/MiniMonth';
import { WeekNav } from '@/components/ui/WeekNav';
import { addDays, eventColor, sameDay, toValue, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { tasksQuery } from '@/lib/tasks/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import {
  CALENDAR_KEY,
  sellerCalendarQuery,
  useSetFollowUp,
  type CalendarConsultation,
  type CalendarType,
} from '../api';
import {
  CALL_MINUTES,
  DEFAULT_MINUTES,
  statusOf,
  type Chosen,
  type Status,
} from '../consultationStatus';
import { EventDetails, StartAction } from './EventDetails';
import { FollowUpDialog } from './FollowUpDialog';
import { TaskBrief } from './TaskBrief';

const MINUTE = 60_000;
/** A task added on a day without a time is due at this hour (or the next full hour, today). */
const TASK_HOUR = 10;

// Only when a day of the tasks row is clicked.
const NewTaskDialog = lazy(() =>
  import('@/components/tasks/NewTask').then((module) => ({ default: module.NewTaskDialog })),
);

/** When a task added on `day` is due: 10:00 that day, or the next full hour once 10:00 has passed. */
const dueOn = (day: Date, now: Date) => {
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), TASK_HOUR);
  if (at > now) return at;
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next;
};

/** The follow-up dialog: a new one at a time, or a customer's moved (`lead`). */
interface Setting {
  at: Date | null;
  lead?: { id: number; name: string };
}

/**
 * "My consultations" as a week calendar (design: "Seller Consultations Calendar" canvas): the
 * paid sessions in their type's colour and their state's look, with how they are held (online:
 * the seller calls; in person: the customer comes) and whether the customer filled the tablet
 * form; the timed follow-up calls beside them. Each layer (a type, the calls) can be hidden.
 */
type ModeFilter = 'all' | CalendarType['mode'];
const MODES: readonly ModeFilter[] = ['all', 'online', 'in_person'];

export function ConsultationCalendar() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, startDay);
  const [week, setWeek] = useState(thisWeek);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [onlyUnlogged, setOnlyUnlogged] = useState(false);
  const [mode, setMode] = useState<ModeFilter>('all');
  const inMode = (held: CalendarType['mode']) => mode === 'all' || held === mode;
  const [chosenId, setChosenId] = useState<string | null>(null);
  const { data, isPending } = useQuery(sellerCalendarQuery(week));
  const setFollowUp = useSetFollowUp();
  const [setting, setSetting] = useState<Setting | null>(null);
  /** A day of the tasks row was clicked: a new task due then. */
  const [newTaskOn, setNewTaskOn] = useState<Date | null>(null);
  const colleagues = useQuery({ ...tasksQuery('sales'), enabled: newTaskOn !== null });
  const client = useQueryClient();
  /** A time picked or dropped on the calendar, unless it has passed. */
  const ahead = (start: Date) => {
    if (start.getTime() >= Date.now()) return true;
    toast.error(t('followUpDialog.past'));
    return false;
  };
  const pickSlot = (start: Date) => {
    setChosenId(null);
    if (ahead(start)) setSetting({ at: start });
  };
  const moveCall = (id: string, start: Date) => {
    const call = data?.calls.find((row) => `l${String(row.lead)}` === id);
    if (!call || !ahead(start)) return;
    setFollowUp.mutate(
      { lead: call.lead, at: start.toISOString() },
      {
        onSuccess: () =>
          toast.success(
            t('followUpDialog.moved', {
              when: t('followUpDialog.when', { day: f.weekday(start), time: f.time(start) }),
            }),
          ),
        onError: () => toast.error(t('error')),
      },
    );
  };

  const types = new Map((data?.types ?? []).map((type) => [type.id, type]));
  const taskDays = new Map((data?.tasks ?? []).map((row) => [row.day, row]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nowTime = now.getTime();
  const consultations = (data?.consultations ?? []).filter(
    (item) =>
      inMode(item.mode) &&
      !hidden.has(String(item.type)) &&
      (!onlyUnlogged || statusOf(item, nowTime) === 'need'),
  );
  const calls = hidden.has('calls') || onlyUnlogged ? [] : (data?.calls ?? []);

  const sellerOf = (item: CalendarConsultation) =>
    item.seller ?? t('consultationCalendar.noSeller');
  const events: CalendarEvent[] = [
    ...consultations.map((item) => {
      const status = statusOf(item, nowTime);
      const type = types.get(item.type);
      const start = new Date(item.starts_at);
      // Someone else's (a manager's view): whose, in place of the type its colour already shows.
      const meta = `${f.time(start)} · ${item.mine ? (type?.name ?? '') : sellerOf(item)}`;
      return {
        id: `c${String(item.id)}`,
        start,
        minutes: item.minutes ?? DEFAULT_MINUTES,
        color: eventColor(type?.color),
        look: status satisfies EventLook,
        title: item.name,
        meta,
        aria: [
          item.name,
          meta,
          t(`mode.${item.mode}`),
          t(`consultationCalendar.status.${status}`),
          t(item.form ? 'consultationCalendar.form.done' : 'consultationCalendar.form.missing'),
        ].join('، '),
        lead: <Icon name={item.mode === 'online' ? 'phone' : 'building'} size={12} />,
        trail: (
          <Icon
            name={item.form ? 'formDone' : 'formMissing'}
            size={13}
            className={item.form ? 'text-good opacity-60' : 'text-danger opacity-80'}
          />
        ),
        tag: status === 'need' ? t('consultationCalendar.tagNeed') : undefined,
        warn: !item.form && (status === 'soon' || status === 'upcoming'),
      };
    }),
    ...calls.map((item) => {
      const start = new Date(item.follow_up_at);
      const meta = `${f.time(start)} · ${t('consultationCalendar.followUp')}`;
      return {
        id: `l${String(item.lead)}`,
        start,
        minutes: CALL_MINUTES,
        color: 'var(--text-2)',
        look: 'call' as const,
        title: item.name,
        meta,
        aria: `${item.name}، ${meta}`,
        lead: <Icon name="followUp" size={12} />,
        movable: true,
      };
    }),
  ];

  const chosen: Chosen | undefined = chosenId?.startsWith('c')
    ? (() => {
        const item = consultations.find((row) => `c${String(row.id)}` === chosenId);
        return item && { kind: 'consultation' as const, item };
      })()
    : (() => {
        const item = calls.find((row) => `l${String(row.lead)}` === chosenId);
        return item && { kind: 'call' as const, item };
      })();

  const all = data?.consultations ?? [];
  const unlogged = all.filter((item) => statusOf(item, nowTime) === 'need').length;
  const next = all
    .filter((item) => {
      const status = statusOf(item, nowTime);
      if (!inMode(item.mode)) return false;
      return status === 'live' || status === 'soon' || status === 'upcoming';
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const go = (target: Date) => {
    setWeek(target);
    setChosenId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <WeekNav week={week} onWeekChange={go} thisWeek={thisWeek} heading="h2" />
        <span className="flex-1" />
        <Button variant="outline" onClick={() => setSetting({ at: null })}>
          <Icon name="plus" size={16} />
          {t('followUpDialog.new')}
        </Button>
        {unlogged > 0 && !onlyUnlogged && (
          <button
            type="button"
            onClick={() => setOnlyUnlogged(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-warn-tint px-4 text-sm font-semibold text-warn"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-[var(--cal-few)]" />
            {t('consultationCalendar.unlogged', { n: f.number(unlogged) })}
          </button>
        )}
        <TogglePill
          label={t('consultations.unloggedOnly')}
          checked={onlyUnlogged}
          onChange={setOnlyUnlogged}
        />
      </div>

      <div className="flex flex-wrap items-start gap-4 lg:gap-5">
        <aside
          aria-label={t('consultationCalendar.aside')}
          className="flex min-w-0 flex-[1_1_260px] flex-col gap-4 lg:max-w-80"
        >
          {next && (
            <NextSession
              item={next}
              type={types.get(next.type)}
              status={statusOf(next, nowTime)}
              onOpen={() => {
                go(weekOf(new Date(next.starts_at), startDay));
                setChosenId(`c${String(next.id)}`);
              }}
            />
          )}
          <Card className="p-3 max-lg:hidden">
            <MiniMonth
              week={week}
              color="var(--cal-0)"
              min={addDays(thisWeek, -365)}
              max={addDays(thisWeek, 365)}
              marked={(date) => events.some((event) => sameDay(event.start, date))}
              onPick={(date) => go(weekOf(date, startDay))}
            />
          </Card>
          <Card className="p-3">
            <FilterTabs
              label={t('consultationCalendar.modeFilter')}
              value={mode}
              onChange={(value) => {
                setMode(value);
                setChosenId(null);
              }}
              options={MODES.map((value) => ({
                value,
                label: value === 'all' ? t('consultationCalendar.modeAll') : t(`mode.${value}`),
              }))}
            />
          </Card>
          <Card className="p-3 max-lg:hidden">
            <Layers
              types={(data?.types ?? []).filter((type) => inMode(type.mode))}
              counts={(id) =>
                id === 'calls'
                  ? (data?.calls.length ?? 0)
                  : all.filter((item) => String(item.type) === id).length
              }
              hidden={hidden}
              onToggle={(id) => {
                const nextHidden = new Set(hidden);
                if (nextHidden.has(id)) nextHidden.delete(id);
                else nextHidden.add(id);
                setHidden(nextHidden);
                setChosenId(null);
              }}
            />
          </Card>
        </aside>

        <Card className="min-w-0 flex-[999_1_600px] p-3 lg:p-5">
          <ul className="m-0 mb-3 flex list-none flex-wrap items-center justify-end gap-x-4 gap-y-1.5 p-0 text-xs text-text-2">
            <Legend swatch="bg-track">{t('consultationCalendar.status.done')}</Legend>
            <Legend swatch="bg-warn-tint shadow-[inset_0_0_0_1.5px_var(--cal-few)]">
              {t('consultationCalendar.status.need')}
            </Legend>
            <Legend swatch="bg-primary">{t('consultationCalendar.status.live')}</Legend>
            <Legend swatch="bg-tint">{t('consultationCalendar.status.upcoming')}</Legend>
            <Legend swatch="bg-surface shadow-[inset_0_0_0_1px_var(--line-3)]">
              {t('consultationCalendar.followUp')}
            </Legend>
            <li className="flex items-center gap-1.5">
              <Icon name="phone" size={13} />
              {t('mode.online')}
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="building" size={13} />
              {t('mode.in_person')}
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="formDone" size={13} className="text-good" />
              {t('consultationCalendar.form.legendDone')}
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="formMissing" size={13} className="text-danger" />
              {t('consultationCalendar.form.legendMissing')}
            </li>
          </ul>
          <EventCalendar
            label={t('consultations.title')}
            week={week}
            events={events}
            value={chosen ? chosenId : null}
            onChange={setChosenId}
            loading={isPending}
            now={now}
            onSlotPick={pickSlot}
            onMove={moveCall}
            dayRow={{
              label: t('consultationCalendar.tasks.row'),
              cell: (day, compact) => (
                <TaskBrief
                  day={day}
                  tasks={taskDays.get(toValue(day, false))}
                  today={today}
                  compact={compact}
                />
              ),
              onAdd: (day) => {
                setChosenId(null);
                setNewTaskOn(dueOn(day, new Date()));
              },
              addLabel: (day) => t('consultationCalendar.tasks.add', { day: f.weekday(day) }),
            }}
            details={
              chosen && (
                <EventDetails
                  chosen={chosen}
                  type={chosen.kind === 'consultation' ? types.get(chosen.item.type) : undefined}
                  now={nowTime}
                  onClose={() => setChosenId(null)}
                  onMoveCall={(call) =>
                    setSetting({
                      at: new Date(call.follow_up_at),
                      lead: { id: call.lead, name: call.name },
                    })
                  }
                />
              )
            }
          />
        </Card>
      </div>
      {setting && (
        <FollowUpDialog open onClose={() => setSetting(null)} at={setting.at} lead={setting.lead} />
      )}
      {newTaskOn && (
        <Suspense fallback={null}>
          <NewTaskDialog
            open
            due={newTaskOn}
            colleagues={colleagues.data?.colleagues ?? []}
            onClose={() => setNewTaskOn(null)}
            onCreated={() => void client.invalidateQueries({ queryKey: CALENDAR_KEY })}
          />
        </Suspense>
      )}
    </div>
  );
}

function Legend({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-3.5 rounded-[3px] ${swatch}`} />
      {children}
    </li>
  );
}

/** Which layers show: each consultation type and the follow-up calls, like a calendar app's list. */
function Layers({
  types,
  counts,
  hidden,
  onToggle,
}: {
  types: CalendarType[];
  counts: (id: string) => number;
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const rows = [
    ...types.map((type) => ({
      id: String(type.id),
      label: type.name,
      color: eventColor(type.color),
    })),
    { id: 'calls', label: t('consultationCalendar.calls'), color: 'var(--text-2)' },
  ];
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 px-2 text-sm font-bold">{t('consultationCalendar.layers')}</legend>
      {/* Many types: the list scrolls rather than pushing the page down. */}
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {rows.map((row) => {
          const on = !hidden.has(row.id);
          return (
            <label
              key={row.id}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-2 hover:bg-canvas has-focus-visible:outline-2 has-focus-visible:outline-focus"
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(row.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                style={{
                  background: on ? row.color : undefined,
                  boxShadow: `inset 0 0 0 2px ${row.color}`,
                }}
                className="flex size-[18px] flex-none items-center justify-center rounded-[5px] text-on-primary"
              >
                {on && <Icon name="check" size={12} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{row.label}</span>
              <span className="text-xs text-text-2">{f.number(counts(row.id))}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The next (or current) session, on the dark card: who, when, how, and its first action. */
function NextSession({
  item,
  type,
  status,
  onOpen,
}: {
  item: CalendarConsultation;
  type: CalendarType | undefined;
  status: Status;
  onOpen: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const start = new Date(item.starts_at);
  const end = new Date(start.getTime() + (item.minutes ?? DEFAULT_MINUTES) * MINUTE);
  return (
    <section
      aria-label={t('consultationCalendar.next')}
      className="flex flex-col gap-3 rounded-card-sm bg-hero p-4 text-on-hero shadow-hero"
    >
      <span className="flex items-center justify-between gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-2 font-semibold ${status === 'live' ? 'text-live' : 'text-on-hero-2'}`}
        >
          {status === 'live' && <span aria-hidden="true" className="size-2 rounded-full bg-live" />}
          {status === 'live' ? t('consultationCalendar.live') : t('consultationCalendar.next')}
        </span>
        <span className="text-on-hero-2">
          {status === 'live'
            ? t('consultationCalendar.range', { from: f.time(start), to: f.time(end) })
            : `${f.weekday(start)} ${f.time(start)}`}
        </span>
      </span>
      <button type="button" onClick={onOpen} className="flex flex-col gap-1 text-start">
        <span className="text-lg font-bold">{item.name}</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-on-hero-2">
          <Icon name={item.mode === 'online' ? 'phone' : 'building'} size={14} />
          {[type?.name, t(`mode.${item.mode}`)].filter(Boolean).join(' · ')}
        </span>
        {!item.form && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-hero-danger">
            <Icon name="formMissing" size={14} />
            {t('consultationCalendar.form.missing')}
          </span>
        )}
      </button>
      <StartAction item={item} status={status} onHero />
    </section>
  );
}

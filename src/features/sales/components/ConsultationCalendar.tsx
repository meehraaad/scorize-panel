import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FaceDot } from '@/components/customers/FaceDot';
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
import { useDisplayName } from '@/lib/i18n/useDisplayName';
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
  DEFAULT_MINUTES,
  callMinutes,
  statusOf,
  type Chosen,
  type Status,
} from '../consultationStatus';
import { EventDetails, StartAction } from './EventDetails';
import { TASK_COLOR, TASK_MINUTES } from './useSellerBusy';
import { useSalesFormat } from '../format';
import { FollowUpDialog } from './FollowUpDialog';
import { TaskBrief } from './TaskBrief';

const MINUTE = 60_000;
/** A task added on a day without a time is due at this hour (or the next full hour, today). */
const TASK_HOUR = 10;
/** In-person meetings at the office (S75): their own colour on the calendar. */
const VISIT_COLOR = 'var(--cal-7)';

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

/** What the calendar draws, each of which can be hidden: paid sessions, tasks, office meetings, calls. */
type Kind = 'consultations' | 'tasks' | 'visits' | 'calls';
const KINDS: readonly Kind[] = ['consultations', 'tasks', 'visits', 'calls'];
const KIND_COLOR: Record<Kind, string> = {
  consultations: 'var(--primary)',
  tasks: TASK_COLOR,
  visits: VISIT_COLOR,
  calls: 'var(--text-2)',
};

/**
 * Which consultation types show. `only` off: every type but those in `picked` (a new type in
 * another week shows); on: only those in `picked` ("clear all" then a few ticked, in any week).
 */
interface TypePick {
  only: boolean;
  picked: ReadonlySet<string>;
}
const typeShown = (pick: TypePick, id: string) => pick.only === pick.picked.has(id);

export function ConsultationCalendar() {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const f = useFormat();
  const s = useSalesFormat();
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, startDay);
  const [week, setWeek] = useState(thisWeek);
  const [kindsOff, setKindsOff] = useState<ReadonlySet<Kind>>(() => new Set());
  const [typePick, setTypePick] = useState<TypePick>(() => ({ only: false, picked: new Set() }));
  const shows = (kind: Kind) => !kindsOff.has(kind);
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
      shows('consultations') &&
      inMode(item.mode) &&
      typeShown(typePick, String(item.type)) &&
      (!onlyUnlogged || statusOf(item, nowTime) === 'need'),
  );
  // A follow-up for a day with no hour is on the day row (its count), not drawn at 23:59.
  const calls =
    !shows('calls') || onlyUnlogged
      ? []
      : (data?.calls ?? []).filter((item) => item.timed !== false);
  // The seller's own tasks with an hour, at that hour; those without one stay on the day row.
  const taskRows =
    !shows('tasks') || onlyUnlogged ? [] : (data?.task_rows ?? []).filter((item) => item.timed);
  // In-person meetings at the office (S75): held in person, so "online only" hides them.
  const visits = !shows('visits') || onlyUnlogged || mode === 'online' ? [] : (data?.visits ?? []);

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
        lead: (
          <span className="inline-flex items-center gap-1">
            <FaceDot name={item.name} face={item.face} size="sm" />
            <Icon name={item.mode === 'online' ? 'phone' : 'building'} size={12} />
          </span>
        ),
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
      // A manager's calendar says whose call it is.
      const meta = [f.time(start), t('consultationCalendar.followUp'), s.owner(item.seller)]
        .filter(Boolean)
        .join(' · ');
      return {
        id: `l${String(item.lead)}`,
        start,
        minutes: callMinutes(item),
        color: 'var(--text-2)',
        look: 'call' as const,
        title: item.name,
        meta,
        aria: `${named(item.name)}، ${meta}`,
        lead: (
          <span className="inline-flex items-center gap-1">
            <FaceDot name={item.name} face={item.face} size="sm" />
            <Icon name="followUp" size={12} />
          </span>
        ),
        movable: true,
      };
    }),
    ...taskRows.map((item) => {
      const start = new Date(item.due_at);
      const meta = [f.time(start), item.name].filter(Boolean).join(' · ');
      return {
        id: `t${String(item.id)}`,
        start,
        minutes: TASK_MINUTES,
        color: TASK_COLOR,
        look: item.done ? ('done' as const) : ('call' as const),
        title: item.text,
        meta,
        aria: [item.text, meta, t('consultationCalendar.taskBlock')].join('، '),
        lead: <Icon name="check" size={12} />,
      };
    }),
    ...visits.map((item) => {
      const start = new Date(item.starts_at);
      const look: EventLook =
        start.getTime() + item.minutes * MINUTE < nowTime ? 'done' : 'upcoming';
      const meta = [
        f.time(start),
        item.room ? t('visit.room', { room: item.room }) : '',
        item.mine ? '' : (item.seller ?? ''),
      ]
        .filter(Boolean)
        .join(' · ');
      return {
        id: `v${String(item.id)}`,
        start,
        minutes: item.minutes,
        color: VISIT_COLOR,
        look,
        title: item.name,
        meta,
        aria: `${named(item.name)}، ${meta}، ${t('visit.onCalendar')}`,
        lead: <Icon name="building" size={12} />,
      };
    }),
  ];

  const chosen: Chosen | undefined = chosenId?.startsWith('c')
    ? (() => {
        const item = consultations.find((row) => `c${String(row.id)}` === chosenId);
        return item && { kind: 'consultation' as const, item };
      })()
    : chosenId?.startsWith('v')
      ? (() => {
          const item = visits.find((row) => `v${String(row.id)}` === chosenId);
          return item && { kind: 'visit' as const, item };
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
        <TogglePill
          label={t('consultations.unloggedOnly')}
          checked={onlyUnlogged}
          badge={unlogged > 0 ? f.number(unlogged) : undefined}
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
          <Card className="p-3">
            <Layers
              kinds={kindsOff}
              kindCount={(kind) =>
                kind === 'consultations'
                  ? all.filter((item) => inMode(item.mode)).length
                  : kind === 'calls'
                    ? (data?.calls.filter((item) => item.timed !== false).length ?? 0)
                    : kind === 'visits'
                      ? mode === 'online'
                        ? 0
                        : (data?.visits?.length ?? 0)
                      : (data?.task_rows?.filter((item) => item.timed).length ?? 0)
              }
              onKind={(kind) => {
                const next = new Set(kindsOff);
                if (next.has(kind)) next.delete(kind);
                else next.add(kind);
                setKindsOff(next);
                setChosenId(null);
              }}
              types={(data?.types ?? []).filter((type) => inMode(type.mode))}
              typeCount={(id) => all.filter((item) => String(item.type) === id).length}
              typePick={typePick}
              onTypes={(next) => {
                setTypePick(next);
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
            zoomDays
            // Tasks hidden: their day row (tasks without an hour) goes too.
            dayRow={
              shows('tasks')
                ? {
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
                  }
                : undefined
            }
            details={
              chosen && (
                <EventDetails
                  chosen={chosen}
                  type={chosen.kind === 'consultation' ? types.get(chosen.item.type) : undefined}
                  now={nowTime}
                  onClose={() => setChosenId(null)}
                  sellers={data?.sellers}
                  onMoveCall={(call) =>
                    setSetting({
                      at: new Date(call.follow_up_at),
                      lead: { id: call.lead, name: named(call.name) },
                    })
                  }
                  editTimes
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

/** A row with a calendar-app check box in its colour, a label and its count. */
function LayerRow({
  label,
  color,
  on,
  count,
  onToggle,
  disabled = false,
}: {
  label: string;
  color: string;
  on: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const f = useFormat();
  return (
    <label
      className={`flex min-h-11 items-center gap-2.5 rounded-xl px-2 has-focus-visible:outline-2 has-focus-visible:outline-focus ${
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-canvas'
      }`}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        style={{ background: on ? color : undefined, boxShadow: `inset 0 0 0 2px ${color}` }}
        className="flex size-[18px] flex-none items-center justify-center rounded-[5px] text-on-primary"
      >
        {on && <Icon name="check" size={12} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span>
      <span className="text-xs text-text-2 tabular-nums">{f.number(count)}</span>
    </label>
  );
}

/**
 * What the calendar shows, like a calendar app's list: each kind (consultations, tasks, office
 * meetings, calls), then the consultation types with "select all" / "clear all". On phones the
 * types fold under one button so the calendar stays near the top.
 */
function Layers({
  kinds,
  kindCount,
  onKind,
  types,
  typeCount,
  typePick,
  onTypes,
}: {
  kinds: ReadonlySet<Kind>;
  kindCount: (kind: Kind) => number;
  onKind: (kind: Kind) => void;
  types: CalendarType[];
  typeCount: (id: string) => number;
  typePick: TypePick;
  onTypes: (next: TypePick) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [typesOpen, setTypesOpen] = useState(false);
  const listId = useId();
  const consultationsOn = !kinds.has('consultations');
  const ids = types.map((type) => String(type.id));
  const shown = ids.filter((id) => typeShown(typePick, id)).length;
  const allShown = shown === ids.length;
  const toggleType = (id: string) => {
    const picked = new Set(typePick.picked);
    if (picked.has(id)) picked.delete(id);
    else picked.add(id);
    onTypes({ only: typePick.only, picked });
  };
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 px-2 text-sm font-bold">{t('consultationCalendar.kinds')}</legend>
        <div className="grid grid-cols-2 gap-0.5 lg:grid-cols-1">
          {KINDS.map((kind) => (
            <LayerRow
              key={kind}
              label={t(`consultationCalendar.kind.${kind}`)}
              color={KIND_COLOR[kind]}
              on={!kinds.has(kind)}
              count={kindCount(kind)}
              onToggle={() => onKind(kind)}
            />
          ))}
        </div>
      </fieldset>

      {types.length > 0 && (
        <fieldset
          disabled={!consultationsOn}
          className="border-line m-0 border-0 border-t p-0 pt-3"
        >
          <legend className="sr-only">{t('consultationCalendar.types')}</legend>
          <div className="flex min-h-9 items-center gap-2 px-2">
            {/* Phones: the list folds under this; wider screens: a plain heading. */}
            <button
              type="button"
              aria-expanded={typesOpen}
              aria-controls={listId}
              onClick={() => setTypesOpen(!typesOpen)}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-start text-sm font-bold lg:pointer-events-none"
            >
              {t('consultationCalendar.types')}
              <span className="text-xs font-normal text-text-2">
                {t('consultationCalendar.typesShown', {
                  shown: f.number(shown),
                  total: f.number(ids.length),
                })}
              </span>
              <Icon
                name="chevronDown"
                size={14}
                className={`text-text-2 transition-transform lg:hidden ${typesOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => onTypes({ only: allShown, picked: new Set() })}
              className="min-h-11 rounded-lg px-2 text-xs font-semibold text-primary-text hover:bg-tint disabled:cursor-not-allowed disabled:opacity-45"
            >
              {allShown ? t('consultationCalendar.clearAll') : t('consultationCalendar.selectAll')}
            </button>
          </div>
          {/* Many types: the list scrolls rather than pushing the page down. */}
          <div
            id={listId}
            className={`mt-0.5 max-h-64 flex-col gap-0.5 overflow-y-auto lg:flex ${typesOpen ? 'flex' : 'hidden'}`}
          >
            {types.map((type) => (
              <LayerRow
                key={type.id}
                label={type.name}
                color={eventColor(type.color)}
                on={typeShown(typePick, String(type.id))}
                count={typeCount(String(type.id))}
                onToggle={() => toggleType(String(type.id))}
                disabled={!consultationsOn}
              />
            ))}
          </div>
        </fieldset>
      )}
    </div>
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
  const named = useDisplayName();
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
        <span className="inline-flex items-center gap-2 text-lg font-bold">
          <FaceDot name={item.name} face={item.face} />
          {named(item.name)}
        </span>
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

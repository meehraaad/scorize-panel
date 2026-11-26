import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Suspense, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { Switch } from '@/components/ui/Switch';
import { useUser } from '@/lib/auth/session';
import { BOARDS_KEY } from '@/lib/boards/api';
import { parseValue, toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { TASKS_KEY, type Colleague, type NewTask, type TasksPanel } from '@/lib/tasks/api';
import { useCreateTask } from '@/lib/tasks/changes';
import { canAssignTasks, canPenalize } from '@/lib/tasks/rights';
import { toast } from '@/lib/toast';
import { fromLocalInput, quickWhen } from '@/lib/when';
import { PickChip, type Slots } from './CalendarSlots';
import { ColleagueSearch } from './ColleagueSearch';

const TARGETS = ['me', 'person', 'team'] as const;
type Target = (typeof TARGETS)[number];
const WHENS = ['evening', 'tomorrow', 'week', 'day', 'other'] as const;

/** A column of my board, which a new task for me can go on. */
interface BoardColumnChoice {
  id: number;
  name: string;
}

/**
 * «کار تازه» in a page header: opens the composer for `panel`'s tasks (`slots`: its week picker;
 * `columns`: my board's, on its page).
 */
export function NewTaskButton({
  panel,
  slots,
  columns,
}: {
  panel: TasksPanel;
  slots?: Slots | undefined;
  columns?: readonly BoardColumnChoice[] | undefined;
}) {
  const { t } = useTranslation('tasks');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Icon name="plus" size={18} />
        {t('new.title')}
      </Button>
      <NewTaskDialog
        key={open ? 'open' : 'closed'}
        open={open}
        panel={panel}
        slots={slots}
        columns={columns}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * A new task of `panel` (meeting0, canvas «کار تازه» 2A): for me, and for the panel's admin also for
 * colleagues (found by name, each gets their own copy) or the whole team; the server checks the
 * same rule. `about`: the customer it is about (their page), whose own people are `suggested`.
 * `slots`: the panel's week to pick a time on («از تقویم»; the seller's sessions, my tasks).
 */
export function NewTaskDialog({
  open,
  panel,
  onClose,
  about,
  suggested,
  due,
  day: dueDay,
  slots: PickSlots,
  columns = [],
  onCreated,
  also = TASKS_KEY,
}: {
  open: boolean;
  panel: TasksPanel;
  onClose: () => void;
  about?: { id: number; name: string } | undefined;
  suggested?: readonly Colleague[] | undefined;
  /** Opened on an hour of the calendar: due then (another can be set). */
  due?: Date | undefined;
  /** Opened on a day of the calendar: due that day, with no hour (one can be set). */
  day?: Date | undefined;
  /** Each panel's picker of a time on its week; without one there is no «از تقویم». */
  slots?: Slots | undefined;
  /** My board's columns (opened on it): a task for me can go on one. */
  columns?: readonly BoardColumnChoice[] | undefined;
  /** After it is saved (the opener refreshes what shows the new task). */
  onCreated?: (() => void) | undefined;
  /** What else shows the new task (the customer's page). */
  also?: QueryKey;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const user = useUser();
  const admin = canAssignTasks(user, panel);
  const penalizes = admin && canPenalize(user);
  const create = useCreateTask(also);
  const client = useQueryClient();
  const [column, setColumn] = useState('');
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Target>('me');
  const [people, setPeople] = useState<Colleague[]>([]);
  const [penalty, setPenalty] = useState(false);
  const [when, setWhen] = useState<(typeof WHENS)[number]>(
    due ? 'other' : dueDay ? 'day' : 'tomorrow',
  );
  const [date, setDate] = useState(due ? toValue(due, true) : '');
  const [day, setDay] = useState(dueDay ? toValue(dueDay, false) : '');
  const [checked, setChecked] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickedAt = when === 'other' ? parseValue(date) : null;

  const n = people.length;
  const dueAt =
    when === 'day' ? null : when === 'other' ? fromLocalInput(date) : quickWhen(when).toISOString();
  const sendLabel =
    target === 'person'
      ? n > 1
        ? t('new.send.many', { n: f.number(n) })
        : n === 1
          ? t('new.send.person', { name: people[0]?.name ?? '' })
          : t('new.send.people')
      : t(`new.send.${target}`);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (!text.trim() || (when === 'day' ? !day : !dueAt) || (target === 'person' && n === 0))
      return;
    const task: NewTask = {
      panel,
      user: about?.id ?? null,
      text: text.trim(),
      kind: target === 'me' ? 'mine' : 'request',
      ...(dueAt ? { due_at: dueAt } : { due_on: day }),
      ...(target === 'person' && { assignees: people.map((colleague) => colleague.id) }),
      ...(target === 'team' && { everyone: true }),
      ...(penalty && target !== 'me' && { penalty: true }),
      ...(column && target === 'me' && { column: Number(column) }),
    };
    create.mutate(task, {
      onError: () => toast.error(t('error')),
      onSuccess: () => {
        onCreated?.();
        if (task.column) void client.invalidateQueries({ queryKey: BOARDS_KEY });
        toast.success(
          target === 'person'
            ? t('new.sent.people', { n: f.number(n) })
            : target === 'team'
              ? t('new.sent.team')
              : t('new.sent.me', { when: dueAt ? f.dateTime(dueAt) : f.date(`${day}T12:00`) }),
        );
        onClose();
      },
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('new.title')}
      subtitle={admin ? t('new.admin') : undefined}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="new-task" disabled={create.isPending} className="flex-1">
            {sendLabel}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="new-task" noValidate onSubmit={submit} className="flex flex-col gap-6">
        {admin ? (
          <ChoiceGroup
            legend={t('new.for')}
            look="trio"
            value={target}
            onChange={setTarget}
            options={TARGETS.map((value) => ({
              value,
              label: t(`new.target.${value}`),
              hint: t(`new.targetHint.${value}`),
            }))}
            hint={target === 'team' ? t('new.teamHint') : undefined}
          />
        ) : (
          <p className="m-0 text-sm leading-6 text-text-2">{t('new.selfOnly')}</p>
        )}
        {target === 'person' && (
          <ColleagueSearch
            label={t('new.people')}
            panel={panel}
            multiple
            picked={people}
            onChange={setPeople}
            suggested={suggested}
            hint={n > 1 ? t('new.eachOwn') : t('new.several')}
            error={checked && n === 0 ? t('new.pickSomeone') : undefined}
          />
        )}
        <TextAreaField
          label={about ? t('new.whatAbout', { name: about.name }) : t('new.what')}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          hint={checked && !text.trim() ? t('new.required') : undefined}
        />
        <ChoiceGroup
          legend={t('new.due')}
          value={when}
          onChange={setWhen}
          extra={
            PickSlots && (
              <PickChip on={pickedAt !== null} onClick={() => setPicking(true)}>
                <Icon name="calendar" size={16} />
                {pickedAt
                  ? t('new.picked', { day: f.weekdayName(pickedAt), time: f.time(pickedAt) })
                  : t('new.fromCalendar')}
              </PickChip>
            )
          }
          options={WHENS.map((value) => ({
            value,
            label:
              value === 'other'
                ? t('new.other')
                : value === 'day'
                  ? t('new.dayOnly')
                  : t(`done.whenOption.${value}`),
          }))}
          hint={target === 'me' && when !== 'day' ? t('new.meHint') : undefined}
        />
        {when === 'other' && (
          <LazyDatePicker
            time
            only="future"
            label={t('new.date')}
            value={date}
            onChange={setDate}
            error={checked && !dueAt ? t('new.dateRequired') : undefined}
          />
        )}
        {when === 'day' && (
          <LazyDatePicker
            only="future"
            label={t('new.day')}
            hint={t('new.dayHint')}
            value={day}
            onChange={setDay}
            error={checked && !day ? t('new.dayRequired') : undefined}
          />
        )}
        {target === 'me' && columns.length > 0 && (
          <SelectField
            label={t('new.column')}
            value={column}
            onChange={setColumn}
            options={[
              { value: '', label: t('new.noColumn') },
              ...columns.map((choice) => ({ value: String(choice.id), label: choice.name })),
            ]}
          />
        )}
        {penalizes && target !== 'me' && (
          <div className="rounded-card-sm bg-warn-tint px-3">
            <Switch
              label={t('new.penalty')}
              description={t('new.penaltyHint')}
              checked={penalty}
              onChange={setPenalty}
            />
          </div>
        )}
      </form>
      {PickSlots && (
        <Dialog
          open={picking}
          onClose={() => setPicking(false)}
          size="wide"
          title={t('new.calendarTitle')}
          subtitle={t('new.calendarHint')}
          closeLabel={t('close')}
        >
          {picking && (
            // The picker's calendar loads with it, not with the composer.
            <Suspense fallback={null}>
              <PickSlots
                value={pickedAt ? date : ''}
                onChange={(value) => {
                  setWhen('other');
                  setDate(value);
                  setPicking(false);
                }}
              />
            </Suspense>
          )}
        </Dialog>
      )}
    </Dialog>
  );
}

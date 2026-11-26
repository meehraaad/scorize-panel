import type { QueryKey } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { Switch } from '@/components/ui/Switch';
import { useUser } from '@/lib/auth/session';
import { toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { TASKS_KEY, type Colleague, type NewTask, type TasksPanel } from '@/lib/tasks/api';
import { useCreateTask } from '@/lib/tasks/changes';
import { canAssignTasks, canPenalize } from '@/lib/tasks/rights';
import { toast } from '@/lib/toast';
import { fromLocalInput, quickWhen } from '@/lib/when';
import { ColleagueSearch } from './ColleagueSearch';

const TARGETS = ['me', 'person', 'team'] as const;
type Target = (typeof TARGETS)[number];
const WHENS = ['evening', 'tomorrow', 'week', 'day', 'other'] as const;

/** «کار تازه» in a page header: opens the composer for `panel`'s tasks. */
export function NewTaskButton({ panel }: { panel: TasksPanel }) {
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
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * A new task of `panel` (meeting0, canvas «کار تازه» 2A): for me, and for the panel's admin also for
 * colleagues (found by name, each gets their own copy) or the whole team; the server checks the
 * same rule. `about`: the customer it is about (their page), whose own people are `suggested`.
 */
export function NewTaskDialog({
  open,
  panel,
  onClose,
  about,
  suggested,
  due,
  onCreated,
  also = TASKS_KEY,
}: {
  open: boolean;
  panel: TasksPanel;
  onClose: () => void;
  about?: { id: number; name: string } | undefined;
  suggested?: readonly Colleague[] | undefined;
  /** Opened on a day of the calendar: a task for me that day (no hour; one can be set). */
  due?: Date | undefined;
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
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Target>('me');
  const [people, setPeople] = useState<Colleague[]>([]);
  const [penalty, setPenalty] = useState(false);
  const [when, setWhen] = useState<(typeof WHENS)[number]>(due ? 'day' : 'tomorrow');
  const [date, setDate] = useState(due ? toValue(due, true) : '');
  const [day, setDay] = useState(due ? toValue(due, false) : '');
  const [checked, setChecked] = useState(false);

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
    };
    create.mutate(task, {
      onError: () => toast.error(t('error')),
      onSuccess: () => {
        onCreated?.();
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
    </Dialog>
  );
}

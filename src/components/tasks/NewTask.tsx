import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ColleaguePicker } from './ColleaguePicker';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  TASKS_KEY,
  TASK_TEAMS,
  type Colleague,
  type NewTask,
  type TaskTeam,
} from '@/lib/tasks/api';
import { useCreateTask } from '@/lib/tasks/changes';
import { toast } from '@/lib/toast';
import { fromLocalInput, quickWhen } from '@/lib/when';

const TARGETS = ['me', 'people', 'team'] as const;
type Target = (typeof TARGETS)[number];
const WHENS = ['evening', 'tomorrow', 'week', 'day', 'other'] as const;

/** «کار تازه» in a page header: opens the composer. */
export function NewTaskButton({ colleagues }: { colleagues: Colleague[] }) {
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
        colleagues={colleagues}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * A task with nobody to attach (tasks about a person start on their page): for me, for one or
 * more colleagues (each gets their own copy and I follow them in one row), or for a team's queue.
 * Panel-neutral; canvas "کار تازه (همه‌ی پنل‌ها)".
 */
export function NewTaskDialog({
  open,
  colleagues,
  onClose,
  due,
  onCreated,
}: {
  open: boolean;
  colleagues: Colleague[];
  onClose: () => void;
  /** Opened on a day of the calendar: a task for me that day (no hour; one can be set). */
  due?: Date | undefined;
  /** After it is saved (the opener refreshes what shows the new task). */
  onCreated?: (() => void) | undefined;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const create = useCreateTask(TASKS_KEY);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Target>(due ? 'me' : 'people');
  const [picked, setPicked] = useState<number[]>([]);
  const [team, setTeam] = useState<TaskTeam>(TASK_TEAMS[0]);
  const [when, setWhen] = useState<(typeof WHENS)[number]>(due ? 'day' : 'tomorrow');
  const [date, setDate] = useState(due ? toValue(due, true) : '');
  const [day, setDay] = useState(due ? toValue(due, false) : '');
  const [checked, setChecked] = useState(false);

  const chosen = colleagues.filter((colleague) => picked.includes(colleague.id));
  const toggle = (id: number) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  const n = chosen.length;
  const dueAt =
    when === 'day' ? null : when === 'other' ? fromLocalInput(date) : quickWhen(when).toISOString();
  const sendLabel =
    target === 'people' && n > 1 ? t('new.send.many', { n: f.number(n) }) : t(`new.send.${target}`);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (!text.trim() || (when === 'day' ? !day : !dueAt) || (target === 'people' && n === 0))
      return;
    const task: NewTask = {
      user: null,
      text: text.trim(),
      kind: target === 'me' ? 'mine' : target === 'team' ? 'team' : 'request',
      ...(dueAt ? { due_at: dueAt } : { due_on: day }),
      ...(target === 'people' && { assignees: picked }),
      ...(target === 'team' && { team }),
    };
    create.mutate(task, {
      onError: () => toast.error(t('error')),
      onSuccess: () => {
        onCreated?.();
        toast.success(
          target === 'people'
            ? t('new.sent.people', { n: f.number(n) })
            : target === 'me'
              ? t('new.sent.me', { when: dueAt ? f.dateTime(dueAt) : f.date(`${day}T12:00`) })
              : t('new.sent.team'),
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
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="new-task" disabled={create.isPending}>
            {sendLabel}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="new-task" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextAreaField
          label={t('new.what')}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          hint={checked && !text.trim() ? t('new.required') : undefined}
        />
        <ChoiceGroup
          legend={t('new.for')}
          look="segmented"
          value={target}
          onChange={setTarget}
          options={TARGETS.map((value) => ({ value, label: t(`new.target.${value}`) }))}
          hint={target === 'me' ? t('new.meHint') : undefined}
        />
        {target === 'people' && (
          <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
            <legend className="sr-only">{t('new.people')}</legend>
            {chosen.length > 0 && (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t('new.picked')}>
                {chosen.map((colleague) => (
                  <li key={colleague.id}>
                    <button
                      type="button"
                      onClick={() => toggle(colleague.id)}
                      aria-label={t('new.remove', { name: colleague.name })}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tint px-3 text-sm font-medium text-primary-text"
                    >
                      {colleague.name}
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ColleaguePicker
              multiple
              colleagues={colleagues}
              picked={picked}
              onToggle={toggle}
              label={t('new.people')}
              searchLabel={t('new.search')}
              noMatch={t('new.noMatch')}
            />
            <span
              className={`text-sm leading-6 ${checked && n === 0 ? 'text-danger' : 'text-text-2'}`}
            >
              {checked && n === 0
                ? t('new.pickSomeone')
                : n > 1
                  ? t('new.eachOwn')
                  : t('new.several')}
            </span>
          </fieldset>
        )}
        {target === 'team' && (
          <ChoiceGroup
            legend={t('new.team')}
            value={team}
            onChange={setTeam}
            options={TASK_TEAMS.map((value) => ({ value, label: t(`team.name.${value}`) }))}
            hint={t('new.teamHint')}
          />
        )}
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
      </form>
    </Dialog>
  );
}

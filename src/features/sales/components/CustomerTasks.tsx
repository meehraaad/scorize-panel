import { useId, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ColleaguePicker } from '@/components/tasks/ColleaguePicker';
import { Button } from '@/components/ui/Button';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  TASK_TEAMS,
  type TaskKind,
  type TaskStatus,
  type TaskSummary,
  type TaskTeam,
} from '@/lib/tasks/api';
import { useCreateTask } from '@/lib/tasks/changes';
import { customerKey, type CustomerData } from '../api';
import { salesPath } from '../paths';
import { fromLocalInput, quickWhen } from '@/lib/when';
import { toast } from '@/lib/toast';

const STATUS_TONE: Record<TaskStatus, ChipTone> = {
  open: 'primary',
  sent: 'neutral',
  seen: 'neutral',
  in_progress: 'info',
  done: 'good',
  rejected: 'danger',
  queued: 'info',
};

const KINDS = ['mine', 'request', 'team'] as const satisfies readonly TaskKind[];
const WHENS = ['hour', 'evening', 'tomorrow', 'other'] as const;
type When = (typeof WHENS)[number];

/** Open tasks about this customer, and a form to add one (for me, a colleague or a team). */
export function CustomerTasks({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const first = customer.name.split(' ')[0] ?? customer.name;
  const [adding, setAdding] = useState(false);
  return (
    <SectionCard
      id="customer-tasks"
      title={t('customer.tasks.title', { name: first })}
      badge={
        customer.tasks.length > 0 ? (
          <span className="text-base font-medium text-text-2">
            {f.number(customer.tasks.length)}
          </span>
        ) : undefined
      }
      end={
        <span className="flex items-center gap-1">
          <Link
            to={salesPath('tasks')}
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-text-2 hover:text-text"
          >
            {t('customer.tasks.all')}
          </Link>
          <button
            type="button"
            aria-expanded={adding}
            onClick={() => setAdding((open) => !open)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-tint px-4 text-[13px] font-semibold text-primary-text"
          >
            <Icon name={adding ? 'close' : 'plus'} size={15} />
            {t(adding ? 'cancel' : 'customer.tasks.add')}
          </button>
        </span>
      }
    >
      {adding && <NewTaskForm customer={customer} name={first} onDone={() => setAdding(false)} />}
      <TaskList tasks={customer.tasks} />
    </SectionCard>
  );
}

/** The kind of task as an icon tile: mine, asked of a colleague, or a team's queue. */
const KIND_LOOK: Record<TaskKind, { icon: IconName; tone: string }> = {
  mine: { icon: 'clock', tone: 'bg-tint text-primary-text' },
  request: { icon: 'user', tone: 'bg-info-tint text-info' },
  team: { icon: 'send', tone: 'bg-info-tint text-info' },
};

function TaskList({ tasks }: { tasks: TaskSummary[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  // Read once: whether a task is late doesn't need to change while the page is open.
  const [now] = useState(() => Date.now());
  if (tasks.length === 0) return <EmptyState>{t('customer.tasks.empty')}</EmptyState>;
  const when = (task: TaskSummary) => `${f.dateShort(task.due_at)} ${f.time(task.due_at)}`;
  return (
    <ul className="m-0 list-none p-0 pb-3">
      {tasks.map((task) => {
        const late = new Date(task.due_at).getTime() < now && task.status !== 'done';
        const meta =
          task.kind === 'mine'
            ? t('customer.tasks.meta.mine', { due: when(task) })
            : task.kind === 'request'
              ? t('customer.tasks.meta.request', {
                  creator: task.creator ?? t('customer.history.system'),
                  owner: task.owner ?? '',
                  due: when(task),
                })
              : t('customer.tasks.meta.team', {
                  auto: task.automatic ? t('customer.tasks.automatic') : '',
                  team: task.team ? t(`customer.team.${task.team}`) : '',
                  due: when(task),
                });
        return (
          <li
            key={task.id}
            className="flex items-center gap-3 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
          >
            <span
              aria-hidden="true"
              className={`flex size-[38px] flex-none items-center justify-center rounded-xl ${
                late ? 'bg-warn-tint text-warn' : KIND_LOOK[task.kind].tone
              }`}
            >
              <Icon name={KIND_LOOK[task.kind].icon} size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] leading-7 font-semibold">{task.text}</span>
              <span className={`text-xs ${late ? 'text-urgent' : 'text-text-2'}`}>{meta}</span>
            </span>
            <Chip tone={STATUS_TONE[task.status]} small>
              {t(`customer.tasks.status.${task.status}`)}
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}

function NewTaskForm({
  customer,
  name,
  onDone,
}: {
  customer: CustomerData;
  name: string;
  onDone: () => void;
}) {
  const { t } = useTranslation('sales');
  const create = useCreateTask(customerKey(customer.id));
  const [text, setText] = useState('');
  const [kind, setKind] = useState<TaskKind>('mine');
  const [peer, setPeer] = useState(customer.colleagues[0]?.id);
  const peerHint = useId();
  const [team, setTeam] = useState<TaskTeam>('writing');
  const [when, setWhen] = useState<When>('evening');
  const [date, setDate] = useState('');
  const [missing, setMissing] = useState(false);

  const dueAt = when === 'other' ? fromLocalInput(date) : quickWhen(when).toISOString();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim() || !dueAt) {
      setMissing(true);
      return;
    }
    create.mutate(
      {
        user: customer.id,
        text: text.trim(),
        kind,
        due_at: dueAt,
        ...(kind === 'request' && peer !== undefined ? { assignee: peer } : {}),
        ...(kind === 'team' ? { team } : {}),
      },
      {
        onError: () => toast.error(t('error')),
        onSuccess: () => {
          setText('');
          setMissing(false);
          toast.success(t('customer.newTask.created'));
          onDone();
        },
      },
    );
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      className="mx-5 mb-4 flex flex-col gap-4 rounded-2xl bg-canvas p-5 lg:mx-8"
    >
      <TextField
        label={t('customer.newTask.label', { name })}
        placeholder={t(`customer.newTask.placeholder.${kind}`)}
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={missing && !text.trim() ? t('customer.newTask.required') : undefined}
      />
      <ChoiceGroup
        legend={t('customer.newTask.for')}
        value={kind}
        onChange={setKind}
        options={KINDS.map((value) => ({ value, label: t(`customer.newTask.forOption.${value}`) }))}
      />
      {kind === 'request' && customer.colleagues.length > 0 && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold text-text-2">
            {t('customer.newTask.peer')}
          </legend>
          <ColleaguePicker
            colleagues={customer.colleagues}
            picked={peer === undefined ? [] : [peer]}
            onToggle={setPeer}
            label={t('customer.newTask.peer')}
            searchLabel={t('customer.newTask.peerSearch')}
            noMatch={t('customer.newTask.peerNoMatch')}
            describedBy={peerHint}
          />
          <span id={peerHint} className="text-sm leading-6 text-text-2">
            {t('customer.newTask.peerHint')}
          </span>
        </fieldset>
      )}
      {kind === 'team' && (
        <SelectField
          label={t('customer.newTask.team')}
          hint={t('customer.newTask.teamHint')}
          value={team}
          onChange={setTeam}
          options={TASK_TEAMS.map((value) => ({ value, label: t(`customer.team.${value}`) }))}
        />
      )}
      <ChoiceGroup
        legend={t('customer.newTask.when')}
        value={when}
        onChange={setWhen}
        options={WHENS.map((value) => ({
          value,
          label: t(`customer.newTask.whenOption.${value}`),
        }))}
      />
      {when === 'other' && (
        <LazyDatePicker
          time
          only="future"
          label={t('customer.newTask.date')}
          value={date}
          onChange={setDate}
          error={missing && !dueAt ? t('customer.newTask.date') : undefined}
        />
      )}
      <Button type="submit" className="self-start" disabled={create.isPending}>
        {t(`customer.newTask.cta.${kind}`)}
      </Button>
    </form>
  );
}

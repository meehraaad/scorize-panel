import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  TASK_TEAMS,
  useCreateTask,
  type TaskKind,
  type TaskStatus,
  type TaskSummary,
  type TaskTeam,
} from '@/lib/tasks/api';
import { customerKey, type CustomerData } from '../api';
import { salesPath } from '../paths';
import { fromLocalInput, quickWhen } from '@/lib/when';

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
  const first = customer.name.split(' ')[0] ?? customer.name;
  return (
    <SectionCard
      id="customer-tasks"
      title={t('customer.tasks.title', { name: first })}
      end={
        <Link to={salesPath('tasks')} className="text-sm font-medium text-primary-text">
          {t('customer.tasks.all')}
        </Link>
      }
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TaskList tasks={customer.tasks} />
        <NewTaskForm customer={customer} name={first} />
      </div>
    </SectionCard>
  );
}

function TaskList({ tasks }: { tasks: TaskSummary[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  // Read once: whether a task is late doesn't need to change while the page is open.
  const [now] = useState(() => Date.now());
  if (tasks.length === 0) return <EmptyState>{t('customer.tasks.empty')}</EmptyState>;
  const when = (task: TaskSummary) =>
    task.date_only
      ? f.dateShort(task.due_at)
      : `${f.dateShort(task.due_at)} ${f.time(task.due_at)}`;
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
            className="flex items-start gap-3 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
          >
            <span
              aria-hidden="true"
              className={`mt-2 size-2 flex-none rounded-full ${late ? 'bg-hero-current' : 'bg-primary'}`}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] leading-7 font-medium">{task.text}</span>
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

function NewTaskForm({ customer, name }: { customer: CustomerData; name: string }) {
  const { t } = useTranslation('sales');
  const create = useCreateTask(customerKey(customer.id), 'sales');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<TaskKind>('mine');
  const [peer, setPeer] = useState(String(customer.colleagues[0]?.id ?? ''));
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
        ...(kind === 'request' ? { assignee: Number(peer) } : {}),
        ...(kind === 'team' ? { team } : {}),
      },
      {
        onSuccess: () => {
          setText('');
          setMissing(false);
        },
      },
    );
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4 bg-canvas px-5 py-5 lg:rounded-es-card lg:px-7"
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
        <SelectField
          label={t('customer.newTask.peer')}
          hint={t('customer.newTask.peerHint')}
          value={peer}
          onChange={setPeer}
          options={customer.colleagues.map((colleague) => ({
            value: String(colleague.id),
            label: t('customer.newTask.peerOption', { name: colleague.name, role: colleague.role }),
          }))}
        />
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
        <DatePicker
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
      {create.isSuccess && <Notice tone="success">{t('customer.newTask.created')}</Notice>}
      {create.isError && <Notice tone="error">{t('error')}</Notice>}
    </form>
  );
}

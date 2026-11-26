import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { TaskKind, TaskStatus, TaskSummary } from '@/lib/tasks/api';
import { customerKey, type CustomerData } from '../api';
import { salesPath } from '../paths';
import { FollowUpSlots } from './FollowUpWhen';

const NewTaskDialog = lazy(() =>
  import('@/components/tasks/NewTask').then((module) => ({ default: module.NewTaskDialog })),
);

const STATUS_TONE: Record<TaskStatus, ChipTone> = {
  open: 'primary',
  sent: 'neutral',
  seen: 'neutral',
  in_progress: 'info',
  done: 'good',
  rejected: 'danger',
  queued: 'info',
};

/** Open tasks about this customer, and the shared «کار تازه» panel about them (their people first). */
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
            aria-haspopup="dialog"
            onClick={() => setAdding(true)}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-tint px-4 text-[13px] font-semibold text-primary-text"
          >
            <Icon name="plus" size={15} />
            {t('customer.tasks.add')}
          </button>
        </span>
      }
    >
      {adding && (
        <Suspense fallback={null}>
          <NewTaskDialog
            open
            panel="sales"
            about={{ id: customer.id, name: first }}
            suggested={customer.colleagues}
            also={customerKey(customer.id)}
            slots={FollowUpSlots}
            onClose={() => setAdding(false)}
          />
        </Suspense>
      )}
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
  const when = (task: TaskSummary) =>
    task.timed === false
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFormat } from '@/lib/i18n/useFormat';
import { useTaskChange, type MyTask, type TaskSource, type TasksOverview } from '@/lib/tasks/api';
import { quickWhen, type QuickWhen } from '@/lib/when';
import type { TasksConfig } from '../config';
import { DoneDialog } from './DoneDialog';

const GROUPS = ['late', 'now', 'today'] as const;
type Group = (typeof GROUPS)[number];
const SOON = 60 * 60_000;
const DAY = 86_400_000;

const SOURCE_TONE: Record<TaskSource, ChipTone> = {
  system: 'info',
  me: 'neutral',
  chain: 'primary',
};
const SNOOZES = ['twoHours', 'tomorrow', 'week'] as const satisfies readonly QuickWhen[];
const REASONS = ['customer_later', 'waiting', 'no_time'] as const;

const groupOf = (task: MyTask, now: number): Group => {
  const due = new Date(task.due_at).getTime();
  if (due < now) return 'late';
  return due - now <= SOON ? 'now' : 'today';
};

/** My follow-ups for today: overdue first, then the next hour, then the rest. */
export function MyTasks({ data, config }: { data: TasksOverview; config: TasksConfig }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  // Read once: the groups don't need to move while the page is open.
  const [now] = useState(() => Date.now());
  const [done, setDone] = useState<MyTask | null>(null);

  if (data.mine.length === 0) return <EmptyState variant="card">{t('mine.empty')}</EmptyState>;

  return (
    <Card aria-label={t('view.mine.label')}>
      {GROUPS.map((group) => {
        const tasks = data.mine.filter((task) => groupOf(task, now) === group);
        if (tasks.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h2
              id={`group-${group}`}
              className={`m-0 flex items-center gap-2 px-5 pt-5 pb-2 text-sm font-bold lg:px-8 ${group === 'late' ? 'text-urgent' : group === 'now' ? 'text-primary-text' : 'text-neutral'}`}
            >
              {t(`mine.group.${group}`)}
              <span className="font-normal text-text-2">{f.number(tasks.length)}</span>
            </h2>
            <ul className="m-0 list-none p-0">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  late={group === 'late'}
                  now={now}
                  config={config}
                  onDone={() => setDone(task)}
                />
              ))}
            </ul>
          </section>
        );
      })}
      <p className="m-0 flex flex-wrap justify-between gap-2 px-5 py-4 text-sm text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
        <span>{t('mine.tomorrow', { n: f.number(data.tomorrow) })}</span>
        <span>{t('mine.doneToday', { n: f.number(data.done_today) })}</span>
      </p>
      <DoneDialog
        key={done?.id ?? 'closed'}
        task={done}
        config={config}
        onClose={() => setDone(null)}
      />
    </Card>
  );
}

function TaskRow({
  task,
  late,
  now,
  config,
  onDone,
}: {
  task: MyTask;
  late: boolean;
  now: number;
  config: TasksConfig;
  onDone: () => void;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const change = useTaskChange();
  const [snoozing, setSnoozing] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('customer_later');
  const daysLate = Math.max(1, Math.floor((now - new Date(task.due_at).getTime()) / DAY));
  const lateToday = late && now - new Date(task.due_at).getTime() < DAY;

  const snooze = (choice: (typeof SNOOZES)[number]) => {
    change.mutate({
      id: task.id,
      change: { kind: 'snooze', until: quickWhen(choice).toISOString(), reason },
    });
  };

  return (
    <li
      className={`flex flex-wrap gap-x-5 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:flex-nowrap lg:px-8 ${late ? 'bg-row-highlight' : ''}`}
    >
      <div className="flex w-20 flex-none flex-col">
        <span className={`text-base font-bold tabular-nums ${late ? 'text-urgent' : 'text-text'}`}>
          {late && !lateToday ? t('mine.daysLate', { n: f.number(daysLate) }) : f.time(task.due_at)}
        </span>
        {late && <span className="text-xs text-urgent">{t('mine.late')}</span>}
      </div>
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
        <span className="text-[15px] leading-7 font-semibold">{task.text}</span>
        <span className="text-[13px] text-text-2">
          <Link to={config.personPath(task.person.id)} className="font-medium text-primary-text">
            {task.person.name}
          </Link>
          {` · ${task.person.context}`}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Chip tone={SOURCE_TONE[task.source]} small>
            {t(`mine.source.${task.source}`)}
          </Chip>
          {task.snoozed > 0 && (
            <Chip tone="warn" small>
              {t('mine.snoozed', { n: f.number(task.snoozed) })}
            </Chip>
          )}
          {task.step !== null && (
            <Chip tone="neutral" small>
              {t(`mine.step.${config.person}`, { n: f.number(task.step) })}
            </Chip>
          )}
        </span>
        {snoozing && (
          <div
            role="group"
            aria-label={t('mine.snoozeLabel')}
            className="mt-2 flex flex-wrap items-end gap-2 rounded-2xl bg-canvas p-3"
          >
            <SelectField
              inline
              label={t('mine.reason')}
              value={reason}
              onChange={setReason}
              options={REASONS.map((value) => ({ value, label: t(`mine.reasonOption.${value}`) }))}
            />
            {SNOOZES.map((choice) => (
              <Button
                key={choice}
                variant="outline"
                className="h-11 px-4 text-sm"
                disabled={change.isPending}
                onClick={() => snooze(choice)}
              >
                {t(`mine.snoozeOption.${choice}`)}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-none flex-wrap items-start gap-2">
        {task.action !== 'open' && (
          <Link
            to={config.personPath(task.person.id, task.action)}
            className={buttonClass('outline', 'h-11 px-4 text-sm')}
          >
            {t(`mine.action.${task.action}`)}
          </Link>
        )}
        <Button
          className="h-11 px-4 text-sm"
          aria-label={t('mine.doneFor', { text: task.text })}
          onClick={onDone}
        >
          {t('mine.done')}
        </Button>
        <Button
          variant="outline"
          className="h-11 px-4 text-sm"
          aria-expanded={snoozing}
          onClick={() => setSnoozing(!snoozing)}
        >
          {t('mine.snooze')}
        </Button>
      </div>
    </li>
  );
}

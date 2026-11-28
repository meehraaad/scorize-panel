import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import type { MyTask, TaskRequest } from '@/lib/tasks/api';
import { useOpenTasks } from '@/lib/tasks/useOpenTasks';
import { useNow } from '@/lib/useNow';
import type { TasksConfig } from '../config';
import { DoneDialog } from './DoneDialog';
import { useDone } from './useDone';
import { useDueLabel } from './due';
import { RequestDialog } from './RequestDialog';
import { TickButton } from './StatusMark';

type Row = { kind: 'mine'; task: MyTask } | { kind: 'request'; task: TaskRequest };

/**
 * What is waiting for me, briefly: my follow-ups due by today and colleagues' requests, soonest
 * first (overdue on a tint). For the bell's popup and the dock; the tasks page has the rest.
 * A row opens the task with its conversation; a follow-up is done from its tick (outcome and next
 * step in the same dialog as on the tasks page).
 */
export function TaskPeek({ config, limit = 5 }: { config: TasksConfig; limit?: number }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const named = useDisplayName();
  const dueOf = useDueLabel();
  const { mine, requests, count } = useOpenTasks(config.panel);
  // A live clock: a row turns late while the popup stays open.
  const now = useNow(30_000);
  const { done, finish, close } = useDone();
  const [open, setOpen] = useState<Row | null>(null);

  if (mine.isError || requests.isError) return <Notice tone="error">{t('hub.error')}</Notice>;
  if (!mine.data || !requests.data) return <SkeletonRows rows={3} />;

  const rows: Row[] = [
    ...mine.data.results.map((task) => ({ kind: 'mine' as const, task })),
    ...requests.data.results.map((task) => ({ kind: 'request' as const, task })),
  ]
    .sort((a, b) => a.task.due_at.localeCompare(b.task.due_at))
    .slice(0, limit);

  if (rows.length === 0)
    return (
      <EmptyState title={t('hub.empty')} icon="check">
        {t('hub.emptyHint')}
      </EmptyState>
    );

  return (
    <>
      <ul className="m-0 list-none p-0">
        {rows.map((row) => {
          const due = dueOf(row.task, now);
          const who =
            row.kind === 'request'
              ? t('hub.requestFrom', { name: row.task.from.name })
              : row.task.person && named(row.task.person.name);
          return (
            <li
              key={`${row.kind}-${String(row.task.id)}`}
              className={`flex items-center gap-3 px-4 py-2.5 shadow-[inset_0_1px_0_var(--hair)] first:shadow-none ${
                due.late ? 'bg-row-highlight' : ''
              }`}
            >
              {row.kind === 'request' ? (
                <Avatar name={row.task.from.name} size="sm" />
              ) : row.task.person ? (
                <Avatar name={row.task.person.name} face={row.task.person.face ?? null} size="sm" />
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-canvas text-text-2"
                >
                  <Icon name="followUp" size={16} />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <button
                  type="button"
                  onClick={() => setOpen(row)}
                  aria-label={t('requests.openFor', { text: row.task.text })}
                  title={row.task.text}
                  className="truncate text-start text-sm font-semibold hover:text-primary-text"
                >
                  {row.task.text}
                </button>
                {who && (
                  <span title={who} className="truncate text-xs text-text-2">
                    {who}
                  </span>
                )}
              </span>
              <span
                className={`flex-none text-xs font-semibold tabular-nums ${due.late ? 'text-urgent' : 'text-text-2'}`}
              >
                {due.text}
              </span>
              {row.kind === 'mine' && (
                <TickButton
                  label={t('mine.doneFor', { text: row.task.text })}
                  onClick={() => finish(row.task)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {count > rows.length && (
        <p className="m-0 px-4 pt-2 text-xs text-text-2">
          {t('hub.more', { n: f.number(count - rows.length) })}
        </p>
      )}
      <DoneDialog key={done?.id ?? 'closed'} task={done} config={config} onClose={close} />
      <RequestDialog
        key={open ? `${open.kind}-${String(open.task.id)}` : 'none'}
        id={open?.task.id ?? null}
        config={config}
        followUp={open?.kind === 'mine'}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

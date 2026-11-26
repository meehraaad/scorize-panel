import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { FilterTabs } from '@/components/ui/Filters';
import { ProgressBar } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { taskListQuery, type MyTask, type SentRequest } from '@/lib/tasks/api';
import type { TasksConfig } from '../config';
import { DoneDialog } from './DoneDialog';
import { PersonRef } from './PersonRef';
import { RequestDialog } from './RequestDialog';
import { StatusMark, TickButton } from './StatusMark';
import { useDueLabel } from './due';

const FILTERS = ['all', 'late', 'sent'] as const;
type Filter = (typeof FILTERS)[number];

type Row =
  { kind: 'late'; due: number; task: MyTask } | { kind: 'sent'; due: number; request: SentRequest };

/** What still waits on a request I sent: not yet done by everyone, nor refused. */
const waiting = (request: SentRequest) => request.status !== 'done';

/**
 * «نیازمند توجه» (meeting0, canvas 1A): my overdue follow-ups and the requests I sent that are not
 * done yet, in one list by due time with the same columns (due, task, whom, state); a badge says
 * which each is and a filter keeps one kind. A group request is one row with its progress. Overdue
 * rows come from the first page of «پیگیری‌های من» (the same request as that list), the sent ones
 * with the page. Nothing to show: no card.
 */
export function AttentionCard({ sent, config }: { sent: SentRequest[]; config: TasksConfig }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const dueLabel = useDueLabel();
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('all');
  const [done, setDone] = useState<MyTask | null>(null);
  const [open, setOpen] = useState<{ id: number; sent: boolean } | null>(null);
  const mine = useQuery(taskListQuery(config.panel, 'mine', 1));

  const late: Row[] = (mine.data?.results ?? [])
    .filter((task) => new Date(task.due_at).getTime() < now)
    .map((task) => ({ kind: 'late', due: new Date(task.due_at).getTime(), task }));
  const asked: Row[] = sent
    .filter(waiting)
    .map((request) => ({ kind: 'sent', due: new Date(request.due_at).getTime(), request }));
  const all = [...late, ...asked].sort((a, b) => a.due - b.due);
  if (all.length === 0) return null;
  const rows = filter === 'all' ? all : all.filter((row) => row.kind === filter);
  const count = { all: all.length, late: late.length, sent: asked.length };
  const whom = (request: SentRequest) =>
    'team' in request.to
      ? t(`team.name.${request.to.team}`)
      : request.to.others > 0
        ? t('sent.toMany', { name: request.to.name, n: f.number(request.to.others) })
        : request.to.name;

  return (
    <Card aria-labelledby="attention-title">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 lg:px-8">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="attention-title" className="m-0 font-display text-lead font-bold">
            {t('attention.title')}
          </h2>
          <span className="text-small text-text-2">{t('attention.subtitle')}</span>
        </div>
        <FilterTabs
          label={t('attention.filter')}
          look="pills"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((value) => ({
            value,
            label: t(`attention.show.${value}`),
            count: f.number(count[value]),
          }))}
        />
      </div>
      {/* The columns' names, for the eye; each row's cells say what they are to screen readers. */}
      <div
        aria-hidden="true"
        className="grid grid-cols-[6.5rem_minmax(0,1fr)_12rem_8rem] gap-4 bg-row-highlight px-5 py-2.5 text-xs text-text-2 shadow-[inset_0_1px_0_var(--hair),inset_0_-1px_0_var(--hair)] max-lg:hidden lg:px-8"
      >
        <span>{t('attention.column.due')}</span>
        <span>{t('attention.column.task')}</span>
        <span>{t('attention.column.who')}</span>
        <span className="text-end">{t('attention.column.state')}</span>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 px-5 py-6 text-sm text-text-2 lg:px-8">{t('attention.none')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((row) => {
            const item = row.kind === 'late' ? row.task : row.request;
            const due = dueLabel(item, now);
            const isLate = row.kind === 'late';
            return (
              <li
                key={`${row.kind}-${String(item.id)}`}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 shadow-[inset_0_-1px_0_var(--hair)] lg:grid-cols-[6.5rem_minmax(0,1fr)_12rem_8rem] lg:px-8"
              >
                <span className="flex flex-col">
                  <span
                    className={`text-base font-bold tabular-nums ${due.late ? 'text-urgent' : 'text-text'}`}
                  >
                    {due.text}
                  </span>
                  {due.late && <span className="text-xs text-urgent">{t('mine.late')}</span>}
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOpen({ id: item.id, sent: !isLate })}
                    aria-label={t('requests.openFor', { text: item.text })}
                    className="cursor-pointer self-start text-start text-[15px] leading-7 font-semibold [overflow-wrap:anywhere] hover:text-primary-text"
                  >
                    {item.text}
                  </button>
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isLate ? 'bg-warn-tint text-urgent' : 'bg-tint text-primary-text'
                      }`}
                    >
                      {t(`attention.kind.${row.kind}`)}
                    </span>
                    {isLate && row.task.penalty && (
                      <span className="text-xs font-semibold text-warn">
                        {t('attention.penalty')}
                      </span>
                    )}
                    {isLate && row.task.person && (
                      <span className="min-w-0 truncate text-small text-text-2">
                        <PersonRef person={row.task.person} config={config} />
                      </span>
                    )}
                  </span>
                </span>
                <span className="col-span-2 flex min-w-0 flex-col gap-1.5 max-lg:order-last lg:col-span-1">
                  <span className="truncate text-sm font-semibold">
                    {isLate ? t('attention.me') : whom(row.request)}
                  </span>
                  {!isLate && row.request.progress && (
                    <span className="flex items-center gap-2">
                      <ProgressBar
                        size="sm"
                        className="flex-1"
                        value={Math.round(
                          (row.request.progress.done / row.request.progress.total) * 100,
                        )}
                      />
                      <span className="text-xs text-text-2 tabular-nums">
                        {t('attention.progress', {
                          done: f.number(row.request.progress.done),
                          total: f.number(row.request.progress.total),
                        })}
                      </span>
                    </span>
                  )}
                </span>
                <span className="flex justify-end">
                  {isLate ? (
                    <TickButton
                      label={t('mine.doneFor', { text: row.task.text })}
                      onClick={() => setDone(row.task)}
                    />
                  ) : (
                    <StatusMark status={row.request.status} />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <DoneDialog
        key={done?.id ?? 'closed'}
        task={done}
        config={config}
        onClose={() => setDone(null)}
      />
      <RequestDialog
        key={open?.id ?? 'none'}
        id={open?.id ?? null}
        config={config}
        sent={open?.sent ?? false}
        followUp={open ? !open.sent : false}
        onClose={() => setOpen(null)}
      />
    </Card>
  );
}

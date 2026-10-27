import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFormat } from '@/lib/i18n/useFormat';
import { useTaskChange, type TaskRequest } from '@/lib/tasks/api';
import type { TasksConfig } from '../config';
import { RequestDialog } from './RequestDialog';
import { StatusMark } from './StatusMark';

/** The one-button move from each status: start it, then finish it. */
const NEXT = { sent: 'in_progress', seen: 'in_progress', in_progress: 'done' } as const;

/** Colleagues' requests to me, with their status and one button for the next move. */
export function Requests({
  requests,
  pager,
  config,
}: {
  requests: TaskRequest[];
  /** Under the list, when it has more than one page. */
  pager?: ReactNode;
  config: TasksConfig;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const change = useTaskChange();
  const [open, setOpen] = useState<number | null>(null);

  if (requests.length === 0) return <EmptyState variant="card">{t('requests.empty')}</EmptyState>;

  return (
    <Card aria-label={t('view.requests.label')}>
      <ul className="m-0 list-none p-0">
        {requests.map((request) => {
          const step = request.status in NEXT ? (request.status as keyof typeof NEXT) : null;
          const next = step && NEXT[step];
          return (
            <li
              key={request.id}
              className={`flex flex-wrap gap-x-4 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] first:shadow-none lg:flex-nowrap lg:px-8 ${request.status === 'sent' ? 'bg-row-highlight' : ''}`}
            >
              <Avatar name={request.from.name} />
              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
                <span className="flex flex-wrap justify-between gap-2 text-[13px] text-text-2">
                  <span>
                    <span className="font-semibold text-text">{request.from.name}</span>
                    {` · ${request.from.role}`}
                  </span>
                  <span>{f.timeAgo(request.created_at)}</span>
                </span>
                <span className="text-[15px] leading-7 font-semibold">{request.text}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-2">
                  {request.person && (
                    <span>
                      {t('requests.about')}{' '}
                      <Link
                        to={config.personPath(request.person.id)}
                        className="font-medium text-primary-text"
                      >
                        {request.person.name}
                      </Link>
                    </span>
                  )}
                  <span>{t('requests.due', { when: f.dateTime(request.due_at) })}</span>
                  {request.comments > 0 && (
                    <span>{t('requests.comments', { n: f.number(request.comments) })}</span>
                  )}
                </span>
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <StatusMark status={request.status} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    aria-label={t('requests.openFor', { text: request.text })}
                    onClick={() => setOpen(request.id)}
                  >
                    {t('requests.open')}
                  </Button>
                  {next && (
                    <Button
                      className="h-11 px-4 text-sm"
                      disabled={change.isPending}
                      onClick={() =>
                        change.mutate({ id: request.id, change: { kind: 'status', status: next } })
                      }
                    >
                      {t(`requests.cta.${step}`)}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {pager}
      <RequestDialog
        key={open ?? 'closed'}
        id={open}
        config={config}
        onClose={() => setOpen(null)}
      />
    </Card>
  );
}

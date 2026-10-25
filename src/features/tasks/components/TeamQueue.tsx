import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { useTaskChange, type QueueItem } from '@/lib/tasks/api';
import type { TasksConfig } from '../config';

/** Tasks given to a team, not a person: whoever takes one first owns it. */
export function TeamQueue({
  items,
  pager,
  config,
}: {
  items: QueueItem[];
  /** Under the list, when it has more than one page. */
  pager?: ReactNode;
  config: TasksConfig;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const change = useTaskChange();
  return (
    <Card aria-label={t('view.team.label')} className="flex flex-col">
      <div className="p-5 pb-2 lg:px-8">
        <Notice tone="info">{t('team.note')}</Notice>
      </div>
      {items.length === 0 ? (
        <EmptyState>{t('team.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
                <span className="flex flex-wrap gap-1.5">
                  <Chip tone="neutral" small>
                    {t(`team.name.${item.team}`)}
                  </Chip>
                  {item.automatic && (
                    <Chip tone="info" small>
                      {t('mine.source.system')}
                    </Chip>
                  )}
                </span>
                <span className="text-[15px] leading-7 font-semibold">{item.text}</span>
                <span className="text-[13px] text-text-2">
                  {item.person && (
                    <>
                      {t('requests.about')}{' '}
                      <Link to={config.personPath(item.person.id)} className="text-primary-text">
                        {item.person.name}
                      </Link>
                      {' · '}
                    </>
                  )}
                  {t('team.waiting', { when: f.timeAgo(item.queued_at) })}
                </span>
              </div>
              {item.taken === null ? (
                <Button
                  className="h-11 px-4 text-sm"
                  aria-label={t('team.claimFor', { text: item.text })}
                  disabled={change.isPending}
                  onClick={() => change.mutate({ id: item.id, change: { kind: 'claim' } })}
                >
                  {t('team.claim')}
                </Button>
              ) : (
                <span className="text-sm text-good">{t(`team.taken.${item.taken}`)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {pager}
    </Card>
  );
}

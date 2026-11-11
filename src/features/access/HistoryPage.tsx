import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { historyQuery, keysQuery, type AccessChange } from './api';

/** Every change on the access pages, newest first: who gave or took what, from whom, when. */
export default function HistoryPage() {
  const { t } = useTranslation('access');
  const f = useFormat();
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery(historyQuery(page));
  const keys = useQuery(keysQuery());
  const label = (id: string) => keys.data?.keys.find((key) => key.id === id)?.label ?? id;

  const sentence = (change: AccessChange) =>
    t(`history.action.${change.action}`, {
      key: label(change.key),
      name: change.user?.name ?? t('dash'),
      group: change.group?.name ?? t('dash'),
    });

  return (
    <PageStack>
      <PageHeader title={t('history.title')} subtitle={t('history.subtitle')} />
      <Card aria-label={t('history.title')} aria-busy={!data}>
        {!data ? (
          <SkeletonRows rows={5} />
        ) : data.results.length === 0 ? (
          <EmptyState variant="padded">{t('history.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.results.map((change, index) => (
              <li
                key={change.id}
                className={`flex flex-col gap-0.5 px-5 py-3 lg:px-8 ${
                  index ? 'shadow-[inset_0_1px_0_var(--hair)]' : ''
                }`}
              >
                <span className="text-[15px]">{sentence(change)}</span>
                <span className="text-[13px] text-text-2">
                  {t('history.by', {
                    who: change.by?.name ?? t('dash'),
                    when: f.timeAgo(change.at),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data && data.count > data.page_size && (
          <Pager page={page} pages={pagesOf(data)} pending={isFetching} onPage={setPage} />
        )}
      </Card>
    </PageStack>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { activityQuery } from './api';
import { useCaseId } from './useCaseId';

/** Everything that happened on the case, newest first (CaseHistory). Canvas V1 "فعالیت‌ها". */
export default function CaseActivityPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const id = useCaseId();
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(activityQuery(id, page));
  const pages = data ? Math.max(1, Math.ceil(data.count / data.page_size)) : 1;

  return (
    <SectionCard id="case-history" title={t('activity.title')}>
      {!data ? (
        <SkeletonRows rows={6} />
      ) : data.results.length === 0 ? (
        <EmptyState>{t('activity.empty')}</EmptyState>
      ) : (
        <ol aria-busy={isPlaceholderData} className="m-0 list-none p-0">
          {data.results.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="flex-[1_1_320px] text-[15px] leading-7">{item.text}</span>
              <time dateTime={item.at} className="text-[13px] whitespace-nowrap text-text-2">
                {f.dateTime(item.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {data && data.count > 0 && (
        <Pager
          status={t('activity.pager', { page: f.number(page), pages: f.number(pages) })}
          page={page}
          pages={pages}
          pending={isPlaceholderData}
          onPage={setPage}
        />
      )}
    </SectionCard>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { Badge } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { inboxQuery, type InboxFilter } from './api';
import { casePath } from './paths';

/**
 * Every case's supervisors' thread in one list, those waiting for an answer first; a row opens the
 * conversation inside the case file. (The canvas has the nav item "تیکت‌ها ۷" but no screen.)
 */
export default function InboxPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [filter, setFilter] = useState<InboxFilter>('waiting');
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(inboxQuery(filter, page));
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);

  return (
    <PageStack>
      <PageHeader
        title={t('inbox.title')}
        subtitle={
          data
            ? data.counts.waiting > 0
              ? t('inbox.subtitle', { n: f.number(data.counts.waiting) })
              : t('inbox.subtitleClear')
            : undefined
        }
      />
      <FilterTabs
        label={t('inbox.filter')}
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
        options={(['waiting', 'all'] as const).map((value) => ({
          value,
          label: t(`inbox.${value}`),
          ...(data ? { count: f.number(data.counts[value]) } : {}),
        }))}
      />
      <Card aria-label={t('inbox.list')} aria-busy={!data || isPlaceholderData}>
        {!data ? (
          <SkeletonRows rows={5} />
        ) : data.results.length === 0 ? (
          <EmptyState variant="padded" title={t('inbox.emptyTitle')}>
            {t('inbox.empty')}
          </EmptyState>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.results.map((item) => (
              <li key={item.applicant.id} className="not-first:shadow-[inset_0_1px_0_var(--hair)]">
                <Link
                  to={casePath(item.applicant.id, 'tickets')}
                  className={`flex items-start gap-3 px-5 py-4 text-text hover:bg-canvas lg:px-8 ${
                    item.waiting_since ? 'bg-row-highlight' : ''
                  }`}
                >
                  <Avatar name={item.applicant.name} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{item.applicant.name}</span>
                      <span className="text-[13px] text-text-2">
                        {t('fileNumber', { n: f.digits(String(item.applicant.file_number)) })}
                      </span>
                      {item.urgent && (
                        <Chip tone="warn" small>
                          {t('inbox.urgent')}
                        </Chip>
                      )}
                    </span>
                    <span className="line-clamp-2 text-[15px] leading-7 text-text-2">
                      {item.last.mine
                        ? t('inbox.you', { text: item.last.text })
                        : t('inbox.from', { name: item.last.author, text: item.last.text })}
                    </span>
                    {item.waiting_since && (
                      <span className="text-[13px] font-semibold text-urgent">
                        {t('inbox.waitingSince', { when: f.timeAgo(item.waiting_since) })}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1.5">
                    <time dateTime={item.last.at} className="text-[13px] text-text-2">
                      {f.timeAgo(item.last.at)}
                    </time>
                    {item.unread > 0 && (
                      <>
                        <Badge>{f.number(item.unread)}</Badge>
                        <span className="sr-only">{t('inbox.unread')}</span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
        )}
      </Card>
    </PageStack>
  );
}

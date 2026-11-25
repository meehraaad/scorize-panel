import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Pager } from '@/components/ui/Pager';
import { Badge } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { openCaseChat } from '@/lib/supervisor/caseChats';
import { inboxQuery, type InboxFilter, type InboxItem } from './api';
import { casePath } from './paths';

/**
 * Every case's supervisors' thread in one list, those waiting for an answer first; a row opens the
 * conversation in the chat window, so the supervisor stays on the list and answers one after another. (The canvas has the nav item "تیکت‌ها ۷" but no screen.)
 */
export interface InboxPageProps {
  query?: typeof inboxQuery;
  controls?: ReactNode;
  threadLabel?: (item: InboxItem) => string;
  onOpenThread?: (item: InboxItem) => void;
  detailPath?: (item: InboxItem) => string;
}

export default function InboxPage({
  query = inboxQuery,
  controls,
  threadLabel,
  onOpenThread,
  detailPath,
}: InboxPageProps) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [filter, setFilter] = useState<InboxFilter>('waiting');
  const [page, setPage] = useState(1);
  const { data, error, isPlaceholderData } = useQuery(query(filter, page));
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);
  if (error && !data) throw error;

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
      {controls}
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
              <li
                key={`${String(item.applicant.id)}:${item.thread ?? ''}`}
                className={`flex items-stretch not-first:shadow-[inset_0_1px_0_var(--hair)] ${
                  item.waiting_since ? 'bg-row-highlight' : ''
                }`}
              >
                <button
                  type="button"
                  // The longest-waiting conversation (a service's, or the general one).
                  onClick={() => {
                    if (onOpenThread) onOpenThread(item);
                    else openCaseChat(item.applicant.id, item.applicant.name, item.thread ?? null);
                  }}
                  className="flex min-w-0 flex-1 items-start gap-3 py-4 ps-5 pe-2 text-start text-text hover:bg-canvas lg:ps-8"
                >
                  <Avatar name={item.applicant.name} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{item.applicant.name}</span>
                      <span className="text-[13px] text-text-2">
                        {t('fileNumber', { n: f.digits(String(item.applicant.file_number)) })}
                      </span>
                      {threadLabel && (
                        <Chip tone="neutral" small>
                          {threadLabel(item)}
                        </Chip>
                      )}
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
                </button>
                <Link
                  to={detailPath ? detailPath(item) : casePath(item.applicant.id)}
                  aria-label={t(detailPath ? 'inbox.openOrder' : 'inbox.openCase', {
                    name: item.applicant.name,
                  })}
                  title={t(detailPath ? 'inbox.openOrder' : 'inbox.openCase', {
                    name: item.applicant.name,
                  })}
                  className="flex w-14 flex-none items-center justify-center text-text-2 hover:bg-canvas hover:text-text lg:w-16"
                >
                  <Icon name="folder" size={20} />
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

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { QUEUE_VIEWS, queueQuery, type QueueView } from './api';
import { OrderList } from './components/OrderList';
import { CapacityCard, GuidesCard, WeekCard } from './components/QueueSide';

/**
 * The writer's orders: those waiting on them (soonest due first), on the applicant, and
 * delivered; this week's deliveries, their load and the team's guides on the side.
 * Design: canvas V8 "نگارش · سفارش‌ها" (WriterQueue).
 */
export default function QueuePage() {
  const { t } = useTranslation('writer');
  const f = useFormat();
  const user = useUser();
  const [view, setView] = useState<QueueView>('mine');
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(queueQuery(view, page));
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);
  const name = user.first_name || user.staff?.full_name || '';
  const waiting = data?.counts.mine ?? 0;

  return (
    <PageStack>
      <PageHeader
        title={
          waiting > 0
            ? t('queue.title', { name, n: f.number(waiting) })
            : t('queue.titleClear', { name })
        }
        subtitle={
          data &&
          (data.week.length > 0
            ? t('queue.subtitle', { n: f.number(data.week.length) })
            : t('queue.subtitleCalm'))
        }
      />
      <FilterTabs
        label={t('queue.views')}
        value={view}
        onChange={(next) => {
          setView(next);
          setPage(1);
        }}
        options={QUEUE_VIEWS.map((value) => ({
          value,
          label: t(`queue.view.${value}`),
          ...(data ? { count: f.number(data.counts[value]) } : {}),
        }))}
      />
      <PageColumns
        asideLabel={t('queue.side')}
        main={
          <Card aria-label={t(`queue.view.${view}`)} aria-busy={!data || isPlaceholderData}>
            {!data ? (
              <SkeletonRows rows={4} />
            ) : data.results.length === 0 ? (
              <EmptyState variant="padded">{t(`queue.empty.${view}`)}</EmptyState>
            ) : (
              <OrderList orders={data.results} />
            )}
            {pages > 1 && (
              <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
            )}
          </Card>
        }
        aside={
          data && (
            <>
              <WeekCard week={data.week} />
              <CapacityCard capacity={data.capacity} />
              <GuidesCard guides={data.guides} />
            </>
          )
        }
      />
    </PageStack>
  );
}

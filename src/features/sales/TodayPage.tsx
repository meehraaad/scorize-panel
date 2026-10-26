import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { QuerySection } from '@/components/ui/QuerySection';
import { Pager } from '@/components/ui/Pager';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { outreachQuery, activityQuery, insightsQuery, type CallBucket } from './api';
import { CallList } from './components/CallList';
import { HotLeads } from './components/HotLeads';
import { MonthCard, ReceiptsCard, TasksCard, TodayConsultationsCard } from './components/TodaySide';
import { UpsellSection } from './components/UpsellSection';
import { salesPath } from './paths';

/** The seller's home: who to call now, today's list, sessions, receipts, the month. Canvas "امروز". */
export default function TodayPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const user = useUser();
  const [page, setPage] = useState(1);
  const [hotPage, setHotPage] = useState(1);
  const [bucket, setBucket] = useState<CallBucket | 'all'>('all');
  const [activityPage, setActivityPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const outreach = useQuery(outreachQuery(page, hotPage, bucket));
  const activity = useQuery(activityQuery(activityPage));
  const insights = useQuery({ ...insightsQuery, enabled: expanded });
  useClampPage(outreach.data?.hot, hotPage, setHotPage);
  useClampPage(outreach.data?.calls, page, setPage);
  useClampPage(activity.data?.consultations, activityPage, setActivityPage);
  const waiting = outreach.data?.hot.count ?? 0;
  const name = user.first_name || user.staff?.full_name || '';

  return (
    <PageStack>
      <PageHeader
        title={
          !outreach.data
            ? t('today.greeting', { name })
            : waiting > 0
              ? t('today.title', { name, n: f.number(waiting) })
              : t('today.titleClear', { name })
        }
        subtitle={t('today.subtitleCalm', { n: f.number(outreach.data?.calls.count ?? 0) })}
        actions={
          <Link to={salesPath('leads?new=1')} className={buttonClass('outline')}>
            <Icon name="plus" size={18} />
            {t('today.newLead')}
          </Link>
        }
      />
      <QuerySection
        pending={outreach.isPending}
        error={outreach.error}
        retry={() => {
          void outreach.refetch();
        }}
      >
        {waiting > 0 && (
          <>
            <HotLeads leads={outreach.data?.hot.results ?? []} />
            <Pager page={hotPage} pages={pagesOf(outreach.data?.hot)} onPage={setHotPage} />
          </>
        )}
      </QuerySection>
      <PageColumns
        asideLabel={t('today.month.title')}
        main={
          <QuerySection
            pending={outreach.isPending}
            error={outreach.error}
            retry={() => {
              void outreach.refetch();
            }}
          >
            <CallList
              calls={outreach.data?.calls.results ?? []}
              counts={outreach.data?.calls.counts}
              tab={bucket}
              onTab={(value) => {
                setBucket(value);
                setPage(1);
              }}
            />
            <Pager page={page} pages={pagesOf(outreach.data?.calls)} onPage={setPage} />
          </QuerySection>
        }
        aside={
          <>
            <QuerySection
              pending={activity.isPending}
              error={activity.error}
              retry={() => {
                void activity.refetch();
              }}
            >
              {activity.data && <TasksCard tasks={activity.data.tasks} />}
              <TodayConsultationsCard consultations={activity.data?.consultations.results ?? []} />
              <Pager
                page={activityPage}
                pages={pagesOf(activity.data?.consultations)}
                onPage={setActivityPage}
              />
            </QuerySection>
            <ReceiptsCard />
            <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
              <summary className="min-h-11 cursor-pointer p-3">{t('today.month.title')}</summary>
              {expanded && (
                <QuerySection
                  pending={insights.isPending}
                  error={insights.error}
                  retry={() => {
                    void insights.refetch();
                  }}
                >
                  {insights.data && (
                    <>
                      <MonthCard month={insights.data.month} />
                      <UpsellSection items={insights.data.upsell} />
                    </>
                  )}
                </QuerySection>
              )}
            </details>
          </>
        }
      />
    </PageStack>
  );
}

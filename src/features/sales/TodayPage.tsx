import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { QuerySection } from '@/components/ui/QuerySection';
import { Pager } from '@/components/ui/Pager';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { outreachQuery, activityQuery, insightsQuery, type CallBucket } from './api';
import { CallList } from './components/CallList';
import { DayCalendar } from './components/DayCalendar';
import { HotLeads } from './components/HotLeads';
import { MonthCard, ReceiptsCard, TasksCard } from './components/TodaySide';
import { UpsellSection } from './components/UpsellSection';
import { salesPath } from './paths';

/**
 * The seller's home (canvas "امروز"), in order of what the day is made of: who to call now, then
 * the day itself (consultations and timed follow-ups on a calendar, beside the follow-up list),
 * then the chances to sell more, then tasks, receipts and the month.
 */
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
  useClampPage(
    activity.data
      ? {
          count: Math.max(
            pagesOf(activity.data.consultations),
            pagesOf(activity.data.calendar_calls),
          ),
          page_size: 1,
        }
      : undefined,
    activityPage,
    setActivityPage,
  );
  const calendarPages = Math.max(
    pagesOf(activity.data?.consultations),
    pagesOf(activity.data?.calendar_calls),
  );
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
        subtitle={t('today.subtitleCalm', { n: f.number(outreach.data?.calls.counts.all ?? 0) })}
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
      <div className="grid items-start gap-4 lg:gap-7 xl:grid-cols-2">
        <QuerySection
          pending={activity.isPending}
          error={activity.error}
          retry={() => {
            void activity.refetch();
          }}
        >
          <DayCalendar
            consultations={activity.data?.consultations.results ?? []}
            calls={activity.data?.calendar_calls.results ?? []}
          />
          <Pager page={activityPage} pages={calendarPages} onPage={setActivityPage} />
        </QuerySection>
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
            page={page}
            pages={pagesOf(outreach.data?.calls)}
            onPage={setPage}
            total={outreach.data?.calls.count ?? 0}
            tab={bucket}
            onTab={(value) => {
              setBucket(value);
              setPage(1);
            }}
          />
        </QuerySection>
      </div>
      <aside
        aria-label={t('today.more')}
        className="grid items-start gap-4 md:grid-cols-2 lg:gap-7 xl:grid-cols-3"
      >
        <QuerySection
          pending={activity.isPending}
          error={activity.error}
          retry={() => {
            void activity.refetch();
          }}
        >
          {activity.data && <TasksCard tasks={activity.data.tasks} />}
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
      </aside>
    </PageStack>
  );
}

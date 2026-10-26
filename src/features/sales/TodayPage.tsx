import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { QuerySection } from '@/components/ui/QuerySection';
import { Pager } from '@/components/ui/Pager';
import { pagesOf, slicePage, slicedPages, useClampPage } from '@/lib/api/page';
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
import { HOT_PAGE, HotLeads } from './components/HotLeads';
import { MonthCard, ReceiptsCard, TasksCard } from './components/TodaySide';
import { UpsellSection } from './components/UpsellSection';
import { salesPath } from './paths';

/**
 * The seller's home (canvas "امروز"), in order of what the day is made of: who to call now, then
 * the day itself (consultations and timed follow-ups on a calendar, beside the follow-up list),
 * then, on one screen, the chances to sell more, tasks, the month and receipts. Each part loads on
 * its own; the month and the chances only once they scroll into view.
 */
export default function TodayPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const user = useUser();
  const [page, setPage] = useState(1);
  const [hotPage, setHotPage] = useState(1);
  const [bucket, setBucket] = useState<CallBucket | 'all'>('all');
  const [activityPage, setActivityPage] = useState(1);
  const [insightsRef, insightsSeen] = useSeen<HTMLDivElement>();
  // Hot leads come in the server's pages: the hero shows them three at a time (`slicePage`).
  const [hotServerSize, setHotServerSize] = useState(HOT_PAGE);
  const hot = slicePage(hotPage, HOT_PAGE, hotServerSize);
  const outreach = useQuery(outreachQuery(page, hot.serverPage, bucket));
  const activity = useQuery(activityQuery(activityPage));
  const insights = useQuery({ ...insightsQuery, enabled: insightsSeen });
  const hotData = outreach.data?.hot;
  if (hotData && hotData.page_size !== hotServerSize) setHotServerSize(hotData.page_size);
  const hotPages = slicedPages(hotData?.count ?? 0, HOT_PAGE, hotServerSize);
  useClampPage(hotData && { count: hotPages, page_size: 1 }, hotPage, setHotPage);
  useClampPage(outreach.data?.calls, page, setPage);
  const calendarPages = Math.max(
    pagesOf(activity.data?.consultations),
    pagesOf(activity.data?.calendar_calls),
  );
  useClampPage(
    activity.data ? { count: calendarPages, page_size: 1 } : undefined,
    activityPage,
    setActivityPage,
  );
  const waiting = hotData?.count ?? 0;
  const name = user.first_name || user.staff?.full_name || '';
  const retry = (query: { refetch: () => Promise<unknown> }) => () => {
    void query.refetch();
  };

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
      <QuerySection pending={outreach.isPending} error={outreach.error} retry={retry(outreach)}>
        {hotData && waiting > 0 && (
          <HotLeads
            leads={hotData.results.slice(hot.offset, hot.offset + HOT_PAGE)}
            from={(hot.serverPage - 1) * hotServerSize + hot.offset}
            total={waiting}
            page={hotPage}
            pages={hotPages}
            onPage={setHotPage}
          />
        )}
      </QuerySection>
      {/* Side by side the two cards are one height; each scrolls inside. */}
      <div className="grid gap-4 lg:gap-7 xl:grid-cols-2 xl:grid-rows-[640px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <QuerySection pending={activity.isPending} error={activity.error} retry={retry(activity)}>
            <DayCalendar
              consultations={activity.data?.consultations.results ?? []}
              calls={activity.data?.calendar_calls.results ?? []}
            />
            {calendarPages > 1 && (
              <Pager page={activityPage} pages={calendarPages} onPage={setActivityPage} />
            )}
          </QuerySection>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <QuerySection pending={outreach.isPending} error={outreach.error} retry={retry(outreach)}>
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
      </div>
      {/* The rest of the day fits one screen: opportunities, tasks and the month, beside receipts. */}
      <div ref={insightsRef} className="grid items-start gap-4 lg:gap-7 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-7 xl:col-span-2">
          <QuerySection pending={insights.isPending} error={insights.error} retry={retry(insights)}>
            {insights.data && insights.data.upsell.length > 0 && (
              <UpsellSection items={insights.data.upsell} />
            )}
          </QuerySection>
          <div className="grid items-start gap-4 md:grid-cols-2 lg:gap-7">
            <QuerySection
              pending={activity.isPending}
              error={activity.error}
              retry={retry(activity)}
            >
              {activity.data && <TasksCard tasks={activity.data.tasks} />}
            </QuerySection>
            {/* Its loading and errors show once, above (same request as the chances). */}
            {insights.data && <MonthCard month={insights.data.month} />}
          </div>
        </div>
        <ReceiptsCard />
      </div>
    </PageStack>
  );
}

/** Whether the element has come near the screen once (it loads what it shows only then). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const element = ref.current;
    if (seen || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

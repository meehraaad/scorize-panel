import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuerySection } from '@/components/ui/QuerySection';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { phoneCallsQuery } from '@/lib/sales/phoneCalls';
import { taskListQuery } from '@/lib/tasks/api';
import { agendaOf } from './agenda';
import { activityQuery, insightsQuery, outreachQuery, receiptsQuery } from './api';
import { NextUpCard, type NextUp } from './components/NextUpCard';
import { TodayAgenda } from './components/TodayAgenda';
import { TodayAside } from './components/TodaySide';
import { salesPath } from './paths';
import { useNow } from './useNow';

const MINUTE = 60_000;

/**
 * The seller's home (canvas "داشبورد امروز"): the next person to call, with the result in one
 * click; below it one timetable for the whole day (what is due now on top, the rest at its hour);
 * beside it, quietly, the month, the chances to sell more and the team queue.
 */
export default function TodayPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const user = useUser();
  const now = useNow(MINUTE);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [asideRef, asideSeen] = useSeen<HTMLDivElement>();

  // The route's data lists the same queries (src/panels/sales): keep the two in step.
  const outreach = useQuery(outreachQuery(1, 1, 'overdue'));
  const activity = useQuery(activityQuery(1));
  const receipts = useQuery(receiptsQuery(1));
  const mine = useQuery(taskListQuery('sales', 'mine', 1));
  const requests = useQuery(taskListQuery('sales', 'requests', 1));
  const insights = useQuery({ ...insightsQuery, enabled: asideSeen });
  // Same query as the workspace's live-call listener, so this adds no request.
  const phone = useQuery({ ...phoneCallsQuery(user.id), enabled: ON_SERVER.livePhoneCalls });
  const needsExtension = phone.data?.available === true && !phone.data.extension;

  const agenda = agendaOf(
    {
      hot: outreach.data?.hot.results ?? [],
      overdue: outreach.data?.calls.results ?? [],
      timedCalls: activity.data?.calendar_calls.results ?? [],
      consultations: activity.data?.consultations.results ?? [],
      receipts: receipts.data?.results ?? [],
      tasks: mine.data?.results ?? [],
      requests: requests.data?.results ?? [],
    },
    now,
  );
  const people = agenda.now.filter(
    (item): item is NextUp => item.kind === 'lead' || item.kind === 'call',
  );
  const waiting = people.filter((item) => !skipped.includes(item.key));
  // Skipped everyone: start over from the first.
  const next = waiting[0] ?? people[0];
  const ready = Boolean(outreach.data && activity.data);
  const total = agenda.now.length + agenda.timed.length;
  const name = user.first_name || user.staff?.full_name || '';
  const retry = (query: { refetch: () => Promise<unknown> }) => () => {
    void query.refetch();
  };
  const sideError = receipts.error ?? mine.error ?? requests.error;

  return (
    <PageStack>
      <PageHeader
        title={
          !ready
            ? t('today.greeting', { name })
            : agenda.now.length > 0
              ? t('today.title', { name, n: f.number(agenda.now.length) })
              : t('today.titleClear', { name })
        }
        subtitle={
          ready
            ? agenda.now.length > 0
              ? t('today.subtitle', {
                  total: f.number(total),
                  now: f.number(agenda.now.length),
                })
              : t('today.subtitleClear', { total: f.number(total) })
            : undefined
        }
        actions={
          <Link to={salesPath('leads?new=1')} className={buttonClass('outline')}>
            <Icon name="plus" size={18} />
            {t('today.newLead')}
          </Link>
        }
      />
      {needsExtension && (
        <Notice tone="info">
          {t('officeExtension.missing')}{' '}
          <Link to="/settings" className="font-medium text-primary-text underline">
            {t('officeExtension.missingLink')}
          </Link>
        </Notice>
      )}
      {next && (
        <NextUpCard
          item={next}
          position={people.indexOf(next) + 1}
          total={agenda.now.length}
          onSkip={
            people.length > 1
              ? () => setSkipped((list) => (waiting.length > 1 ? [...list, next.key] : []))
              : null
          }
        />
      )}
      <div className="grid items-start gap-6 lg:gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          <QuerySection
            pending={outreach.isPending || activity.isPending}
            error={outreach.error ?? activity.error}
            retry={() => {
              void outreach.refetch();
              void activity.refetch();
            }}
          >
            <TodayAgenda
              agenda={agenda}
              now={now}
              more={{
                hot: Math.max(
                  0,
                  (outreach.data?.hot.count ?? 0) - (outreach.data?.hot.results.length ?? 0),
                ),
                overdue: Math.max(
                  0,
                  (outreach.data?.calls.count ?? 0) - (outreach.data?.calls.results.length ?? 0),
                ),
                stale: outreach.data?.calls.counts.new ?? 0,
                tasks:
                  (mine.data?.count ?? 0) > (mine.data?.results.length ?? 0) ||
                  (requests.data?.count ?? 0) > (requests.data?.results.length ?? 0),
              }}
            />
          </QuerySection>
          {sideError !== null && (
            <QuerySection
              pending={false}
              error={sideError}
              retry={() => {
                retry(receipts)();
                retry(mine)();
                retry(requests)();
              }}
            >
              {null}
            </QuerySection>
          )}
        </div>
        <div ref={asideRef} className="min-w-0">
          <QuerySection pending={false} error={insights.error} retry={retry(insights)}>
            <TodayAside
              month={insights.data?.month}
              upsell={insights.data?.upsell ?? []}
              tasks={activity.data?.tasks}
              instalments={insights.data?.instalments}
            />
          </QuerySection>
        </div>
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

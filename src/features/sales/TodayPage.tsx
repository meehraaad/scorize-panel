import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { FIRST_CALL_TARGET_MINUTES } from '@/lib/sales/api';
import { todayQuery } from './api';
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
  const { data } = useSuspenseQuery(todayQuery);
  // Read once per render: the hot list's timers tick on their own.
  const [now] = useState(() => Date.now());

  const waiting = data.hot.length;
  const fresh = data.hot.filter(
    (lead) => now - new Date(lead.created_at).getTime() < FIRST_CALL_TARGET_MINUTES * 60_000,
  ).length;
  const name = user.first_name || user.staff?.full_name || '';

  return (
    <PageStack>
      <PageHeader
        title={
          waiting > 0
            ? t('today.title', { name, n: f.number(waiting) })
            : t('today.titleClear', { name })
        }
        subtitle={
          fresh > 0
            ? t('today.subtitle', { n: f.number(fresh) })
            : t('today.subtitleCalm', { n: f.number(data.calls.length) })
        }
        actions={
          <Link to={salesPath('leads?new=1')} className={buttonClass('outline')}>
            <Icon name="plus" size={18} />
            {t('today.newLead')}
          </Link>
        }
      />
      {waiting > 0 && <HotLeads leads={data.hot} />}
      <div className="grid items-start gap-4 lg:gap-7 xl:grid-cols-2">
        <DayCalendar consultations={data.consultations} calls={data.calls} />
        <CallList calls={data.calls} />
      </div>
      {data.upsell.length > 0 && <UpsellSection items={data.upsell} />}
      <aside
        aria-label={t('today.more')}
        className="grid items-start gap-4 md:grid-cols-2 lg:gap-7 xl:grid-cols-3"
      >
        <TasksCard tasks={data.tasks} />
        <ReceiptsCard />
        <MonthCard month={data.month} />
      </aside>
    </PageStack>
  );
}

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { FIRST_CALL_TARGET_MINUTES } from '@/lib/sales/api';
import { todayQuery } from './api';
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
      <PageColumns
        asideLabel={t('today.month.title')}
        main={<CallList calls={data.calls} />}
        aside={
          <>
            <TasksCard tasks={data.tasks} />
            <TodayConsultationsCard consultations={data.consultations} />
            <ReceiptsCard receipts={data.receipts} />
            <MonthCard month={data.month} />
          </>
        }
      />
      {data.upsell.length > 0 && <UpsellSection items={data.upsell} />}
    </PageStack>
  );
}

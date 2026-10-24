import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '@/components/ui/buttonStyles';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  REPORT_PERIODS,
  reportsExportHref,
  reportsQuery,
  type ReportPeriod,
  type ReportsData,
} from './api';
import { CountryTable, MissedDeadlines, MonthsChart } from './components/ReportMain';
import { BotCard, IdleCases, RepliesCard } from './components/ReportSide';

/**
 * The supervisor's reports: their month in numbers, applications and admissions over half a
 * year, results by country, missed deadlines, ticket replies, idle cases and the email bot.
 * Design: canvas V8 "سوپروایزر · گزارش‌ها" (SupReports).
 */
export default function ReportsPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const { data, isPlaceholderData } = useQuery({
    ...reportsQuery(period),
    placeholderData: keepPreviousData,
  });

  return (
    <PageStack>
      <PageHeader
        title={t('reports.title')}
        subtitle={
          data &&
          t(period === 'quarter' ? 'reports.subtitleQuarter' : 'reports.subtitle', {
            month: f.monthYear(data.end),
          })
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterTabs
              label={t('reports.period')}
              value={period}
              onChange={setPeriod}
              options={REPORT_PERIODS.map((value) => ({
                value,
                label: t(`reports.periods.${value}`),
              }))}
            />
            <a href={reportsExportHref(period)} download className={buttonClass('outline')}>
              <Icon name="download" size={18} />
              {t('reports.export')}
            </a>
          </div>
        }
      />
      {data ? (
        <div aria-busy={isPlaceholderData} className="contents">
          <Report data={data} />
        </div>
      ) : (
        <SkeletonRows rows={8} />
      )}
    </PageStack>
  );
}

function Report({ data }: { data: ReportsData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const change = data.submitted.change;

  return (
    <>
      <StatGrid
        label={t('reports.summary')}
        stats={[
          {
            label: t('reports.stat.submitted'),
            value: f.number(data.submitted.count),
            unit: t('reports.stat.submittedUnit'),
            note:
              change === 0
                ? t('reports.stat.same')
                : t(change > 0 ? 'reports.stat.more' : 'reports.stat.fewer', {
                    n: f.number(Math.abs(change)),
                  }),
          },
          {
            label: t('reports.stat.accepted'),
            value: f.number(data.accepted.count),
            unit: t('reports.stat.acceptedUnit'),
            note: t('reports.stat.results', { n: f.number(data.accepted.results) }),
            tone: 'good',
          },
          {
            label: t('reports.stat.onTime'),
            value: t('reports.percent', { n: f.number(data.on_time.percent) }),
            note: t('reports.stat.goal', { n: f.number(data.on_time.goal) }),
            ...(data.on_time.percent < data.on_time.goal ? { tone: 'urgent' as const } : {}),
          },
          {
            label: t('reports.stat.documents'),
            value: f.number(data.documents_waiting.count),
            unit: t('reports.stat.documentsUnit'),
            ...(data.documents_waiting.oldest_at
              ? {
                  note: t('reports.stat.oldest', {
                    time: f.timeAgo(data.documents_waiting.oldest_at),
                  }),
                }
              : {}),
            ...(data.documents_waiting.count > 0 ? { tone: 'urgent' as const } : {}),
          },
        ]}
      />
      <PageColumns
        asideLabel={t('reports.followUps')}
        main={
          <>
            <MonthsChart months={data.months} />
            <CountryTable countries={data.countries} />
            <MissedDeadlines missed={data.missed} />
          </>
        }
        aside={
          <>
            <RepliesCard replies={data.replies} />
            <IdleCases idle={data.idle} />
            <BotCard bot={data.bot} />
          </>
        }
      />
    </>
  );
}

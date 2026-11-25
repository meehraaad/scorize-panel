import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { ReportPeriod, type ReportDays } from '@/components/ui/ReportPeriod';
import { ReportTable } from '@/components/ui/ReportTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { acquisitionQuery, type AcquisitionReport } from './acquisitionApi';

const steps = ['visits', 'cta', 'started', 'reserved', 'paid'] as const;

export default function AcquisitionPage() {
  const { t } = useTranslation('telemetry');
  const [days, setDays] = useState<ReportDays>(7);
  const report = useQuery(acquisitionQuery(days));
  return (
    <PageStack>
      <PageHeader
        title={t('acquisition.title')}
        subtitle={t('acquisition.description')}
        actions={
          <ReportPeriod
            days={days}
            change={setDays}
            busy={report.isFetching}
            refresh={() => void report.refetch()}
          />
        }
      />
      {report.isError && <Notice tone="error">{t('failed')}</Notice>}
      {report.isPending && <SkeletonRows rows={5} />}
      {report.data && <AcquisitionOverview data={report.data} />}
    </PageStack>
  );
}

function AcquisitionOverview({ data }: { data: AcquisitionReport }) {
  const { t } = useTranslation('telemetry');
  const f = useFormat();
  const { total, cohorts } = data;
  const percent = (count: number, visits: number) =>
    visits
      ? t('health.percent', { value: f.number(Math.round((1_000 * count) / visits) / 10) })
      : t('missing');
  const toman = (amount: number) => t('acquisition.toman', { value: f.number(amount) });
  return (
    <>
      <StatGrid
        label={t('acquisition.summary')}
        stats={[
          { label: t('acquisition.steps.visits'), value: f.number(total.visits) },
          { label: t('acquisition.bookings'), value: f.number(total.bookings) },
          {
            label: t('acquisition.paidBookings'),
            value: f.number(total.paid_bookings),
            note: t('acquisition.paidRate', { value: percent(total.paid, total.visits) }),
          },
          {
            label: t('acquisition.revenue'),
            value: f.number(total.revenue_toman),
            unit: t('acquisition.unit'),
          },
        ]}
      />
      <SectionCard
        id="consultation-funnel"
        title={t('acquisition.funnel')}
        subtitle={t('acquisition.funnelNote')}
        variant="panel"
      >
        <dl className="m-0 grid gap-4">
          {steps.map((step) => (
            <div key={step} className="grid gap-1.5">
              <div className="flex flex-wrap justify-between gap-2">
                <dt>{t(`acquisition.steps.${step}`)}</dt>
                <dd className="m-0 flex items-baseline gap-3 tabular-nums">
                  <strong>{f.number(total[step])}</strong>
                  <span className="text-sm text-text-2">{percent(total[step], total.visits)}</span>
                </dd>
              </div>
              <ProgressBar value={total.visits ? (100 * total[step]) / total.visits : 0} />
            </div>
          ))}
        </dl>
      </SectionCard>
      <SectionCard
        id="acquisition-campaigns"
        title={t('acquisition.campaigns')}
        subtitle={t('acquisition.campaignNote')}
      >
        <ReportTable
          labelledBy="acquisition-campaigns"
          columns={[
            t('acquisition.source'),
            t('acquisition.campaign'),
            t('acquisition.landing'),
            t('acquisition.steps.visits'),
            t('acquisition.bookings'),
            t('acquisition.paidBookings'),
            t('acquisition.conversion'),
            t('acquisition.revenue'),
          ]}
          rows={cohorts.map((row) => ({
            key: [row.surface, row.source, row.medium, row.campaign, row.landing].join('/'),
            cells: [
              <div key="source">
                <bdi>{row.source || t('acquisition.direct')}</bdi>
                {row.medium && (
                  <div className="text-xs text-text-2">
                    <bdi>{row.medium}</bdi>
                  </div>
                )}
              </div>,
              <bdi key="campaign">{row.campaign || t('missing')}</bdi>,
              <div key="landing">
                <bdi>{row.landing}</bdi>
                <div className="text-xs text-text-2">{t(`health.targets.${row.surface}`)}</div>
              </div>,
              f.number(row.visits),
              f.number(row.bookings),
              f.number(row.paid_bookings),
              percent(row.paid, row.visits),
              toman(row.revenue_toman),
            ],
          }))}
        />
      </SectionCard>
    </>
  );
}

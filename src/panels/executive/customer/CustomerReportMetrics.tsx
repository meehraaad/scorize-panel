import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { customerReportQuery, REPORT_PERIODS, type ReportPeriod } from './api';

export function CustomerReportMetrics({ id }: { id: number }) {
  const { t } = useTranslation('executive');
  const f = useFormat();
  const [period, setPeriod] = useState<ReportPeriod>('all');
  const { data, error, isPlaceholderData } = useQuery(customerReportQuery(id, period));
  if (error && !data) throw error;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <SelectField
          inline
          label={t('workspace.report.period')}
          value={period}
          options={REPORT_PERIODS.map((value) => ({
            value,
            label: t(`workspace.report.range.${value}`),
          }))}
          onChange={setPeriod}
        />
        <Button variant="outline" className="ms-auto" onClick={() => window.print()}>
          {t('workspace.report.print')}
        </Button>
      </div>
      <SectionCard id="service-progress" title={t('workspace.report.progress')} variant="panel">
        {!data || isPlaceholderData ? (
          <SkeletonRows rows={4} />
        ) : data.services.length ? (
          <ul className="m-0 list-none divide-y divide-hair p-0">
            {data.services.map((service) => (
              <li key={service.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{service.name}</div>
                  <p className="m-0 text-label text-text-2">
                    {[service.owner ?? t('customers.unassigned'), service.stage]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {service.progress !== null && (
                  <div className="w-28">
                    <ProgressBar value={service.progress} label={service.name} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{t('workspace.report.noServices')}</EmptyState>
        )}
      </SectionCard>
      {data && !isPlaceholderData && (
        <StatGrid
          label={t('workspace.report.response')}
          compact
          stats={[
            { label: t('workspace.report.answered'), value: f.number(data.answered), tone: 'good' },
            { label: t('workspace.report.waiting'), value: f.number(data.waiting) },
            { label: t('workspace.report.slow'), value: f.number(data.slow), tone: 'urgent' },
          ]}
        />
      )}
    </>
  );
}

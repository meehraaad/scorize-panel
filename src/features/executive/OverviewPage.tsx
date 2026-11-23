import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid, type Stat } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { overviewQuery, workPath } from './api';

export default function OverviewPage() {
  const { data } = useSuspenseQuery(overviewQuery);
  const { t } = useTranslation('executive');
  const f = useFormat();
  const active = data.services.reduce((sum, service) => sum + service.active, 0);
  const total = data.services.reduce((sum, service) => sum + service.total, 0);
  const stats: Stat[] = [
    { label: t('activeAssignments'), value: f.number(active), tone: 'primary' },
    { label: t('total'), value: f.number(total) },
  ];
  if (data.services.some((service) => service.key === 'writing')) {
    stats.push({ label: t('writingToDo'), value: f.number(data.writing_waiting) });
  }

  return (
    <PageStack>
      <PageHeader
        title={t('overview')}
        actions={
          <Link className={buttonClass('primary', '', 'md', 'rounded')} to={workPath()}>
            <Icon name="list" size={18} />
            {t('openWork')}
          </Link>
        }
      />
      <StatGrid
        label={t('workload')}
        stats={stats}
        compact
        className="max-sm:grid-cols-2 max-sm:[&>div:last-child:nth-child(odd)]:col-span-full"
      />
      <SectionCard id="executive-services" title={t('byService')}>
        {data.services.length === 0 ? (
          <EmptyState>{t('empty')}</EmptyState>
        ) : (
          <table className="w-full text-start text-body">
            <thead className="border-y border-hair bg-canvas text-small text-text-2">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium lg:px-8">
                  {t('service')}
                </th>
                <th scope="col" className="px-3 py-3 text-end font-medium">
                  {t('active')}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-medium sm:px-3">
                  {t('total')}
                </th>
                <th
                  scope="col"
                  className="hidden w-1/3 px-6 py-3 text-start font-medium sm:table-cell lg:px-8"
                >
                  {t('activeShare')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((service) => (
                <tr
                  key={service.key}
                  className="border-b border-hair last:border-0 hover:bg-canvas"
                >
                  <th scope="row" className="px-4 py-2 text-start font-semibold lg:px-8">
                    <Link
                      className="inline-flex min-h-11 items-center gap-3 rounded-lg text-text hover:text-primary-text hover:underline"
                      to={workPath(new URLSearchParams({ service: service.key }))}
                    >
                      <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-tint text-primary-text max-sm:hidden">
                        <Icon
                          name={
                            service.key === 'writing'
                              ? 'pen'
                              : service.key === 'admission'
                                ? 'graduation'
                                : 'folder'
                          }
                          size={18}
                        />
                      </span>
                      {service.name ?? t(service.key === 'writing' ? 'writing' : 'caseFile')}
                    </Link>
                  </th>
                  <td className="px-3 py-3 text-end font-semibold text-primary-text tabular-nums">
                    {f.number(service.active)}
                  </td>
                  <td className="px-4 py-3 text-end text-text-2 tabular-nums sm:px-3">
                    {f.number(service.total)}
                  </td>
                  <td className="hidden px-6 py-3 sm:table-cell lg:px-8">
                    <ProgressBar
                      value={service.total ? (100 * service.active) / service.total : 0}
                      label={t('activeShare')}
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </PageStack>
  );
}

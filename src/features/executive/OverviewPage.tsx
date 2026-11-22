import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { overviewQuery, workPath } from './api';

export default function OverviewPage() {
  const { data } = useSuspenseQuery(overviewQuery);
  const { t } = useTranslation(['executive', 'common']);
  const f = useFormat();
  return (
    <PageStack>
      <PageHeader title={t('common:panels.executive.nav.table')} />
      <Card className="overflow-x-auto">
        {data.services.length === 0 ? (
          <EmptyState variant="padded">{t('empty')}</EmptyState>
        ) : (
          <table className="w-full text-start">
            <thead className="text-text-2">
              <tr className="border-b border-hair">
                <th scope="col" className="px-5 py-3 text-start">
                  {t('service')}
                </th>
                <th scope="col" className="px-5 py-3 text-start">
                  {t('active')}
                </th>
                <th scope="col" className="px-5 py-3 text-start">
                  {t('total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((service) => (
                <tr key={service.key} className="border-b border-hair last:border-0">
                  <th scope="row" className="px-5 py-3 text-start font-medium">
                    <Link
                      className="inline-flex min-h-11 items-center text-primary-text hover:underline"
                      to={workPath(new URLSearchParams({ service: service.key }))}
                    >
                      {service.name ?? t(service.key === 'writing' ? 'writing' : 'caseFile')}
                    </Link>
                    {service.key === 'writing' && data.writing_waiting > 0 && (
                      <p className="m-0 text-body font-normal text-text-2">
                        {t('writingWaiting', { n: f.number(data.writing_waiting) })}
                      </p>
                    )}
                  </th>
                  <td className="px-5 py-3">{f.number(service.active)}</td>
                  <td className="px-5 py-3">{f.number(service.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageStack>
  );
}

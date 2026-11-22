import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { overviewQuery, workPath, workQuery } from '@/features/executive/api';
import { casePath } from '@/features/supervisor/paths';
import { orderPath } from '@/features/writer/paths';
import { pagesOf } from '@/lib/api/page';

export default function WorkPage() {
  const { t } = useTranslation(['executive', 'common', 'writer']);
  const [search, setSearch] = useSearchParams();
  const service = search.get('service') ?? '';
  const customerSelected = search.has('customer');
  const page = Math.max(1, Number.parseInt(search.get('page') ?? '', 10) || 1);
  const { data: overview } = useSuspenseQuery(overviewQuery);
  const { data, error, isPlaceholderData } = useQuery(workQuery(search));
  const pages = pagesOf(data);
  useEffect(() => {
    if (!data || isPlaceholderData || page <= pages) return;
    const next = new URLSearchParams(search);
    if (pages === 1) next.delete('page');
    else next.set('page', String(pages));
    setSearch(next, { replace: true });
  }, [data, isPlaceholderData, page, pages, search, setSearch]);
  if (error && !data) throw error;

  return (
    <PageStack>
      <PageHeader title={t('common:panels.executive.nav.work')} />
      <FilterTabs
        label={t('service')}
        value={service}
        options={[
          { value: '', label: t('all') },
          ...overview.services.map((entry) => ({
            value: entry.key,
            label: entry.name ?? t(entry.key === 'writing' ? 'writing' : 'caseFile'),
          })),
        ]}
        onChange={(value) => {
          const next = new URLSearchParams(search);
          next.delete('page');
          if (value) next.set('service', value);
          else next.delete('service');
          setSearch(next);
        }}
      />
      {customerSelected && (
        <Link className="self-start text-primary-text hover:underline" to={workPath()}>
          {t('allCustomers')}
        </Link>
      )}
      <Card className="overflow-x-auto" aria-busy={!data || isPlaceholderData}>
        {!data ? (
          <SkeletonRows rows={5} />
        ) : data.results.length === 0 ? (
          <EmptyState variant="padded">{t('empty')}</EmptyState>
        ) : (
          <table className="w-full text-start">
            <thead className="text-text-2">
              <tr className="border-b border-hair">
                <th scope="col" className="px-5 py-3 text-start">
                  {t('customer')}
                </th>
                <th scope="col" className="px-5 py-3 text-start">
                  {t('service')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((customer) => (
                <tr key={customer.id} className="border-b border-hair align-top last:border-0">
                  <th scope="row" className="px-5 py-4 text-start font-semibold">
                    {customer.name}
                  </th>
                  <td className="px-5 py-2">
                    <ul className="m-0 list-none p-0">
                      {customer.items.map((item) => (
                        <li
                          key={`${item.kind}:${String(item.id)}`}
                          className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1"
                        >
                          <Link
                            className="inline-flex min-h-11 items-center font-medium text-primary-text hover:underline"
                            to={item.case === null ? orderPath(item.id) : casePath(item.case)}
                          >
                            {item.case === null
                              ? t(`writer:type.${item.name}`)
                              : item.name || t('caseFile')}
                          </Link>
                          {item.detail && <span className="text-text-2">{item.detail}</span>}
                          <Chip tone="neutral" small>
                            {t(`status.${item.status}`)}
                          </Chip>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && pages > 1 && (
          <Pager
            page={page}
            pages={pages}
            pending={isPlaceholderData}
            onPage={(value) => {
              const next = new URLSearchParams(search);
              if (value === 1) next.delete('page');
              else next.set('page', String(value));
              setSearch(next);
            }}
          />
        )}
      </Card>
    </PageStack>
  );
}

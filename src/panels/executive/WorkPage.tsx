import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { overviewQuery, workPath, workQuery, type WorkItem } from '@/features/executive/api';
import { orderPath } from '@/features/writer/paths';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { CustomerName } from './CustomerName';
import { customerWorkDeskPath } from './customer/paths';

const statusTone: Record<WorkItem['status'], ChipTone> = {
  open: 'info',
  paused: 'warn',
  closed: 'neutral',
  new: 'primary',
  drafting: 'info',
  revision: 'warn',
  waiting_applicant: 'warn',
  delivered: 'good',
};

export default function WorkPage() {
  const { t } = useTranslation(['executive', 'common', 'writer']);
  const f = useFormat();
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
      <Card aria-busy={!data || isPlaceholderData}>
        <div className="flex flex-col gap-2 border-b border-hair px-4 py-3 sm:px-6 lg:px-8">
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
          <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 text-small text-text-2">
            <p className="m-0" aria-live="polite">
              {data &&
                !isPlaceholderData &&
                t('customerCount', { count: data.count, n: f.number(data.count) })}
            </p>
            {customerSelected && (
              <Link
                className="inline-flex min-h-11 items-center text-primary-text hover:underline"
                to={workPath()}
              >
                {t('allCustomers')}
              </Link>
            )}
          </div>
        </div>
        {!data ? (
          <SkeletonRows rows={5} />
        ) : data.results.length === 0 ? (
          <EmptyState variant="padded">{t('empty')}</EmptyState>
        ) : (
          <table className="w-full table-fixed text-start text-body">
            <thead className="bg-canvas text-small text-text-2">
              <tr className="border-b border-hair">
                <th
                  scope="col"
                  className="w-[36%] px-4 py-3 text-start font-medium sm:w-[30%] sm:px-6 lg:px-8"
                >
                  {t('customer')}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium sm:px-6 lg:px-8">
                  {t('assignedWork')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((customer) => (
                <tr key={customer.id} className="border-b border-hair align-top last:border-0">
                  <th scope="row" className="px-4 py-4 text-start font-semibold sm:px-6 lg:px-8">
                    <CustomerName name={customer.name} id={customer.id} />
                  </th>
                  <td className="px-4 py-1 sm:px-6 lg:px-8">
                    <ul className="m-0 list-none divide-y divide-hair p-0">
                      {customer.items.map((item) => (
                        <li
                          key={`${item.kind}:${String(item.id)}`}
                          className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
                        >
                          <div className="min-w-0 flex-[1_1_11rem]">
                            <Link
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg font-semibold wrap-anywhere text-primary-text hover:underline"
                              to={
                                item.case === null
                                  ? orderPath(item.id)
                                  : customerWorkDeskPath(customer.id)
                              }
                            >
                              {item.case === null
                                ? t(`writer:type.${item.name}`)
                                : item.name || t('caseFile')}
                              <Icon name="chevronEnd" size={15} className="shrink-0 opacity-70" />
                            </Link>
                            {item.detail && (
                              <p className="m-0 -mt-1 mb-1 text-small wrap-anywhere text-text-2">
                                {item.detail}
                              </p>
                            )}
                          </div>
                          <Chip tone={statusTone[item.status]} dot small>
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

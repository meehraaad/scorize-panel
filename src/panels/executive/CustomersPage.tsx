import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage, type Page } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { SEARCH_DELAY_MS } from '@/lib/useDebouncedValue';
import {
  customerPageOf,
  customersExportHref,
  customersQuery,
  CUSTOMER_ORDERS,
  CUSTOMER_QUEUES,
  CUSTOMER_SCOPES,
  CUSTOMER_STAGES,
} from './customersApi';
import { CustomerImport } from './CustomerImport';
import { CustomerRows } from './CustomerRows';
import './customers.css';

const QUEUE_COLOR = {
  today: 'text-text',
  late: 'text-danger',
  review: 'text-primary-text',
  reply: 'text-info',
  unassigned: 'text-warn',
};

export default function CustomersPage() {
  return <CustomerList />;
}

function useCustomerListParams() {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (key: string, value: string, replace = false) => {
      const next = new URLSearchParams(params);
      next.delete('page');
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace, preventScrollReset: true });
    },
    [params, setParams],
  );
  const page = customerPageOf(params);
  const setPage = useCallback(
    (value: number) => set('page', value > 1 ? String(value) : ''),
    [set],
  );
  return { params, set, page, setPage };
}

function CustomerList() {
  const { t } = useTranslation(['executive', 'supervisor', 'common']);
  const f = useFormat();
  const { params, set, page, setPage } = useCustomerListParams();
  const { data, error, isPlaceholderData } = useQuery(customersQuery(params));
  const search = params.get('search') ?? '';
  const setSearch = useCallback((value: string) => set('search', value, true), [set]);
  if (error && !data) throw error;
  const scope = params.get('scope') ?? 'mine';
  const queue = params.get('queue');
  const stageLabel = (stage: (typeof CUSTOMER_STAGES)[number]) =>
    stage === 'emailing' ? t('customers.emailing') : t(`supervisor:stage.${stage}`);

  return (
    <PageStack>
      <PageHeader
        title={t('common:panels.executive.nav.customers')}
        compact
        actions={
          <div className="flex min-w-0 grow flex-wrap items-center justify-between gap-3">
            <div className="customer-scopes min-w-0 rounded-full bg-track px-2 py-1">
              <FilterTabs
                label={t('customers.scope.label')}
                value={scope}
                options={CUSTOMER_SCOPES.flatMap((value) => {
                  const count = data?.scopes[value];
                  return count === undefined
                    ? []
                    : [{ value, label: t(`customers.scope.${value}`), count: f.number(count) }];
                })}
                onChange={(value) => set('scope', value === 'mine' ? '' : value)}
              />
            </div>
            <div className="ms-auto flex flex-wrap gap-2">
              {data?.can_import && <CustomerImport />}
              {data?.can_export && !isPlaceholderData && (
                <a href={customersExportHref(params)} className={buttonClass('outline')} download>
                  {t('customers.export')}
                </a>
              )}
            </div>
          </div>
        }
      />
      <div
        role="group"
        aria-label={t('customers.attention')}
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {CUSTOMER_QUEUES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={queue === value}
            onClick={() => set('queue', queue === value ? '' : value)}
            className="customer-queue flex min-h-11 flex-col gap-1 rounded-2xl bg-surface p-4 text-start shadow-panel"
          >
            <span
              className={`font-display text-title leading-none font-bold tabular-nums ${QUEUE_COLOR[value]}`}
            >
              {data && !isPlaceholderData ? f.number(data.queues[value]) : t('supervisor:dash')}
            </span>
            <span className="text-label">{t(`customers.queue.${value}`)}</span>
          </button>
        ))}
      </div>
      <ListCard
        data={data}
        pending={isPlaceholderData}
        page={page}
        setPage={setPage}
        filters={
          <>
            <div className="customer-filters">
              <CustomerSearch value={search} onSearch={setSearch} />
              <SelectField
                inline
                hideLabel
                label={t('customers.country')}
                value={params.get('country') ?? ''}
                onChange={(value) => set('country', value)}
                options={[
                  { value: '', label: t('customers.anyCountry') },
                  ...(data?.options.country ?? []),
                ]}
              />
              <SelectField
                inline
                hideLabel
                label={t('customers.stage')}
                value={params.get('stage') ?? ''}
                onChange={(value) => set('stage', value)}
                options={[
                  { value: '', label: t('customers.stage') },
                  ...CUSTOMER_STAGES.map((value) => ({ value, label: stageLabel(value) })),
                ]}
              />
              <SelectField
                inline
                hideLabel
                label={t('customers.contract')}
                value={params.get('contract') ?? ''}
                onChange={(value) => set('contract', value)}
                options={[
                  { value: '', label: t('customers.contract') },
                  ...(data?.options.contract ?? []),
                ]}
              />
              <SelectField
                inline
                hideLabel
                label={t('customers.order')}
                value={params.get('order') ?? CUSTOMER_ORDERS[0]}
                onChange={(value) => set('order', value === CUSTOMER_ORDERS[0] ? '' : value)}
                options={CUSTOMER_ORDERS.map((value) => ({
                  value,
                  label: t(`customers.sort.${value}`),
                }))}
              />
            </div>
            <FilterTabs
              label={t('service')}
              value={params.get('service') ?? ''}
              options={[{ value: '', label: t('all') }, ...(data?.options.service ?? [])]}
              onChange={(value) => set('service', value)}
              look="pills"
            />
          </>
        }
      >
        {data && <CustomerRows rows={data.results} />}
      </ListCard>
    </PageStack>
  );
}

function CustomerSearch({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const { t } = useTranslation('executive');
  const [previous, setPrevious] = useState(value);
  const [draft, setDraft] = useState(value);
  // Browser navigation may restore a different search while keeping the page mounted.
  if (value !== previous) {
    setPrevious(value);
    setDraft(value);
  }

  const search = draft.trim();
  useEffect(() => {
    if (search === value) return;
    const timeout = setTimeout(() => onSearch(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [search, value, onSearch]);

  return (
    <SearchField
      label={t('customers.search')}
      placeholder={t('customers.searchPlaceholder')}
      value={draft}
      className="customer-search min-w-0"
      maxLength={150}
      onChange={setDraft}
      onEnter={() => {
        if (search !== value) onSearch(search);
      }}
    />
  );
}


function ListCard({
  data,
  pending,
  page,
  setPage,
  filters,
  children,
}: {
  data: Page<unknown> | undefined;
  pending: boolean;
  page: number;
  setPage: (page: number) => void;
  filters: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation('executive');
  const f = useFormat();
  const pages = pagesOf(data);
  useClampPage(pending ? undefined : data, page, setPage);

  return (
    <Card className="customer-list" aria-label={t('customers.list')} aria-busy={!data || pending}>
      <div className="flex flex-col gap-3 border-b border-hair px-5 pt-4 pb-3">{filters}</div>
      {!data || pending ? (
        <SkeletonRows rows={5} />
      ) : (
        <>
          {data.results.length ? (
            children
          ) : (
            <EmptyState variant="padded">{t('customers.empty')}</EmptyState>
          )}
          <Pager
            status={t('customers.page', {
              count: data.count,
              n: f.number(data.count),
              page: f.number(Math.min(page, pages)),
              pages: f.number(pages),
            })}
            page={page}
            pages={pages}
            onPage={setPage}
            numbered
          />
        </>
      )}
    </Card>
  );
}

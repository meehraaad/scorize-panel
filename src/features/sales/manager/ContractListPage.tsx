import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { contractBuilderQuery, contractOverviewQuery, type ContractOverviewRow, type RuleLimits } from '../api';
import { useSalesFormat } from '../format';
import { contractPath } from '../paths';
import { NewContract } from './NewContract';

type Filter = 'all' | 'on' | 'off';

/**
 * The manager's contracts (S74): every kind as a card (what it offers, who it is for, whether
 * sellers can pick it), a way to make a new one, and a link to each one's settings.
 */
export default function ContractListPage() {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(contractOverviewQuery);
  // The names of degrees and currencies come with the standard contract's builder.
  const { limits } = useSuspenseQuery(contractBuilderQuery(null)).data;
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const rows = data.contracts.filter(
    (row) => filter === 'all' || (filter === 'on') === row.is_active,
  );
  return (
    <>
      <PageHeader
        title={t('manager.contracts.listTitle')}
        subtitle={t('manager.contracts.listSubtitle')}
        actions={<Button onClick={() => setAdding(true)}>{t('manager.builder.templates.add')}</Button>}
      />
      <ChoiceGroup
        legend={t('manager.contracts.filter')}
        hideLegend
        look="segmented"
        value={filter}
        onChange={setFilter}
        options={(['all', 'on', 'off'] as const).map((value) => ({
          value,
          label: t(`manager.contracts.filters.${value}`),
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState>{t('manager.contracts.listEmpty')}</EmptyState>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id ?? 'standard'} className="flex">
              <ContractCard row={row} limits={limits} />
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t('manager.contracts.new')}
        subtitle={t('manager.contracts.newHint')}
        closeLabel={t('close')}
      >
        <NewContract
          contracts={data.contracts}
          onDone={(id) => {
            setAdding(false);
            if (id !== undefined) void navigate(contractPath(id));
          }}
        />
      </Dialog>
    </>
  );
}

function ContractCard({ row, limits }: { row: ContractOverviewRow; limits: RuleLimits }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const degrees = row.degrees
    .map((id) => limits.degrees.find((degree) => degree.id === id)?.name)
    .filter((name): name is string => !!name);
  const range =
    row.min_amount === null && row.max_amount === null
      ? t('manager.contracts.anyAmount')
      : [
          row.min_amount !== null &&
            t('manager.contracts.from', { amount: s.exact(row.min_amount, row.currency) }),
          row.max_amount !== null &&
            t('manager.contracts.listTo', { amount: s.exact(row.max_amount, row.currency) }),
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <Link
      to={contractPath(row.id)}
      className="flex w-full flex-col gap-3 rounded-card bg-surface p-4 shadow-panel hover:bg-canvas sm:p-5"
    >
      <span className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-bold">{row.name}</span>
          <span className="text-[13px] text-text-2">
            {row.description || t('manager.builder.templates.noDescription')}
          </span>
        </span>
        <Chip tone={row.is_active ? 'good' : 'neutral'} dot>
          {t(row.is_active ? 'manager.contracts.on' : 'manager.contracts.off')}
        </Chip>
      </span>
      <dl className="m-0 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
        <Fact label={t('manager.contracts.services')}>
          {row.features.filter((item) => item.price !== null).length
            ? row.features
                .filter((item) => item.price !== null)
                .map((item) =>
                  t('manager.contracts.service', {
                    name: t(`manager.contracts.feature.${item.key}`),
                    price: item.price ? s.inCurrency(item.price, row.currency) : t('manager.builder.prices.free'),
                  }),
                )
                .join(' · ')
            : t('manager.builder.prices.none')}
        </Fact>
        <Fact label={t('manager.contracts.currency')}>
          {limits.currencies.find((item) => item.id === row.currency)?.name ?? row.currency}
        </Fact>
        <Fact label={t('manager.contracts.countries')}>
          {row.countries.length ? f.list(row.countries) : t('manager.contracts.all')}
        </Fact>
        <Fact label={t('manager.contracts.degrees')}>
          {degrees.length ? f.list(degrees) : t('manager.contracts.all')}
        </Fact>
        <Fact label={t('manager.contracts.range')}>{range}</Fact>
        <Fact label={t('manager.contracts.text')}>
          {t('manager.contracts.textFacts', {
            articles: f.number(row.articles),
            clauses: f.number(row.clauses),
            version: f.number(row.version),
          })}
        </Fact>
      </dl>
    </Link>
  );
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-text-2">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  );
}

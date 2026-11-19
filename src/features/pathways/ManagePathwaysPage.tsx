import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { ChoiceGroup } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  PATHWAYS_PATH,
  managedPathwaysQuery,
  type PathwayRow,
  type PathwayStatus,
} from './manageApi';
import { STATUS_TONE } from './manageForm';
import type { ParseKeys } from 'i18next';

/** A key built at run time (a question's, a status's): one of this dictionary's. */
const key = (name: string) => name as ParseKeys<'pathways'>;

type Filter = 'all' | PathwayStatus;
const FILTERS: readonly Filter[] = ['all', 'published', 'draft', 'review_due', 'off'];

/** Management > pathways: each country with its routes and where each stands. */
export default function ManagePathwaysPage() {
  const { t } = useTranslation('pathways');
  const { data } = useSuspenseQuery(managedPathwaysQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const shown = data.pathways.filter((row) => filter === 'all' || row.status === filter);
  const countries = new Map<number, { name: string; rows: PathwayRow[] }>();
  for (const row of shown) {
    const entry = countries.get(row.country.id) ?? { name: row.country.name, rows: [] };
    entry.rows.push(row);
    countries.set(row.country.id, entry);
  }
  const count = (value: Filter) =>
    value === 'all'
      ? data.pathways.length
      : data.pathways.filter((row) => row.status === value).length;

  return (
    <PageStack>
      <PageHeader
        title={t('manage.title')}
        subtitle={t('manage.subtitle')}
        actions={
          <Link to={`${PATHWAYS_PATH}/new`} className={buttonClass('primary')}>
            {t('manage.new')}
          </Link>
        }
      />
      <ChoiceGroup
        legend={t('manage.filter')}
        hideLegend
        options={FILTERS.map((value) => ({
          value,
          label: t(key(`manage.filters.${value}`), { count: count(value) }),
        }))}
        value={filter}
        onChange={setFilter}
      />
      {countries.size === 0 ? (
        <EmptyState title={t('manage.empty')} variant="card">
          {t('manage.empty_body')}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...countries].map(([id, country]) => (
            <SectionCard
              key={id}
              id={`country-${id}`}
              variant="panel"
              title={country.name}
              end={
                <span className="text-sm text-text-2">
                  {t('manage.routes', { count: country.rows.length })}
                </span>
              }
            >
              <ul className="m-0 flex list-none flex-col p-0">
                {country.rows.map((row) => (
                  <li key={row.id} className="border-line border-t first:border-t-0">
                    <Link
                      to={`${PATHWAYS_PATH}/${row.id}`}
                      className="flex min-h-12 items-center justify-between gap-3 text-text no-underline hover:text-primary-text"
                    >
                      <span className="min-w-0 text-[15px]">{row.name_persian || row.name}</span>
                      <Chip tone={STATUS_TONE[row.status]} small>
                        {t(key(`manage.status.${row.status}`))}
                      </Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
    </PageStack>
  );
}

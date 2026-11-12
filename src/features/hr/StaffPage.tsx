import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { matchesSearch } from '@/lib/text';
import { staffQuery, type StaffRow, type StaffState } from './api';
import { PersonLink } from './components/PersonLink';
import { CONTRACT_TONE, STATE_TONE, dayOf } from './format';

const NewStaffDialog = lazy(() => import('./components/NewStaffDialog'));

type Filter = 'all' | Exclude<StaffState, 'active'>;
const FILTERS: readonly Filter[] = ['all', 'trial', 'joining', 'leaving', 'inactive'];

/**
 * Everyone who works here (canvas "کارکنان"): position, team, direct manager, the contract in
 * force, whether the attendance terminal knows them, and a joining or leaving under way. "Left"
 * also lists the people who no longer work here. A new staff member starts here.
 */
export default function StaffPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const { data } = useSuspenseQuery(staffQuery());
  // The people who left: only once that filter is chosen.
  const everyone = useQuery({ ...staffQuery(true), enabled: filter === 'inactive' });
  const source = filter === 'inactive' ? (everyone.data?.results ?? []) : data.results;
  const rows = source.filter(
    (row) =>
      (filter === 'all' || row.state === filter) &&
      matchesSearch(
        search,
        row.name,
        row.position?.name ?? '',
        row.personnel_code,
        row.manager?.name ?? '',
      ),
  );
  const count = (value: Filter) =>
    value === 'all'
      ? data.results.length
      : value === 'inactive'
        ? undefined
        : data.results.filter((row) => row.state === value).length;

  return (
    <PageStack>
      <PageHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle', { n: f.number(data.results.length) })}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} />
            {t('staff.new')}
          </Button>
        }
      />
      <Card aria-label={t('staff.label')}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 lg:px-8">
          <FilterTabs
            label={t('staff.filter')}
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((value) => {
              const n = count(value);
              return {
                value,
                label: t(value === 'all' ? 'staff.all' : `state.${value}`),
                ...(n !== undefined && { count: f.number(n) }),
              };
            })}
          />
          <SearchField
            className="min-w-56 flex-1"
            label={t('staff.search')}
            placeholder={t('staff.searchHint')}
            value={search}
            onChange={setSearch}
          />
        </div>
        {filter === 'inactive' && everyone.isPending ? (
          <EmptyState variant="padded">{t('loading')}</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState variant="padded">{t('staff.empty')}</EmptyState>
        ) : (
          <ul aria-label={t('staff.list')} className="m-0 list-none p-0 pt-3 pb-3">
            {rows.map((row) => (
              <StaffItem key={row.id} row={row} />
            ))}
          </ul>
        )}
      </Card>
      {adding && (
        <Suspense fallback={null}>
          <NewStaffDialog open onClose={() => setAdding(false)} />
        </Suspense>
      )}
    </PageStack>
  );
}

function StaffItem({ row }: { row: StaffRow }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const sub = [row.position?.name, row.team && t(`team.${row.team}`)].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hair px-5 py-2.5 first:border-t-0 lg:px-8">
      <div className="min-w-0 flex-[1_1_220px]">
        <PersonLink id={row.id} name={row.name} face={row.face} sub={sub} />
      </div>
      <span className="min-w-0 flex-[0_1_160px] truncate text-sm text-text-2">
        {row.manager ? t('staff.manager', { name: row.manager.name }) : ''}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {row.contract && (
          <Chip tone={CONTRACT_TONE[row.contract.kind]} small>
            {row.contract.end
              ? t('staff.contractUntil', {
                  kind: t(`contract.${row.contract.kind}`),
                  day: f.dateShort(dayOf(row.contract.end)),
                })
              : t(`contract.${row.contract.kind}`)}
          </Chip>
        )}
        {row.state !== 'active' && row.state !== 'trial' && (
          <Chip tone={STATE_TONE[row.state]} small dot>
            {row.move
              ? t('staff.moveProgress', {
                  kind: t(`state.${row.state}`),
                  done: f.number(row.move.done),
                  total: f.number(row.move.total),
                })
              : t(`state.${row.state}`)}
          </Chip>
        )}
        {row.is_active && !row.device && (
          <Chip tone="warn" small>
            {t('staff.noDevice')}
          </Chip>
        )}
      </span>
    </li>
  );
}

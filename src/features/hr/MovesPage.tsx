import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { movesQuery, type MoveKind } from './api';
import { MoveCard } from './components/MoveCard';

type Filter = 'all' | MoveKind;
const FILTERS: readonly Filter[] = ['all', 'entry', 'exit'];

/**
 * «ورود و خروج»: every joining and leaving under way, soonest first, each with its checklist. A
 * joining starts with a new staff member (staff page); a leaving from the person's file.
 */
export default function MovesPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const { data } = useSuspenseQuery(movesQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const rows = data.results.filter((move) => filter === 'all' || move.kind === filter);
  const count = (value: Filter) =>
    data.results.filter((move) => value === 'all' || move.kind === value).length;

  return (
    <PageStack>
      <PageHeader title={t('moves.title')} subtitle={t('moves.subtitle')} />
      <FilterTabs
        label={t('moves.filter')}
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((value) => ({
          value,
          label: t(value === 'all' ? 'moves.all' : `move.${value}`),
          count: f.number(count(value)),
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState variant="card" icon="check">
          {t('moves.empty')}
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((move) => (
            <MoveCard key={move.id} move={move} staff={move.staff} />
          ))}
        </div>
      )}
    </PageStack>
  );
}

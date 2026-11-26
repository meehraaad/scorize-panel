import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { movesQuery, type MoveKind } from './api';
import { MoveCard } from './components/MoveCard';

const NewStaffDialog = lazy(() => import('./components/NewStaffDialog'));
const ExitDialog = lazy(() =>
  import('./components/FileDialogs').then((module) => ({ default: module.ExitDialog })),
);

type Filter = 'all' | MoveKind;
const FILTERS: readonly Filter[] = ['all', 'entry', 'exit'];

/**
 * «استخدام و جدایی»: every joining and leaving under way, soonest first, each with its checklist.
 * Both start here too (meeting0, canvas 5A): «کارمند جدید» as on the staff page, and «شروع جدایی»
 * with the colleague found by name (as from their file).
 */
export default function MovesPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const { data } = useSuspenseQuery(movesQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const [starting, setStarting] = useState<'entry' | 'exit' | null>(null);
  const rows = data.results.filter((move) => filter === 'all' || move.kind === filter);
  const count = (value: Filter) =>
    data.results.filter((move) => value === 'all' || move.kind === value).length;

  return (
    <PageStack>
      <PageHeader
        title={t('moves.title')}
        subtitle={t('moves.subtitle')}
        actions={
          <>
            <Button variant="danger" onClick={() => setStarting('exit')}>
              {t('person.exit')}
            </Button>
            <Button onClick={() => setStarting('entry')}>
              <Icon name="plus" size={18} />
              {t('staff.new')}
            </Button>
          </>
        }
      />
      {starting && (
        <Suspense fallback={null}>
          {starting === 'entry' ? (
            <NewStaffDialog open onClose={() => setStarting(null)} />
          ) : (
            <ExitDialog file={null} onClose={() => setStarting(null)} />
          )}
        </Suspense>
      )}
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

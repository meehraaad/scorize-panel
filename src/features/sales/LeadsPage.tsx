import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { TogglePill, SelectField } from '@/components/ui/Choices';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { FIRST_CALL_TARGET_MINUTES, SCORE_BANDS, SOURCES, STAGES } from '@/lib/sales/api';
import { pagesOf } from '@/lib/api/page';
import { leadsQuery, type LeadFilter, type LeadQuery, type LeadsData } from './api';
import { BulkBar } from './components/BulkBar';
import { useSalesFormat } from './format';
import { LeadTable } from './components/LeadTable';
import { NewLeadDialog } from './components/NewLeadDialog';

const FILTERS: readonly LeadFilter[] = ['all', ...STAGES];
const isFilter = (value: string | null): value is LeadFilter =>
  FILTERS.includes(value as LeadFilter);

/** Every lead of the seller, by stage, with its score and next follow-up. Canvas "لیدها". */
export default function LeadsPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const stageParam = params.get('stage');
  const stage: LeadFilter = isFilter(stageParam) ? stageParam : 'all';
  const [source, setSource] = useState<LeadQuery['source']>('all');
  const [band, setBand] = useState<LeadQuery['band']>('all');
  const [overdue, setOverdue] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const query: LeadQuery = {
    stage,
    source,
    band,
    overdue,
    search: useDebouncedValue(search.trim()),
    page,
  };
  const { data, isPending, isPlaceholderData } = useQuery(leadsQuery(query));

  // Any filter change starts again at page 1 with nothing selected.
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
      setSelected(new Set());
    };
  const setStage = refilter((value: LeadFilter) =>
    setParams(
      (current) => {
        if (value === 'all') current.delete('stage');
        else current.set('stage', value);
        return current;
      },
      { replace: true },
    ),
  );
  const openNew = params.get('new') === '1';
  const setOpenNew = (open: boolean) =>
    setParams(
      (current) => {
        if (open) current.set('new', '1');
        else current.delete('new');
        return current;
      },
      { replace: true },
    );

  const pages = pagesOf(data);

  return (
    <PageStack>
      <PageHeader
        title={t('leads.title')}
        subtitle={data ? t('leads.subtitle', { n: f.number(data.counts.all) }) : undefined}
        actions={
          <Button onClick={() => setOpenNew(true)}>
            <Icon name="plus" size={18} />
            {t('leads.add')}
          </Button>
        }
      />
      {data && <LeadStats stats={data.stats} />}

      <section aria-label={t('leads.list')} className="flex flex-col gap-4">
        <FilterTabs
          label={t('leads.stageFilter')}
          value={stage}
          onChange={setStage}
          options={FILTERS.filter((value) => !data || data.supports.stages.includes(value)).map(
            (value) => ({
              value,
              label: value === 'all' ? t('leads.all') : t(`stage.${value}`),
              ...(data ? { count: f.number(data.counts[value]) } : {}),
            }),
          )}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchField
            label={t('leads.search')}
            placeholder={t('leads.searchPlaceholder')}
            value={search}
            onChange={refilter(setSearch)}
          />
          <SelectField
            inline
            label={t('leads.source')}
            value={source}
            onChange={refilter(setSource)}
            options={[
              { value: 'all', label: t('leads.allSources') },
              ...SOURCES.map((value) => ({ value, label: t(`source.${value}`) })),
            ]}
          />
          {data?.supports.band !== false && (
            <SelectField
              inline
              label={t('leads.band')}
              value={band}
              onChange={refilter(setBand)}
              options={[
                { value: 'all', label: t('leads.allBands') },
                ...SCORE_BANDS.map((value) => ({ value, label: t(`leads.bandOption.${value}`) })),
              ]}
            />
          )}
          {data?.supports.overdue !== false && (
            <TogglePill
              label={t('leads.overdueOnly')}
              checked={overdue}
              onChange={refilter(setOverdue)}
            />
          )}
        </div>

        <Card aria-busy={isPending || isPlaceholderData}>
          {selected.size > 0 && data?.supports.bulk && (
            <BulkBar ids={[...selected]} onDone={() => setSelected(new Set())} />
          )}
          {!data ? (
            <SkeletonRows rows={6} />
          ) : data.results.length === 0 ? (
            <EmptyState variant="padded">{t('leads.empty')}</EmptyState>
          ) : (
            <LeadTable
              rows={data.results}
              selected={selected}
              onSelect={setSelected}
              selectable={data.supports.bulk}
            />
          )}
          {data && data.count > 0 && (
            <Pager
              status={t('leads.pager', {
                shown: f.number(data.results.length),
                total: f.number(data.count),
              })}
              page={page}
              pages={pages}
              pending={isPlaceholderData}
              onPage={(next) => {
                setPage(next);
                setSelected(new Set());
              }}
            />
          )}
        </Card>
      </section>

      <NewLeadDialog open={openNew} onClose={() => setOpenNew(false)} />
    </PageStack>
  );
}

function LeadStats({ stats }: { stats: LeadsData['stats'] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const { overdue, first_call_minutes: firstCall } = stats;
  return (
    <StatGrid
      label={t('leads.stats.label')}
      stats={[
        {
          label: t('leads.stats.newWaiting'),
          value: f.number(stats.new_waiting),
          tone: stats.new_waiting > 0 ? 'urgent' : 'default',
          note:
            stats.oldest_new_minutes === null
              ? t('leads.stats.noneWaiting')
              : t('leads.stats.oldest', {
                  age: s.duration(stats.oldest_new_minutes),
                }),
        },
        {
          label: t('leads.stats.today'),
          value: f.number(stats.today),
          note: t('leads.stats.beforeNoon', { n: f.number(stats.today_before_noon) }),
        },
        // Unknown until the server stores follow-ups and first calls (S3, S6).
        ...(overdue === null
          ? []
          : [
              {
                label: t('leads.stats.overdue'),
                value: f.number(overdue),
                tone: overdue > 0 ? ('urgent' as const) : ('default' as const),
                note:
                  overdue > 0
                    ? t('leads.stats.maxOverdue', { n: f.number(stats.max_overdue_days) })
                    : t('leads.stats.noneOverdue'),
              },
            ]),
        ...(firstCall === null
          ? []
          : [
              {
                label: t('leads.stats.firstCall'),
                value: f.number(firstCall),
                tone:
                  firstCall > FIRST_CALL_TARGET_MINUTES ? ('urgent' as const) : ('good' as const),
                note: t('leads.stats.target', { n: f.number(FIRST_CALL_TARGET_MINUTES) }),
              },
            ]),
      ]}
    />
  );
}

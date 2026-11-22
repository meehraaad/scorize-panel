import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  STAGE_FILTERS,
  casesQuery,
  firstCasesQuery,
  exportHref,
  managerTeamQuery,
  type BotFilter,
  type CasesQuery,
  type StageFilter,
  type SupervisorFilter,
} from './api';
import { pagesOf } from '@/lib/api/page';
import { CaseTable } from './components/CaseTable';
import { ImportDialog } from './components/ImportDialog';
import { MoveDialog } from './manager/MoveDialog';

/**
 * Every case the supervisor runs: by stage, searchable, with the professor-email bot and
 * documents at a glance; chosen cases' applications export as a spreadsheet.
 * Design: canvas V1 "سوپروایزر · فهرست متقاضیان" (Main), in the V6 look.
 */
export default function CasesPage() {
  return <CaseList />;
}

/**
 * The list; `team`: the manager's list of every case (manager section), with each case's
 * supervisors and a supervisor filter (the team page links to one person's cases).
 */
export function CaseList({ team = false }: { team?: boolean }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  // Starts as the route prefetched it: the URL's stage and bot (reports link to stopped bots).
  const first = firstCasesQuery(params, team);
  const stage = first.stage;
  const supervisor = first.team?.supervisor ?? 'all';
  const people = useQuery({ ...managerTeamQuery, enabled: team }).data?.people;
  const [bot, setBot] = useState<BotFilter>(first.bot);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [moving, setMoving] = useState(false);
  // One person's list: their chosen cases can go to someone else.
  const owner = people?.find((person) => String(person.id) === supervisor);
  const query: CasesQuery = {
    stage,
    bot,
    search: useDeferredValue(search),
    page,
    ...(team && { team: { supervisor } }),
  };
  const { data, isPending, isPlaceholderData } = useQuery(casesQuery(query));

  // Any filter change starts again at page 1 with nothing selected.
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
      setSelected(new Set());
    };
  const setStage = refilter((value: StageFilter) =>
    setParams(
      (current) => {
        if (value === 'all') current.delete('stage');
        else current.set('stage', value);
        return current;
      },
      { replace: true },
    ),
  );

  const setSupervisor = refilter((value: SupervisorFilter) =>
    setParams(
      (current) => {
        if (value === 'all') current.delete('supervisor');
        else current.set('supervisor', value);
        return current;
      },
      { replace: true },
    ),
  );

  const pages = pagesOf(data);

  return (
    <PageStack>
      <PageHeader
        title={t(team ? 'manager.cases.title' : 'cases.title')}
        subtitle={
          data
            ? t(team ? 'manager.cases.subtitle' : 'cases.subtitle', {
                n: f.number(data.counts.all),
              })
            : undefined
        }
        actions={
          team ? undefined : (
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Icon name="upload" size={18} />
              {t('import.open')}
            </Button>
          )
        }
      />
      {!team && <ImportDialog open={importing} onClose={() => setImporting(false)} />}
      {owner && (
        <MoveDialog
          person={owner}
          cases={[...selected]}
          open={moving}
          onClose={() => setMoving(false)}
          onMoved={() => setSelected(new Set())}
        />
      )}

      <section aria-label={t('cases.list')} className="flex flex-col gap-4">
        <FilterTabs
          label={t('cases.stageFilter')}
          value={stage}
          onChange={setStage}
          options={STAGE_FILTERS.map((value) => ({
            value,
            label: value === 'all' ? t('cases.all') : t(`stage.${value}`),
            ...(data ? { count: f.number(data.counts[value]) } : {}),
          }))}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchField
            label={t('cases.search')}
            placeholder={t('cases.searchPlaceholder')}
            value={search}
            onChange={refilter(setSearch)}
          />
          {team && (
            <SelectField
              inline
              label={t('manager.cases.supervisor')}
              value={supervisor}
              onChange={setSupervisor}
              options={[
                { value: 'all', label: t('manager.cases.everyone') },
                { value: 'none', label: t('manager.cases.nobody') },
                // The route loads the team with the list.
                ...(people ?? []).map((person) => ({
                  value: String(person.id) as SupervisorFilter,
                  label: person.name,
                })),
              ]}
            />
          )}
          <SelectField
            inline
            label={t('cases.bot')}
            value={bot}
            onChange={refilter(setBot)}
            options={[
              { value: 'all', label: t('cases.botAll') },
              { value: 'on', label: t('bot.on') },
              { value: 'off', label: t('bot.off') },
            ]}
          />
        </div>

        <Card aria-busy={isPending || isPlaceholderData}>
          {selected.size > 0 && (
            <div
              role="region"
              aria-label={t('cases.selection')}
              className="flex flex-wrap items-center gap-3 bg-tint px-5 py-3 lg:px-8"
            >
              <span className="text-sm font-semibold text-primary-text">
                {t('cases.selected', { n: f.number(selected.size) })}
              </span>
              {owner && (
                <Button
                  variant="outline"
                  className="ms-auto h-11 text-sm"
                  onClick={() => setMoving(true)}
                >
                  {t('manager.move.chosenOpen')}
                </Button>
              )}
              <a
                href={exportHref([...selected])}
                download
                className={buttonClass('outline', `${owner ? '' : 'ms-auto'}h-11 text-sm`)}
              >
                <Icon name="download" size={18} />
                {t('cases.export')}
              </a>
              <Button
                variant="outline"
                className="h-11 text-sm"
                onClick={() => setSelected(new Set())}
              >
                {t('cases.clear')}
              </Button>
            </div>
          )}
          {!data ? (
            <SkeletonRows rows={6} />
          ) : data.results.length === 0 ? (
            <EmptyState variant="padded">{t('cases.empty')}</EmptyState>
          ) : (
            <CaseTable rows={data.results} selected={selected} onSelect={setSelected} team={team} />
          )}
          {data && data.count > 0 && (
            <Pager
              status={t('cases.pager', {
                from: f.number((page - 1) * data.page_size + 1),
                to: f.number((page - 1) * data.page_size + data.results.length),
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
    </PageStack>
  );
}

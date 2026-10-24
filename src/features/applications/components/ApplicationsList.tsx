import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { Pager } from '@/components/ui/Pager';
import { SectionHeading } from '@/components/ui/SectionCard';
import { isolate, useFormat } from '@/lib/i18n/useFormat';
import type { Application } from '../api';
import { GROUPS, PAGE_SIZE, groupOf, isGroup, type Group } from '../groups';
import { ApplicationRow, ROW_COLUMNS } from './ApplicationRow';

/** Search + filter tabs + the list. The tab lives in the URL (?filter=awaiting) so it can be linked. */
export function ApplicationsList({ applications }: { applications: Application[] }) {
  const { t } = useTranslation('applications');
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const raw = params.get('filter');
  const filter: Group = isGroup(raw) ? raw : 'all';
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const search = useDeferredValue(query.trim().toLowerCase());

  const counts = Object.fromEntries(
    GROUPS.map((group) => [
      group,
      group === 'all'
        ? applications.length
        : applications.filter((item) => groupOf(item) === group).length,
    ]),
  ) as Record<Group, number>;

  const matches = applications.filter(
    (item) =>
      (filter === 'all' || groupOf(item) === filter) &&
      (!search ||
        item.university.toLowerCase().includes(search) ||
        item.program.toLowerCase().includes(search)),
  );
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const choose = (group: Group) => {
    setPage(1);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (group === 'all') next.delete('filter');
        else next.set('filter', group);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <section aria-labelledby="apps-list" className="flex flex-col gap-4">
      <SectionHeading
        id="apps-list"
        title={t('list.title')}
        end={
          <SearchField
            label={t('list.search')}
            placeholder={t('list.searchPlaceholder')}
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
          />
        }
      />

      <FilterTabs
        label={t('list.filters')}
        value={filter}
        onChange={choose}
        options={GROUPS.map((group) => ({
          value: group,
          label: t(`filter.${group}`),
          count: f.number(counts[group]),
        }))}
      />

      <Card>
        {shown.length > 0 ? (
          <>
            <div
              aria-hidden="true"
              className={`hidden min-h-12 items-center gap-x-5 px-8 text-[13px] font-medium text-text-2 shadow-[inset_0_-1px_0_var(--hair)] lg:grid ${ROW_COLUMNS}`}
            >
              <span>{t('column.university')}</span>
              <span>{t('column.deadline')}</span>
              <span>{t('column.fee')}</span>
              <span>{t('column.result')}</span>
              <span>{t('column.approval')}</span>
            </div>
            <ul className="m-0 list-none divide-y divide-hair p-0">
              {shown.map((item) => (
                <ApplicationRow key={item.id} item={item} />
              ))}
            </ul>
            <Pager
              page={current}
              pages={pages}
              onPage={setPage}
              status={
                pages > 1
                  ? t('list.range', {
                      from: f.number((current - 1) * PAGE_SIZE + 1),
                      to: f.number((current - 1) * PAGE_SIZE + shown.length),
                      total: f.number(matches.length),
                    })
                  : t('list.count', { total: f.number(matches.length) })
              }
            />
          </>
        ) : (
          <EmptyState
            variant="padded"
            title={applications.length === 0 ? t('list.noneTitle') : undefined}
            icon="graduation"
            action={
              applications.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (search) setQuery('');
                    else choose('all');
                  }}
                >
                  {search ? t('list.clearSearch') : t('list.showAll')}
                </Button>
              )
            }
          >
            {applications.length === 0
              ? t('list.none')
              : search
                ? t('list.emptySearch', { query: isolate(query.trim()) })
                : t('list.emptyFilter')}
          </EmptyState>
        )}
      </Card>
    </section>
  );
}

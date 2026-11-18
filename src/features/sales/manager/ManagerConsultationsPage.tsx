import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Choices';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  CONSULTATION_STATUS_FILTERS,
  MANAGER_CONSULTATION_VIEWS,
  managerConsultationsQuery,
  managerViewOf,
  type ConsultationSummary,
  type ManagerConsultationView,
} from '../api';
import { ConsultationDays } from '../components/ConsultationDays';

/** The views whose count is in the summary (the rest depend on the filters). */
const COUNTED: Partial<Record<ManagerConsultationView, keyof ConsultationSummary>> = {
  today: 'today',
  tomorrow: 'tomorrow',
  week: 'week',
  unassigned: 'unassigned',
  unlogged: 'unlogged',
};
/** Views that need the manager: their count shows in warning colour when it isn't zero. */
const NEEDS: readonly ManagerConsultationView[] = ['unassigned', 'unlogged'];
/** Filters kept in the address besides the view. */
const FILTER_KEYS = ['type', 'mode', 'seller', 'status', 'from', 'to'] as const;

/**
 * Every paid consultation of the team for the sales manager: a view (today, tomorrow, the week,
 * those nobody holds, those held without a log, past, all, or chosen days), filters (type, online
 * or in person, consultant, status, a name or phone), and on each row the consultant menu.
 */
export default function ManagerConsultationsPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const typed = useDebouncedValue(search.trim());
  const { data, isPlaceholderData } = useQuery(managerConsultationsQuery(params, typed));
  const view = managerViewOf(params.get('view'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pages = pagesOf(data);

  /** Sets (or with null / 'all', drops) address values; any change but the page starts at page 1. */
  const update = (values: Record<string, string | null>) =>
    setParams(
      (current) => {
        for (const [key, value] of Object.entries(values)) {
          if (value === null || value === 'all') current.delete(key);
          else current.set(key, value);
        }
        if (!('page' in values)) current.delete('page');
        return current;
      },
      { replace: true },
    );
  const filtered = FILTER_KEYS.some((key) => key !== 'from' && key !== 'to' && params.has(key));
  const summary = data?.summary;
  const showSeller = view !== 'unassigned';
  const showStatus = view !== 'unassigned' && view !== 'unlogged';

  return (
    <>
      <PageHeader title={t('manager.sessions.title')} subtitle={t('manager.sessions.subtitle')} />

      <section aria-label={t('manager.sessions.list')} className="flex flex-col gap-4">
        <FilterTabs
          label={t('manager.sessions.views')}
          value={view}
          onChange={(value) =>
            update({
              view: value === 'week' ? null : value,
              ...(value === 'span' ? {} : { from: null, to: null }),
            })
          }
          options={MANAGER_CONSULTATION_VIEWS.map((value) => {
            const key = COUNTED[value];
            const count = key && summary ? summary[key] : undefined;
            return {
              value,
              label: t(`manager.sessions.view.${value}`),
              ...(count === undefined ? {} : { count: f.number(count) }),
            };
          })}
        />
        {summary && NEEDS.some((key) => summary[COUNTED[key] ?? 'today'] > 0) && (
          <p className="m-0 text-sm text-warn">
            {[
              summary.unassigned > 0 &&
                t('manager.sessions.needs.unassigned', { n: f.number(summary.unassigned) }),
              summary.unlogged > 0 &&
                t('manager.sessions.needs.unlogged', { n: f.number(summary.unlogged) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {view === 'span' && (
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <LazyDatePicker
              clearable
              label={t('manager.sessions.from')}
              value={params.get('from') ?? ''}
              max={params.get('to') ?? undefined}
              onChange={(value) => update({ from: value || null })}
            />
            <LazyDatePicker
              clearable
              label={t('manager.sessions.to')}
              value={params.get('to') ?? ''}
              min={params.get('from') ?? undefined}
              onChange={(value) => update({ to: value || null })}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <SearchField
            label={t('manager.sessions.search')}
            placeholder={t('manager.sessions.searchPlaceholder')}
            value={search}
            onChange={(value) => {
              setSearch(value);
              if (params.has('page')) update({ page: null });
            }}
          />
          <SelectField
            inline
            label={t('manager.sessions.type')}
            value={params.get('type') ?? 'all'}
            onChange={(value) => update({ type: value })}
            options={[
              { value: 'all', label: t('manager.sessions.allTypes') },
              ...(data?.types ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
          <SelectField
            inline
            label={t('manager.sessions.mode')}
            value={params.get('mode') ?? 'all'}
            onChange={(value) => update({ mode: value })}
            options={(['all', 'in_person', 'online'] as const).map((value) => ({
              value,
              label: t(`manager.sessions.modeOption.${value}`),
            }))}
          />
          {showSeller && (
            <SelectField
              inline
              label={t('manager.sessions.seller')}
              value={params.get('seller') ?? 'all'}
              onChange={(value) => update({ seller: value })}
              options={[
                { value: 'all', label: t('manager.sessions.allSellers') },
                { value: 'none', label: t('consultationCalendar.noSeller') },
                ...(data?.sellers ?? []).map((item) => ({
                  value: String(item.id),
                  label: item.name,
                })),
              ]}
            />
          )}
          {showStatus && (
            <SelectField
              inline
              label={t('manager.sessions.status')}
              value={params.get('status') ?? 'all'}
              onChange={(value) => update({ status: value })}
              options={[
                { value: 'all', label: t('manager.sessions.allStatuses') },
                ...CONSULTATION_STATUS_FILTERS.map((value) => ({
                  value,
                  label: t(`manager.sessions.statusOption.${value}`),
                })),
              ]}
            />
          )}
          {(filtered || search) && (
            <Button
              variant="outline"
              className="h-11 px-4 text-sm"
              onClick={() => {
                setSearch('');
                update({ type: null, mode: null, seller: null, status: null });
              }}
            >
              {t('manager.sessions.clear')}
            </Button>
          )}
        </div>

        {data && (
          <p className="m-0 text-sm text-text-2" aria-live="polite">
            {t('manager.sessions.found', { n: f.number(data.count) })}
          </p>
        )}
        <div className="flex flex-col gap-4" aria-busy={!data || isPlaceholderData}>
          {!data ? (
            <Card>
              <SkeletonRows rows={5} />
            </Card>
          ) : (
            <ConsultationDays
              items={data.results}
              sellers={data.sellers ?? []}
              empty={t(
                filtered || typed
                  ? 'manager.sessions.emptyFiltered'
                  : `manager.sessions.empty.${view}`,
              )}
            />
          )}
        </div>
        {pages > 1 && (
          <Card>
            <Pager
              page={Math.min(page, pages)}
              pages={pages}
              pending={isPlaceholderData}
              onPage={(next) => update({ page: next === 1 ? null : String(next) })}
            />
          </Card>
        )}
      </section>
    </>
  );
}

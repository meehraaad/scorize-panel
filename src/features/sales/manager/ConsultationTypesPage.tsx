import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { WEEKDAYS } from '@/lib/sales/phoneCalls';
import {
  consultationTypesQuery,
  startsOf,
  type ConsultationMode,
  type ConsultationTypeRow,
} from '../api';
import { useSalesFormat } from '../format';
import { salesPath } from '../paths';

type ModeFilter = 'all' | ConsultationMode;
const MODE_FILTERS: readonly ModeFilter[] = ['all', 'in_person', 'online'];

/** Start times a type offers on each weekday. */
const startsByDay = (item: ConsultationTypeRow) =>
  WEEKDAYS.map((day) =>
    item.week
      .filter((row) => row.day === day)
      .reduce((sum, row) => sum + startsOf(row, item.length, item.slot_minutes).length, 0),
  );

/**
 * The consultation types the team sells (S81), the first page of the manager's consultations tab:
 * each one's price, length and week at a glance (a strip of the seven days), filtered by in person
 * or online; a card opens its editor. Types that aren't sold sit in their own list below.
 */
export default function ConsultationTypesPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(consultationTypesQuery);
  const [mode, setMode] = useState<ModeFilter>('all');
  const shown = data.types.filter((item) => mode === 'all' || item.mode === mode);
  const active = shown.filter((item) => item.active);
  const off = shown.filter((item) => !item.active);
  const selling = data.types.filter((item) => item.active);
  const weekly = selling.reduce(
    (sum, item) => sum + startsByDay(item).reduce((all, n) => all + n, 0),
    0,
  );

  return (
    <>
      <PageHeader
        title={t('manager.consultations.title')}
        subtitle={t('manager.consultations.subtitle')}
        actions={
          <Link to={salesPath('manager/consultations/new')} className={buttonClass('primary')}>
            <Icon name="plus" size={18} />
            {t('manager.consultations.new')}
          </Link>
        }
      />
      <StatGrid
        compact
        label={t('manager.consultations.stats.label')}
        stats={[
          {
            label: t('manager.consultations.stats.selling'),
            value: f.number(selling.length),
            unit: t('manager.consultations.stats.of', { n: f.number(data.types.length) }),
          },
          { label: t('manager.consultations.stats.weekly'), value: f.number(weekly) },
          {
            label: t('manager.consultations.stats.upcoming'),
            value: f.number(data.types.reduce((sum, item) => sum + item.upcoming, 0)),
          },
        ]}
      />
      <FilterTabs
        label={t('manager.consultations.modeFilter')}
        value={mode}
        onChange={setMode}
        options={MODE_FILTERS.map((value) => ({
          value,
          label: t(`manager.consultations.modeOption.${value}`),
          count: f.number(
            data.types.filter((item) => value === 'all' || item.mode === value).length,
          ),
        }))}
      />
      <SectionCard
        id="consultation-types-active"
        variant="panel"
        title={t('manager.consultations.active')}
      >
        {active.length === 0 ? (
          <EmptyState>{t('manager.consultations.emptyActive')}</EmptyState>
        ) : (
          <TypeList types={active} />
        )}
      </SectionCard>
      {off.length > 0 && (
        <SectionCard
          id="consultation-types-off"
          variant="panel"
          title={t('manager.consultations.off')}
          subtitle={t('manager.consultations.offHint')}
        >
          <TypeList types={off} />
        </SectionCard>
      )}
    </>
  );
}

function TypeList({ types }: { types: ConsultationTypeRow[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
      {types.map((item) => (
        <li key={item.id}>
          <TypeCard item={item} />
        </li>
      ))}
    </ul>
  );
}

function TypeCard({ item }: { item: ConsultationTypeRow }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const perDay = startsByDay(item);
  const days = perDay.filter((n) => n > 0).length;
  const times = perDay.reduce((sum, n) => sum + n, 0);

  return (
    <Link
      to={salesPath(`manager/consultations/${String(item.id)}`)}
      className="flex h-full flex-col gap-4 rounded-2xl p-4 text-text shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--primary)] lg:p-5"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="text-base font-bold">{item.title}</span>
          <span className="flex flex-wrap gap-1.5">
            <Chip tone={item.mode === 'in_person' ? 'primary' : 'info'} small>
              {t(`manager.consultations.mode.${item.mode}`)}
            </Chip>
            <Chip tone="neutral" small>
              {t('manager.consultations.minutes', { n: f.number(item.length) })}
            </Chip>
            {item.slot_minutes !== null && (
              <Chip tone="neutral" small>
                {t('manager.consultations.every', { n: f.number(item.slot_minutes) })}
              </Chip>
            )}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-0.5 text-end">
          {item.discount_on && item.discounted_price !== null ? (
            <>
              <span className="text-lg font-bold">{s.toman(item.discounted_price)}</span>
              <span className="text-[13px] text-text-2 line-through">{s.toman(item.price)}</span>
              {item.discount_until && (
                <span className="text-[13px] text-good">
                  {t('manager.consultations.discountUntil', { date: f.date(item.discount_until) })}
                </span>
              )}
            </>
          ) : (
            <span className="text-lg font-bold">
              {item.price ? s.toman(item.price) : t('manager.consultations.free')}
            </span>
          )}
        </span>
      </span>

      <span className="flex flex-col gap-2">
        <span className="sr-only">
          {days === 0
            ? t('manager.consultations.noWeek')
            : t('manager.consultations.weekSummary', {
                days: f.number(days),
                times: f.number(times),
              })}
        </span>
        <span aria-hidden="true" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day, index) => {
            const n = perDay[index] ?? 0;
            return (
              <span
                key={day}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs ${
                  n > 0 ? 'bg-tint text-primary-text' : 'bg-track/60 text-text-2'
                }`}
              >
                <span className="font-semibold">{t(`manager.consultations.dayShort.${day}`)}</span>
                <span className="tabular-nums">{n > 0 ? f.number(n) : '–'}</span>
              </span>
            );
          })}
        </span>
      </span>

      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-2">
        <span aria-hidden="true">
          {days === 0
            ? t('manager.consultations.noWeek')
            : t('manager.consultations.weekSummary', {
                days: f.number(days),
                times: f.number(times),
              })}
        </span>
        <span>{t('manager.consultations.upcoming', { n: f.number(item.upcoming) })}</span>
        {item.closures.length > 0 && (
          <span className="text-warn">
            {t('manager.consultations.closedCount', { n: f.number(item.closures.length) })}
          </span>
        )}
      </span>
    </Link>
  );
}

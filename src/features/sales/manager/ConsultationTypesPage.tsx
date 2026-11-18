import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { consultationTypesQuery, startsOf, type ConsultationTypeRow } from '../api';
import { useSalesFormat } from '../format';
import { salesPath } from '../paths';

/**
 * The consultation types the team sells (S81): each one's price, length and week at a glance;
 * a card opens its editor. Types that aren't sold sit in their own list below.
 */
export default function ConsultationTypesPage() {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(consultationTypesQuery);
  const active = data.types.filter((item) => item.active);
  const off = data.types.filter((item) => !item.active);

  return (
    <>
      <PageHeader
        title={t('manager.consultations.title')}
        subtitle={t('manager.consultations.subtitle')}
        actions={
          <Link
            to={salesPath('manager/consultations/types/new')}
            className={buttonClass('primary')}
          >
            {t('manager.consultations.new')}
          </Link>
        }
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
  const days = new Set(item.week.map((row) => row.day)).size;
  const times = item.week.reduce(
    (sum, row) => sum + startsOf(row, item.length, item.slot_minutes).length,
    0,
  );

  return (
    <Link
      to={salesPath(`manager/consultations/types/${String(item.id)}`)}
      className="flex h-full flex-col gap-3 rounded-2xl p-4 text-text shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--primary)]"
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-bold">{item.title}</span>
        <span className="flex flex-wrap gap-1.5">
          <Chip tone={item.mode === 'in_person' ? 'primary' : 'info'} small>
            {t(`manager.consultations.mode.${item.mode}`)}
          </Chip>
          <Chip tone="neutral" small>
            {t('manager.consultations.minutes', { n: f.number(item.length) })}
          </Chip>
        </span>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {item.discount_on && item.discounted_price !== null ? (
          <>
            <span className="text-lg font-bold">{s.toman(item.discounted_price)}</span>
            <span className="text-[13px] text-text-3 line-through">{s.toman(item.price)}</span>
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
      <span className="text-[13px] leading-6 text-text-2">
        {days === 0
          ? t('manager.consultations.noWeek')
          : t('manager.consultations.weekSummary', {
              days: f.number(days),
              times: f.number(times),
            })}
        {' · '}
        {t('manager.consultations.upcoming', { n: f.number(item.upcoming) })}
        {item.closures.length > 0 &&
          ` · ${t('manager.consultations.closedCount', { n: f.number(item.closures.length) })}`}
      </span>
    </Link>
  );
}

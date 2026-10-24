import { useTranslation } from 'react-i18next';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CustomerData, ProfileItem } from '../api';
import { useSalesFormat } from '../format';

const PURCHASE_TONE: Record<CustomerData['purchases'][number]['status'], ChipTone> = {
  paid: 'good',
  pending: 'warn',
  failed: 'danger',
};

/** Side column of the customer page: score and why, similar admissions, profile, purchases. */
export function CustomerAside({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const first = customer.name.split(' ')[0] ?? customer.name;
  const { t: tc } = useTranslation();
  const profileValue = (item: ProfileItem) =>
    'degree' in item
      ? tc(`degree.${item.degree}`)
      : 'budget' in item
        ? t(`info.choice.budget.${item.budget}`)
        : 'military' in item
          ? t(`info.choice.military.${item.military}`)
          : item.text;

  return (
    <>
      {/* The automatic score explains itself; a manual estimate (no factors) shows only as the chip. */}
      {customer.lead?.score != null && customer.score_factors.length > 0 && (
        <SectionCard
          id="customer-score"
          variant="panel"
          title={t('customer.score.title')}
          end={
            <span className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums">
                {f.number(customer.lead.score)}
              </span>
              <span className="text-xs text-text-2">{t('customer.score.of')}</span>
            </span>
          }
        >
          <ProgressBar value={customer.lead.score} />
          <dl aria-label={t('customer.score.factors')} className="m-0 flex flex-col gap-2">
            {customer.score_factors.map((factor) => (
              <div key={factor.label} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-neutral">{factor.label}</dt>
                <dd
                  dir="ltr"
                  className={`m-0 font-semibold tabular-nums ${factor.points < 0 ? 'text-urgent' : 'text-good'}`}
                >
                  {`${factor.points > 0 ? '+' : ''}${f.number(factor.points)}`}
                </dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-xs leading-6 text-text-2">{t('customer.score.note')}</p>
        </SectionCard>
      )}

      {customer.similar && (
        <SectionCard id="customer-similar" variant="panel" title={t('customer.similar.title')}>
          <p className="m-0 text-sm leading-7 text-neutral">
            {t('customer.similar.text', {
              n: f.number(customer.similar.count),
              name: first,
              background: customer.similar.background,
            })}
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {customer.similar.universities.map((university) => (
              <li key={university} dir="ltr">
                <Chip tone="neutral" small>
                  {university}
                </Chip>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard id="customer-profile" variant="panel" title={t('customer.profile.title')}>
        <dl className="m-0 flex flex-col gap-2.5">
          {customer.profile.map((item) => (
            <div key={item.key} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="flex-none text-text-2">{t(`customer.profile.key.${item.key}`)}</dt>
              <dd className="m-0 text-end font-medium">{profileValue(item)}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard id="customer-purchases" variant="panel" title={t('customer.purchases.title')}>
        {customer.purchases.length === 0 ? (
          <p className="m-0 text-sm text-text-2">{t('customer.purchases.none')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {customer.purchases.map((purchase, index) => (
              <li
                key={`${String(index)}-${purchase.label}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{purchase.label}</span>
                <Chip tone={PURCHASE_TONE[purchase.status]} small>
                  {t(`customer.purchases.status.${purchase.status}`)}
                </Chip>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-text-2">{t('customer.purchases.credit')}</span>
          <span className="font-semibold">{s.toman(customer.credit)}</span>
        </div>
      </SectionCard>
    </>
  );
}

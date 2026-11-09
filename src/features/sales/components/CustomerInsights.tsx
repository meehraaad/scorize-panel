import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CustomerData, ProfileKey } from '../api';

/** What the first call should find out, in this order (the rest is on the details tab). */
const FIRST_CALL: readonly ProfileKey[] = [
  'wanted_degree',
  'countries',
  'budget',
  'current_degree',
  'gpa',
  'language',
];
const SHOWN = 4;

/**
 * The summary tab's "to convince" cards: the score and why, and admissions of people like them.
 * Each shows only when there is something to say; a customer we know little about gets the
 * questions for the first call instead.
 */
export function CustomerInsights({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const first = customer.name.split(' ')[0] ?? customer.name;
  const { t: tc } = useTranslation();
  const known = new Set(customer.profile.map((item) => item.key));
  const ask = FIRST_CALL.filter((key) => !known.has(key));

  return (
    <>
      {ask.length >= 3 && (
        <SectionCard id="customer-first-call" variant="panel" title={t('customer.firstCall.title')}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {ask.slice(0, SHOWN).map((key) => (
              <li key={key} className="flex items-center gap-2.5 text-[15px]">
                <span aria-hidden="true" className="size-2 flex-none rounded-full bg-primary" />
                {t(`customer.profile.key.${key}`)}
              </li>
            ))}
          </ul>
          {ask.length > SHOWN && (
            <span className="text-xs text-text-2">
              {t('customer.firstCall.more', { n: f.number(ask.length - SHOWN) })}
            </span>
          )}
        </SectionCard>
      )}
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
              background: t(
                customer.similar.background.field
                  ? 'customer.similar.background'
                  : 'customer.similar.backgroundNoField',
                {
                  degree: tc(`degree.${customer.similar.background.degree}`),
                  field: customer.similar.background.field,
                  gpa: f.number(customer.similar.background.gpa),
                },
              ),
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
    </>
  );
}

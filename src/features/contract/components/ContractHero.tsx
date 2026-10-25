import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/components/ui/Progress';
import { daysBetween, daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import type { ContractData } from '../api';

/** Days in an average month, to show the contract length in months. */
const MONTH_DAYS = 30.44;

/** Dark summary card: what the contract covers, what it costs, and how much time is left. */
export function ContractHero({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const total = daysBetween(contract.start_date, contract.end_date);
  const left = Math.min(total, daysUntil(contract.end_date));
  const turkey = contract.kind === 'turkey';
  const features = f.list(contract.features.map((key) => t(`feature.${key}`)));
  const degrees = f.list(contract.degrees.map((degree) => tc(`degree.${degree}`)));

  const facts = (
    turkey
      ? [
          [t('hero.countries'), f.list(contract.countries)],
          [t('hero.degrees'), degrees],
          [t('hero.services'), features],
          [t('hero.fee'), t('hero.free')],
          contract.pledge_signed_at && [
            t('hero.pledge'),
            t('hero.pledgeSigned', { date: f.dateShort(contract.pledge_signed_at) }),
          ],
        ]
      : [
          [t('hero.countries'), f.list(contract.countries)],
          [t('hero.degrees'), degrees],
          [t('hero.applies'), t('hero.appliesValue', { n: f.number(contract.applies_total) })],
          contract.total_amount !== null && [
            t('hero.total'),
            f.price(contract.total_amount, contract.currency, (amount) => t('amount', { amount })),
          ],
          [t('hero.duration'), t('hero.months', { n: f.number(Math.round(total / MONTH_DAYS)) })],
        ]
  ).filter((fact): fact is [string, string] => Array.isArray(fact));

  return (
    <section
      aria-label={t('hero.label')}
      className="flex flex-col gap-5 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:gap-[26px] lg:rounded-[32px] lg:px-10 lg:py-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-on-hero-2">
            {t('hero.number', {
              number: f.digits(String(contract.number)),
              holder: contract.holder,
            })}
          </span>
          <span className="font-display text-2xl font-bold lg:text-[32px]">
            {turkey ? t('hero.turkey') : features}
          </span>
        </div>
        <span
          className={`inline-flex h-8 items-center gap-2 rounded-full bg-hero-raised px-3.5 text-sm font-semibold ${
            contract.status === 'active' ? 'text-live' : 'text-on-hero-2'
          }`}
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
          {t(`hero.status.${contract.status}`)}
        </span>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-5 pt-[22px] shadow-[inset_0_1px_0_var(--hero-line)] lg:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1.5">
            <dt className="text-[13px] text-on-hero-2">{label}</dt>
            <dd className="m-0 text-base font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
          <span className="text-on-hero-2">{f.date(contract.start_date)}</span>
          <span className="font-semibold">
            {t('hero.daysLeft', { left: f.number(left), total: f.number(total) })}
          </span>
          <span className="text-on-hero-2">{f.date(contract.end_date)}</span>
        </div>
        <ProgressBar
          value={percentOf(total - left, total)}
          size="sm"
          tone="onHero"
          label={t('hero.time')}
        />
      </div>
    </section>
  );
}

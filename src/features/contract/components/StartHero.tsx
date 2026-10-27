import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { StepBar } from '@/components/ui/Progress';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ContractData } from '../api';

type Prepayment = NonNullable<ApplicantAccess['prepayment']>;

const STEPS = ['pay', 'supervisor', 'open'] as const;

/**
 * An approved contract whose case hasn't started (S46), on the luxe card: what the contract is, and
 * the prepayment right on the card (amount, state, the way to pay), then the steps to the case.
 * The headline, the actions and the gold step follow the prepayment's state. The home only points
 * here. Design: canvas "Scorize New User Dashboard v2", ContractStarting.
 */
export function StartHero({
  prepayment,
  contract,
}: {
  prepayment: Prepayment;
  contract: ContractData;
}) {
  const { t } = useTranslation('contract');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const { status } = prepayment;
  const payment = `/payments/${String(prepayment.payment_id)}`;
  const about = [
    f.list(contract.features.map((key) => t(`feature.${key}`))),
    f.list(contract.countries),
    f.list(contract.degrees.map((degree) => tc(`degree.${degree}`))),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      aria-label={t('start.title')}
      className="flex flex-col gap-7 rounded-[24px] px-5 py-6 text-on-hero shadow-luxe bg-luxe lg:rounded-[36px] lg:p-9"
    >
      <div className="grid gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <span className="inline-flex h-7 items-center self-start rounded-full px-3.5 text-[13px] font-bold bg-luxe-gold">
            {t(`start.badge.${status}`)}
          </span>
          <h2 className="m-0 font-display text-[26px] leading-snug font-bold lg:text-4xl">
            {t(`start.headline.${status}`)}
          </h2>
          <p className="m-0 max-w-[620px] text-[15px] leading-7 text-on-luxe-2 lg:text-base">
            {about && `${about}. `}
            {t(`start.text.${status}`)}
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-end gap-3.5 lg:border-s lg:border-[var(--luxe-line)] lg:ps-10">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-on-luxe-2">{t('start.prepayment')}</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-luxe-gold-light">
              <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
              {t(`start.state.${status}`)}
            </span>
          </span>
          <span className="flex items-baseline gap-2.5">
            <span className="font-display text-[40px] leading-tight font-bold tabular-nums lg:text-[44px]">
              {f.number(prepayment.amount)}
            </span>
            <span className="text-base text-on-luxe-2">{t('start.toman')}</span>
          </span>
          {status !== 'paid' && (
            <div className="mt-1.5 flex flex-wrap gap-2.5">
              {status === 'review' ? (
                <Link to={payment} className={buttonClass('onLuxe', 'flex-auto', 'lg')}>
                  {t('start.open')}
                </Link>
              ) : (
                <>
                  <Link to={payment} className={buttonClass('gold', 'flex-auto', 'lg')}>
                    {t(status === 'declined' ? 'start.again' : 'start.pay')}
                  </Link>
                  <Link
                    to={`${payment}?method=receipt`}
                    className={buttonClass('onLuxe', 'flex-auto', 'lg')}
                  >
                    {t('start.receipt')}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <StepBar
        label={t('start.steps')}
        tone="luxe"
        steps={STEPS.map((step) => ({
          key: step,
          label: t(`start.step.${step}`),
          hint: t(`start.hint.${step}`),
        }))}
        current={status === 'paid' ? 1 : 0}
        className="pt-5 shadow-[inset_0_1px_0_var(--luxe-line)]"
      />
    </section>
  );
}

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { StepBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { useFormat } from '@/lib/i18n/useFormat';

type Prepayment = NonNullable<ApplicantAccess['prepayment']>;

const STEPS = ['pay', 'supervisor', 'open'] as const;
const TONE: Record<Prepayment['status'], ChipTone> = {
  unpaid: 'warn',
  review: 'info',
  declined: 'danger',
  paid: 'good',
};

/**
 * An approved contract whose case hasn't started (S46): the prepayment to pay, then a manager
 * assigns a supervisor and the panel opens. The home only points here.
 */
export function StartCard({ prepayment }: { prepayment: Prepayment }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const paid = prepayment.status === 'paid';
  const amount = t('start.toman', { amount: f.number(prepayment.amount) });

  return (
    <SectionCard
      id="contract-start"
      variant="panel"
      size="lg"
      title={t('start.title')}
      subtitle={t('start.subtitle')}
      badge={
        <Chip tone={TONE[prepayment.status]} small>
          {t(`start.state.${prepayment.status}`)}
        </Chip>
      }
    >
      <StepBar
        label={t('start.steps')}
        steps={STEPS.map((step) => ({ key: step, label: t(`start.step.${step}`) }))}
        current={paid ? 1 : 0}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 flex-[1_1_320px] text-[15px] leading-7">
          {t(`start.${prepayment.status}`, { amount })}
        </p>
        {!paid && (
          <Link
            to={`/payments/${String(prepayment.payment_id)}`}
            className={buttonClass('primary', 'max-sm:w-full')}
          >
            {t(prepayment.status === 'review' ? 'start.open' : 'start.pay')}
          </Link>
        )}
      </div>
    </SectionCard>
  );
}

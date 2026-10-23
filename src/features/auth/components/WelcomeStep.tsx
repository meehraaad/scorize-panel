import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { StepHeader } from './StepHeader';

interface Props {
  firstName: string;
  pending: boolean;
  onContinue: () => void;
}

const NEXT_STEPS = [
  { id: 'estimate', href: SITE.estimateAdmission, tile: 'bg-tint text-primary-text' },
  { id: 'consultation', href: SITE.consultation, tile: 'bg-good-tint text-good' },
  { id: 'samples', href: SITE.admissionSamples, tile: 'bg-warn-tint text-warn' },
] as const;

/** Right after sign-up: what to do first on Scorize, then into the panel. */
export function WelcomeStep({ firstName, pending, onContinue }: Props) {
  const { t } = useTranslation('auth');
  const format = useFormat();

  return (
    <div className="flex flex-col gap-6">
      <span className="flex size-[72px] items-center justify-center rounded-3xl bg-good-tint text-good">
        <Icon name="check" size={34} />
      </span>
      <StepHeader title={t('welcome.title', { name: firstName })}>{t('welcome.body')}</StepHeader>
      <nav aria-labelledby="welcome-next" className="flex flex-col gap-2.5">
        <h2 id="welcome-next" className="m-0 text-sm font-semibold">
          {t('welcome.startHere')}
        </h2>
        {NEXT_STEPS.map((item, index) => (
          <a
            key={item.id}
            href={item.href}
            className="flex items-center gap-3.5 rounded-[20px] bg-surface px-4 py-3.5 text-text shadow-panel hover:shadow-[inset_0_0_0_1px_var(--line-3)]"
          >
            <span
              className={`flex size-11 flex-none items-center justify-center rounded-[14px] font-bold ${item.tile}`}
            >
              {format.number(index + 1)}
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">
                {t(`welcome.next.${item.id}.title`)}
              </span>
              <span className="text-[13px] text-text-2">{t(`welcome.next.${item.id}.text`)}</span>
            </span>
            <Icon name="chevronEnd" size={18} className="text-text-2" />
          </a>
        ))}
      </nav>
      <Button
        size="lg"
        onClick={onContinue}
        disabled={pending}
        aria-busy={pending}
        className="w-full"
      >
        {t('welcome.enterPanel')}
      </Button>
    </div>
  );
}

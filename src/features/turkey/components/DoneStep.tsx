import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { StepDot } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';

const NEXT = ['call', 'apply', 'approve'] as const;

/** Step 5: signed. The case has started; what happens next. */
export function DoneStep() {
  const { t } = useTranslation('turkey');
  const f = useFormat();
  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center lg:p-10">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-good-tint text-good"
      >
        <Icon name="check" size={30} />
      </span>
      <h1 className="m-0 font-display text-2xl font-bold lg:text-[28px]">{t('done.title')}</h1>
      <p className="m-0 max-w-[60ch] text-[15px] leading-8 text-text-2">{t('done.text')}</p>
      <ol
        aria-label={t('done.next')}
        className="m-0 flex w-full max-w-[520px] list-none flex-col gap-2.5 p-0 text-start"
      >
        {NEXT.map((step, index) => (
          <li
            key={step}
            className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3 text-[15px]"
          >
            <StepDot number={f.number(index + 1)} state="current" size="sm" />
            {t(`done.nextStep.${step}`)}
          </li>
        ))}
      </ol>
      <Link to="/" className={buttonClass('primary', 'mt-2')}>
        {t('done.home')}
      </Link>
    </Card>
  );
}

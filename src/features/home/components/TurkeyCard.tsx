import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import type { ApplicantAccess } from '@/lib/applicant/access';

/**
 * The free Turkey application: an invitation, or where the request stands once started (canvas V7
 * sections 2 and 3).
 */
export function TurkeyCard({ step }: { step: ApplicantAccess['turkey'] }) {
  const { t } = useTranslation('home');
  return (
    <Card
      aria-labelledby="guest-turkey"
      className="flex flex-wrap items-center gap-x-7 gap-y-5 p-5 shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)] lg:p-7"
    >
      <span
        aria-hidden="true"
        className="flex size-16 flex-none items-center justify-center rounded-[20px] bg-tint text-[15px] font-extrabold tracking-wider text-primary-text"
      >
        {t('guest.turkey.badge')}
      </span>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <h2 id="guest-turkey" className="m-0 font-display text-[21px] font-bold">
            {t('guest.turkey.title')}
          </h2>
          <Chip tone="good">{t('guest.turkey.free')}</Chip>
        </span>
        <p className="m-0 text-sm leading-7 text-text-2">
          {step ? t(`guest.turkey.state.${step}`) : t('guest.turkey.text')}
        </p>
      </div>
      <Link to="/turkey" className={buttonClass('primary', 'max-sm:w-full')}>
        {t(step ? 'guest.turkey.continue' : 'guest.turkey.start')}
      </Link>
    </Card>
  );
}

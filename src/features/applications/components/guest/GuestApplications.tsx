import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { ChanceSection } from './ChanceSection';
import { GuestHero } from './GuestHero';
import { GuestInterests } from './GuestInterests';

/** What every application goes through, in order. */
const STEPS = ['pick', 'approve', 'send', 'result'] as const;

/**
 * "Applications & results" without a contract: a page that sells the service instead of a locked
 * preview. The promise and the way to start; their research interests and the professors on them;
 * their chance per country with the answers it reads; the four steps of an application; one line
 * to start with a consultation. Design: canvas "تب اپلای‌ها و نتایج", بدون قرارداد.
 */
export function GuestApplications({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('applications');
  const f = useFormat();

  return (
    <>
      <GuestHero access={access} />
      {ON_SERVER.guestInterests && (
        <Suspense fallback={null}>
          <GuestInterests />
        </Suspense>
      )}
      {ON_SERVER.estimate && <ChanceSection />}

      <section
        aria-labelledby="apps-steps"
        className="flex flex-col gap-5 pt-7 shadow-[inset_0_1px_0_var(--line-2)] lg:pt-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1">
          <h2
            id="apps-steps"
            className="m-0 max-w-[620px] font-display text-[22px] leading-relaxed font-bold"
          >
            {t('guest.steps.title')}
          </h2>
          <span className="text-sm text-text-2">{t('guest.steps.subtitle')}</span>
        </div>
        <ol className="m-0 grid list-none gap-x-14 p-0 lg:grid-cols-2">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-3.5 gap-y-1 py-5 shadow-[inset_0_1px_0_var(--hair)]"
            >
              <span
                aria-hidden="true"
                className="row-span-2 font-display font-bold text-primary-text"
              >
                {f.number(index + 1)}
              </span>
              <span className="text-base font-bold">{t(`guest.steps.${step}.name`)}</span>
              <span className="text-sm leading-7 text-text-2">{t(`guest.steps.${step}.text`)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="apps-start"
        className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-tint p-6 lg:px-8"
      >
        <div className="flex flex-col gap-1">
          <h2 id="apps-start" className="m-0 font-display text-xl leading-snug font-bold">
            {t('guest.start.title')}
          </h2>
          <span className="text-sm leading-7 text-text-2">{t('guest.start.text')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5 max-sm:w-full">
          <Link to="/consultations/book" className={buttonClass('primary', 'max-sm:w-full', 'lg')}>
            {t('guest.book')}
          </Link>
          <Link to="/contract" className={buttonClass('outline', 'max-sm:w-full', 'lg')}>
            {t('guest.start.contract')}
          </Link>
        </div>
      </section>
    </>
  );
}

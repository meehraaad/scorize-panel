import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { FaqList } from '@/components/tickets/FaqList';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StepBar } from '@/components/ui/Progress';
import { SideSection } from '@/components/ui/SectionCard';
import { sessionSummariesQuery } from '@/lib/applicant/consultations';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { Admissions } from './Admissions';
import { SessionNotes } from './SessionNotes';
import { StartCards } from './StartCards';

const STAGES = ['session', 'choose', 'contract', 'start'] as const;

const UNLOCKS = [
  { key: 'supervisor', icon: 'user' },
  { key: 'writing', icon: 'pen' },
  { key: 'applications', icon: 'graduation' },
  { key: 'tickets', icon: 'send' },
] as const satisfies readonly { key: string; icon: IconName }[];

const FAQ = ['turkey', 'both', 'price', 'sign'] as const;

/**
 * "Contract & payment" without a contract: a page that sells the next step instead of a locked
 * preview. Where they are on the way to a case, the two ways to start (Turkey, the full contract),
 * what their consultant wrote after their sessions, admissions of people like them, what the panel
 * opens after a contract, and the questions asked before one. Only the start cards are raised; the
 * rest sits on the page with thin lines. Design: canvas "Scorize New User Dashboard v2",
 * ContractGuest and ContractGuestSession.
 */
export function GuestContract({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('contract');
  const { data: notes } = useSuspenseInfiniteQuery(sessionSummariesQuery());
  // After a session (its notes are shared), the next stage is choosing how to start.
  const here = notes.pages[0]?.results.length ? 1 : 0;

  return (
    <>
      <StepBar
        label={t('guest.journey.label')}
        steps={STAGES.map((stage, index) => ({
          key: stage,
          label: t(`guest.journey.${stage}.name`),
          hint:
            index === here
              ? t('guest.journey.here', { hint: t(`guest.journey.${stage}.hint`) })
              : t(`guest.journey.${stage}.hint`),
        }))}
        current={here}
      />
      <StartCards access={access} />
      <SessionNotes />
      {ON_SERVER.estimate && (
        <Suspense fallback={null}>
          <Admissions />
        </Suspense>
      )}

      <section
        aria-labelledby="contract-unlocks"
        className="flex flex-col gap-5 pt-7 shadow-[inset_0_1px_0_var(--line-2)] lg:pt-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1">
          <h2
            id="contract-unlocks"
            className="m-0 max-w-[620px] font-display text-[22px] leading-relaxed font-bold"
          >
            {t('guest.unlocks.title')}
          </h2>
          <span className="text-sm text-text-2">{t('guest.unlocks.subtitle')}</span>
        </div>
        <dl className="m-0 grid gap-x-14 lg:grid-cols-2">
          {UNLOCKS.map(({ key, icon }) => (
            <div
              key={key}
              className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-3.5 gap-y-1 py-5 shadow-[inset_0_1px_0_var(--hair)]"
            >
              <span className="row-span-2 pt-0.5 text-primary-text">
                <Icon name={icon} size={22} />
              </span>
              <dt className="text-base font-bold">{t(`guest.unlocks.${key}.name`)}</dt>
              <dd className="m-0 text-sm leading-7 text-text-2">
                {t(`guest.unlocks.${key}.text`)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="m-0 rounded-[20px] bg-surface px-6 py-4 text-sm leading-7 text-text-2 shadow-[inset_0_0_0_1px_var(--hair)]">
          <b className="text-text">{t('guest.unlocks.payLabel')}</b> {t('guest.unlocks.pay')}
        </p>
      </section>

      <SideSection id="contract-faq" title={t('guest.faq.title')}>
        <FaqList
          items={FAQ.map((key) => ({
            id: key,
            question: t(`guest.faq.${key}.q`),
            answer: t(`guest.faq.${key}.a`),
          }))}
        />
      </SideSection>
    </>
  );
}

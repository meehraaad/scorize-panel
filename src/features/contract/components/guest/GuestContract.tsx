import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { GuestInterests } from '@/components/applicant/GuestInterests';
import { FaqList } from '@/components/tickets/FaqList';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SideSection } from '@/components/ui/SectionCard';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { Tickets } from './Tickets';

const PROMISE = [
  { key: 'choose', icon: 'check' },
  { key: 'installments', icon: 'card' },
  { key: 'together', icon: 'document' },
] as const satisfies readonly { key: string; icon: IconName }[];

const FAQ = ['why', 'turkey', 'both', 'price'] as const;

/**
 * "Contract & payment" without a contract: what this tab holds once there is one (the decisions
 * stay theirs), the two contracts as tickets (Turkey online, the full contract at the office), the
 * research interests they can already save, and the questions asked before starting. Calm and
 * spacious on purpose. Design: canvas "قرارداد و پرداخت: بدون قرارداد".
 */
export function GuestContract({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('contract');

  return (
    <div className="flex flex-col gap-12 lg:gap-[72px]">
      <section
        aria-labelledby="contract-promise"
        className="grid gap-5 rounded-[24px] bg-surface p-5 shadow-panel lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:items-center lg:gap-11 lg:px-12 lg:py-11"
      >
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold text-primary-text">
            {t('guest.promise.label')}
          </span>
          <h2
            id="contract-promise"
            className="m-0 font-display text-lg leading-relaxed font-bold lg:text-[26px]"
          >
            {t('guest.promise.title')}
          </h2>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0 lg:grid-cols-3 lg:gap-6">
          {PROMISE.map(({ key, icon }) => (
            <li
              key={key}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 lg:flex lg:flex-col lg:gap-2"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-xl bg-tint text-primary-text lg:size-10"
              >
                <Icon name={icon} size={18} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-extrabold lg:text-[15px]">
                  {t(`guest.promise.${key}.name`)}
                </span>
                <span className="text-[13px] leading-7 text-text-2">
                  {t(`guest.promise.${key}.text`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="contract-choose" className="flex flex-col gap-4 lg:gap-6">
        <h2 id="contract-choose" className="m-0 font-display text-lg font-bold lg:text-[22px]">
          {t('guest.choose')}
        </h2>
        <Tickets access={access} />
        <p className="m-0 text-center text-[13px] leading-7 text-text-2 lg:text-sm">
          {t('guest.both')}
        </p>
      </section>

      {ON_SERVER.guestInterests && (
        <Suspense fallback={null}>
          <GuestInterests id="contract-interests" />
        </Suspense>
      )}

      <SideSection id="contract-faq" title={t('guest.faq.title')}>
        <FaqList
          items={FAQ.map((key) => ({
            id: key,
            question: t(`guest.faq.${key}.q`),
            answer: t(`guest.faq.${key}.a`),
          }))}
        />
      </SideSection>
    </div>
  );
}

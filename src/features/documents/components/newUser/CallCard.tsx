import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { ON_SERVER } from '@/lib/applicant/onServer';

const STEPS = ['see', 'call', 'contract'] as const;

/** "No time to upload?": an advisor calls and asks for everything by phone. */
export function CallCard({ phone }: { phone: string | null }) {
  const { t } = useTranslation('documents');
  if (!ON_SERVER.callRequest) return null;
  return (
    <section
      aria-labelledby="docs-call"
      className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[28px] bg-tint p-6 lg:p-8"
    >
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
        <h2 id="docs-call" className="m-0 font-display text-xl font-black">
          {t('newUser.call.title')}
        </h2>
        <p className="m-0 text-sm leading-7 text-text-2">{t('newUser.call.text')}</p>
        <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
          {STEPS.map((step) => (
            <li key={step} className="flex items-center gap-2 text-sm">
              <Icon name="check" size={16} className="flex-none text-primary-text" />
              {t(`newUser.call.steps.${step}`)}
            </li>
          ))}
        </ul>
      </div>
      <CallRequestButton
        label={t('newUser.call.button')}
        className={buttonClass('primary', 'max-sm:w-full', 'lg')}
        phone={phone}
        topic="admission"
        page="documents"
        reason="guest"
      />
    </section>
  );
}

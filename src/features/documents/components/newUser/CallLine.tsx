import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';

/** "No time to upload?" in one line: an advisor calls and asks for it all by phone. */
export function CallLine({ phone }: { phone: string | null }) {
  const { t } = useTranslation('documents');
  return (
    <p className="m-0 flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-8 text-[15px] text-text-2">
      {t('newUser.call.text')}
      <CallRequestButton
        label={t('newUser.call.button')}
        className="min-h-11 font-bold text-primary-text"
        phone={phone}
        topic="admission"
        page="documents"
        reason="guest"
      />
    </p>
  );
}

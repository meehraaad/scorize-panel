import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { SectionCard } from '@/components/ui/SectionCard';

/** A contract without writing services: the team can write the CV and SOP too (a seller calls). */
export function WritingUpsell({ phone }: { phone: string | null }) {
  const { t } = useTranslation('documents');
  return (
    <SectionCard variant="panel" size="lg" id="docs-upsell" title={t('upsell.title')}>
      <p className="m-0 text-sm leading-7 text-text-2">{t('upsell.text')}</p>
      <CallRequestButton
        label={t('upsell.cta')}
        className={buttonClass('outline', 'w-full')}
        phone={phone}
        topic="writing"
        page="documents"
        reason="add_service"
      />
    </SectionCard>
  );
}

import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BookingFlow } from '@/components/applicant/booking/BookingFlow';
import { BackLink } from '@/components/ui/BackLink';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Booking a consultation on its own page, for links (SMS, email, the site): the same flow as the
 * booking dialog. `?mode=online|in_person&type=<id>` opens it on a choice.
 */
export default function BookPage() {
  const { t } = useTranslation('booking');
  const [params] = useSearchParams();
  return (
    <PageStack>
      <BackLink to="/">{t('back')}</BackLink>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <BookingFlow initial={{ mode: params.get('mode'), type: Number(params.get('type')) }} />
    </PageStack>
  );
}

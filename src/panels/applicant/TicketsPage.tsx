import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionLock } from '@/components/applicant/SectionLock';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { TicketsPage } from '@/features/tickets/TicketsPage';
import { TicketsPreview } from '@/features/tickets/TicketsPreview';
import { accessQuery, lockOf } from '@/lib/applicant/access';
import { applicantTickets } from './tickets';

/**
 * /tickets (supervisors), /tickets/writing/<department>. Without an active contract: the locked
 * preview of canvas V7 section 6 (the tickets page itself is shared with the staff panels).
 */
export default function ApplicantTicketsPage() {
  const { t } = useTranslation('tickets');
  const { data: access } = useSuspenseQuery(accessQuery);
  const lock = lockOf(access, 'tickets');

  // An ended case keeps its conversations as they are (the chat layout has no room for a banner).
  if (!lock || lock === 'ended') return <TicketsPage config={applicantTickets} />;
  return (
    <PageStack>
      <PageHeader title={t('title')} />
      <SectionLock section="tickets" lock={lock} access={access}>
        <TicketsPreview />
      </SectionLock>
    </PageStack>
  );
}

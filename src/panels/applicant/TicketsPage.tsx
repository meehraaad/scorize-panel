import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionLock } from '@/components/applicant/SectionLock';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { TicketsPage } from '@/features/tickets/TicketsPage';
import { TicketsPreview } from '@/features/tickets/TicketsPreview';
import { accessQuery, lockOf } from '@/lib/applicant/access';
import { ticketsQuery } from '@/lib/tickets/api';
import { applicantTickets } from '@/lib/applicant/tickets';

/**
 * /tickets (supervisors), /tickets/writing/<department>. Without an active contract: the locked
 * preview of canvas V7 section 6 (the tickets page itself is shared with the staff panels), unless
 * they bought writing: then its writers' threads open.
 */
export default function ApplicantTicketsPage() {
  const { t } = useTranslation('tickets');
  const { data: access } = useSuspenseQuery(accessQuery);
  // Started with the route (prefetchTickets): no case and no writing order answers no threads.
  const { data: tickets } = useSuspenseQuery(ticketsQuery(applicantTickets));
  const lock = lockOf(access, 'tickets');
  const writing = tickets?.threads.some((thread) => thread.department === 'writing') ?? false;

  // An ended case keeps its conversations as they are (the chat layout has no room for a banner).
  if (!lock || lock === 'ended' || writing) return <TicketsPage config={applicantTickets} />;
  return (
    <PageStack>
      <PageHeader title={t('title')} />
      <SectionLock section="tickets" lock={lock} access={access}>
        <TicketsPreview />
      </SectionLock>
    </PageStack>
  );
}

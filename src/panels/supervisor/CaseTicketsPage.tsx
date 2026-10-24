import { useParams } from 'react-router';
import { caseTickets } from '@/features/supervisor/api';
import { casePath } from '@/features/supervisor/paths';
import type { TicketsConfig } from '@/features/tickets/config';
import { TicketsPage } from '@/features/tickets/TicketsPage';

/**
 * The case file's tickets tab: the shared tickets page for one applicant's threads, as staff
 * (no priority picker, sees the applicant's ratings). Writing threads show when the server sends them.
 */
export default function CaseTicketsPage() {
  const id = Number(useParams().id);
  const config: TicketsConfig = {
    ...caseTickets(id),
    path: casePath(id, 'tickets'),
    viewer: 'staff',
  };
  return <TicketsPage config={config} embedded />;
}

import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { EXECUTIVE_API } from '@/features/executive/api';
import { SUPERVISOR_KEY, type Inbox, type InboxFilter } from '@/features/supervisor/api';
import { WRITER_INBOX_KEY } from '@/features/writer/api';
import { api } from '@/lib/api/client';
import type { Role } from '@/lib/auth/roles';

export function ticketDepartment(roles: Role[], search: URLSearchParams) {
  if (!roles.includes('writer')) return 'cases';
  if (!roles.includes('supervisor')) return 'writing';
  return search.get('department') === 'writing' ? 'writing' : 'cases';
}

function executiveInboxQuery(source: 'cases' | 'writing', filter: InboxFilter, page: number) {
  const key = source === 'cases' ? [...SUPERVISOR_KEY, 'inbox', 'executive'] : WRITER_INBOX_KEY;
  return queryOptions({
    queryKey: [...key, filter, page],
    queryFn: ({ signal }) =>
      api<Inbox>(`${EXECUTIVE_API}/tickets/${source}/?filter=${filter}&page=${String(page)}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export const caseInboxQuery = (filter: InboxFilter, page: number) =>
  executiveInboxQuery('cases', filter, page);
export const writingInboxQuery = (filter: InboxFilter, page: number) =>
  executiveInboxQuery('writing', filter, page);

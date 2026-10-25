import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import type { TicketsEndpoint } from '@/lib/tickets/api';
import { caseKey } from './case';
import { SUPERVISOR_API, SUPERVISOR_KEY } from './common';

/**
 * One case's conversations, for the shared tickets page (`viewer: 'staff'`). Under the case's
 * key, so reading or answering refreshes the case's unread count.
 */
export const caseTickets = (id: number): TicketsEndpoint => ({
  api: `${SUPERVISOR_API}/cases/${String(id)}/tickets`,
  queryKey: caseKey(id),
});

export type InboxFilter = 'waiting' | 'all';

/** A case's supervisors' thread, as the inbox lists it. */
export interface InboxItem {
  applicant: { id: number; name: string; file_number: number };
  last: { text: string; at: string; author: string; mine: boolean };
  unread: number;
  /** The applicant's oldest message nobody answered yet; null when answered. */
  waiting_since: string | null;
  /** The applicant marked a waiting message «خیلی ضروری». */
  urgent: boolean;
}

/** A page of the chosen filter, and how many threads each filter has. */
export interface Inbox extends Page<InboxItem> {
  counts: Record<InboxFilter, number>;
}

export const inboxQuery = (filter: InboxFilter, page: number) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'inbox', filter, page],
    queryFn: ({ signal }) =>
      api<Inbox>(`${SUPERVISOR_API}/tickets/?filter=${filter}&page=${String(page)}`, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

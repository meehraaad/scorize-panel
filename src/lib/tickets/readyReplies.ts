import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * The ticket replies staff pick from in the composer (the messages section's "ready messages",
 * kind `ticket`; Django `api/messages/v1/ticket-replies/`). Only those that are on.
 */
export interface ReadyReply {
  id: number;
  title: string;
  /** Without `case`: with `{customer}` and `{seller}` (the staff member) still in it. */
  text: string;
}

/**
 * `caseId`: a case's chat. Django fills in every variable for its applicant (their session, the
 * last summary…); elsewhere only `{customer}` and `{seller}` are filled, by the panel.
 */
export const ticketRepliesQuery = (caseId?: number) =>
  queryOptions({
    queryKey: ['messages', 'ticket-replies', caseId ?? null],
    queryFn: ({ signal }) =>
      api<ReadyReply[]>(
        `/messages/v1/ticket-replies/${caseId === undefined ? '' : `?case=${String(caseId)}`}`,
        { signal },
      ),
    staleTime: 5 * 60_000,
  });

/** Fills a ready message's `{customer}` and `{seller}`, as Django does for sellers. */
export const fillReady = (text: string, values: { customer: string; seller: string }) =>
  text.replaceAll('{customer}', values.customer).replaceAll('{seller}', values.seller);

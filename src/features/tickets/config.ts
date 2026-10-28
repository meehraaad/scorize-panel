import { queryClient } from '@/lib/api/queryClient';
import { prefetchQueries } from '@/lib/router/lazyPage';
import {
  messagesQuery,
  ticketsQuery,
  type TicketThread,
  type TicketsConfig,
  type TicketsEndpoint,
} from '@/lib/tickets/api';

export type { TicketsConfig } from '@/lib/tickets/api';

/** The address of a thread. */
export function threadPath(
  config: TicketsConfig,
  threads: readonly TicketThread[],
  thread: TicketThread,
) {
  return threads[0]?.id === thread.id ? config.path : `${config.path}/${thread.id}`;
}

/**
 * The thread a URL segment points at: '' → the first; a department ('writing') → its first
 * thread; else the thread with that id. undefined when nothing matches.
 */
export function findThread(threads: readonly TicketThread[], segment: string) {
  if (!segment) return threads[0];
  return (
    threads.find((thread) => thread.id === segment) ??
    threads.find((thread) => thread.department === segment)
  );
}

/**
 * Route data of a tickets page: the list now, and the thread the URL points at as soon as the
 * list arrives (its id comes from the list). Never awaited: a failure shows on the page.
 */
export function prefetchTickets(endpoint: TicketsEndpoint, segment: string) {
  queryClient
    .query(ticketsQuery(endpoint))
    .then((data) => {
      const thread = data && findThread(data.threads, segment);
      if (thread) prefetchQueries([messagesQuery(endpoint, thread.id)]);
    })
    .catch(() => undefined);
}

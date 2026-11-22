import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { type TicketsEndpoint, type TicketMessage, messagesQuery, type NewMessage } from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
function useRefresh(endpoint: TicketsEndpoint) {
  const client = useQueryClient();
  return () =>
    Promise.all(
      [endpoint.queryKey, ...(endpoint.invalidateKeys ?? [])].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );
}

export function useSendMessage(endpoint: TicketsEndpoint, thread: string) {
  const client = useQueryClient();
  const refresh = useRefresh(endpoint);
  return useMutation({
    mutationFn: ({ text, priority, attachment }: NewMessage) => {
      const body = new FormData();
      body.append('message', text);
      body.append('priority', String(priority));
      if (attachment) body.append('attachment', attachment);
      return api<TicketMessage>(`${endpoint.api}/${thread}/messages/`, { method: 'POST', body });
    },
    // The sent message shows at once, from the server's answer; the rest refreshes behind it.
    onSuccess: (message) => {
      client.setQueryData(messagesQuery(endpoint, thread).queryKey, (data) => {
        const [newest, ...older] = data?.pages ?? [];
        return data && newest
          ? { ...data, pages: [{ ...newest, messages: [...newest.messages, message] }, ...older] }
          : data;
      });
      void refresh();
    },
  });
}

export function useRateMessage(endpoint: TicketsEndpoint, thread: string) {
  const refresh = useRefresh(endpoint);
  return useMutation({
    mutationFn: ({ id, score }: { id: number; score: number }) =>
      api(`${endpoint.api}/${thread}/messages/${String(id)}/rating/`, {
        method: 'POST',
        body: { score },
      }),
    onSuccess: refresh,
  });
}

/** The viewer opened the thread: the other side's messages count as seen. */
export function useMarkSeen(endpoint: TicketsEndpoint, thread: string) {
  const refresh = useRefresh(endpoint);
  return useMutation({
    mutationFn: () => api(`${endpoint.api}/${thread}/seen/`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  MESSAGES_API,
  MESSAGES_KEY,
  type SystemMessageDetail,
  type SystemChange,
  type ReadyMessage,
  type ReadyInput,
} from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
function useMessagesMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  key: QueryKey = MESSAGES_KEY,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

export const useSaveSystemMessage = (key: string) =>
  useMessagesMutation(
    (change: SystemChange) =>
      api<SystemMessageDetail>(`${MESSAGES_API}/system/${encodeURIComponent(key)}/`, {
        method: 'PATCH',
        body: change,
      }),
    [...MESSAGES_KEY, 'system'],
  );

/** Sends it to the person asking, with the sample values (an SMS costs). */
export const useTestSystemMessage = (key: string) =>
  useMutation({
    mutationFn: () =>
      api<{ sent: boolean }>(`${MESSAGES_API}/system/${encodeURIComponent(key)}/test/`, {
        method: 'POST',
      }),
  });

export const useAddReadyMessage = () =>
  useMessagesMutation((values: ReadyInput) =>
    api<ReadyMessage>(`${MESSAGES_API}/ready/`, { method: 'POST', body: values }),
  );

export const useSaveReadyMessage = (id: number) =>
  useMessagesMutation((change: Partial<ReadyInput>) =>
    api<ReadyMessage>(`${MESSAGES_API}/ready/${String(id)}/`, { method: 'PATCH', body: change }),
  );

export const useDeleteReadyMessage = (id: number) =>
  useMessagesMutation(() => api(`${MESSAGES_API}/ready/${String(id)}/`, { method: 'DELETE' }));

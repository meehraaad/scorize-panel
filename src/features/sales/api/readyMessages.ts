import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import type { FieldVariable } from '@/lib/messageVariables';

/**
 * A seller's own ready messages, made in settings (Django `api/sales/v1/ready.py`): they show on
 * that seller's customer pages (WhatsApp, the contact log) before management's, and no one else
 * sees them. Management's ones come along to read only: they're changed in management > messages.
 * Imported by the settings card only, so it stays out of the first load.
 */
export interface OwnReadyMessage {
  id: number;
  title: string;
  text: string;
  updated_at: string | null;
}

export interface OwnReadyMessages {
  own: OwnReadyMessage[];
  shared: { id: number; title: string; text: string }[];
  variables: FieldVariable[];
  /** How many a seller may keep. */
  max: number;
}

const READY_API = `${SALES_API}/ready-messages`;
const readyKey = [...SALES_KEY, 'ready-messages'] as const;

export const ownReadyMessagesQuery = queryOptions({
  queryKey: readyKey,
  queryFn: ({ signal }) => api<OwnReadyMessages>(`${READY_API}/`, { signal }),
});

export type OwnReadyInput = Pick<OwnReadyMessage, 'title' | 'text'>;

/** Every change also refreshes the customer pages, whose message lists carry these filled in. */
function useReadyMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: readyKey }),
        client.invalidateQueries({ queryKey: [...SALES_KEY, 'customer'] }),
      ]),
  });
}

export const useAddOwnReadyMessage = () =>
  useReadyMutation((body: OwnReadyInput) =>
    api<OwnReadyMessage>(`${READY_API}/`, { method: 'POST', body }),
  );

export const useSaveOwnReadyMessage = (id: number) =>
  useReadyMutation((body: Partial<OwnReadyInput>) =>
    api<OwnReadyMessage>(`${READY_API}/${String(id)}/`, { method: 'PATCH', body }),
  );

export const useDeleteOwnReadyMessage = (id: number) =>
  useReadyMutation(() => api(`${READY_API}/${String(id)}/`, { method: 'DELETE' }));

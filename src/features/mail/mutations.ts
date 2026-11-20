import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  MAIL_API,
  MAIL_KEY,
  type MailServer,
  type Mailbox,
  type NewMailbox,
  type MailboxChange,
  type BotRules,
} from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** Invalidates the page's lists after a change. */
function useMailMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  key: QueryKey = MAIL_KEY,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

/** Answers the password once: it isn't shown again. */
export const useCreateMailbox = () =>
  useMailMutation((values: NewMailbox) =>
    api<Mailbox & { password: string }>(`${MAIL_API}/mailboxes/`, {
      method: 'POST',
      body: values,
    }),
  );

export const useChangeMailbox = (id: number) =>
  useMailMutation((change: MailboxChange) =>
    api<Mailbox>(`${MAIL_API}/mailboxes/${String(id)}/`, { method: 'PATCH', body: change }),
  );

export const useNewPassword = (id: number) =>
  useMailMutation(() =>
    api<{ password: string }>(`${MAIL_API}/mailboxes/${String(id)}/password/`, {
      method: 'POST',
    }),
  );

export const useDeleteMailbox = (id: number) =>
  useMailMutation(() => api(`${MAIL_API}/mailboxes/${String(id)}/`, { method: 'DELETE' }));

export const useRefreshServer = () =>
  useMailMutation((id: number) =>
    api<MailServer>(`${MAIL_API}/servers/${String(id)}/refresh/`, { method: 'POST' }),
  );

export const useSaveBotRules = () =>
  useMailMutation(
    (change: Partial<Omit<BotRules, 'updated_at'>>) =>
      api<BotRules>(`${MAIL_API}/bot-rules/`, { method: 'PATCH', body: change }),
    [...MAIL_KEY, 'rules'],
  );

export const useUnsuppress = () =>
  useMailMutation(
    (id: number) => api(`${MAIL_API}/suppressed/${String(id)}/`, { method: 'DELETE' }),
    [...MAIL_KEY, 'suppressed'],
  );

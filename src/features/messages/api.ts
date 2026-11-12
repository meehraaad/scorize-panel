import { queryOptions, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Management > messages: every message the site sends on its own (when, to whom, through what, its
 * text), and the ready messages sellers and ticket answerers pick from. Django: `api/messages/v1/`
 * (user_profile/message_catalog.py).
 *
 * Two keys: `manage_system_messages` (the automatic messages) and `manage_ready_messages` (the
 * ready ones), given on management > access.
 */
export {
  SYSTEM_MESSAGES_PERMISSION as SYSTEM_PERMISSION,
  READY_MESSAGES_PERMISSION as READY_PERMISSION,
} from '@/lib/auth/roles';
const MESSAGES_API = '/messages/v1';
/** Where the pages live: the management panel (founders). */
export const MESSAGES_PATH = '/founders/messages';
export const MESSAGES_KEY = ['messages'] as const;

export const AUDIENCES = [
  'customer',
  'applicant',
  'supervisor',
  'writer',
  'writing_manager',
  'staff',
  'manager',
  'seller',
] as const;
export type Audience = (typeof AUDIENCES)[number];

export const GROUPS = [
  'consultation',
  'sales',
  'account',
  'case',
  'writing',
  'ticket',
  'team',
  'other',
] as const;
export type Group = (typeof GROUPS)[number];

export const CHANNELS = ['sms', 'telegram', 'bell', 'email'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Variable {
  /** What goes between the braces: `{token2}`. */
  name: string;
  /** What it means, from Django ("ساعت جلسه"). */
  label: string;
  /** A made-up value for the preview and the test send. */
  sample: string;
}

export interface Person {
  id: number;
  name: string;
}

export interface Change {
  id: number;
  title: string;
  /** The text after the change ('' for a deleted ready message). */
  text: string;
  is_active: boolean;
  by: Person | null;
  at: string;
}

export interface SystemMessage {
  key: string;
  /** false: sent outside the shared list (login codes, emails): shown, not editable. */
  editable: boolean;
  title: string;
  default_title: string;
  /** The bell / Telegram text. */
  text: string;
  default_text: string;
  is_active: boolean;
  /** The title or the text differs from the default. */
  edited: boolean;
  updated_by: Person | null;
  updated_at: string | null;
  group: Group;
  audience: Audience;
  /** When it is sent, in Django's words. */
  when: string;
  /** In the order they are tried (SMS, Telegram), then the bell. */
  channels: Channel[];
  /** The Kavenegar template: its text is kept and approved there. */
  sms_template: string | null;
  variables: Variable[];
  /** Kavenegar sends so far (cost in Tomans); null: no SMS, or none sent yet. */
  stats: { sent: number; cost: number; last_sent: string } | null;
}

export interface SystemMessageDetail extends SystemMessage {
  history: Change[];
}

export const systemMessagesQuery = queryOptions({
  queryKey: [...MESSAGES_KEY, 'system'],
  queryFn: ({ signal }) =>
    api<{ groups: Group[]; results: SystemMessage[] }>(`${MESSAGES_API}/system/`, { signal }),
});

export const systemMessageQuery = (key: string) =>
  queryOptions({
    queryKey: [...MESSAGES_KEY, 'system', key],
    queryFn: ({ signal }) =>
      api<SystemMessageDetail>(`${MESSAGES_API}/system/${encodeURIComponent(key)}/`, { signal }),
  });

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

export type SystemChange = Partial<Pick<SystemMessage, 'title' | 'text' | 'is_active'>>;

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

// Ready messages

/** Where a ready message shows: the sellers' chats (WhatsApp, Telegram, SMS), tickets, or both. */
export const READY_KINDS = ['sales', 'ticket', 'both'] as const;
export type ReadyKind = (typeof READY_KINDS)[number];
/** The ready page's tabs: each lists its own and those for both. */
export const READY_TABS = ['sales', 'ticket'] as const;
export type ReadyTab = (typeof READY_TABS)[number];
/** The tab the ready page opens on. */
export const FIRST_READY_KIND: ReadyTab = 'sales';

/**
 * The variables a ready message may use (Django `user_profile/ready_variables.py`): the customer's
 * and the sender's names, the customer's session, the last summary… Filled in for the customer.
 */
export const readyVariablesQuery = queryOptions({
  queryKey: [...MESSAGES_KEY, 'ready', 'variables'],
  queryFn: ({ signal }) => api<Variable[]>(`${MESSAGES_API}/ready/variables/`, { signal }),
  staleTime: Infinity,
});

export interface ReadyMessage {
  id: number;
  kind: ReadyKind;
  title: string;
  text: string;
  is_active: boolean;
  order: number;
  updated_at: string | null;
}

export const readyMessagesQuery = (kind: ReadyTab) =>
  queryOptions({
    queryKey: [...MESSAGES_KEY, 'ready', kind],
    queryFn: ({ signal }) => api<ReadyMessage[]>(`${MESSAGES_API}/ready/?kind=${kind}`, { signal }),
  });

export const readyHistoryQuery = (id: number) =>
  queryOptions({
    queryKey: [...MESSAGES_KEY, 'history', 'ready', id],
    queryFn: ({ signal }) =>
      api<Change[]>(`${MESSAGES_API}/history/?kind=ready&key=${String(id)}`, { signal }),
  });

export type ReadyInput = Pick<ReadyMessage, 'kind' | 'title' | 'text' | 'is_active'>;

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

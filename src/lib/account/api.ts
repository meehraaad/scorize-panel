import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * The account, shared by every panel: notifications (also behind the header's bell), how messages
 * reach the user, and login details. Shapes: docs/backend-changes.md A1–A6.
 */

export const ACCOUNT_KEY = ['account'] as const;

export interface Notification {
  id: number;
  title: string;
  text: string;
  created_at: string;
  read: boolean;
  /** Where it points in the panel or the site (a ticket, an application); null for none. */
  url: string | null;
}

export interface NotificationPage {
  results: Notification[];
  /** Unread, over all pages. */
  unread: number;
  has_more: boolean;
}

export type Channel = 'sms' | 'telegram' | 'email';
export const CHANNELS: readonly Channel[] = ['sms', 'telegram', 'email'];

export interface AccountData {
  first_name: string;
  last_name: string;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
  email: string | null;
  email_verified: boolean;
  channels: Record<Channel, boolean>;
  /** The Telegram bot: linked or not, and the deep link that links it. */
  telegram: { connected: boolean; connect_url: string };
  /** "How did you hear about us", once answered. */
  referral: string | null;
}

export const REFERRALS = ['telegram', 'instagram', 'google', 'friends', 'other'] as const;
export type Referral = (typeof REFERRALS)[number];

const BASE = '/profile/v1';

export const notificationsQuery = infiniteQueryOptions({
  queryKey: [...ACCOUNT_KEY, 'notifications'],
  queryFn: ({ pageParam, signal }) =>
    api<NotificationPage>(
      `${BASE}/notifications/${pageParam === null ? '' : `?before=${String(pageParam)}`}`,
      { signal },
    ),
  initialPageParam: null as number | null,
  getNextPageParam: (last) => (last.has_more ? (last.results.at(-1)?.id ?? null) : null),
  staleTime: 30_000,
});

/** Just the unread count, for the bell: the newest page answers it. */
export const unreadQuery = queryOptions({
  queryKey: [...ACCOUNT_KEY, 'unread'],
  queryFn: ({ signal }) =>
    api<NotificationPage>(`${BASE}/notifications/`, { signal }).then((page) => page.unread),
  staleTime: 60_000,
});

export const accountQuery = queryOptions({
  queryKey: [...ACCOUNT_KEY, 'details'],
  queryFn: ({ signal }) => api<AccountData>(`${BASE}/account/`, { signal }),
  staleTime: 60_000,
});

function useAccountMutation<T, R = unknown>(mutationFn: (variables: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ACCOUNT_KEY }),
  });
}

/** Marks notifications read: the given ones, or all of them. */
export function useMarkRead() {
  return useAccountMutation((ids?: number[]) =>
    api(`${BASE}/notifications/read/`, { method: 'POST', body: ids ? { ids } : {} }),
  );
}

export function useUpdateAccount() {
  return useAccountMutation(
    (changes: Partial<Pick<AccountData, 'first_name' | 'last_name' | 'channels' | 'referral'>>) =>
      api(`${BASE}/account/`, { method: 'PATCH', body: changes }),
  );
}

export function useResendEmail() {
  return useMutation({
    mutationFn: () => api(`${BASE}/account/email/resend/`, { method: 'POST' }),
  });
}

/** 400 when the current password is wrong or the new one too weak. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current: string; new: string }) =>
      api(`${BASE}/account/password/`, { method: 'POST', body }),
  });
}

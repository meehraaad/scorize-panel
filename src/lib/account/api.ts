import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
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
  /** The Telegram bot: linked or not, and (until linked) the API link that opens the bot to link it. */
  telegram: { connected: boolean; connect_url: string | null };
  /** "How did you hear about us", once answered. */
  referral: Referral | null;
}

export const REFERRALS = ['telegram', 'instagram', 'google', 'friends', 'other'] as const;
export type Referral = (typeof REFERRALS)[number];

export const BASE = '/profile/v1';

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

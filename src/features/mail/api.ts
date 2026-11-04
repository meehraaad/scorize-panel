import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';

/**
 * Our own mail servers (PersiaMail, GradNexus) and the applicants' mailboxes on them, and the
 * rules every applicant's email bot runs inside. Django: scorize-revolution `api/mail/v1/`,
 * docs/mail-servers.md there. Managers with `mail_server.manage_mailboxes` only.
 */
export const MAIL_PERMISSION = 'manage_mailboxes';
const MAIL_API = '/mail/v1';
export const MAIL_KEY = ['mail'] as const;

export interface MailServer {
  id: number;
  name: string;
  domain: string;
  is_active: boolean;
  default_quota_mb: number;
  mailboxes: number | null;
  /** The last read of the server (every 15 minutes); null: never read. */
  checked_at: string | null;
  /** Why the last read failed; the list shown is the one before. */
  error: string | null;
  disk_used_percent: number | null;
  disk_free_mb: number | null;
  /** Emails waiting in the server's queue. */
  queue: number | null;
  certificate_expires_at: string | null;
  today: {
    sent: number | null;
    bounced: number | null;
    deferred: number | null;
    /** "Poor reputation" or blocklist rejects: a server past the rules' limit pauses its bots. */
    reputation_rejects: number | null;
  };
}

export const MAILBOX_PROBLEMS = [
  'no_applicant',
  'login_failed',
  'no_password',
  'no_quota',
  'near_full',
] as const;
export type MailboxProblem = (typeof MAILBOX_PROBLEMS)[number];

export interface MailboxApplicant {
  id: number;
  name: string;
  file_number: number | null;
}

export interface Mailbox {
  id: number;
  address: string;
  server: { id: number; name: string };
  used_mb: number;
  /** null: no quota. */
  quota_mb: number | null;
  applicant: MailboxApplicant | null;
  use_for_bot: boolean;
  use_for_writing: boolean;
  sent_today: number;
  problems: MailboxProblem[];
  checked_at: string | null;
}

export type MailboxActionKind = 'create' | 'password' | 'quota' | 'link' | 'delete';

export interface MailboxDetail extends Mailbox {
  /** The last 20 changes made from the panel; never a password. */
  actions: {
    id: number;
    kind: MailboxActionKind;
    detail: string;
    ok: boolean;
    error: string | null;
    by: string | null;
    at: string;
  }[];
}

export interface MailboxFilters {
  server: string;
  search: string;
  problem: MailboxProblem | '';
  page: number;
}

export const FIRST_MAILBOXES: MailboxFilters = { server: '', search: '', problem: '', page: 1 };

export const serversQuery = queryOptions({
  queryKey: [...MAIL_KEY, 'servers'],
  queryFn: ({ signal }) => api<MailServer[]>(`${MAIL_API}/servers/`, { signal }),
});

export const mailboxesQuery = (filters: MailboxFilters) => {
  const params = new URLSearchParams({ page: String(filters.page) });
  if (filters.server) params.set('server', filters.server);
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.problem) params.set('problem', filters.problem);
  return queryOptions({
    queryKey: [...MAIL_KEY, 'mailboxes', filters],
    queryFn: ({ signal }) =>
      api<Page<Mailbox>>(`${MAIL_API}/mailboxes/?${params.toString()}`, { signal }),
    placeholderData: keepPreviousData,
  });
};

export const mailboxQuery = (id: number) =>
  queryOptions({
    queryKey: [...MAIL_KEY, 'mailbox', id],
    queryFn: ({ signal }) => api<MailboxDetail>(`${MAIL_API}/mailboxes/${String(id)}/`, { signal }),
  });

export interface ApplicantMatch extends MailboxApplicant {
  /** The email accounts the applicant already has. */
  emails: string[];
}

export const applicantSearchQuery = (search: string) =>
  queryOptions({
    queryKey: [...MAIL_KEY, 'applicants', search],
    queryFn: ({ signal }) =>
      api<ApplicantMatch[]>(
        `${MAIL_API}/applicants/?${new URLSearchParams({ search }).toString()}`,
        { signal },
      ),
    enabled: search.length >= 2 || /^\d+$/.test(search),
    placeholderData: keepPreviousData,
  });

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

export interface NewMailbox {
  server: number;
  local_part: string;
  applicant: number | null;
  /** Left out: the server's default. null: no quota. */
  quota_mb?: number | null;
  use_for_bot: boolean;
  use_for_writing: boolean;
}

/** Answers the password once: it isn't shown again. */
export const useCreateMailbox = () =>
  useMailMutation((values: NewMailbox) =>
    api<Mailbox & { password: string }>(`${MAIL_API}/mailboxes/`, {
      method: 'POST',
      body: values,
    }),
  );

export type MailboxChange = Partial<
  Pick<Mailbox, 'quota_mb' | 'use_for_bot' | 'use_for_writing'> & { applicant: number | null }
>;

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

/** The limits every applicant's bot runs inside (BotRules). Days: 0 = Monday. */
export interface BotRules {
  per_mailbox_daily: number;
  per_mailbox_hourly: number;
  per_server_daily: number;
  per_recipient_domain_daily: number;
  min_gap_minutes: number;
  max_gap_minutes: number;
  warmup_week1_daily: number;
  warmup_week2_daily: number;
  allowed_days: number[];
  earliest_hour: number;
  latest_hour: number;
  min_reminder_days: number;
  max_reminders: number;
  professor_cooldown_days: number;
  bounce_pause_percent: number;
  bounce_min_sent: number;
  reputation_pause_rejects: number;
  updated_at: string;
}

export type BotRuleNumber = Exclude<keyof BotRules, 'allowed_days' | 'updated_at'>;

export const botRulesQuery = queryOptions({
  queryKey: [...MAIL_KEY, 'rules'],
  queryFn: ({ signal }) => api<BotRules>(`${MAIL_API}/bot-rules/`, { signal }),
});

export const useSaveBotRules = () =>
  useMailMutation(
    (change: Partial<Omit<BotRules, 'updated_at'>>) =>
      api<BotRules>(`${MAIL_API}/bot-rules/`, { method: 'PATCH', body: change }),
    [...MAIL_KEY, 'rules'],
  );

export interface SuppressedAddress {
  id: number;
  address: string;
  reason: string;
  created_at: string;
  applicant: { id: number; name: string } | null;
}

export const suppressedQuery = (search: string, page: number) => {
  const params = new URLSearchParams({ page: String(page) });
  if (search.trim()) params.set('search', search.trim());
  return queryOptions({
    queryKey: [...MAIL_KEY, 'suppressed', search, page],
    queryFn: ({ signal }) =>
      api<Page<SuppressedAddress>>(`${MAIL_API}/suppressed/?${params.toString()}`, { signal }),
    placeholderData: keepPreviousData,
  });
};

export const useUnsuppress = () =>
  useMailMutation(
    (id: number) => api(`${MAIL_API}/suppressed/${String(id)}/`, { method: 'DELETE' }),
    [...MAIL_KEY, 'suppressed'],
  );

import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { MAIL_KEY, type MailboxApplicant } from './api';

export const GMAIL_ACCOUNT_FILTERS = ['all', 'login_failed', 'queued'] as const;
export type GmailAccountFilter = (typeof GMAIL_ACCOUNT_FILTERS)[number];

export interface GmailAccount {
  id: number;
  address: string;
  applicant: MailboxApplicant;
  queued: number;
  source_eligible: number;
  first_emails_today: number;
  next_round_at: string | null;
  template_count: number;
  required_templates: number;
  reasons: (
    | 'login_failed'
    | 'provider_inactive'
    | 'connection_unavailable'
    | 'paused_bounces'
    | 'paused_staff'
    | 'missing_resume'
    | 'missing_templates'
    | 'source_restricted'
  )[];
  last_login_error: { at: string; reason: 'credentials_rejected' | 'smtp_rejected' } | null;
}

export interface GmailQueuedRecipient {
  id: number;
  name: string;
  address: string;
  university: string;
  source: 'database' | 'csv';
  source_allowed: boolean;
}

export const gmailAccountsQuery = (view: GmailAccountFilter, page: number) =>
  queryOptions({
    queryKey: [...MAIL_KEY, 'gmail-accounts', view, page],
    queryFn: ({ signal }) =>
      api<Page<GmailAccount>>(`/mail/v1/gmail-accounts/?view=${view}&page=${String(page)}`, {
        signal,
      }),
  });

export const gmailQueueQuery = (id: number, page: number) =>
  queryOptions({
    queryKey: [...MAIL_KEY, 'gmail-queue', id, page],
    queryFn: ({ signal }) =>
      api<Page<GmailQueuedRecipient>>(
        `/mail/v1/gmail-accounts/${String(id)}/queue/?page=${String(page)}`,
        { signal },
      ),
  });

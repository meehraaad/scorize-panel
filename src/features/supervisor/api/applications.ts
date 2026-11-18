import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';
import type { ApplicationResult, Approval, FeePayment } from '@/lib/applications';
import { type BotProblem, caseKey } from './case';
import { SUPERVISOR_API, type Money } from './common';

export interface BotStatus {
  active: boolean;
  sent_today: number;
  daily_limit: number;
  /** The Gmail account the bot sends from. */
  account: string | null;
  problems: BotProblem[];
  /**
   * Why it isn't sending now, in the order to fix them; empty: it sends at its next round
   * (scorize-revolution docs/mail-servers.md, "Bot rules"). Sent once the bot rules ship
   * (`ON_SERVER.mailServers`).
   */
  stopped?: BotStopReason[];
}

export const BOT_STOP_REASONS = [
  'bot_off',
  'case_not_active',
  'no_account',
  'login_failed',
  'no_cv',
  'paused_staff',
  'paused_bounces',
  'server_paused',
  'daily_limit',
  'nothing_queued',
] as const;
export type BotStopReason = (typeof BOT_STOP_REASONS)[number];

export interface CaseApplication {
  id: number;
  university: string;
  program: string;
  degree: Degree;
  deadline: string | null;
  fee: Money | null;
  payment: FeePayment | null;
  result: ApplicationResult | null;
  approval: Approval;
  /** Shown to the applicant under the application. */
  note: string | null;
}

/** What the side editor sends (create or update). */
export type ApplicationInput = Omit<CaseApplication, 'id' | 'approval'>;

export interface Credential {
  label: string;
  value: string;
  secret: boolean;
}

export interface CaseApplications {
  applies: { used: number; total: number };
  bot: BotStatus;
  applications: CaseApplication[];
  emails: { sent: number; total: number; replied: number };
  /** The application accounts the team made (also kept after the panel closes). */
  credentials: Credential[];
}

export const applicationsQuery = (id: number) =>
  queryOptions({
    queryKey: [...caseKey(id), 'applications'],
    queryFn: ({ signal }) =>
      api<CaseApplications>(`${SUPERVISOR_API}/cases/${String(id)}/applications/`, { signal }),
  });

export type ProfessorEmailStatus = 'queued' | 'sent' | 'reminded' | 'replied' | 'bounced';

export interface ProfessorEmailRow {
  id: number;
  professor: string;
  university: string;
  sent_at: string | null;
  status: ProfessorEmailStatus;
}

export interface ProfessorEmailsPage {
  count: number;
  page_size: number;
  results: ProfessorEmailRow[];
}

export const professorEmailsQuery = (id: number, page: number) =>
  queryOptions({
    queryKey: [...caseKey(id), 'emails', page],
    queryFn: ({ signal }) =>
      api<ProfessorEmailsPage>(
        `${SUPERVISOR_API}/cases/${String(id)}/professor-emails/?page=${String(page)}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });

/**
 * When and how much this applicant's bot sends. A supervisor may only narrow the managers' rules
 * (`limits`); days count from Monday (0) and hours are in the professor's time zone.
 */
export interface BotSettings {
  days: number[];
  start_hour: number;
  end_hour: number;
  daily_max: number;
  reminder_days: number;
  reminders: number;
  /** For professors whose country has no known time zone. */
  fallback_timezone: string;
  /** `bounces`: paused by itself after too many bounces; a supervisor resumes it. */
  paused: 'staff' | 'bounces' | null;
  paused_at: string | null;
  limits: {
    days: number[];
    earliest_hour: number;
    latest_hour: number;
    daily_max: number;
    min_reminder_days: number;
    max_reminders: number;
  };
}

export type BotSettingsChange = Partial<
  Omit<BotSettings, 'paused' | 'paused_at' | 'limits'> & { paused: boolean }
>;

export const botSettingsQuery = (id: number) =>
  queryOptions({
    queryKey: [...caseKey(id), 'bot-settings'],
    queryFn: ({ signal }) =>
      api<BotSettings>(`${SUPERVISOR_API}/cases/${String(id)}/bot/settings/`, { signal }),
  });

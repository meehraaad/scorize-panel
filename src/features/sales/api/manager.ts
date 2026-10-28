import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { SALES_API, SALES_KEY, type Degree, type LeadSource } from '@/lib/sales/api';
import type { Colleague } from '@/lib/tasks/api';
import type { ActivityKind, StageActivity, StagePhase } from './board';

/** Django permission of the sales manager's section (SupportStaff Meta: can_assign_to_seller). */
export const MANAGER_PERMISSION = 'can_assign_to_seller';
const MANAGER_API = `${SALES_API}/manager`;
const MANAGER_KEY = [...SALES_KEY, 'manager'] as const;

export type AssignMode = 'round_robin' | 'least_load' | 'match';
export type Escalation = 'alert' | 'next' | 'both';

export interface AssignSettings {
  on: boolean;
  mode: AssignMode;
  /** What happens when a lead isn't called within the team goal. */
  escalation: Escalation;
}

export interface SellerLoad {
  /** SupportStaff id. */
  id: number;
  name: string;
  status: 'available' | 'busy' | 'away';
  /** `busy`: in a session until then. */
  busy_until: string | null;
  open: number;
  /** Open leads with no answered contact yet. */
  uncalled: number;
  /** Median minutes to the first call this week; null without samples. */
  response_minutes: number | null;
}

export interface UnassignedLead {
  lead: number;
  customer: number;
  name: string;
  degree: Degree | null;
  countries: string[];
  cause: string;
  score: number;
  created_at: string;
  /** The seller automatic assignment would pick; null when none is available. */
  suggested: number | null;
}

export interface AssignData {
  settings: AssignSettings;
  sellers: SellerLoad[];
  /** A page of the unassigned leads, best score first. */
  queue: Page<UnassignedLead>;
  /** When the longest-waiting unassigned lead arrived; null with an empty queue. */
  oldest_at: string | null;
}

export const assignQuery = (page: number) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'assign', page],
    queryFn: ({ signal }) =>
      api<AssignData>(`${MANAGER_API}/assign/?page=${String(page)}`, { signal }),
    refetchInterval: 60_000,
  });

export function useAssignSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: AssignSettings) =>
      api(`${MANAGER_API}/assign/settings/`, { method: 'PUT', body: settings }),
    onSuccess: () => client.invalidateQueries({ queryKey: MANAGER_KEY }),
  });
}

/** Assigns the queue through Django's manager API, which timestamps and logs each assignment. */
export function useAssignLeads() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (assignments: { lead: number; seller: number }[]) =>
      api<{ assigned: number }>(`${MANAGER_API}/assign/`, {
        method: 'POST',
        body: { assignments },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export type DraftTerm =
  'services' | 'degree' | 'applies' | 'period' | 'amount' | 'instalments' | 'language';

export interface ContractDraft {
  id: number;
  customer: number;
  name: string;
  created_at: string;
  /** One line for the list ("Admission + visa · Italy · 120 million toman"). */
  summary: string;
  seller: string;
  /** Percent. */
  discount: number;
  /** Under the name: field, countries, seller, source. */
  meta: string;
  /** Values localized by the server. */
  terms: { key: DraftTerm; value: string }[];
  /** Automatic checks: price list, open debts, discount over the seller's limit… */
  checks: { ok: boolean; text: string }[];
  note: string;
}

export const approvalsQuery = queryOptions({
  queryKey: [...MANAGER_KEY, 'approvals'],
  queryFn: ({ signal }) =>
    api<{ drafts: ContractDraft[] }>(`${MANAGER_API}/approvals/`, { signal }),
});

export type ApprovalAction = 'approve' | 'return' | 'reject';

/** Approve (opens in the customer's panel), return to the seller, or reject; S36. */
export function useDecideDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      comment,
    }: {
      id: number;
      action: ApprovalAction;
      comment: string;
    }) =>
      api(`${MANAGER_API}/approvals/${String(id)}/`, {
        method: 'POST',
        body: { action, comment },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export type TeamRange = 'month' | 'last' | 'quarter';

export type TeamAlert =
  | { kind: 'unattended'; seller: string; count: number }
  | { kind: 'draft'; customer: string; discount: number }
  | { kind: 'no_offer'; count: number };

export interface TeamData {
  /** First day of the range. */
  from: string;
  won: number;
  target: number;
  days_left: number;
  sales: number;
  /** Change against the previous range, 0.18 = +18%; null without prior sales. */
  sales_change: number | null;
  conversion: number;
  conversion_before: number;
  first_call_minutes: number | null;
  sellers: {
    id: number;
    name: string;
    won: number;
    target: number;
    sales: number;
    conversion: number;
    first_call_minutes: number | null;
    overdue: number;
  }[];
  alerts: TeamAlert[];
  sources: { source: LeadSource | 'referral'; leads: number; won: number; sales: number }[];
}

export const teamQuery = (range: TeamRange) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'team', range],
    queryFn: ({ signal }) => api<TeamData>(`${MANAGER_API}/team/?range=${range}`, { signal }),
    placeholderData: keepPreviousData,
  });

/** The admission-chance quiz's funnel (S42): counted per person. */
export const FUNNEL_STEPS = ['started', 'finished', 'wanted_call', 'called', 'contract'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export type FunnelSteps = Record<FunnelStep, number>;

export interface FunnelData {
  start: string;
  /** The day after the range. */
  end: string;
  steps: FunnelSteps;
  /** Median minutes from the finished quiz to the first call; null before any call. */
  first_call_minutes: number | null;
  /** `unknown`: opened the quiz but never finished it. */
  by_goal: ({ goal: 'study' | 'work' | 'both' | 'unknown' } & FunnelSteps)[];
}

export const funnelQuery = (range: TeamRange) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'funnel', range],
    queryFn: ({ signal }) =>
      api<FunnelData>(`${MANAGER_API}/estimate-funnel/?range=${range}`, { signal }),
    placeholderData: keepPreviousData,
  });

/** The same report as a spreadsheet (S38). */
export const teamExportHref = (range: TeamRange) =>
  `/api${MANAGER_API}/team/export/?range=${range}`;

export type HealthTeam = 'all' | 'sales' | 'supervisors';

export interface HealthData {
  /** Each with the last four weeks, oldest first. */
  on_time: { value: number; target: number; weeks: number[] };
  overdue: { value: number; over_two_days: number; weeks: number[] };
  orphans: { value: number; customers: number; files: number; weeks: number[] };
  automatic: { value: number; weeks: number[] };
  people: {
    id: number;
    name: string;
    role: 'sales' | 'supervisor';
    on_time: number;
    overdue: number;
    orphans: number;
    snoozed: number;
    oldest_days: number | null;
  }[];
  oldest: {
    task: number;
    text: string;
    person: string;
    context: string;
    owner: { id: number; name: string };
    days: number;
  }[];
  colleagues: Colleague[];
}

export const healthQuery = (team: HealthTeam) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'health', team],
    queryFn: ({ signal }) => api<HealthData>(`${MANAGER_API}/follow-ups/?team=${team}`, { signal }),
    placeholderData: keepPreviousData,
  });

/** Nudge the owner of an overdue task, or hand it to someone else (T12). */
export function useManageTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ task, assignee }: { task: number; assignee?: number }) =>
      api(`/staff/v1/tasks/${String(task)}/${assignee ? 'reassign' : 'remind'}/`, {
        method: 'POST',
        body: assignee ? { assignee } : {},
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: MANAGER_KEY }),
  });
}

/** A team column as the manager edits it (S48). */
export interface StageSettings {
  id: number;
  name: string;
  phase: StagePhase;
  max_days: number | null;
  /** Open cards showing in it now: removing it asks where they go. */
  cards: number;
  activities: StageActivity[];
}

export interface StagesData {
  stages: StageSettings[];
  /** Ready messages a `message` activity can send. */
  templates: { id: number; title: string }[];
}

export const stagesQuery = queryOptions({
  queryKey: [...MANAGER_KEY, 'stages'],
  queryFn: ({ signal }) => api<StagesData>(`${MANAGER_API}/stages/`, { signal }),
});

export interface ActivityInput {
  kind: ActivityKind;
  required: boolean;
  days?: number;
  hour?: number;
  text?: string;
  template?: number | null;
}

export interface StageInput {
  /** Null for a new column. */
  id: number | null;
  name: string;
  phase: StagePhase;
  max_days: number | null;
  activities: ActivityInput[];
}

/** The whole list at once: Django renames, reorders, adds and removes in one transaction. */
export function useSaveStages() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { stages: StageInput[]; moves: { source: number; to: number }[] }) =>
      api<StagesData>(`${MANAGER_API}/stages/`, { method: 'PUT', body }),
    onSuccess: (data) => {
      client.setQueryData(stagesQuery.queryKey, data);
      return client.invalidateQueries({ queryKey: [...SALES_KEY, 'board'] });
    },
  });
}

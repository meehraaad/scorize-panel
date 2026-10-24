import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  SALES_API,
  SALES_KEY,
  type Channel,
  type Degree,
  type LeadSource,
  type LeadStage,
  type LostReason,
} from '@/lib/sales/api';
import type { Colleague, TaskSummary } from '@/lib/tasks/api';

/**
 * Seller pages of the sales panel: one response per screen (as the applicant panel does), so a
 * phone waits for one round trip. Shapes: docs/backend-changes.md S1–S20. Mock: src/mocks/sales.ts.
 */

// ── Today ────────────────────────────────────────────────────────────────────────────────────

/** A new lead nobody has called yet (top of "Today", oldest first). */
export interface HotLead {
  lead: number;
  customer: number;
  name: string;
  phone: string;
  score: number;
  /** When the lead arrived (the timer counts from here). */
  created_at: string;
  /** What happened, written by the server ("A 4.5M payment for … failed · master's"). */
  reason: string;
  source: LeadSource;
}

/** Why a lead is on today's call list. */
export type CallBucket = 'new' | 'today' | 'overdue';

export interface CallItem {
  lead: number;
  customer: number;
  name: string;
  phone: string;
  score: number;
  /** The last thing that happened ("Got the Germany offer yesterday · talks with family"). */
  reason: string;
  stage: LeadStage;
  bucket: CallBucket;
  follow_up_at: string | null;
}

export interface TodayConsultation {
  id: number;
  customer: number;
  name: string;
  /** ConsultationType name, localized. */
  type: string;
  mode: 'online' | 'in_person';
  starts_at: string;
  /** A ContactHistory exists for it (the session was logged). */
  logged: boolean;
}

/** A card-transfer receipt waiting for a seller (Payment.Status.PENDING_RECEIPT). */
export interface PendingReceipt {
  payment: number;
  customer: number;
  name: string;
  /** Toman. */
  amount: number;
  /** What it pays for, localized ("First instalment of the full application contract"). */
  what: string;
  method: 'card' | 'iban';
  uploaded_at: string;
  receipt_url: string;
}

export interface MonthSummary {
  won: number;
  target: number;
  /** 0–1: leads that became contracts this month. */
  conversion: number;
  /** Median minutes from a new lead to its first call. */
  first_call_minutes: number;
  working_days_left: number;
  /** Contract drafts waiting for the sales manager. */
  drafts_waiting: number;
}

/** Customers ready for their next purchase, found from their files (S10). */
export type Upsell =
  | { kind: 'admitted'; customer: number; name: string; university: string }
  | { kind: 'ending'; customer: number; name: string; days: number; admissions: number }
  | { kind: 'no_contract'; customers: { id: number; name: string }[] };

export interface TodayData {
  hot: HotLead[];
  calls: CallItem[];
  tasks: { overdue: number; requests: number; team: number };
  consultations: TodayConsultation[];
  receipts: PendingReceipt[];
  month: MonthSummary;
  upsell: Upsell[];
}

export const todayQuery = queryOptions({
  queryKey: [...SALES_KEY, 'today'],
  queryFn: ({ signal }) => api<TodayData>(`${SALES_API}/today/`, { signal }),
  // New leads arrive all day: refresh while the page is open.
  refetchInterval: 60_000,
});

// ── Leads ────────────────────────────────────────────────────────────────────────────────────

export interface LeadRow {
  id: number;
  customer: number;
  name: string;
  phone: string;
  degree: Degree | null;
  /** Localized names. */
  countries: string[];
  source: LeadSource;
  /** What brought them, localized ("Canada application consultation · 4 minutes ago"). */
  cause: string;
  score: number;
  stage: LeadStage;
  lost_reason: LostReason | null;
  follow_up_at: string | null;
  /** The last contact: null before the first call. */
  last_contact: { at: string; summary: string } | null;
  created_at: string;
}

export type LeadFilter = LeadStage | 'all';

export interface LeadQuery {
  stage: LeadFilter;
  source: LeadSource | 'all';
  band: 'hot' | 'warm' | 'cold' | 'all';
  overdue: boolean;
  search: string;
  page: number;
}

export interface LeadsData {
  /** Per stage, for the tabs (the other filters applied). */
  counts: Record<LeadFilter, number>;
  stats: {
    new_waiting: number;
    oldest_new_minutes: number | null;
    today: number;
    today_before_noon: number;
    overdue: number;
    max_overdue_days: number;
    first_call_minutes: number;
  };
  count: number;
  page_size: number;
  results: LeadRow[];
}

export const leadsQuery = (query: LeadQuery) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'leads', query],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(query.page) });
      if (query.stage !== 'all') params.set('stage', query.stage);
      if (query.source !== 'all') params.set('source', query.source);
      if (query.band !== 'all') params.set('band', query.band);
      if (query.overdue) params.set('overdue', '1');
      if (query.search.trim()) params.set('search', query.search.trim());
      return api<LeadsData>(`${SALES_API}/leads/?${params.toString()}`, { signal });
    },
    placeholderData: keepPreviousData,
  });

export type BulkChange =
  { stage: Exclude<LeadStage, 'lost' | 'draft' | 'won'> } | { follow_up_at: string };

/** Several leads at once from the list (S13). */
export function useBulkLeads() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, change }: { ids: number[]; change: BulkChange }) =>
      api(`${SALES_API}/leads/bulk/`, { method: 'POST', body: { ids, ...change } }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export interface NewLead {
  first_name: string;
  last_name: string;
  phone: string;
  note: string;
}

/** A lead typed in by the seller (referral, walk-in): source `manual` (S14). */
export function useCreateLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (lead: NewLead) =>
      api<{ customer: number }>(`${SALES_API}/leads/`, { method: 'POST', body: lead }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

// ── Board ────────────────────────────────────────────────────────────────────────────────────

/** Stages shown as columns (lost deals are summed under the board). */
export const BOARD_STAGES = ['new', 'contacted', 'consulted', 'offer', 'draft', 'won'] as const;

export type NextStep =
  | { kind: 'call_now' }
  | { kind: 'follow_up'; at: string }
  | { kind: 'manager' }
  | { kind: 'receipt' };

export interface BoardCard {
  lead: number;
  customer: number;
  name: string;
  score: number;
  /** Localized ("Full Germany application · 8 applies"). */
  summary: string;
  /** Offer or contract value, toman; null before an offer. */
  amount: number | null;
  /** `won`: paid so far, toman. */
  paid: number | null;
  /** Entered the current stage at. */
  stage_since: string;
  next: NextStep | null;
}

export interface BoardData {
  /** Sum of open offers and drafts, toman. */
  open_value: number;
  columns: {
    stage: (typeof BOARD_STAGES)[number];
    count: number;
    value: number | null;
    /** The first few cards; the rest are in the list view. */
    cards: BoardCard[];
  }[];
  lost: { total: number; reasons: { reason: LostReason; count: number }[] };
}

export const boardQuery = queryOptions({
  queryKey: [...SALES_KEY, 'board'],
  queryFn: ({ signal }) => api<BoardData>(`${SALES_API}/board/`, { signal }),
});

/** A card left in one stage this long is flagged. */
export const STALE_DAYS = 7;

// ── Customer ─────────────────────────────────────────────────────────────────────────────────

export type ProfileKey =
  | 'current_degree'
  | 'wanted_degree'
  | 'gpa'
  | 'language'
  | 'countries'
  | 'budget'
  | 'city'
  | 'military'
  | 'referral';

export interface CustomerData {
  /** User id. */
  id: number;
  name: string;
  phone: string;
  email: string | null;
  /** The open lead (the newest one); null for a customer with no lead. */
  lead: {
    id: number;
    source: LeadSource;
    stage: LeadStage;
    score: number;
    follow_up_at: string | null;
    lost_reason: LostReason | null;
    seller: string | null;
  } | null;
  /** The line under the name. */
  headline: {
    degree: Degree | null;
    field: string | null;
    countries: string[];
    budget: string | null;
  };
  /** Why the score is what it is, localized labels. */
  score_factors: { label: string; points: number }[];
  /** Scorize applicants with a similar background (Experience, same as crm user_report). */
  similar: { background: string; count: number; universities: string[] } | null;
  /** Values as the server words them (UserInfo choices, exam scores…). */
  profile: { key: ProfileKey; value: string }[];
  purchases: { label: string; status: 'paid' | 'pending' | 'failed' }[];
  /** Wallet credit, toman. */
  credit: number;
  counts: { purchases: number; payments: number };
  tasks: TaskSummary[];
  /** Ready messages with the customer's and seller's names filled in (S7). */
  templates: { id: number; title: string; text: string }[];
  /** For "ask a colleague". */
  colleagues: Colleague[];
}

export const customerKey = (id: number) => [...SALES_KEY, 'customer', id] as const;

export const customerQuery = (id: number) =>
  queryOptions({
    queryKey: customerKey(id),
    queryFn: ({ signal }) => api<CustomerData>(`${SALES_API}/customers/${String(id)}/`, { signal }),
  });

export type HistoryKind =
  'call' | 'no_answer' | 'message' | 'meeting' | 'note' | 'payment' | 'payment_failed' | 'lead';

export interface HistoryEvent {
  /** Unique across kinds ("contact-12", "payment-4"), like contact_history_list_generator. */
  id: string;
  kind: HistoryKind;
  at: string;
  /** The staff member; null for system events. */
  author: string | null;
  /** `message`: which app. */
  channel: Channel | null;
  /** Payments and leads: what it was, localized ("Master's application consultation"). */
  title: string | null;
  text: string;
  /** The stage the contact moved the lead to. */
  stage: LeadStage | null;
}

export interface HistoryPage {
  results: HistoryEvent[];
  next: number | null;
}

export const historyQuery = (id: number) =>
  infiniteQueryOptions({
    queryKey: [...customerKey(id), 'history'],
    queryFn: ({ signal, pageParam }) =>
      api<HistoryPage>(`${SALES_API}/customers/${String(id)}/history/?page=${String(pageParam)}`, {
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (page) => page.next,
  });

export type CallOutcome = 'talked' | 'no_answer' | 'call_later' | 'wrong_number';

export interface ContactLog {
  channel: Channel;
  /** Calls only. */
  outcome?: CallOutcome;
  stage?: LeadStage;
  lost_reason?: LostReason;
  notes: string;
  /** Creates "my follow-up" at this time; null: none (a lost lead). */
  follow_up_at: string | null;
  email_summary: boolean;
  /** Messages: the template sent. */
  template?: number;
  /** Logging a consultation session. */
  reservation?: number;
}

/** Logs a call, message or session (ContactHistory) and sets the next step (S16). */
export function useLogContact(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (log: ContactLog) =>
      api(`${SALES_API}/customers/${String(customer)}/contacts/`, { method: 'POST', body: log }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

/** A quick note on the customer's history (S17). */
export function useAddNote(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api(`${SALES_API}/customers/${String(customer)}/notes/`, { method: 'POST', body: { text } }),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKey(customer) }),
  });
}

// ── My month ─────────────────────────────────────────────────────────────────────────────────

export interface MonthData {
  /** First day of the month. */
  month: string;
  won: number;
  target: number;
  /** 0–1: share of the month's working days already gone (where the seller should be). */
  elapsed: number;
  working_days_left: number;
  /** Toman. */
  sales: number;
  /** Toman; null until a commission rate is set (S18). */
  commission: number | null;
  drafts_waiting: number;
  rank: { position: number; of: number };
  funnel: { leads: number; reached: number; consulted: number; offered: number; won: number };
  team_conversion: number;
  /** Median minutes to the first call, week by week. */
  weeks: number[];
  sources: { source: LeadSource; leads: number; won: number }[];
}

export const monthQuery = queryOptions({
  queryKey: [...SALES_KEY, 'month'],
  queryFn: ({ signal }) => api<MonthData>(`${SALES_API}/month/`, { signal }),
});

// ── My consultations ─────────────────────────────────────────────────────────────────────────

export type ConsultationRange = 'today' | 'week' | 'past' | 'all';

export interface Consultation {
  id: number;
  customer: number;
  name: string;
  phone: string;
  /** ConsultationType. */
  type: { id: number; name: string };
  mode: 'online' | 'in_person';
  minutes: number;
  starts_at: string;
  logged: boolean;
  meeting_url: string | null;
}

export interface ConsultationsData {
  counts: Record<ConsultationRange, number>;
  /** Past sessions without a log, any range. */
  unlogged: number;
  types: { id: number; name: string }[];
  results: Consultation[];
}

export const consultationsQuery = (
  range: ConsultationRange,
  type: number | null,
  unlogged: boolean,
) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'consultations', range, type, unlogged],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ range });
      if (type !== null) params.set('type', String(type));
      if (unlogged) params.set('unlogged', '1');
      return api<ConsultationsData>(`${SALES_API}/consultations/?${params.toString()}`, { signal });
    },
    placeholderData: keepPreviousData,
  });

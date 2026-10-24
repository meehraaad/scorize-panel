import {
  infiniteQueryOptions,
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

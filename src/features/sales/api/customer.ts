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

/** A profile row: codes are labelled by the page (degrees, model choices), text is shown as is. */
export type ProfileItem =
  | { key: 'current_degree' | 'wanted_degree'; degree: Degree }
  | { key: 'budget'; budget: 1 | 2 | 3 }
  | { key: 'military'; military: 1 | 2 | 3 | 4 }
  | {
      key: Exclude<ProfileKey, 'current_degree' | 'wanted_degree' | 'budget' | 'military'>;
      text: string;
    };

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
    /** 0–100; null while unknown (the automatic score is S5). */
    score: number | null;
    follow_up_at: string | null;
    lost_reason: LostReason | null;
    seller: string | null;
  } | null;
  /** The line under the name. */
  headline: {
    degree: Degree | null;
    field: string | null;
    countries: string[];
    /** UserPersonalInformation.Budget. */
    budget: 1 | 2 | 3 | null;
  };
  /** Why the score is what it is, localized labels. */
  score_factors: { label: string; points: number }[];
  /**
   * Admissions of Scorize applicants with a similar background (ExperienceViewSet, as on the crm
   * user page): `count` successful ones, `universities` the first few, `background` the customer's
   * highest education degree they were matched on.
   */
  similar: {
    background: { degree: Degree; field: string | null; gpa: number };
    count: number;
    universities: string[];
  } | null;
  profile: ProfileItem[];
  purchases: { label: string; status: 'paid' | 'pending' | 'failed' }[];
  /** Wallet credit, toman. */
  credit: number;
  counts: { purchases: number; payments: number };
  tasks: TaskSummary[];
  /** Ready messages with the customer's and seller's names filled in (S7). */
  templates: { id: number; title: string; text: string }[];
  /** For "ask a colleague". */
  colleagues: Colleague[];
  /** What the server does with a logged contact: store stage moves (S3), text "no answer" (S16). */
  supports: { stages: boolean; no_answer_sms: boolean };
}

export const customerKey = (id: number) => [...SALES_KEY, 'customer', id] as const;

const customerApi = (id: number) => `${SALES_API}/customers/${String(id)}`;

export const customerQuery = (id: number) =>
  queryOptions({
    queryKey: customerKey(id),
    queryFn: ({ signal }) => api<CustomerData>(`${customerApi(id)}/`, { signal }),
    // Sellers switch to WhatsApp and back all the time: don't rebuild the card each time. The
    // seller's own changes refresh it; another visit after staleTime does too.
    refetchOnWindowFocus: false,
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

/** Contacts, leads, sessions, payments and notes, newest first (S17). */
export const historyQuery = (id: number) =>
  infiniteQueryOptions({
    queryKey: [...customerKey(id), 'history'],
    queryFn: ({ signal, pageParam }) =>
      api<HistoryPage>(`${customerApi(id)}/history/?page=${String(pageParam)}`, { signal }),
    initialPageParam: 1,
    getNextPageParam: (page) => page.next,
    // A refetch reloads every page the seller has opened, one after another.
    refetchOnWindowFocus: false,
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
  /** The follow-up task's text (a StaffToDo needs one). */
  follow_up_text: string;
}

export function useLogContact(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (log: ContactLog) =>
      api(`${customerApi(customer)}/contacts/`, { method: 'POST', body: log }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

/** A quick note on the customer's history (S17). */
export function useAddNote(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api(`${customerApi(customer)}/notes/`, { method: 'POST', body: { text } }),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKey(customer) }),
  });
}

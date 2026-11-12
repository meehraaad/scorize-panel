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
import type { Face } from '@/lib/face/api';
import type { Colleague, TaskSummary } from '@/lib/tasks/api';
import type { StageActivity, StagePhase } from './board';

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

/** A team column of the board, as the customer page lists them. */
export interface CustomerColumn {
  id: number;
  name: string;
  phase: StagePhase;
  /** What the column asks for when a card enters it, as on the board. */
  activities?: StageActivity[];
}

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
    /** The team column it shows in on the board (S48); null for new, draft, won and lost. */
    column?: number | null;
  } | null;
  /** The board's team columns in the manager's order (S48, `supports.columns`). */
  columns?: CustomerColumn[];
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
  /**
   * Ready messages with their variables filled in for this customer (S7): the seller's own
   * (`own`, made in settings) first, then management's.
   */
  templates: { id: number; title: string; text: string; own?: boolean }[];
  /** For "ask a colleague". */
  colleagues: Colleague[];
  /** Files sent from the panel for a free review (H59), newest first; `kind` is a label. */
  review_files: { id: number; kind: string; url: string; uploaded_at: string }[];
  /** Customer tag ids (S49), named by `tagsQuery`. */
  tags: number[];
  /** The emoji and color the team gave the customer (S66); null: the first letter. */
  face?: Face | null;
  /**
   * What the server does with a logged contact: store stage moves (S3), text "no answer" (S16);
   * `tags`: customer tags (S49).
   */
  supports: {
    stages: boolean;
    no_answer_sms: boolean;
    tags?: boolean;
    /** The log's `sms_summary` is sent (its SMS template is approved). */
    summary_sms?: boolean;
    /** `call-brief/` exists: the call popup's "before you answer" box. */
    call_brief?: boolean;
    /** `columns` and `lead.column` are sent, and the contact log takes `column` (S48). */
    columns?: boolean;
  };
  /** Who first reached the customer, and who their closed contract counts for (S59). */
  attribution?: { first_contact: string | null; won_by: string | null };
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
  | 'call'
  | 'no_answer'
  | 'message'
  | 'meeting'
  | 'note'
  | 'payment'
  | 'payment_failed'
  | 'lead'
  /** The lead went to another seller: `title` is who got it, `previous` who had it. */
  | 'assign';

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
  customer_summary?: string;
  /** `assign`: who had the lead before. */
  previous?: string | null;
  /** The stage the contact moved the lead to. */
  stage: LeadStage | null;
}

export interface HistoryPage {
  results: HistoryEvent[];
  next: number | null;
}

const historyKey = (id: number) => [...customerKey(id), 'history'] as const;

/** Contacts, leads, sessions, payments and notes, newest first (S17). */
export const historyQuery = (id: number) =>
  infiniteQueryOptions({
    queryKey: historyKey(id),
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
  /** A team column (`supports.columns`): the lead moves there and takes its stage. */
  column?: number;
  lost_reason?: LostReason;
  notes: string;
  customer_summary: string;
  /** Creates "my follow-up" at this time; null: none (a lost lead). */
  follow_up_at: string | null;
  email_summary: boolean;
  /** Text the customer that a note waits in their panel (`supports.summary_sms`). */
  sms_summary?: boolean;
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

/** What a seller reads while the phone rings (the call popup's "before you answer" box). */
export interface CallBrief {
  last_contact: { at: string; notes: string; by: string } | null;
  /** `at`: a date-time, or a date for a task with only a day. */
  follow_up: { at: string; text: string } | null;
  /** Payments waiting to be paid, toman. */
  unpaid: { id: number; amount: number }[];
  /** Consultations the customer had with someone other than this seller. */
  consultations_elsewhere: { consultant: string; title: string; at: string }[];
}

export const callBriefQuery = (customer: number) =>
  queryOptions({
    queryKey: [...customerKey(customer), 'call-brief'] as const,
    queryFn: ({ signal }) => api<CallBrief>(`${customerApi(customer)}/call-brief/`, { signal }),
    staleTime: 60_000,
  });

/** A caller's other number kept as the customer's second phone; 409 `taken`: another account's. */
export function useSetSecondPhone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ customer, phone }: { customer: number; phone: string }) =>
      api<{ phone: string }>(`${customerApi(customer)}/second-phone/`, {
        method: 'PUT',
        body: { phone },
      }),
    onSuccess: (_answer, { customer }) =>
      client.invalidateQueries({ queryKey: customerKey(customer) }),
  });
}

/** A quick note on the customer's history (S17). */

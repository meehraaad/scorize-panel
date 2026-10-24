import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
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

// ── Customer: purchases and consultations ────────────────────────────────────────────────────

export type ProductCategory = 'consultation' | 'writing' | 'package' | 'event';

export interface Purchase {
  /** Invoice id. */
  id: number;
  category: ProductCategory;
  title: string;
  /** Localized line ("Monday 28 Mehr · 11:00 · online · consultant: …", "SpotPlayer licence active"). */
  detail: string;
  /** Toman. */
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  at: string;
  /** Consultations: the reservation, and whether its session took place and was logged. */
  session: { reservation: number; starts_at: string; logged: boolean } | null;
}

export interface PurchasesData {
  /** Paid total, toman. */
  total: number;
  sessions: { held: number; upcoming: number };
  failed: { count: number; last_at: string } | null;
  items: Purchase[];
}

export const purchasesQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'purchases'],
    queryFn: ({ signal }) =>
      api<PurchasesData>(`${SALES_API}/customers/${String(id)}/purchases/`, { signal }),
  });

// ── Customer: payments ───────────────────────────────────────────────────────────────────────

/** finance.Payment.Status, by name. */
export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'paid_by_receipt',
  'expired',
  'failed',
  'pending_receipt',
  'receipt_declined',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** finance.types.PaymentMethod (0 online, 1 receipt). */
export type PaymentMethod = 'online' | 'receipt';
const METHOD_CODE: Record<PaymentMethod, number> = { online: 0, receipt: 1 };

export interface PaymentRow {
  id: number;
  /** What it pays for, localized. */
  what: string;
  /** Toman, after discounts and credit. */
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  created_at: string;
  lines: { label: string; amount: number }[];
  /** Destination account for card transfers (Payment.wallet). */
  wallet: number;
  /** Bank reference once paid online. */
  reference: string | null;
  receipt: { url: string; uploaded_at: string } | null;
  /** Last time the invoice SMS went out, and whether the customer opened the link since. */
  factor: { sent_at: string; opened: boolean } | null;
  /** The payment page link to share. */
  pay_url: string;
}

export interface PaymentsData {
  wallets: { id: number; name: string }[];
  results: PaymentRow[];
}

export const paymentsQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'payments'],
    queryFn: ({ signal }) =>
      api<PaymentsData>(`${SALES_API}/customers/${String(id)}/payments/`, { signal }),
  });

/** Existing staff endpoints of Django's PaymentViewSet (api/user_profile/staff). */
const staffPayment = (customer: number, payment: number) =>
  `/profile/staff/v1/users/${String(customer)}/payments/${String(payment)}`;

export type PaymentAction =
  | { kind: 'decline' }
  | { kind: 'method'; method: PaymentMethod }
  | { kind: 'factor' }
  | { kind: 'wallet'; wallet: number };

/**
 * What a seller does to an invoice. Declining a receipt and changing the method use the existing
 * staff endpoints; the invoice SMS and the destination account are new (S24, S25).
 * Confirming a receipt: useConfirmReceipt (lib/sales).
 */
export function usePaymentAction(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ payment, action }: { payment: number; action: PaymentAction }) => {
      switch (action.kind) {
        case 'decline':
          return api(`${staffPayment(customer, payment)}/decline_receipt/`, { method: 'PATCH' });
        case 'method':
          return api(
            `${staffPayment(customer, payment)}/change_method/${String(METHOD_CODE[action.method])}/`,
            { method: 'PATCH' },
          );
        case 'factor':
          return api(`${SALES_API}/payments/${String(payment)}/factor/`, { method: 'POST' });
        case 'wallet':
          return api(`${SALES_API}/payments/${String(payment)}/`, {
            method: 'PATCH',
            body: { wallet: action.wallet },
          });
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

// ── Customer: details ────────────────────────────────────────────────────────────────────────

export interface Option {
  value: string;
  label: string;
}

export interface EducationEntry {
  /** Missing for a new row. */
  id?: number;
  degree: string;
  field: string;
  university: string;
  gpa: string;
}

export interface ExamEntry {
  id?: number;
  exam: string;
  score: string;
  /** ISO date, or empty. */
  date: string;
}

export interface CustomerInfo {
  personal: {
    first_name: string;
    last_name: string;
    father_name: string;
    /** ISO date, or empty. */
    birth_date: string;
    gender: string;
    marital: string;
    military: string;
    city: string;
    work_years: string;
  };
  goal: { wanted_degree: string; budget: string; countries: string; language: string };
  education: EducationEntry[];
  exams: ExamEntry[];
  /** Choices of the select fields (Django model choices), localized. */
  choices: Record<'gender' | 'marital' | 'military' | 'budget' | 'degree' | 'exam', Option[]>;
  /** The office tablet form for this customer (crm user_detail tablet form). */
  tablet_url: string;
  updated_at: string;
}

export const infoQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'info'],
    queryFn: ({ signal }) =>
      api<CustomerInfo>(`${SALES_API}/customers/${String(id)}/info/`, { signal }),
  });

export type InfoSection = Partial<Pick<CustomerInfo, 'personal' | 'goal' | 'education' | 'exams'>>;

/** Saves one section; the server answers the stored info (S27). */
export function useSaveInfo(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (section: InfoSection) =>
      api<CustomerInfo>(`${SALES_API}/customers/${String(id)}/info/`, {
        method: 'PATCH',
        body: section,
      }),
    onSuccess: (data) => {
      client.setQueryData(infoQuery(id).queryKey, data);
      return client.invalidateQueries({ queryKey: customerKey(id), exact: true });
    },
  });
}

// ── Customer: application file (read-only) ───────────────────────────────────────────────────

export interface ApplyFile {
  /** Applicant status, localized ("Applying"). */
  status: string;
  applies: { used: number; total: number };
  admissions: number;
  emails: { sent: number; total: number };
  contract: {
    active: boolean;
    features: ('admission' | 'writing' | 'visa')[];
    start: string;
    end: string;
    degree: Degree;
    countries: string[];
    supervisors: string[];
    consultant: string | null;
    file_url: string | null;
  };
  applications: {
    id: number;
    university: string;
    program: string;
    fee_paid: boolean;
    status: 'ready' | 'submitted' | 'accepted' | 'rejected';
  }[];
}

export const applyQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'apply'],
    queryFn: async ({ signal }): Promise<ApplyFile | null> => {
      try {
        return await api<ApplyFile>(`${SALES_API}/customers/${String(id)}/apply/`, { signal });
      } catch (error) {
        // No applicant file yet.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

// ── Selling a product ────────────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  category: ProductCategory;
  title: string;
  /** Localized ("Online or in person", "Delivered in 7 working days"). */
  detail: string;
  /** Toman; 0 = free. */
  price: number;
  /** Consultations: free times to book. */
  slots: { id: number; starts_at: string; consultant: string }[];
}

export const productsQuery = queryOptions({
  queryKey: [...SALES_KEY, 'products'],
  queryFn: ({ signal }) => api<{ products: Product[] }>(`${SALES_API}/products/`, { signal }),
  staleTime: 5 * 60_000,
});

export interface SaleQuote {
  subtotal: number;
  discount: number;
  total: number;
  /** finance.types.DiscountCheckResult, by name; null when the code is fine or none was given. */
  discount_error: 'invalid' | 'used_by_user' | 'max_use_exceeded' | null;
}

export interface NewSale {
  products: number[];
  slot?: number;
  discount_code?: string;
  use_credit: boolean;
  method: PaymentMethod;
}

/** The price with a discount code, as the cart would compute it (check-content; S29). */
export function useQuote(customer: number) {
  return useMutation({
    mutationFn: (sale: Pick<NewSale, 'products' | 'discount_code' | 'use_credit'>) =>
      api<SaleQuote>(`${SALES_API}/customers/${String(customer)}/sell/quote/`, {
        method: 'POST',
        body: sale,
      }),
  });
}

/** Creates the invoice in the customer's name and texts them the payment link (S30). */
export function useSell(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sale: NewSale) =>
      api<{ payment: number }>(`${SALES_API}/customers/${String(customer)}/sell/`, {
        method: 'POST',
        body: sale,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKey(customer) }),
  });
}

// ── Offer and contract draft ─────────────────────────────────────────────────────────────────

export type ContractFeature = 'admission' | 'visa' | 'writing';

export interface OfferOptions {
  /** Price of each service, toman. */
  features: { key: ContractFeature; price: number }[];
  degrees: Degree[];
  /** Months. */
  durations: number[];
  countries: string[];
  /** Percent; above `approval_above` the manager must approve before the customer sees it. */
  discounts: number[];
  approval_above: number;
  instalments: number[];
}

export interface Offer {
  features: ContractFeature[];
  degree: Degree;
  applies: number;
  /** ISO date. */
  start: string;
  months: number;
  language_score: string;
  /** ISO date, or empty. */
  language_deadline: string;
  countries: string[];
  discount: number;
  instalments: number;
  manager_note: string;
}

export interface OfferData {
  options: OfferOptions;
  /** The saved draft, if any. */
  draft: Offer | null;
  /** Where the draft is: still editable, or sent. */
  state: 'none' | 'saved' | 'sent' | 'submitted';
}

export const offerQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'offer'],
    queryFn: ({ signal }) =>
      api<OfferData>(`${SALES_API}/customers/${String(id)}/offer/`, { signal }),
  });

/**
 * `save`: keep the draft; `send`: send the offer to the customer (SMS + panel); `submit`: send the
 * contract draft to the sales manager (Contract with `creator`; S32).
 */
export type OfferAction = 'save' | 'send' | 'submit';

export function useSaveOffer(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ offer, action }: { offer: Offer; action: OfferAction }) =>
      api(`${SALES_API}/customers/${String(id)}/offer/`, {
        method: 'POST',
        body: { ...offer, action },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

// ── Sales manager ────────────────────────────────────────────────────────────────────────────

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
  /** Median minutes to the first call this week. */
  response_minutes: number;
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
  /** The seller automatic assignment would pick. */
  suggested: number;
}

export interface AssignData {
  settings: AssignSettings;
  sellers: SellerLoad[];
  queue: UnassignedLead[];
}

export const assignQuery = queryOptions({
  queryKey: [...MANAGER_KEY, 'assign'],
  queryFn: ({ signal }) => api<AssignData>(`${MANAGER_API}/assign/`, { signal }),
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

/**
 * Gives leads to sellers with the existing staff endpoint (SaleLeadViewSet.assign_staff, one
 * request per lead), so manual assignment works today.
 */
export function useAssignLeads() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (assignments: { lead: number; seller: number }[]) =>
      Promise.all(
        assignments.map(({ lead, seller }) =>
          api(`/profile/staff/v1/sale-leads/${String(lead)}/assign_staff/`, {
            method: 'PATCH',
            body: { assigned_staff: seller },
          }),
        ),
      ),
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
  /** Change against the previous range, 0.18 = +18%. */
  sales_change: number;
  conversion: number;
  conversion_before: number;
  first_call_minutes: number;
  sellers: {
    id: number;
    name: string;
    won: number;
    target: number;
    sales: number;
    conversion: number;
    first_call_minutes: number;
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

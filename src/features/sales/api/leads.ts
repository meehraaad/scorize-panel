import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  SALES_API,
  SALES_KEY,
  type Degree,
  type LeadSource,
  type LeadStage,
  type LostReason,
  STAGES,
} from '@/lib/sales/api';

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
  /** Null until the automatic score (S5). */
  score: number | null;
  stage: LeadStage;
  lost_reason: LostReason | null;
  follow_up_at: string | null;
  /** The last contact: null before the first call. */
  last_contact: { at: string; summary: string } | null;
  created_at: string;
  /** Customer tag ids (S49), named by `tagsQuery`. */
  tags: number[];
  /** A sales manager's lists: whose it is ('' while nobody has it); null or absent for a seller. */
  seller?: string | null;
}

export type LeadFilter = LeadStage | 'all';

export const LEAD_FILTERS: readonly LeadFilter[] = ['all', ...STAGES];

/** The stage tab in the URL (`?stage=`); anything else is "all". */
export const leadFilterOf = (value: string | null): LeadFilter =>
  LEAD_FILTERS.find((filter) => filter === value) ?? 'all';

/** The list as the page first shows it: the URL's stage tab, no other filter, page 1. */
export const firstLeadQuery = (stage: LeadFilter): LeadQuery => ({
  stage,
  source: 'all',
  band: 'all',
  overdue: false,
  tag: null,
  search: '',
  page: 1,
});

export interface LeadQuery {
  stage: LeadFilter;
  source: LeadSource | 'all';
  band: 'hot' | 'warm' | 'cold' | 'all';
  overdue: boolean;
  /** Customers with this tag (S49). */
  tag: number | null;
  search: string;
  page: number;
  /** A sales manager's seller filter: a SupportStaff id, or the leads nobody has yet. */
  seller?: number | 'none' | null;
}

export interface LeadsData {
  /** Per stage, for the tabs (the other filters applied). */
  counts: Record<LeadFilter, number>;
  /** What the server can filter and change; the page hides the rest. */
  supports: {
    stages: readonly LeadFilter[];
    band: boolean;
    overdue: boolean;
    bulk: boolean;
    /** Customer tags: the filter, the row chips and bulk tagging (S49). */
    tags?: boolean;
  };
  stats: {
    new_waiting: number;
    oldest_new_minutes: number | null;
    today: number;
    today_before_noon: number;
    /** Null until follow-ups are stored on the lead (S3). */
    overdue: number | null;
    max_overdue_days: number;
    /** Null until the first answered call is recorded (S6). */
    first_call_minutes: number | null;
  };
  count: number;
  page_size: number;
  results: LeadRow[];
  /** A sales manager's seller filter (SupportStaff ids); empty or absent for a seller. */
  sellers?: { id: number; name: string }[];
}

/** The seller's leads (managers: everyone's), with per-stage counts and the stats line (S11). */
function fetchLeads(query: LeadQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.stage !== 'all') params.set('stage', query.stage);
  if (query.source !== 'all') params.set('source', query.source);
  if (query.band !== 'all') params.set('band', query.band);
  if (query.overdue) params.set('overdue', '1');
  if (query.tag !== null) params.set('tag', String(query.tag));
  if (query.search.trim()) params.set('search', query.search.trim());
  if (query.seller !== undefined && query.seller !== null)
    params.set('seller', String(query.seller));
  return api<LeadsData>(`${SALES_API}/leads/?${params.toString()}`, { signal });
}

/** One of the seller's open leads found by name or phone (S56). */
export interface LeadMatch {
  id: number;
  customer: number;
  name: string;
  phone: string;
  stage: LeadStage;
  follow_up_at: string | null;
  /** A sales manager's lists: whose it is ('' while nobody has it); null or absent for a seller. */
  seller?: string | null;
}

/** Up to 8 open leads matching what the seller typed, best first (S56): the customer pickers. */
export const leadSearchQuery = (typed: string) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'lead-search', typed],
    queryFn: ({ signal }) =>
      api<{ results: LeadMatch[] }>(
        `${SALES_API}/leads/search/?${new URLSearchParams({ q: typed }).toString()}`,
        { signal },
      ),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

/** Whether the seller may open a found customer, take them, or they are another seller's (S63). */
export type CustomerAccess = 'mine' | 'free' | 'other';

/** Anyone with an account, found by name, email or phone (S63), like the old CRM's search. */
export interface CustomerMatch {
  customer: number;
  name: string;
  phone: string;
  email: string;
  access: CustomerAccess;
  /** With `other`: whose they are. */
  seller: string | null;
  /** Their open lead's stage, if any. */
  stage: LeadStage | null;
}

/** Up to 10 active users matching what the seller typed, the seller's or not, best first (S63). */
export const customerSearchQuery = (typed: string) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'customer-search', typed],
    queryFn: ({ signal }) =>
      api<{ results: CustomerMatch[] }>(
        `${SALES_API}/customers/search/?${new URLSearchParams({ q: typed }).toString()}`,
        { signal },
      ),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

/**
 * A found customer nobody has made the seller's (S63). Another seller's answers 409 with
 * `{code: 'other_seller', seller}`.
 */
export function useTakeCustomer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (customer: number) =>
      api<{ customer: number }>(`${SALES_API}/customers/${String(customer)}/take/`, {
        method: 'POST',
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export const leadsQuery = (query: LeadQuery) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'leads', query],
    queryFn: ({ signal }) => fetchLeads(query, signal),
    placeholderData: keepPreviousData,
  });

export type BulkChange =
  | { stage: Exclude<LeadStage, 'lost' | 'draft' | 'won'> }
  | { follow_up_at: string }
  | { add_tag: number }
  | { remove_tag: number };

/** Several leads at once from the list (S13; tags S49). */
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
  /** From an unknown caller's popup: a number that has an account becomes this seller's (no SMS). */
  from_call?: boolean;
}

/** `existing`: the number already had an account, so no welcome SMS went. */
export interface NewLeadAnswer {
  customer: number;
  existing?: boolean;
}

/**
 * A customer typed in by the seller (referral, walk-in): creates the user when the phone is new
 * and their lead (source `manual`, S14). Errors come back as `{phone: ['invalid' | 'exists']}`.
 */
const createLead = (lead: NewLead) =>
  api<NewLeadAnswer>(`${SALES_API}/leads/`, { method: 'POST', body: lead });

export function useCreateLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createLead,
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

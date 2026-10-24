import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import {
  SALES_API,
  SALES_KEY,
  STAGES,
  type Degree,
  type LeadSource,
  type LeadStage,
  type LostReason,
} from '@/lib/sales/api';
import {
  LEAD_CAUSE,
  STAFF_API,
  fullName,
  type DjangoLead,
  type DjangoUser,
  type Page,
} from '@/lib/staff/api';

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
  /** What the server can filter and change; the page hides the rest. */
  supports: { stages: readonly LeadFilter[]; band: boolean; overdue: boolean; bulk: boolean };
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
}

const LEADS = `${STAFF_API}/sale-leads`;
const PAGE_SIZE = 15;
/** SaleLead.Cause of each source Django has (S2 adds the others). */
const CAUSES: Partial<Record<LeadSource, string>> = {
  failed_purchase: [
    LEAD_CAUSE.failed_product,
    LEAD_CAUSE.failed_writing,
    LEAD_CAUSE.failed_consultation,
    LEAD_CAUSE.failed_event,
  ].join(','),
  campaign: String(LEAD_CAUSE.campaign),
};
/** Django's lead knows only whether it was called (StaffAssignable.is_called). */
const DJANGO_STAGES = ['all', 'new', 'contacted'] as const satisfies readonly LeadFilter[];

const leadRow = (lead: DjangoLead): LeadRow => ({
  id: lead.id,
  customer: lead.user.id,
  name: fullName(lead.user),
  phone: lead.user.phone_number ?? '',
  degree: null,
  countries: [],
  source: lead.cause === LEAD_CAUSE.campaign ? 'campaign' : 'failed_purchase',
  cause: [lead.cause_display, lead.description].filter(Boolean).join(' · '),
  score: null,
  stage: lead.is_called ? 'contacted' : 'new',
  lost_reason: null,
  follow_up_at: null,
  last_contact: null,
  created_at: lead.creation_date,
});

const minutesSince = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60_000);

/**
 * The seller's leads from Django's SaleLeadViewSet (own leads; managers see all) until S11 ships:
 * "new" = no contact yet (`contact_history__isnull`), "contacted" = has one. Stages after that,
 * scores, follow-ups and the first-call time don't exist there yet (S3, S5, S6).
 */
async function fetchLeads(query: LeadQuery, signal?: AbortSignal): Promise<LeadsData> {
  const filters = new URLSearchParams();
  if (query.search.trim()) filters.set('search', query.search.trim());
  const causes = query.source === 'all' ? null : CAUSES[query.source];
  if (causes) filters.set('cause__in', causes);
  const unsupported =
    (query.source !== 'all' && !causes) ||
    !(DJANGO_STAGES as readonly LeadFilter[]).includes(query.stage);
  const withFilters = (extra: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    return params.toString();
  };
  const count = (extra: Record<string, string>) =>
    api<{ count: number }>(`${LEADS}/count/?${withFilters(extra)}`, { signal }).then(
      (data) => data.count,
    );
  const stage =
    query.stage === 'new'
      ? { contact_history__isnull: 'true' }
      : query.stage === 'contacted'
        ? { contact_history__isnull: 'false' }
        : {};
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const noon = new Date(start);
  noon.setHours(12);
  const [page, all, waiting, oldest, today, beforeNoon] = await Promise.all([
    unsupported
      ? Promise.resolve<Page<DjangoLead>>({ count: 0, next: null, previous: null, results: [] })
      : api<Page<DjangoLead>>(
          `${LEADS}/?${withFilters({ ...stage, ordering: '-id', page: String(query.page) })}`,
          { signal },
        ),
    count({}),
    count({ contact_history__isnull: 'true' }),
    api<Page<DjangoLead>>(
      `${LEADS}/?${withFilters({ contact_history__isnull: 'true', ordering: 'id', page_size: '1' })}`,
      { signal },
    ),
    count({ creation_date__gte: start.toISOString() }),
    count({ creation_date__range: `${start.toISOString()},${noon.toISOString()}` }),
  ]);
  const counts = Object.fromEntries(['all', ...STAGES].map((key) => [key, 0])) as Record<
    LeadFilter,
    number
  >;
  counts.all = all;
  counts.new = waiting;
  counts.contacted = all - waiting;
  const first = oldest.results[0];
  return {
    counts,
    supports: { stages: DJANGO_STAGES, band: false, overdue: false, bulk: false },
    stats: {
      new_waiting: waiting,
      oldest_new_minutes: first ? minutesSince(first.creation_date) : null,
      today,
      today_before_noon: beforeNoon,
      overdue: null,
      max_overdue_days: 0,
      first_call_minutes: null,
    },
    count: page.count,
    page_size: PAGE_SIZE,
    results: page.results.map(leadRow),
  };
}

export const leadsQuery = (query: LeadQuery) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'leads', query],
    queryFn: ({ signal }) => fetchLeads(query, signal),
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

/**
 * A customer typed in by the seller (referral, walk-in): Django's UserViewSet.create (the crm
 * "new user"), with the note in UserInfo. Django can't make the lead itself yet (S14), so the
 * customer opens without one. Errors come back as `{phone: ['invalid' | 'exists']}`.
 */
async function createCustomer(lead: NewLead): Promise<{ customer: number }> {
  const users = `${STAFF_API}/users`;
  const found = await api<Page<DjangoUser>>(`${users}/?search=${encodeURIComponent(lead.phone)}`);
  if (found.results.some((user) => user.phone_number === lead.phone))
    throw new ApiError(400, { phone: ['exists'] });
  let user: DjangoUser;
  try {
    user = await api<DjangoUser>(`${users}/`, {
      method: 'POST',
      body: { first_name: lead.first_name, last_name: lead.last_name, phone_number: lead.phone },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400)
      throw new ApiError(400, { phone: ['invalid'] });
    throw error;
  }
  if (lead.note)
    await api(`${users}/${String(user.id)}/info/`, { method: 'POST', body: { notes: lead.note } });
  return { customer: user.id };
}

export function useCreateLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

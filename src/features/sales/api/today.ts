import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { SALES_API, SALES_KEY, type LeadSource, type LeadStage } from '@/lib/sales/api';

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
  month: MonthSummary;
  upsell: Upsell[];
}

export const todayQuery = queryOptions({
  queryKey: [...SALES_KEY, 'today'],
  queryFn: ({ signal }) => api<TodayData>(`${SALES_API}/today/`, { signal }),
  // New leads arrive all day: refresh while the page is open.
  refetchInterval: 60_000,
});

/** Receipts waiting for a seller, oldest first, a page at a time (the Today card pages through them). */
export const receiptsQuery = (page: number) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'receipts', page],
    queryFn: ({ signal }) =>
      api<Page<PendingReceipt>>(`${SALES_API}/receipts/?page=${String(page)}`, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

export const outreachQuery = (page: number, hotPage = 1, bucket: CallBucket | 'all' = 'all') =>
  queryOptions({
    queryKey: [...SALES_KEY, 'today', 'outreach', page, hotPage, bucket],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api<{
        hot: Page<HotLead>;
        calls: Page<CallItem> & { counts: Record<CallBucket | 'all', number> };
      }>(
        `${SALES_API}/today/outreach/?page=${String(page)}&hot_page=${String(hotPage)}&bucket=${bucket}`,
        { signal },
      ),
    refetchInterval: 60_000,
  });
export const activityQuery = (page: number) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'today', 'activity', page],
    queryFn: ({ signal }) =>
      api<{ tasks: TodayData['tasks']; consultations: Page<TodayConsultation> }>(
        `${SALES_API}/today/activity/?page=${String(page)}`,
        { signal },
      ),
    refetchInterval: 60_000,
  });
export const insightsQuery = queryOptions({
  queryKey: [...SALES_KEY, 'today', 'insights'],
  queryFn: ({ signal }) =>
    api<Pick<TodayData, 'month' | 'upsell'>>(`${SALES_API}/today/insights/`, { signal }),
  refetchInterval: 60_000,
});

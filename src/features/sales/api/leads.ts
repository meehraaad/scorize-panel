import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  SALES_API,
  SALES_KEY,
  type Degree,
  type LeadSource,
  type LeadStage,
  type LostReason,
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

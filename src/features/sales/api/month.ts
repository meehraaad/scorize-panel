import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY, type LeadSource } from '@/lib/sales/api';

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

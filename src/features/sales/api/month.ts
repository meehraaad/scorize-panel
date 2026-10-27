import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, type LeadSource } from '@/lib/sales/api';

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
  /** Median minutes to the first call, week by week; null when no samples exist. */
  weeks: (number | null)[];
  sources: { source: LeadSource; leads: number; won: number }[];
}

/**
 * The month is read with the seller's password on every visit (commission and rank stay hidden on
 * an open screen): a POST, kept only in the page's state, never in the query cache. Django answers
 * 400 for a wrong password, 409 when the account has none, 429 after too many tries.
 */
export function useMonthUnlock() {
  return useMutation({
    mutationFn: (password: string) =>
      api<MonthData>(`${SALES_API}/month/`, { method: 'POST', body: { password } }),
  });
}

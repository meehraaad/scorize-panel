import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, type LeadSource } from '@/lib/sales/api';
import type { CommissionReward } from './manager';

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
  /** Toman; null until a commission rate or rule is set (S18, S60). */
  commission: number | null;
  /** The share of the sales the commission makes, in percent (0: none yet); null without rules. */
  commission_percent: number | null;
  /** Toman of it from bonuses and per-contract amounts; null without rules. */
  commission_extra: number | null;
  /** The closest better range not reached yet: contracts or sales still to go, and what it earns. */
  commission_next: {
    basis: 'contracts' | 'sales';
    remaining: number;
    reward: CommissionReward;
    percent: number | null;
    amount: number | null;
    /** The rule's currency: `remaining` sales and `amount` are in it. */
    currency: string;
  } | null;
  drafts_waiting: number;
  rank: { position: number; of: number };
  funnel: { leads: number; reached: number; consulted: number; offered: number; won: number };
  team_conversion: number;
  /** Median minutes to the first call, week by week; null when no samples exist. */
  weeks: (number | null)[];
  sources: { source: LeadSource; leads: number; won: number }[];
  /** The month's contracts that count for the seller, newest first (S59). */
  contracts: MonthContract[];
  /** Instalments due in the month, and the unpaid ones already due, oldest first. */
  instalments: Instalment[];
  /** First days of the months the seller can open, newest first (this month first). */
  months: string[];
  /** Whether it is this month (a past one has no "where you should be today"). */
  current: boolean;
}

/** A closed contract and the seller it counts for (fixed when the case starts). */
export interface MonthContract {
  lead: number;
  customer: number;
  name: string;
  /** What it covers, localized ("پذیرش + ویزا · کانادا"). */
  title: string;
  /** Toman; null for another currency (`amount_text`). */
  amount: number | null;
  amount_text: string | null;
  won_at: string;
  seller: string;
  seller_id: number | null;
  /** The contract's status, localized. */
  status: string;
}

export type InstalmentState = 'paid' | 'overdue' | 'due' | 'waiting';

/** An instalment of a contract that counts for the seller. */
export interface Instalment {
  id: number;
  customer: number;
  name: string;
  title: string;
  amount: number | null;
  amount_text: string | null;
  /** Null when it is due on a condition (`condition`, "after admission"). */
  due: string | null;
  condition: string | null;
  state: InstalmentState;
}

/**
 * The month is read with the seller's password on every visit (commission and rank stay hidden on
 * an open screen): a POST, kept only in the page's state, never in the query cache. Django answers
 * 400 for a wrong password, 409 when the account has none, 429 after too many tries.
 */
export function useMonthUnlock() {
  return useMutation({
    mutationFn: ({ password, month }: { password: string; month?: string }) =>
      api<MonthData>(`${SALES_API}/month/`, {
        method: 'POST',
        body: month ? { password, month } : { password },
      }),
  });
}

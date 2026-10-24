import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY, type LostReason } from '@/lib/sales/api';

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

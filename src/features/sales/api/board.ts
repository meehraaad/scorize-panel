import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY, type LostReason } from '@/lib/sales/api';

/** Stages shown as columns (lost deals are summed under the board). */
export const BOARD_STAGES = ['new', 'contacted', 'consulted', 'offer', 'draft', 'won'] as const;

/** Contract approval and payment own the last two stages; the bulk API cannot move those leads. */
export const MOVABLE_STAGES = ['new', 'contacted', 'consulted', 'offer'] as const;
export type MovableStage = (typeof MOVABLE_STAGES)[number];
export const isMovableStage = (stage: unknown): stage is MovableStage =>
  MOVABLE_STAGES.some((value) => value === stage);

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

export interface BoardMove {
  lead: number;
  from: MovableStage;
  to: MovableStage;
}

/** Called once on drop, never during pointer movement. Reconcile counts and card limits with Django. */
export function useMoveBoardCard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lead, to }: BoardMove) =>
      api(`${SALES_API}/leads/bulk/`, { method: 'POST', body: { ids: [lead], stage: to } }),
    retry: false,
    networkMode: 'always',
    onMutate: async ({ lead, from, to }) => {
      await client.cancelQueries({ queryKey: SALES_KEY });
      const previous = client.getQueryData(boardQuery.queryKey);
      const card = previous?.columns
        .find((column) => column.stage === from)
        ?.cards.find((item) => item.lead === lead);
      if (previous && card && from !== to) {
        client.setQueryData(boardQuery.queryKey, {
          ...previous,
          open_value:
            previous.open_value +
            (to === 'offer' ? (card.amount ?? 0) : 0) -
            (from === 'offer' ? (card.amount ?? 0) : 0),
          columns: previous.columns.map((column) => {
            if (column.stage !== from && column.stage !== to) return column;
            const entering = column.stage === to;
            return {
              ...column,
              count: column.count + (entering ? 1 : -1),
              value:
                column.value === null
                  ? null
                  : column.value + (entering ? 1 : -1) * (card.amount ?? 0),
              cards: entering
                ? [
                    {
                      ...card,
                      stage_since: new Date().toISOString(),
                      next: card.next?.kind === 'call_now' && to !== 'new' ? null : card.next,
                    },
                    ...column.cards,
                  ]
                : column.cards.filter((item) => item.lead !== lead),
            };
          }),
        });
      }
      return { previous };
    },
    onError: (_error, _move, context) => {
      if (context?.previous) client.setQueryData(boardQuery.queryKey, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

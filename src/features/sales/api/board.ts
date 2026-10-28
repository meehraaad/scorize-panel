import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY, type LostReason } from '@/lib/sales/api';

/** The lead stages under the columns: `new`, the team's columns (each in one middle stage), `draft`, `won`. */
export const BOARD_STAGES = ['new', 'contacted', 'consulted', 'offer', 'draft', 'won'] as const;
export type BoardStage = (typeof BOARD_STAGES)[number];
/** The middle stages a team column belongs to. */
export const STAGE_PHASES = ['contacted', 'consulted', 'offer'] as const;
export type StagePhase = (typeof STAGE_PHASES)[number];

/** Contract approval and payment own the last two columns; a seller cannot move those leads. */
const CONTRACT_COLUMNS: readonly string[] = ['draft', 'won'];
/** A column's key: a fixed column's stage, or a team column's id (S48). */
export type ColumnKey = string;
export const columnKey = (column: { stage: BoardStage; id: number | null }): ColumnKey =>
  column.id === null ? column.stage : String(column.id);
export const isMovableColumn = (key: unknown): key is ColumnKey =>
  typeof key === 'string' && !CONTRACT_COLUMNS.includes(key);

/** What a team column asks for when a card enters it, in order (S48). */
export const ACTIVITY_KINDS = [
  'follow_up',
  'task',
  'note',
  'message',
  'offer',
  'sell',
  'contract',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
/** The popup fills these in itself; the others open the customer's page. */
export const FORM_ACTIVITIES: readonly ActivityKind[] = ['follow_up', 'task', 'note'];

export interface StageActivity {
  id: number;
  kind: ActivityKind;
  /** Always true for follow_up; only form kinds can be required. */
  required: boolean;
  settings: {
    /** follow_up / task: the proposed time, `days` from today at `hour`. */
    days?: number;
    hour?: number;
    /** follow_up / task: the proposed text; note: the prompt. */
    text?: string;
    /** message: the ready message, `{customer}` and `{seller}` filled in by the panel. */
    template?: { id: number; title: string; text: string } | null;
  };
}

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
  /** A sales manager's board of everyone: whose card it is. */
  seller: string | null;
  next: NextStep | null;
}

export interface BoardColumn {
  /** The lead stage: a team column's phase. */
  stage: BoardStage;
  /** A team column (S48); null for new, draft and won. */
  id: number | null;
  /** A team column's name; fixed columns use the stage's label. */
  name: string | null;
  /** Days a card may stay before it shows as late; null for no limit. */
  max_days: number | null;
  activities: StageActivity[];
  count: number;
  value: number | null;
  /** The first few cards; the rest are in the list view. */
  cards: BoardCard[];
}

export interface BoardData {
  /** Sum of open offers and drafts, toman. */
  open_value: number;
  columns: BoardColumn[];
  lost: { total: number; reasons: { reason: LostReason; count: number }[] };
  /** A sales manager's seller filter (SupportStaff ids); empty for a seller. */
  sellers: { id: number; name: string }[];
}

const boardKey = [...SALES_KEY, 'board'] as const;

/** The seller's own cards; a sales manager's whole team, or one seller's (SupportStaff id). */
export const sellerBoardQuery = (seller: number | null) =>
  queryOptions({
    queryKey: [...boardKey, seller],
    queryFn: ({ signal }) =>
      api<BoardData>(`${SALES_API}/board/${seller === null ? '' : `?seller=${String(seller)}`}`, {
        signal,
      }),
  });

export const boardQuery = sellerBoardQuery(null);

/** Without a team column's limit, a card left in one stage this long is flagged. */
export const STALE_DAYS = 7;

/** What the move popup sends for the column's activities. */
export interface MoveSteps {
  follow_up?: { text: string; due_at: string };
  task?: { text: string; due_at: string };
  note?: { text: string };
}

export interface BoardMove {
  lead: number;
  from: ColumnKey;
  to: ColumnKey;
  steps?: MoveSteps;
  /** The board's query key (the seller filter). */
  board?: readonly unknown[];
}

/** Called once the move is confirmed, never during pointer movement. Reconcile counts and card limits with Django. */
export function useMoveBoardCard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lead, to, steps }: BoardMove) =>
      api(`${SALES_API}/leads/${String(lead)}/move/`, {
        method: 'POST',
        body: { to, steps: steps ?? {} },
      }),
    retry: false,
    networkMode: 'always',
    onMutate: async ({ lead, from, to, steps, board = boardQuery.queryKey }) => {
      await client.cancelQueries({ queryKey: SALES_KEY });
      const previous = client.getQueryData<BoardData>(board);
      const source = previous?.columns.find((column) => columnKey(column) === from);
      const target = previous?.columns.find((column) => columnKey(column) === to);
      const card = source?.cards.find((item) => item.lead === lead);
      if (previous && source && target && card && from !== to) {
        const offer = (column: BoardColumn) => (column.stage === 'offer' ? (card.amount ?? 0) : 0);
        client.setQueryData<BoardData>(board, {
          ...previous,
          open_value: previous.open_value + offer(target) - offer(source),
          columns: previous.columns.map((column) => {
            if (column !== source && column !== target) return column;
            const entering = column === target;
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
                      next: steps?.follow_up
                        ? { kind: 'follow_up', at: steps.follow_up.due_at }
                        : card.next?.kind === 'call_now' && to !== 'new'
                          ? null
                          : card.next,
                    },
                    ...column.cards,
                  ]
                : column.cards.filter((item) => item.lead !== lead),
            };
          }),
        });
      }
      return { previous, board };
    },
    onError: (_error, _move, context) => {
      if (context?.previous) client.setQueryData(context.board, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

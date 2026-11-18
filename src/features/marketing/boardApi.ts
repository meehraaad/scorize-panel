import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Face } from '@/lib/face/api';
import { MARKETING_API, MARKETING_KEY, type AttendanceDay } from './api';

/**
 * The marketing board (Django `api/marketing/v1/board.py`, rules in lang `marketing/board.py`):
 * stages the marketing manager keeps, card types with their checklist, and cards. A card's current
 * step is a task on its owner's tasks page; done there, the card moves on when nothing else is
 * needed. Out of a manager-only stage (review), sending back, and the stages and types are the
 * manager's (`apply.can_manage_marketing`).
 */
export const MARKETING_MANAGER_PERMISSION = 'can_manage_marketing';

export const STAGE_COLORS = ['gray', 'blue', 'amber', 'plum', 'green', 'ink'] as const;
export type StageColor = (typeof STAGE_COLORS)[number];
export const STAGE_NEEDS = ['owner_date', 'file', 'caption', 'checklist', 'link'] as const;
export type StageNeed = (typeof STAGE_NEEDS)[number];

export interface Person {
  /** SupportStaff id. */
  id: number;
  name: string;
  face: Face | null;
}

export interface Stage {
  id: number;
  name: string;
  color: StageColor;
  order: number;
  /** Cards at once; null: no limit (a soft limit: the lane shows it is over). */
  card_limit: number | null;
  /** Only the manager takes a card out (review). */
  manager_only: boolean;
  /** Whose the stage's task is; null: the card's owner (a manager on a manager-only stage). */
  assignee: { id: number; name: string } | null;
  /** The task a card entering it opens; '' for none. */
  task_text: string;
  /** Its deadline, days after entering (0: the same day). */
  task_days: number;
  /** What a card needs before it may enter. */
  needs: StageNeed[];
}

export interface CardType {
  id: number;
  name: string;
  color: StageColor;
  checklist: string[];
  /** Days from making a card to its publish day, as a guide. */
  days: number;
  is_active: boolean;
}

/** The card's task at its stage. */
export interface CardStep {
  /** StaffToDo id. */
  id: number;
  /** `YYYY-MM-DD`. */
  due: string;
  done: boolean;
  owner: { id: number; name: string } | null;
}

export interface BoardCard {
  id: number;
  title: string;
  stage: number;
  type: number | null;
  owner: Person | null;
  campaign: { id: number; title: string } | null;
  publish_at: string | null;
  checklist: { done: number; total: number };
  /** Sent back by the manager, until it moves forward again. */
  returned: boolean;
  step: CardStep | null;
  has_file: boolean;
  link: string;
}

export interface CardEventRow {
  id: number;
  kind: 'created' | 'moved' | 'returned' | 'archived';
  note: string;
  at: string;
  from: string | null;
  to: string | null;
  by: string | null;
}

export interface CardDetail extends BoardCard {
  description: string;
  caption: string;
  file: string | null;
  items: { label: string; done: boolean }[];
  next_stage: number | null;
  /** What the next stage still asks for (empty: it can go). */
  missing: StageNeed[];
  created_at: string;
  events: CardEventRow[];
}

export interface BoardData {
  board: { id: number; name: string };
  can_manage: boolean;
  stages: Stage[];
  types: CardType[];
  cards: BoardCard[];
  /** Who a card can go to. */
  people: Person[];
  campaigns: { id: number; title: string }[];
}

export interface TeamRow extends Person {
  attendance: AttendanceDay | null;
  tasks: { today: number; overdue: number; week: number };
  /** Open cards not yet published. */
  cards: number;
  late_days: number;
}

export interface MarketingTeam {
  members: TeamRow[];
  /** Cards waiting for the manager (in manager-only stages), oldest first. */
  review: BoardCard[];
}

export interface CardFields {
  title?: string;
  description?: string;
  stage?: number;
  type?: number | null;
  owner?: number | null;
  campaign?: number | null;
  publish_at?: string | null;
  caption?: string;
  link?: string;
  checklist?: { label: string; done: boolean }[];
}

export interface StageFields {
  name?: string;
  color?: StageColor;
  card_limit?: number | null;
  manager_only?: boolean;
  assignee?: number | null;
  task_text?: string;
  task_days?: number;
  needs?: StageNeed[];
}

export interface TypeFields {
  name?: string;
  color?: StageColor;
  checklist?: string[];
  days?: number;
  is_active?: boolean;
}

/** A refused move (409): `manager_only`, `needs` (with `missing`), `same`, `board`. */
export interface MoveRefusal {
  detail: string;
  code: 'manager_only' | 'needs' | 'same' | 'board';
  missing: StageNeed[];
}

export const boardQuery = queryOptions({
  queryKey: [...MARKETING_KEY, 'board'],
  queryFn: ({ signal }) => api<BoardData>(`${MARKETING_API}/board/`, { signal }),
});

export const cardQuery = (id: number) =>
  queryOptions({
    queryKey: [...MARKETING_KEY, 'card', id],
    queryFn: ({ signal }) => api<CardDetail>(`${MARKETING_API}/cards/${String(id)}/`, { signal }),
  });

export const teamQuery = queryOptions({
  queryKey: [...MARKETING_KEY, 'team'],
  queryFn: ({ signal }) => api<MarketingTeam>(`${MARKETING_API}/team/`, { signal }),
});

export const cardPath = (id: number, rest = '') => `${MARKETING_API}/cards/${String(id)}/${rest}`;

/** Every board write: the card is put in the cache, and the board, Today and calendar follow. */
function useBoardMutation<V, T>(send: (value: V) => Promise<T>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      if (data && typeof data === 'object' && 'events' in data) {
        const card = data as unknown as CardDetail;
        client.setQueryData(cardQuery(card.id).queryKey, card);
      }
      return client.invalidateQueries({ queryKey: MARKETING_KEY });
    },
  });
}

export const useNewCard = () =>
  useBoardMutation((body: CardFields & { title: string }) =>
    api<CardDetail>(`${MARKETING_API}/cards/`, { method: 'POST', body }),
  );

export const useEditCard = () =>
  useBoardMutation(({ id, ...body }: CardFields & { id: number }) =>
    api<CardDetail>(cardPath(id), { method: 'PATCH', body }),
  );

export const useMoveCard = () =>
  useBoardMutation(({ id, stage, note }: { id: number; stage: number; note?: string }) =>
    api<CardDetail>(cardPath(id, 'move/'), { method: 'POST', body: { stage, note } }),
  );

export const useReturnCard = () =>
  useBoardMutation(({ id, stage, note }: { id: number; stage: number; note: string }) =>
    api<CardDetail>(cardPath(id, 'return/'), { method: 'POST', body: { stage, note } }),
  );

export const useArchiveCard = () =>
  useBoardMutation((id: number) => api<null>(cardPath(id, 'archive/'), { method: 'POST' }));

export const useRemoveCardFile = () =>
  useBoardMutation((id: number) => api<CardDetail>(cardPath(id, 'file/'), { method: 'DELETE' }));

export const useNewStage = () =>
  useBoardMutation((body: StageFields & { name: string }) =>
    api<{ stages: Stage[] }>(`${MARKETING_API}/stages/`, { method: 'POST', body }),
  );

export const useEditStage = () =>
  useBoardMutation(({ id, ...body }: StageFields & { id: number }) =>
    api<{ stages: Stage[] }>(`${MARKETING_API}/stages/${String(id)}/`, { method: 'PATCH', body }),
  );

export const useOrderStages = () =>
  useBoardMutation((ids: number[]) =>
    api<{ stages: Stage[] }>(`${MARKETING_API}/stages/order/`, { method: 'POST', body: { ids } }),
  );

export const useDeleteStage = () =>
  useBoardMutation(({ id, moveTo }: { id: number; moveTo: number | null }) =>
    api<{ stages: Stage[] }>(
      `${MARKETING_API}/stages/${String(id)}/${moveTo ? `?move_to=${String(moveTo)}` : ''}`,
      { method: 'DELETE' },
    ),
  );

export const useNewType = () =>
  useBoardMutation((body: TypeFields & { name: string }) =>
    api<{ types: CardType[] }>(`${MARKETING_API}/types/`, { method: 'POST', body }),
  );

export const useEditType = () =>
  useBoardMutation(({ id, ...body }: TypeFields & { id: number }) =>
    api<{ types: CardType[] }>(`${MARKETING_API}/types/${String(id)}/`, { method: 'PATCH', body }),
  );

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { TasksPanel } from '@/lib/tasks/api';

/*
 * «برد من» (meeting0, lang `api/boards/v1/`): each staff member's own board in a panel. Columns
 * they name and order; cards that are their tasks. A card only arranges a task: moving or removing
 * it never changes the task. Only the board's owner reads it.
 */

const BOARDS_API = '/boards/v1';
export const BOARDS_KEY = ['boards'] as const;

/** A panel with a board (the shared page's `staff` has none). */
export type BoardPanel = Exclude<TasksPanel, 'staff'>;

export interface BoardTask {
  id: number;
  text: string;
  due_at: string;
  /** False: due some time that day, no hour. */
  timed: boolean;
  kind: 'mine' | 'request' | 'team';
  status: string;
  done: boolean;
  penalty: boolean;
}

export interface BoardCard {
  id: number;
  column: number;
  task: BoardTask;
}

export interface BoardColumn {
  id: number;
  name: string;
  cards: BoardCard[];
}

export interface MyBoard {
  id: number;
  panel: BoardPanel;
  columns: BoardColumn[];
}

/** The server's cap on a board's columns. */
export const MAX_COLUMNS = 20;

const boardKey = (panel: BoardPanel) => [...BOARDS_KEY, panel] as const;
const candidatesKey = (panel: BoardPanel) => [...boardKey(panel), 'candidates'] as const;

/** My board of `panel` (made empty the first time it is asked for). */
export const myBoardQuery = (panel: BoardPanel) =>
  queryOptions({
    queryKey: boardKey(panel),
    queryFn: ({ signal }) =>
      api<MyBoard>(`${BOARDS_API}/board/?panel=${encodeURIComponent(panel)}`, { signal }),
    staleTime: 30_000,
  });

/** My open tasks of `panel` not on the board yet (`search`: from two letters). */
export const candidatesQuery = (panel: BoardPanel, search: string) =>
  queryOptions({
    queryKey: [...candidatesKey(panel), search],
    queryFn: ({ signal }) =>
      api<BoardTask[]>(
        `${BOARDS_API}/candidates/?${new URLSearchParams({ panel, search }).toString()}`,
        { signal },
      ),
  });

export type ColumnChange =
  | { kind: 'add'; names: string[] }
  | { kind: 'rename'; id: number; name: string }
  | { kind: 'remove'; id: number }
  | { kind: 'order'; ids: number[] };

/**
 * What is done to the columns: the server answers with the whole board, which replaces the cached
 * one; a deleted column (no answer) leaves the cache with its cards.
 */
export function useColumnChange(panel: BoardPanel) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: ColumnChange) => {
      switch (change.kind) {
        case 'add':
          return api<MyBoard>(`${BOARDS_API}/columns/`, {
            method: 'POST',
            body: { panel, names: change.names },
          });
        case 'rename':
          return api<MyBoard>(`${BOARDS_API}/columns/${String(change.id)}/`, {
            method: 'PATCH',
            body: { name: change.name },
          });
        case 'order':
          return api<MyBoard>(`${BOARDS_API}/columns/order/`, {
            method: 'POST',
            body: { panel, ids: change.ids },
          });
        case 'remove':
          return api<undefined>(`${BOARDS_API}/columns/${String(change.id)}/`, {
            method: 'DELETE',
          });
      }
    },
    onSuccess: (board, change) => {
      if (board) client.setQueryData(boardKey(panel), board);
      else if (change.kind === 'remove') {
        client.setQueryData<MyBoard>(
          boardKey(panel),
          (old) =>
            old && { ...old, columns: old.columns.filter((column) => column.id !== change.id) },
        );
        // Its cards' tasks can go on the board again.
        void client.invalidateQueries({ queryKey: candidatesKey(panel) });
      }
    },
  });
}

export type CardChange =
  | { kind: 'add'; column: number; task: number }
  | { kind: 'move'; card: number; column: number; before: number | null }
  | { kind: 'remove'; card: number };

/** `card` moved before `before` in `column` (null: at its end), as the server will place it. */
function moved(board: MyBoard, card: number, column: number, before: number | null): MyBoard {
  const moving = board.columns.flatMap((lane) => lane.cards).find((item) => item.id === card);
  if (!moving) return board;
  return {
    ...board,
    columns: board.columns.map((lane) => {
      const rest = lane.cards.filter((item) => item.id !== card);
      if (lane.id !== column) return { ...lane, cards: rest };
      const at = before === null ? -1 : rest.findIndex((item) => item.id === before);
      const placed = { ...moving, column };
      return {
        ...lane,
        cards: at < 0 ? [...rest, placed] : [...rest.slice(0, at), placed, ...rest.slice(at)],
      };
    }),
  };
}

/**
 * What is done to cards, without asking for the board again: a move or a removal shows at once
 * (the server places a card the same way) and comes back if the server refuses; an added card
 * arrives with the server's answer, which carries its task. Adding or removing one changes which
 * tasks can still go on the board.
 */
export function useCardChange(panel: BoardPanel) {
  const client = useQueryClient();
  const key = boardKey(panel);
  return useMutation({
    mutationFn: (change: CardChange) =>
      change.kind === 'add'
        ? api<BoardCard>(`${BOARDS_API}/cards/`, {
            method: 'POST',
            body: { column: change.column, task: change.task },
          })
        : change.kind === 'move'
          ? api<BoardCard>(`${BOARDS_API}/cards/${String(change.card)}/`, {
              method: 'PATCH',
              body: { column: change.column, before: change.before },
            })
          : api<undefined>(`${BOARDS_API}/cards/${String(change.card)}/`, { method: 'DELETE' }),
    onMutate: async (change) => {
      if (change.kind === 'add') return undefined;
      await client.cancelQueries({ queryKey: key, exact: true });
      const before = client.getQueryData<MyBoard>(key);
      if (before)
        client.setQueryData<MyBoard>(
          key,
          change.kind === 'move'
            ? moved(before, change.card, change.column, change.before)
            : {
                ...before,
                columns: before.columns.map((lane) => ({
                  ...lane,
                  cards: lane.cards.filter((item) => item.id !== change.card),
                })),
              },
        );
      return before;
    },
    onSuccess: (answer, change) => {
      if (change.kind === 'add' && answer)
        client.setQueryData<MyBoard>(
          key,
          (old) =>
            old && {
              ...old,
              columns: old.columns.map((lane) =>
                lane.id === answer.column ? { ...lane, cards: [...lane.cards, answer] } : lane,
              ),
            },
        );
      if (change.kind !== 'move') void client.invalidateQueries({ queryKey: candidatesKey(panel) });
    },
    // Refused (or the board changed elsewhere): what the server has.
    onError: (_error, _change, before) => {
      if (before) client.setQueryData(key, before);
      void client.invalidateQueries({ queryKey: key, exact: true });
    },
  });
}

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { columnKey, type BoardData, type ColumnKey } from './api/board';

type Order = Partial<Record<ColumnKey, number[]>>;
/** A fixed column's stage or a team column's id (S48). */
const KEY = /^(new|draft|won|[1-9]\d{0,9})$/;
const EMPTY: Order = {};
const MAX_SAVED_CARDS = 500;
const snapshots = new Map<number, { raw: string | null; order: Order }>();
const listeners = new Map<number, Set<() => void>>();
export const boardOrderKey = (owner: number) => `scorize.board-order.v1.${String(owner)}`;

function readOrder(owner: number): Order {
  let raw: string | null;
  try {
    raw = localStorage.getItem(boardOrderKey(owner));
  } catch {
    return EMPTY;
  }
  const cached = snapshots.get(owner);
  if (cached?.raw === raw) return cached.order;
  const order: Order = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [stage, ids] of Object.entries(parsed as Record<string, unknown>)) {
        if (KEY.test(stage) && Array.isArray(ids)) {
          order[stage] = [
            ...new Set(
              ids.filter(
                (id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
              ),
            ),
          ].slice(0, MAX_SAVED_CARDS);
        }
      }
    }
  } catch {
    /* Invalid preferences use the server's order. */
  }
  snapshots.set(owner, { raw, order });
  return order;
}

/** Only numeric IDs, scoped to the signed-in account. No card content is stored. */
function saveOrder(owner: number, stage: ColumnKey, visibleIds: number[]): boolean {
  const previous = readOrder(owner);
  const visible = new Set(visibleIds);
  const ids = [...visibleIds, ...(previous[stage] ?? []).filter((id) => !visible.has(id))].slice(
    0,
    MAX_SAVED_CARDS,
  );
  try {
    localStorage.setItem(boardOrderKey(owner), JSON.stringify({ ...previous, [stage]: ids }));
  } catch {
    return false;
  }
  listeners.get(owner)?.forEach((listener) => listener());
  return true;
}

function applyOrder(data: BoardData, order: Order): BoardData {
  const columns = data.columns.map((column) => {
    const ids = order[columnKey(column)];
    if (!ids?.length) return column;
    const ranks = new Map(ids.map((id, rank) => [id, rank]));
    // Newly arriving cards stay visible at the top; existing cards retain the chosen order.
    const cards = [...column.cards].sort(
      (a, b) => (ranks.get(a.lead) ?? -1) - (ranks.get(b.lead) ?? -1),
    );
    if (cards.every((card, index) => card === column.cards[index])) return column;
    return { ...column, cards };
  });
  return columns.some((column, index) => column !== data.columns[index])
    ? { ...data, columns }
    : data;
}

/** The API has no rank field yet (S12a). A personal order survives refreshes and syncs browser tabs. */
export function useBoardOrder(owner: number, data: BoardData) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const group = listeners.get(owner) ?? new Set<() => void>();
      listeners.set(owner, group);
      group.add(listener);
      const storage = (event: StorageEvent) => {
        if (event.key === null || event.key === boardOrderKey(owner)) listener();
      };
      window.addEventListener('storage', storage);
      return () => {
        group.delete(listener);
        if (!group.size) listeners.delete(owner);
        window.removeEventListener('storage', storage);
      };
    },
    [owner],
  );
  const snapshot = useCallback(() => readOrder(owner), [owner]);
  const order = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return {
    data: useMemo(() => applyOrder(data, order), [data, order]),
    save: (stage: ColumnKey, ids: number[]) => saveOrder(owner, stage, ids),
  };
}

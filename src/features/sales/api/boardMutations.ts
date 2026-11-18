import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import { columnKey, type BoardColumn, type BoardData, boardQuery, type BoardMove } from './board';

/**
 * The mutations of `./board`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
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

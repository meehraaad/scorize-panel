import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { TASKS_API, TASKS_KEY, requestQuery, type ReactionDetail, type TasksPanel } from './api';

// Out of ./api.ts: the panels' first load reads that file for their routes; this is popup-only.

/** The quick reactions a task takes (Django's `ToDoReaction.Emoji`), with a name for each. */
export const TASK_REACTIONS = [
  { emoji: '👍', name: 'agree' },
  { emoji: '✅', name: 'done' },
  { emoji: '🙏', name: 'thanks' },
  { emoji: '❤️', name: 'love' },
  { emoji: '👀', name: 'looking' },
  { emoji: '🎉', name: 'congrats' },
] as const;
export type TaskEmoji = (typeof TASK_REACTIONS)[number]['emoji'];

/** Adds my reaction, or takes it back; answers with the task's reactions. */
export function useToggleReaction(panel: TasksPanel, id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (emoji: TaskEmoji) =>
      api<ReactionDetail[]>(`${TASKS_API}/${String(id)}/reactions/`, {
        method: 'POST',
        body: { emoji },
      }),
    onSuccess: (reactions) => {
      client.setQueryData(
        requestQuery(panel, id).queryKey,
        (detail) => detail && { ...detail, reactions },
      );
      return client.invalidateQueries({
        queryKey: TASKS_KEY,
        predicate: ({ queryKey }) => queryKey[2] !== 'request',
      });
    },
  });
}

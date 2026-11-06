import { queryOptions, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import {
  TASKS_API,
  TASKS_KEY,
  type MyTask,
  type NewTask,
  type RequestDetail,
  type TaskChange,
  type TasksPanel,
} from './api';

/*
 * What the tasks pages do to tasks, apart from `./api.ts`: the panels' routes import that one for
 * their first data, so it is in the first-load bundle and keeps only types and route queries.
 */

/** Creates a task about a person. Refreshes the tasks pages and the `also` keys (the page it came from). */
export function useCreateTask(also: QueryKey) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) => api(`${TASKS_API}/`, { method: 'POST', body: task }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: TASKS_KEY }),
        client.invalidateQueries({ queryKey: ['sales', 'today', 'activity'] }),
        client.invalidateQueries({ queryKey: also }),
      ]),
  });
}

export const requestQuery = (panel: TasksPanel, id: number) =>
  queryOptions({
    queryKey: [...TASKS_KEY, panel, 'request', id],
    queryFn: ({ signal }) =>
      api<RequestDetail>(`${TASKS_API}/${String(id)}/?panel=${encodeURIComponent(panel)}`, {
        signal,
      }),
  });

const CHANGE_PATH: Record<TaskChange['kind'], string> = {
  done: 'done',
  snooze: 'snooze',
  claim: 'claim',
  status: 'status',
  comment: 'comments',
};

/** Cached pages of every panel's "mine" list. */
const isMineList = (queryKey: readonly unknown[]) =>
  queryKey[0] === TASKS_KEY[0] && queryKey[2] === 'list' && queryKey[3] === 'mine';

/**
 * Everything done to a task from the tasks page (T3–T8). A task marked done leaves "my tasks" at
 * once (optimistic; a snoozed one may stay today, so it waits for the server); the lists come back as they were if the server refuses.
 */
export function useTaskChange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: TaskChange }) => {
      const { kind, ...body } = change;
      return api(`${TASKS_API}/${String(id)}/${CHANGE_PATH[kind]}/`, { method: 'POST', body });
    },
    onMutate: async ({ id, change }) => {
      if (change.kind !== 'done') return undefined;
      const filters = {
        predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => isMineList(queryKey),
      };
      await client.cancelQueries(filters);
      const previous = client.getQueriesData<Page<MyTask>>(filters);
      client.setQueriesData<Page<MyTask>>(filters, (page) =>
        page?.results.some((task) => task.id === id)
          ? {
              ...page,
              count: page.count - 1,
              results: page.results.filter((task) => task.id !== id),
            }
          : page,
      );
      return previous;
    },
    onError: (_error, _change, previous) => {
      for (const [queryKey, data] of previous ?? []) client.setQueryData(queryKey, data);
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: TASKS_KEY }),
        client.invalidateQueries({ queryKey: ['sales', 'today', 'activity'] }),
      ]),
  });
}

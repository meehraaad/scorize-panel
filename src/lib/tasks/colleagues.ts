import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { TASKS_API, type Colleague, type TasksPanel } from './api';

/* The colleague search: only the task forms ask it, so it stays out of `./api.ts` (first load). */

/** Typing this many letters starts the colleague search (the server refuses fewer). */
export const COLLEAGUE_SEARCH_MIN = 2;

/**
 * Colleagues whose name has `search`: up to eight, nothing loaded before typing. `panel`: only its
 * people (whom its tasks may go to); without it any active colleague (a meeting's guest).
 */
export const colleagueSearchQuery = (search: string, panel?: TasksPanel) =>
  queryOptions({
    // Outside the tasks key: a change to a task doesn't refetch the searches.
    queryKey: ['colleagues', panel ?? 'all', search],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ search });
      if (panel && panel !== 'staff') query.set('panel', panel);
      return api<Colleague[]>(`${TASKS_API}/colleagues/?${query.toString()}`, { signal });
    },
    enabled: search.trim().length >= COLLEAGUE_SEARCH_MIN,
    staleTime: 60_000,
  });

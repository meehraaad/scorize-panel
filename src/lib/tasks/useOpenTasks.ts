import { useQuery } from '@tanstack/react-query';
import { OPEN_TASKS_POLL, openTaskQueries, type TasksPanel } from './api';

const live = { refetchInterval: OPEN_TASKS_POLL, refetchIntervalInBackground: false } as const;

/**
 * What is waiting for me now: my follow-ups due by today and colleagues' open requests (each list's
 * first page, the same cache as the tasks page), asked again every minute while the tab is in view.
 * The counts are the server's, past the first page too: `count` all of it (the bell), `today` what
 * is due by tonight and `late` what of it is overdue (the dock).
 */
export function useOpenTasks(panel: TasksPanel, enabled = true) {
  const [summaryQuery, mineQuery, requestsQuery] = openTaskQueries(panel);
  const summary = useQuery({ ...summaryQuery, ...live, enabled });
  const mine = useQuery({ ...mineQuery, ...live, enabled });
  const requests = useQuery({ ...requestsQuery, ...live, enabled });
  return {
    summary,
    mine,
    requests,
    count: summary.data?.waiting ?? (mine.data?.count ?? 0) + (requests.data?.count ?? 0),
    today: summary.data?.today ?? 0,
    late: summary.data?.late ?? 0,
  };
}

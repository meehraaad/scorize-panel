import { useQuery } from '@tanstack/react-query';
import { openTaskQueries, type TasksPanel } from './api';

/**
 * What is waiting for me now: my follow-ups due by today and colleagues' open requests (each list's
 * first page, the same cache as the tasks page). `count`: all of them, past the first page too.
 */
export function useOpenTasks(panel: TasksPanel, enabled = true) {
  const [mineQuery, requestsQuery] = openTaskQueries(panel);
  const mine = useQuery({ ...mineQuery, enabled });
  const requests = useQuery({ ...requestsQuery, enabled });
  return {
    mine,
    requests,
    count: (mine.data?.count ?? 0) + (requests.data?.count ?? 0),
  };
}

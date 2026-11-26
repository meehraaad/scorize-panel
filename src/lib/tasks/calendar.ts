import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { addDays, toValue } from '@/lib/calendar';
import { TASKS_API, TASKS_KEY, type TasksPanel } from './api';

/**
 * My tasks on a calendar: the shape every panel's calendar endpoint answers (lang
 * `api/sales/v1/calendar.py` seller_tasks, used by sales, HR and marketing).
 */

/** One of my own tasks in the range (follow-ups and colleagues' requests, not team queues). */
export interface CalendarTaskRow {
  id: number;
  kind: 'mine' | 'request';
  text: string;
  due_at: string;
  /** False: due some time that day, no hour; it shows on the day row only. */
  timed: boolean;
  done: boolean;
  /** The customer it is about; null (and `name` '') for a task about no one. */
  customer: number | null;
  name: string;
}

/** How many of my tasks fall on a day: only days with any. */
export interface CalendarTaskDay {
  /** `YYYY-MM-DD`. */
  day: string;
  /** Open follow-ups of mine due that day. */
  mine: number;
  /** Open requests from colleagues due that day. */
  requests: number;
  /** Of both, how many are closed. */
  done: number;
}

/** What a task calendar reads from its endpoint. */
export interface TaskCalendarData {
  tasks: CalendarTaskDay[];
  task_rows: CalendarTaskRow[];
}

/**
 * A week of my tasks of `panel` (lang `tasks/calendar/`): the picker's week where the panel has no
 * calendar of its own (supervisor, executive, the shared page).
 */
export const taskCalendarQuery = (panel: TasksPanel) => (week: Date) => {
  const from = toValue(week, false);
  const to = toValue(addDays(week, 6), false);
  return queryOptions({
    queryKey: [...TASKS_KEY, panel, 'calendar', from],
    queryFn: ({ signal }) =>
      api<TaskCalendarData>(
        `${TASKS_API}/calendar/?${new URLSearchParams({ panel, from, to }).toString()}`,
        { signal },
      ),
  });
};

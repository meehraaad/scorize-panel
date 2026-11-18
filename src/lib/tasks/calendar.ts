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

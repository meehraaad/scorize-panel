import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { getRoles } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Face } from '@/lib/face/api';
import { parseValue } from '@/lib/calendar';
import type { Page } from '@/lib/api/page';
import type { TaskEmoji } from './reactions';

/**
 * Staff tasks (StaffToDo): one model, three behaviours (canvas "کارها"):
 * - `mine`: a follow-up I set for myself about a person; done → outcome + next step
 * - `request`: I ask a colleague; they see it, work on it, finish or refuse it
 * - `team`: sent to a team's queue; whoever takes it becomes its owner
 * Panel-neutral: both panels use `/api/staff/v1/tasks/` (backend-changes.md T1–T12); `panel`
 * decides whose ids `person` carries (User for sales, Applicant for supervisor), and `person.link`
 * the page this panel may open for them (null: their name only).
 */

/** The person a task is about. `link`: their page's id in the reader's panel; null or absent: no link. */
export interface TaskPerson {
  id: number;
  link?: number | null;
  name: string;
  face?: Face | null;
}

export const TASKS_KEY = ['tasks'] as const;
export const TASKS_API = '/staff/v1/tasks';

/** The panels with tasks of their own, in the panels' order. */
const PANELS_WITH_TASKS = ['supervisor', 'executive', 'sales', 'marketing', 'hr'] as const;

/** `staff`: the shared tasks page (`/tasks`) of a staff member outside these panels (no people's pages). */
export type TasksPanel = (typeof PANELS_WITH_TASKS)[number] | 'staff';

/** The panels whose tasks a user reads (`staff` alone for anyone without one). */
export function taskPanelsOf(user: SessionUser): TasksPanel[] {
  const roles: readonly string[] = getRoles(user);
  const own = PANELS_WITH_TASKS.filter((panel) => roles.includes(panel));
  return own.length > 0 ? own : ['staff'];
}

/** The tasks of `panel` when the user has them, else of their first panel with tasks, else `staff`. */
export function taskPanelOf(user: SessionUser, panel?: string | null): TasksPanel {
  const allowed = taskPanelsOf(user);
  return allowed.find((own) => own === panel) ?? allowed[0] ?? 'staff';
}

export type TaskKind = 'mine' | 'request' | 'team';
export type TaskStatus = 'open' | 'sent' | 'seen' | 'in_progress' | 'done' | 'rejected' | 'queued';
/** Teams that keep a queue. */
export const TASK_TEAMS = ['writing', 'language', 'documents', 'finance'] as const;
export type TaskTeam = (typeof TASK_TEAMS)[number];

export interface TaskSummary {
  id: number;
  kind: TaskKind;
  status: TaskStatus;
  text: string;
  due_at: string;
  /** False: due some time that day (`due_at` is its 23:59), no hour set. Absent from an older Django. */
  timed?: boolean;
  /** Who does it; null while it waits in a team queue. */
  owner: string | null;
  /** Who asked (a colleague, a manager, or the system for automatic follow-ups). */
  creator: string | null;
  team: TaskTeam | null;
  /** Created by the system (new lead, unanswered call, instalment due…). */
  automatic: boolean;
  /** S79: the meeting at the office this follow-up is (the customer page's tasks only). */
  visit?: { id: number; starts_at: string; minutes?: number } | null;
}

export interface Colleague {
  id: number;
  name: string;
  /** "Consultant of this customer" when suggested, else their team: localized by the server. */
  role: string;
  /** Their team's name (lists are grouped by it); absent from an older Django. */
  team?: string;
  /** The people on this customer's case and the sales managers: listed first. */
  suggested?: boolean;
}

export interface NewTask {
  /** The person the task is about (User id); null for an internal request. */
  user: number | null;
  text: string;
  kind: TaskKind;
  /** `request`: the colleague (SupportStaff id). */
  assignee?: number;
  /** `request` to several colleagues: each gets their own copy, one conversation (T13). */
  assignees?: number[];
  /** `team`: the queue. */
  team?: TaskTeam;
  /** When it is due; or `due_on` alone. */
  due_at?: string;
  /** `YYYY-MM-DD`: a day with no hour, due by its end. */
  due_on?: string;
}

/** When a new task is due: its time, or the 23:59 of its day (as Django reads a day-only task). */
export const dueAtOf = (task: Pick<NewTask, 'due_at' | 'due_on'>): string =>
  task.due_at ?? new Date(`${task.due_on ?? ''}T23:59:00`).toISOString();

// ── Reactions (T14) ──────────────────────────────────────────────────────────────────────────

/** How many reacted with an emoji, and whether I did (the emojis: `./reactions.ts`). */
export interface Reaction {
  emoji: TaskEmoji;
  count: number;
  mine: boolean;
}

/** In the popup: also who else reacted (a few names; `count` has everyone). */
export interface ReactionDetail extends Reaction {
  names: string[];
}

// ── The tasks page ───────────────────────────────────────────────────────────────────────────

/** Where a follow-up came from: the system (new lead, unanswered call…), me, or a previous step. */
export type TaskSource = 'system' | 'me' | 'chain';

/** A follow-up I own about a person. */
export interface MyTask {
  id: number;
  text: string;
  due_at: string;
  /** False: due some time that day (`due_at` is its 23:59), no hour set. Absent from an older Django. */
  timed?: boolean;
  /** Null for an internal task about nobody. */
  person: (TaskPerson & { context: string }) | null;
  source: TaskSource;
  /** How many times it was pushed back. */
  snoozed: number;
  /** In a chain of next steps about this person: which step this is. */
  step: number | null;
  /** The main action ("call", "message", …) opens the person's page with it ready. */
  action: 'call' | 'message' | 'open';
  /** The note left when the previous step was done. */
  note: string;
  /** The system's idea for the next step (prefilled when it is done). */
  suggested_next: string;
  /**
   * The customer's follow-up (sales): its time is the lead's `follow_up_at`, so Today shows it once, as the call
   * (Django `api/staff/v1/follow_ups.py`).
   */
  follow_up: boolean;
  /** A receipt to review: its payment (Django `finance/receipt_tasks.py`). Today shows the receipt once. */
  receipt: number | null;
  /** S79: the meeting at the office this follow-up is; done once it starts, with `met` / `no_show`. */
  visit?: { id: number; starts_at: string; minutes?: number } | null;
}

/** A colleague's request to me. */
export interface TaskRequest {
  id: number;
  from: { name: string; role: string };
  created_at: string;
  text: string;
  person: TaskPerson | null;
  due_at: string;
  /** False: due some time that day (`due_at` is its 23:59), no hour set. Absent from an older Django. */
  timed?: boolean;
  status: TaskStatus;
  comments: number;
  reactions: Reaction[];
}

/** A task in a team queue I belong to. */
export interface QueueItem {
  id: number;
  team: TaskTeam | 'sales';
  automatic: boolean;
  text: string;
  person: TaskPerson | null;
  queued_at: string;
  /** Taken by me (it moved to my follow-ups), or by someone else. */
  taken: 'me' | 'other' | null;
}

export interface SentRequest {
  id: number;
  text: string;
  /** A team, or the first colleague it went to and how many more (old rows name dozens). */
  to: { name: string; others: number } | { team: TaskTeam };
  at: string;
  /** For several people: done once all are, in progress once anyone started. */
  status: TaskStatus;
  comments: number;
  reactions: Reaction[];
  /** Sent to several people: how many of them have done it. */
  progress: { done: number; total: number } | null;
}

export interface TasksOverview {
  /** Share of tasks done on time (0–1); null until the server measures it (T3). */
  /** `week`/`last_week`: 0–1, null while no task of that week is done or overdue. */
  on_time: { week: number | null; last_week: number | null; target: number } | null;
  /** Active people with no open next step: they get forgotten (T5). */
  orphans: { id: number; name: string }[];
  /** How many rows each list has (the tabs); the rows come a page at a time (`taskListQuery`). */
  counts: Record<TaskList, number>;
  tomorrow: number;
  /** Null until the server records when a task was done (T3). */
  done_today: number | null;
  sent: SentRequest[];
  colleagues: Colleague[];
}

export const tasksQuery = (panel: TasksPanel) =>
  queryOptions({
    queryKey: [...TASKS_KEY, panel],
    queryFn: ({ signal }) =>
      api<TasksOverview>(`${TASKS_API}/?panel=${encodeURIComponent(panel)}`, { signal }),
  });

/** The three lists of the tasks page, each paged on its own. */
export type TaskList = 'mine' | 'requests' | 'team';

export interface TaskListRow {
  /** Up to the end of today, oldest first. */
  mine: MyTask;
  /** Open requests to me, by due time. */
  requests: TaskRequest;
  /** My teams' queues, oldest first. */
  team: QueueItem;
}

/**
 * What the tasks page's address asks for: `?view=mine | requests | team` (the list it opens on) and
 * `?day=YYYY-MM-DD` (only what's due that day; the seller calendar's day row links here).
 */
export function tasksAddressOf(params: URLSearchParams): {
  view: TaskList;
  day: string | null;
  task: number | null;
} {
  const view = params.get('view');
  const day = params.get('day') ?? '';
  const task = Number(params.get('task'));
  return {
    view: view === 'requests' || view === 'team' ? view : 'mine',
    day: /^\d{4}-\d{2}-\d{2}$/.test(day) && parseValue(day) ? day : null,
    task: Number.isSafeInteger(task) && task > 0 ? task : null,
  };
}

/** The first page of the list the tasks page opens on (its route's data). */
export const openingTaskList = (panel: TasksPanel, url: string) => {
  const { view, day } = tasksAddressOf(new URL(url).searchParams);
  return taskListQuery(panel, view, 1, view === 'team' ? null : day);
};

/**
 * One list of the tasks page, a page at a time. `day` (`YYYY-MM-DD`): only my follow-ups or the
 * requests due that day, ahead or past (the team queue ignores it).
 */
export const taskListQuery = <L extends TaskList>(
  panel: TasksPanel,
  list: L,
  page: number,
  day: string | null = null,
) =>
  queryOptions({
    queryKey: [...TASKS_KEY, panel, 'list', list, page, day],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ panel, page: String(page) });
      if (day) query.set('day', day);
      return api<Page<TaskListRow[L]>>(`${TASKS_API}/lists/${list}/?${query.toString()}`, {
        signal,
      });
    },
    placeholderData: keepPreviousData,
  });

/**
 * A panel's own tasks page from before the shared one (`/sales/tasks?view=…`, old links and
 * bookmarks): the shared page (`/tasks`) on that panel's tasks, the same list, day and task.
 */
export function hubAddressFor(panel: TasksPanel, url: string) {
  const from = new URL(url).searchParams;
  const query = new URLSearchParams({ panel });
  for (const key of ['view', 'day', 'task']) {
    const value = from.get(key);
    if (value) query.set(key, value);
  }
  return `/tasks?${query.toString()}`;
}

/** How often the bell and the dock ask again while the tab is in view: a request can arrive any time. */
export const OPEN_TASKS_POLL = 60_000;

export interface TasksSummary {
  /** My follow-ups due by today and every open request to me (the bell). */
  waiting: number;
  /** What is due by the end of today, follow-ups and requests (the dock). */
  today: number;
  /** Of `today`, those past their time. */
  late: number;
}

/** The bell's and the dock's counts, from the server (the lists only send a page of rows). */
export const tasksSummaryQuery = queryOptions({
  queryKey: [...TASKS_KEY, 'summary'],
  queryFn: ({ signal }) => api<TasksSummary>(`${TASKS_API}/summary/`, { signal }),
});

/** What waits for me now (the bell and the dock): the counts and the first page of each list. */
export const openTaskQueries = (panel: TasksPanel) =>
  [
    tasksSummaryQuery,
    taskListQuery(panel, 'mine', 1),
    taskListQuery(panel, 'requests', 1),
  ] as const;

export interface RequestDetail extends TaskRequest {
  reactions: ReactionDetail[];
  /** Sent to several people: each one's copy and how far it got (empty for one person). */
  people: { name: string; status: TaskStatus }[];
  body: string;
  /** What the task is, and mine to do (`owner`), one I sent (`creator`) or another's (`viewer`). Absent from an older Django. */
  kind?: TaskKind;
  role?: 'owner' | 'creator' | 'viewer';
  watchers: string[];
  thread: { id: number; author: string; mine: boolean; at: string; text: string }[];
}

/** `met` / `no_show`: how a meeting at the office went (S79), only on its follow-up. */
export type TaskOutcome = 'talked' | 'no_answer' | 'messaged' | 'later' | 'met' | 'no_show';

export type TaskChange =
  | {
      kind: 'done';
      outcome: TaskOutcome;
      note: string;
      /** The next step; null closes the follow-up (with `end_reason`). */
      next: { text: string; due_at: string } | null;
      end_reason?: 'won' | 'lost' | 'finished';
    }
  | { kind: 'claim' }
  | { kind: 'status'; status: 'in_progress' | 'done' | 'rejected'; reason?: string }
  | { kind: 'comment'; text: string };

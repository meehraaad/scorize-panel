import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
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
 * decides whose ids `person` carries (User for sales, Applicant for supervisor).
 */

export const TASKS_KEY = ['tasks'] as const;
export const TASKS_API = '/staff/v1/tasks';

export type TasksPanel = 'sales' | 'supervisor';

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
  /** Who does it; null while it waits in a team queue. */
  owner: string | null;
  /** Who asked (a colleague, a manager, or the system for automatic follow-ups). */
  creator: string | null;
  team: TaskTeam | null;
  /** Created by the system (new lead, unanswered call, instalment due…). */
  automatic: boolean;
}

export interface Colleague {
  id: number;
  name: string;
  /** "Consultant of this customer", "Supervisor": localized by the server. */
  role: string;
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
  due_at: string;
}

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
  /** Null for an internal task about nobody. */
  person: { id: number; name: string; context: string; face?: Face | null } | null;
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
}

/** A colleague's request to me. */
export interface TaskRequest {
  id: number;
  from: { name: string; role: string };
  created_at: string;
  text: string;
  person: { id: number; name: string; face?: Face | null } | null;
  due_at: string;
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
  person: { id: number; name: string; face?: Face | null } | null;
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
export function tasksAddressOf(params: URLSearchParams): { view: TaskList; day: string | null } {
  const view = params.get('view');
  const day = params.get('day') ?? '';
  return {
    view: view === 'requests' || view === 'team' ? view : 'mine',
    day: /^\d{4}-\d{2}-\d{2}$/.test(day) && parseValue(day) ? day : null,
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

export interface RequestDetail extends TaskRequest {
  reactions: ReactionDetail[];
  /** Sent to several people: each one's copy and how far it got (empty for one person). */
  people: { name: string; status: TaskStatus }[];
  body: string;
  watchers: string[];
  thread: { id: number; author: string; mine: boolean; at: string; text: string }[];
}

export type TaskOutcome = 'talked' | 'no_answer' | 'messaged' | 'later';

export type TaskChange =
  | {
      kind: 'done';
      outcome: TaskOutcome;
      note: string;
      /** The next step; null closes the follow-up (with `end_reason`). */
      next: { text: string; due_at: string } | null;
      end_reason?: 'won' | 'lost' | 'finished';
    }
  | { kind: 'snooze'; until: string; reason: 'customer_later' | 'waiting' | 'no_time' }
  | { kind: 'claim' }
  | { kind: 'status'; status: 'in_progress' | 'done' | 'rejected'; reason?: string }
  | { kind: 'comment'; text: string };

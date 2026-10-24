import { queryOptions, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { changeTask, createTask, taskRequest, tasksOverview } from './django';

/**
 * Staff tasks (StaffToDo): one model, three behaviours (canvas "کارها"):
 * - `mine`: a follow-up I set for myself about a person; done → outcome + next step
 * - `request`: I ask a colleague; they see it, work on it, finish or refuse it
 * - `team`: sent to a team's queue; whoever takes it becomes its owner
 * Panel-neutral. The sales panel reads and writes Django's existing StaffToDo API (./django.ts);
 * the supervisor panel, whose people are Applicant ids, waits for the tasks endpoint
 * (backend-changes.md T1–T12, T11).
 */

export const TASKS_KEY = ['tasks'] as const;
export const TASKS_API = '/staff/v1/tasks';

export type TasksPanel = 'sales' | 'supervisor';
/** Which panels already run on Django's StaffToDo. */
const onDjango = (panel: TasksPanel) => panel === 'sales';

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
  /** With the time; a `date_only` task is due at the end of its day. */
  due_at: string;
  /** StaffToDo.deadline is a date (T1): show the day, not a time. */
  date_only?: boolean;
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
  /** `team`: the queue. */
  team?: TaskTeam;
  due_at: string;
}

/** Creates a task about a person. Refreshes the tasks pages and the `also` keys (the page it came from). */
export function useCreateTask(also: QueryKey, panel: TasksPanel) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) =>
      onDjango(panel) ? createTask(task) : api(`${TASKS_API}/`, { method: 'POST', body: task }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: TASKS_KEY }),
        client.invalidateQueries({ queryKey: also }),
      ]),
  });
}

// ── The tasks page ───────────────────────────────────────────────────────────────────────────

/** Where a follow-up came from: the system (new lead, unanswered call…), me, or a previous step. */
export type TaskSource = 'system' | 'me' | 'chain';

/** A follow-up I own about a person. */
export interface MyTask {
  id: number;
  text: string;
  due_at: string;
  date_only?: boolean;
  /** Null for an internal task about nobody. */
  person: { id: number; name: string; context: string } | null;
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
}

/** A colleague's request to me. */
export interface TaskRequest {
  id: number;
  from: { name: string; role: string };
  created_at: string;
  text: string;
  person: { id: number; name: string } | null;
  due_at: string;
  date_only?: boolean;
  status: TaskStatus;
  comments: number;
}

/** A task in a team queue I belong to. */
export interface QueueItem {
  id: number;
  team: TaskTeam | 'sales';
  automatic: boolean;
  text: string;
  person: { id: number; name: string } | null;
  queued_at: string;
  /** Taken by me (it moved to my follow-ups), or by someone else. */
  taken: 'me' | 'other' | null;
}

export interface SentRequest {
  id: number;
  text: string;
  /** A colleague's name, or a team. */
  to: { name: string } | { team: TaskTeam };
  at: string;
  status: TaskStatus;
}

export interface TasksOverview {
  /** Share of tasks done on time (0–1); null until the server measures it (T3). */
  on_time: { week: number; last_week: number; target: number } | null;
  /** Active people with no open next step: they get forgotten (T5). */
  orphans: { id: number; name: string }[];
  /** Up to the end of today, oldest first. */
  mine: MyTask[];
  tomorrow: number;
  /** Null until the server records when a task was done (T3). */
  done_today: number | null;
  requests: TaskRequest[];
  team: QueueItem[];
  sent: SentRequest[];
  colleagues: Colleague[];
}

export const tasksQuery = (panel: TasksPanel) =>
  queryOptions({
    queryKey: [...TASKS_KEY, panel],
    queryFn: ({ signal }) =>
      onDjango(panel)
        ? tasksOverview(signal)
        : api<TasksOverview>(`${TASKS_API}/?panel=${encodeURIComponent(panel)}`, { signal }),
  });

export interface RequestDetail extends TaskRequest {
  body: string;
  watchers: string[];
  thread: { id: number; author: string; mine: boolean; at: string; text: string }[];
}

export const requestQuery = (panel: TasksPanel, id: number) =>
  queryOptions({
    queryKey: [...TASKS_KEY, panel, 'request', id],
    queryFn: ({ signal }) =>
      onDjango(panel)
        ? taskRequest(id, signal)
        : api<RequestDetail>(`${TASKS_API}/${String(id)}/`, { signal }),
  });

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

const CHANGE_PATH: Record<TaskChange['kind'], string> = {
  done: 'done',
  snooze: 'snooze',
  claim: 'claim',
  status: 'status',
  comment: 'comments',
};

/** Everything done to a task from the tasks page (T3–T8). */
export function useTaskChange(panel: TasksPanel) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: TaskChange }) => {
      if (onDjango(panel)) return changeTask(id, change);
      const { kind, ...body } = change;
      return api(`${TASKS_API}/${String(id)}/${CHANGE_PATH[kind]}/`, { method: 'POST', body });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

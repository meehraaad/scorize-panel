import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Staff tasks (StaffToDo): one model, three behaviours (canvas "کارها"):
 * - `mine`: a follow-up I set for myself about a person; done → outcome + next step
 * - `request`: I ask a colleague; they see it, work on it, finish or refuse it
 * - `team`: sent to a team's queue; whoever takes it becomes its owner
 * Panel-neutral (the supervisor panel uses the same endpoint). Shapes: backend-changes.md T1–T12.
 */

export const TASKS_KEY = ['tasks'] as const;
export const TASKS_API = '/staff/v1/tasks';

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
  /** With the time (StaffToDo.deadline has none today: T1). */
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
  /** The person the task is about (User id). */
  user: number;
  text: string;
  kind: TaskKind;
  /** `request`: the colleague (SupportStaff id). */
  assignee?: number;
  /** `team`: the queue. */
  team?: TaskTeam;
  due_at: string;
}

/** Creates a task about a person. Refreshes the tasks pages and the `also` keys (the page it came from). */
export function useCreateTask(also: QueryKey) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) => api(`${TASKS_API}/`, { method: 'POST', body: task }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: TASKS_KEY }),
        client.invalidateQueries({ queryKey: also }),
      ]),
  });
}

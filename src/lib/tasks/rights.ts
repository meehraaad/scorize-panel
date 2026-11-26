import { hasPermission } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { taskPanelsOf, type TasksPanel } from './api';

/**
 * Who gives a panel's tasks to others (meeting0): its admin, as Django's `api/staff/v1/panels.py`
 * (`ADMIN_PERMISSION`) decides; the server checks it again on every task.
 */
const ADMIN_PERMISSION: Record<Exclude<TasksPanel, 'staff'>, string> = {
  sales: 'can_assign_to_seller',
  supervisor: 'can_assign_supervisor',
  executive: 'can_assign_supervisor',
  marketing: 'can_manage_marketing',
  hr: 'can_manage_support_staff',
};

/** Manages every panel's tasks (and the shared page's): superusers and task managers. */
const managesAll = (user: SessionUser) => hasPermission(user, 'can_manage_staff_todo');

/** May give `panel`'s tasks to a colleague or the whole team (anyone may add their own). */
export function canAssignTasks(user: SessionUser, panel: TasksPanel): boolean {
  if (managesAll(user)) return true;
  return (
    panel !== 'staff' &&
    taskPanelsOf(user).includes(panel) &&
    hasPermission(user, ADMIN_PERMISSION[panel])
  );
}

/** May mark a task late-counts-against-pay. */
export const canPenalize = (user: SessionUser) => hasPermission(user, 'can_define_todo_penalty');

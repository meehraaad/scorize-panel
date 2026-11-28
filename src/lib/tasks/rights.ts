import { hasPermission } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { taskPanelsOf, type TasksPanel } from './api';

/**
 * A panel's admin (meeting0), as Django's `api/staff/v1/panels.py` (`ADMIN_PERMISSION`) decides; the
 * server checks it again on every task. Anyone sends a task to any colleague, of any panel; only the
 * admin sends one to the panel's whole team or puts it on the team board.
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

/** May send `panel`'s tasks to its whole team (anyone sends one to a colleague). */
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

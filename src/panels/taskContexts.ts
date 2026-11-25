import { hrPath, personPath as staffFilePath } from '@/features/hr/paths';
import { marketingPath } from '@/features/marketing/paths';
import { customerPath, salesPath } from '@/features/sales/paths';
import { casePath, supervisorPath } from '@/features/supervisor/paths';
import { openContactLog } from '@/lib/sales/contactDrafts';
import type { TasksPanel } from '@/lib/tasks/api';
import { customerWorkspacePath } from './executive/customer/paths';
import type { TasksConfig } from '@/features/tasks/config';

/**
 * Each panel's tasks: who they are about and where those people's pages are. One list for the
 * panels' own tasks pages, the shared page (`/tasks`), the bell and the dock. `staff`: anyone's
 * tasks outside these panels; people are named, not linked (no page of theirs is open to them).
 */
export const TASK_CONTEXTS: Record<TasksPanel, TasksConfig> = {
  sales: {
    panel: 'sales',
    homePath: salesPath(),
    onContact: (id, name, action) =>
      openContactLog(id, name, { channel: action === 'message' ? 'whatsapp' : 'call' }),
    personPath: (id, action) => customerPath(id, action),
    person: 'customer',
  },
  supervisor: {
    panel: 'supervisor',
    homePath: supervisorPath(),
    // A case has no call log: every action opens the case file (its tickets for a message).
    personPath: (id, action) => casePath(id, action === 'message' ? 'tickets' : ''),
    person: 'applicant',
  },
  hr: {
    panel: 'hr',
    homePath: hrPath(),
    // A task about a staff member opens their file.
    personPath: (id) => staffFilePath(id),
    person: 'employee',
  },
  marketing: {
    panel: 'marketing',
    homePath: marketingPath(),
    // Marketing tasks are about content and colleagues, not customers: a task about a person opens
    // the tasks page itself.
    personPath: () => marketingPath('tasks'),
    person: 'employee',
  },
  executive: {
    panel: 'executive',
    homePath: '/executive',
    personPath: (id) => customerWorkspacePath(id),
    person: 'customer',
  },
  staff: { panel: 'staff', homePath: '/tasks', person: 'person' },
};

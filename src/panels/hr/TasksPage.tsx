import { hrPath, personPath } from '@/features/hr/paths';
import type { TasksConfig } from '@/features/tasks/config';
import { TasksPage } from '@/features/tasks/TasksPage';

const hrTasks: TasksConfig = {
  panel: 'hr',
  homePath: hrPath(),
  // A task about a staff member opens their file.
  personPath: (id) => personPath(id),
  person: 'employee',
};

/** /hr/tasks: HR's own tasks, colleagues' requests and the joining and leaving checklists' steps. */
export default function HrTasksPage() {
  return <TasksPage config={hrTasks} />;
}

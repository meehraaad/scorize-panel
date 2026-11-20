import { marketingPath } from '@/features/marketing/paths';
import type { TasksConfig } from '@/features/tasks/config';
import { TasksPage } from '@/features/tasks/TasksPage';

const marketingTasks: TasksConfig = {
  panel: 'marketing',
  homePath: marketingPath(),
  // Marketing tasks are about content and colleagues, not customers: a task about a person opens
  // the tasks page itself.
  personPath: () => marketingPath('tasks'),
  person: 'employee',
};

/** /marketing/tasks: my tasks, colleagues' requests and what I sent (the shared tasks page). */
export default function MarketingTasksPage() {
  return <TasksPage config={marketingTasks} />;
}

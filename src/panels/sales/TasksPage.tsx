import { customerPath, salesPath } from '@/features/sales/paths';
import type { TasksConfig } from '@/features/tasks/config';
import { TasksPage } from '@/features/tasks/TasksPage';

const salesTasks: TasksConfig = {
  panel: 'sales',
  homePath: salesPath(),
  personPath: (id, action) => customerPath(id, action),
  person: 'customer',
};

/** /sales/tasks: the seller's follow-ups, requests and team queue. */
export default function SalesTasksPage() {
  return <TasksPage config={salesTasks} />;
}

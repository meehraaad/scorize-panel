import { customerWorkspacePath } from './customer/paths';
import type { TasksConfig } from '@/features/tasks/config';
import { TasksPage } from '@/features/tasks/TasksPage';

const config: TasksConfig = {
  panel: 'executive',
  homePath: '/executive',
  personPath: (id) => customerWorkspacePath(id),
  person: 'customer',
};

export default function ExecutiveTasksPage() {
  return <TasksPage config={config} />;
}

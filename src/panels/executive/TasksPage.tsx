import { workPath } from '@/features/executive/api';
import type { TasksConfig } from '@/features/tasks/config';
import { TasksPage } from '@/features/tasks/TasksPage';

const config: TasksConfig = {
  panel: 'executive',
  homePath: '/executive',
  personPath: (id) => workPath(new URLSearchParams({ customer: String(id) })),
  person: 'customer',
};

export default function ExecutiveTasksPage() {
  return <TasksPage config={config} />;
}

import { TasksPage } from '@/features/tasks/TasksPage';
import { TASK_CONTEXTS } from '../taskContexts';

/** /sales/tasks: this panel's follow-ups, colleagues' requests and team queues. */
export default function SalesTasksPage() {
  return <TasksPage config={TASK_CONTEXTS.sales} />;
}

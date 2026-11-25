import { TasksPage } from '@/features/tasks/TasksPage';
import { TASK_CONTEXTS } from '../taskContexts';

/** /hr/tasks: this panel's follow-ups, colleagues' requests and team queues. */
export default function HrTasksPage() {
  return <TasksPage config={TASK_CONTEXTS.hr} />;
}

import { TasksPage } from '@/features/tasks/TasksPage';
import { TASK_CONTEXTS } from '../taskContexts';

/** /supervisor/tasks: this panel's follow-ups, colleagues' requests and team queues. */
export default function SupervisorTasksPage() {
  return <TasksPage config={TASK_CONTEXTS.supervisor} />;
}

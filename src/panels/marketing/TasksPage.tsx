import { TasksPage } from '@/features/tasks/TasksPage';
import { TASK_CONTEXTS } from '../taskContexts';

/** /marketing/tasks: this panel's follow-ups, colleagues' requests and team queues. */
export default function MarketingTasksPage() {
  return <TasksPage config={TASK_CONTEXTS.marketing} />;
}

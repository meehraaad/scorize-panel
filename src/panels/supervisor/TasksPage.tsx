import { casePath, supervisorPath } from '@/features/supervisor/paths';
import type { TasksConfig } from '@/features/tasks/config';
import { TasksPage } from '@/features/tasks/TasksPage';

const supervisorTasks: TasksConfig = {
  panel: 'supervisor',
  homePath: supervisorPath(),
  // A case has no call log: every action opens the case file (its tickets for a message).
  personPath: (id, action) => casePath(id, action === 'message' ? 'tickets' : ''),
  person: 'applicant',
};

/** /supervisor/tasks: the supervisor's follow-ups, colleagues' requests and team queues. */
export default function SupervisorTasksPage() {
  return <TasksPage config={supervisorTasks} />;
}

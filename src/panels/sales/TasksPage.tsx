import { openContactLog } from '@/lib/sales/contactDrafts';
import { customerPath, salesPath } from '@/features/sales/paths';
import type { TasksConfig } from '@/features/tasks/config';
import { TasksPage } from '@/features/tasks/TasksPage';

const salesTasks: TasksConfig = {
  panel: 'sales',
  homePath: salesPath(),
  onContact: (id, name, action) =>
    openContactLog(id, name, { channel: action === 'message' ? 'whatsapp' : 'call' }),
  personPath: (id, action) => customerPath(id, action),
  person: 'customer',
};

/** /sales/tasks: the seller's follow-ups, requests and team queue. */
export default function SalesTasksPage() {
  return <TasksPage config={salesTasks} />;
}

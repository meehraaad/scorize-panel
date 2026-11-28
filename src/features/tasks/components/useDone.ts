import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MyTask } from '@/lib/tasks/api';
import { useTaskChange } from '@/lib/tasks/changes';
import { toast } from '@/lib/toast';

/**
 * Doing a task from a list: one about a person asks its outcome and next step (`DoneDialog`); one
 * about no one (a marketing card's step, a joining checklist's) is simply done, at once.
 */
export function useDone() {
  const { t } = useTranslation('tasks');
  const change = useTaskChange();
  const [done, setDone] = useState<MyTask | null>(null);
  const finish = (task: MyTask) => {
    if (task.person) {
      setDone(task);
      return;
    }
    change.mutate(
      { id: task.id, change: { kind: 'status', status: 'done' } },
      { onError: () => toast.error(t('error')) },
    );
  };
  return { done, finish, close: () => setDone(null) };
}

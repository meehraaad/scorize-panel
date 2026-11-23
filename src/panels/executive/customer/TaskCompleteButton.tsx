import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useTaskChange } from '@/lib/tasks/changes';
import { toast } from '@/lib/toast';
import { useRefreshCustomerWorkspace, type CustomerTask, type CustomerWorkspace } from './api';

export function TaskCompleteButton({
  workspace,
  task,
  onHero = false,
}: {
  workspace: CustomerWorkspace;
  task: CustomerTask;
  onHero?: boolean;
}) {
  const { t } = useTranslation('executive');
  const change = useTaskChange();
  const refresh = useRefreshCustomerWorkspace(workspace.id, workspace.case?.id);

  if (!task.can_complete) return null;
  return (
    <Button
      variant={onHero ? 'outline' : 'quiet'}
      disabled={change.isPending}
      onClick={() =>
        change.mutate(
          { id: task.id, change: { kind: 'status', status: 'done' } },
          {
            onSuccess: () => {
              refresh();
              toast.success(t('workspace.taskCompleted'));
            },
            onError: () => toast.error(t('workspace.saveError')),
          },
        )
      }
    >
      {t('workspace.completeTask')}
    </Button>
  );
}

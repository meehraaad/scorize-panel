import { Suspense } from 'react';
import { NewTaskDialog as Composer } from '@/components/tasks/NewTask';
import { caseKey } from '../api';

/**
 * A task about this applicant: the shared composer (meeting0: «از تقویم», day only, and for the
 * panel's admin a colleague), refreshing the case when saved. Its `tasks` words load with it.
 */
export function NewTaskDialog({
  caseId,
  user,
  name,
  open,
  onClose,
  panel = 'supervisor',
}: {
  caseId: number;
  user: number;
  name: string;
  open: boolean;
  onClose: () => void;
  /** Whose task it is: the supervisor panel's, or the executive panel's (its customer pages). */
  panel?: 'supervisor' | 'executive';
}) {
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Composer
        open
        panel={panel}
        about={{ id: user, name }}
        also={caseKey(caseId)}
        onClose={onClose}
      />
    </Suspense>
  );
}

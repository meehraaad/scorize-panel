import type { ChipTone } from '@/components/ui/Chip';
import type { TaskStatus } from '@/lib/tasks/api';

/** A request's status as a chip colour. */
export const STATUS_TONE: Record<TaskStatus, ChipTone> = {
  open: 'primary',
  sent: 'primary',
  seen: 'neutral',
  in_progress: 'info',
  done: 'good',
  rejected: 'danger',
  queued: 'info',
};

import type { ChipTone } from '@/components/ui/Chip';
import type { DayStatus } from './api';

export const STATUS_TONE: Record<DayStatus, ChipTone> = {
  present: 'good',
  late: 'warn',
  absent: 'danger',
  pending: 'neutral',
};

/** "8:25" from seconds, digits left to the caller's `digits()`. */
export function clockOf(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60))}:${String(minutes % 60).padStart(2, '0')}`;
}

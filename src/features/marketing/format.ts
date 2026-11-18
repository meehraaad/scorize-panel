import type { ChipTone } from '@/components/ui/Chip';
import type { DayStatus, MarketingEventKind } from './api';

export const STATUS_TONE: Record<DayStatus, ChipTone> = {
  present: 'good',
  late: 'warn',
  absent: 'danger',
  pending: 'neutral',
};

export const EVENT_COLOR: Record<MarketingEventKind, string> = {
  campaign_start: 'var(--cal-2)',
  campaign_end: 'var(--cal-6)',
};

/** "8:25" from seconds, for the caller's `digits()`. */
export function clockOf(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60))}:${String(minutes % 60).padStart(2, '0')}`;
}

import type { MarketingEventKind } from './api';

export const EVENT_COLOR: Record<MarketingEventKind, string> = {
  campaign_start: 'var(--cal-2)',
  campaign_end: 'var(--cal-6)',
};

export { STATUS_TONE, clockOf } from '@/lib/attendance';

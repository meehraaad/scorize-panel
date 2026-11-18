import type { ChipTone } from '@/components/ui/Chip';
import type { MarketingEventKind } from './api';
import type { StageColor } from './boardApi';

export const EVENT_COLOR: Record<MarketingEventKind, string> = {
  campaign_start: 'var(--cal-2)',
  campaign_end: 'var(--cal-6)',
  publish: 'var(--cal-3)',
};

export { STATUS_TONE, clockOf } from '@/lib/attendance';

/** A stage's dot and a type's chip, from its colour. */
export const STAGE_DOT: Record<StageColor, string> = {
  gray: 'bg-neutral',
  blue: 'bg-info',
  amber: 'bg-warn',
  plum: 'bg-primary',
  green: 'bg-good',
  ink: 'bg-text',
};

export const TYPE_TONE: Record<StageColor, ChipTone> = {
  gray: 'neutral',
  blue: 'info',
  amber: 'warn',
  plum: 'primary',
  green: 'good',
  ink: 'neutral',
};

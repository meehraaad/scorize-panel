import type { ChipTone } from '@/components/ui/Chip';
import type { DisputeStatus } from './api';

/** The chip colour of an objection's state (HR's «نتیجه‌ها» and «من»). */
export const DISPUTE_TONES: Record<DisputeStatus, ChipTone> = {
  open: 'warn',
  accepted: 'good',
  rejected: 'neutral',
};

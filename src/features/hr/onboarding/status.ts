import type { ChipTone } from '@/components/ui/Chip';
import type { OnboardingStatus } from './api';

/** A form's status chip colour, the same on the hire's page and HR's file. */
export const STATUS_TONE: Record<OnboardingStatus, ChipTone> = {
  draft: 'neutral',
  returned: 'warn',
  submitted: 'info',
  approved: 'good',
  cancelled: 'neutral',
};

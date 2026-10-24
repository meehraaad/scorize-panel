import type { ChipTone } from '@/components/ui/Chip';
import type { Application, ApplicationResult, FeePayment } from './api';

/** The filter tabs, in order. */
export const GROUPS = ['all', 'awaiting', 'inReview', 'accepted', 'rejected'] as const;
export type Group = (typeof GROUPS)[number];

/** Which tab an application belongs to (besides "all"). */
export function groupOf(item: Application): Exclude<Group, 'all'> {
  if (item.approval === 'pending') return 'awaiting';
  if (item.approval === 'rejected' || item.result === 'rejected') return 'rejected';
  if (item.result === 'accepted') return 'accepted';
  return 'inReview';
}

export function isGroup(value: string | null): value is Group {
  return GROUPS.includes(value as Group);
}

export const RESULT_TONE: Record<ApplicationResult, ChipTone> = {
  accepted: 'good',
  rejected: 'danger',
  pending: 'info',
  submitted: 'info',
  waiting_for_portal: 'neutral',
  completed: 'neutral',
  incomplete_documents: 'warn',
  waiting_for_recommendation: 'warn',
};

export const PAYMENT_TONE: Record<FeePayment, ChipTone> = {
  pending: 'warn',
  paid: 'good',
  waived: 'neutral',
};

/** A deadline this close is shown in the urgent colour (same as the home page). */
export const URGENT_DAYS = 21;

/** Applications per page of the list. */
export const PAGE_SIZE = 10;

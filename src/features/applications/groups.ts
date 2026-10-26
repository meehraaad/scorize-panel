import type { ChipTone } from '@/components/ui/Chip';
import type { Application, ApplicationResult, FeePayment } from './api';

/**
 * The three columns of approved applications. Django's eight result statuses (set by the
 * supervisor) sort into them; each card keeps its exact status.
 */
export const LANES = ['preparing', 'sent', 'decided'] as const;
export type Lane = (typeof LANES)[number];

/** What the page does with an application: ask for approval, show it in a column, or tuck it away. */
export type Place = 'awaiting' | Lane | 'declined';

export function placeOf(item: Application): Place {
  if (item.approval === 'pending') return 'awaiting';
  if (item.approval === 'rejected') return 'declined';
  if (item.result === 'accepted' || item.result === 'rejected') return 'decided';
  if (item.result === 'submitted') return 'sent';
  return 'preparing';
}

/** Applications in one place, nearest deadline first (no deadline last). */
export function inPlace(items: Application[], place: Place): Application[] {
  const at = (item: Application) =>
    item.deadline === null ? Number.POSITIVE_INFINITY : Date.parse(item.deadline);
  return items.filter((item) => placeOf(item) === place).sort((a, b) => at(a) - at(b));
}

/** An admission whose "show it on the site?" question is still open. */
export const isNewAdmission = (item: Application) =>
  item.result === 'accepted' && item.approval === 'approved' && item.showcase === null;

export const RESULT_TONE: Record<ApplicationResult, ChipTone> = {
  accepted: 'good',
  rejected: 'danger',
  pending: 'info',
  submitted: 'info',
  waiting_for_portal: 'neutral',
  completed: 'neutral',
  incomplete_documents: 'danger',
  waiting_for_recommendation: 'warn',
};

export const PAYMENT_TONE: Record<FeePayment, ChipTone> = {
  pending: 'warn',
  paid: 'good',
  waived: 'neutral',
};

/** A deadline this close is shown in the urgent colour (same as the home page). */
export const URGENT_DAYS = 21;

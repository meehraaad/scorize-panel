import { fromLocalInput, quickWhen } from '@/lib/when';

/** Quick follow-up times; any other is a pick on the seller's week (`other`). */
export const FOLLOWS = ['evening', 'tomorrow', 'three'] as const;
export type Follow = (typeof FOLLOWS)[number] | 'week' | 'other';

/** A picked day with no hour (`YYYY-MM-DD`); a picked time is `YYYY-MM-DDTHH:mm`. */
export function isDayOnly(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/** The time a choice stands for: a quick one from now, `other` the picked `date` (null for a day). */
export function followAtOf(follow: Follow, date: string): string | null {
  if (follow !== 'other') return quickWhen(follow).toISOString();
  return isDayOnly(date) ? null : fromLocalInput(date);
}

/** The day of a follow-up with no hour (`other` with only a day picked); null otherwise. */
export function followOnOf(follow: Follow, date: string): string | null {
  return follow === 'other' && isDayOnly(date) ? date : null;
}

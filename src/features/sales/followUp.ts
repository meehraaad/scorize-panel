import { fromLocalInput, quickWhen } from '@/lib/when';

/** Quick follow-up times; any other is a pick on the seller's week (`other`). */
export const FOLLOWS = ['evening', 'tomorrow', 'three'] as const;
export type Follow = (typeof FOLLOWS)[number] | 'week' | 'other';

/** The time a choice stands for: a quick one from now, `other` the picked `date`. */
export function followAtOf(follow: Follow, date: string): string | null {
  return follow === 'other' ? fromLocalInput(date) : quickWhen(follow).toISOString();
}

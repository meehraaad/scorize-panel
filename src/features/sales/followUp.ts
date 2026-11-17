import { parseValue } from '@/lib/calendar';
import { fromLocalInput, quickWhen } from '@/lib/when';

/** Quick follow-up times; any other is a pick on the seller's week (`other`). */
export const FOLLOWS = ['evening', 'tomorrow', 'three', 'week'] as const;
export type Follow = (typeof FOLLOWS)[number] | 'other';

/**
 * A follow-up for a day with no hour is due at that day's 23:59: Django reads that time as
 * "no hour" (`api.sales.v1.calendar.untimed`) and lists it on the day, not at an hour.
 */
export function endOfDay(day: Date) {
  const date = new Date(day);
  date.setHours(23, 59, 0, 0);
  return date;
}

/**
 * The time a choice stands for: a quick one from now, `other` the picked `date`. With `dateOnly`
 * the same day with no hour (its 23:59); the quick «امروز عصر» is then simply today.
 */
export function followAtOf(follow: Follow, date: string, dateOnly = false): string | null {
  if (!dateOnly) return follow === 'other' ? fromLocalInput(date) : quickWhen(follow).toISOString();
  const day =
    follow === 'other' ? parseValue(date) : follow === 'evening' ? new Date() : quickWhen(follow);
  return day ? endOfDay(day).toISOString() : null;
}

/**
 * The customer's lead a follow-up can be set on: an open one (Django refuses a won or lost lead's:
 * `no_open_lead`); undefined when there is none, so the follow-up tab isn't offered.
 */
export const openLead = (customer: { lead: { id: number; stage: string } | null }) =>
  customer.lead && customer.lead.stage !== 'won' && customer.lead.stage !== 'lost'
    ? customer.lead.id
    : undefined;

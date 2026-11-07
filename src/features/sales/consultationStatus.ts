import type { CalendarCall, CalendarConsultation } from './api';

/** A consultation's state on the calendar and Today: logged, waiting for its log, on, soon, ahead. */

export const MINUTE = 60_000;
const SOON_MINUTES = 30;
/** Follow-up calls get a block this long. */
export const CALL_MINUTES = 15;
/** Consultation types without a length get this. */
export const DEFAULT_MINUTES = 30;
export type Status = 'done' | 'need' | 'live' | 'soon' | 'upcoming';

export const statusOf = (item: CalendarConsultation, now: number): Status => {
  const start = new Date(item.starts_at).getTime();
  const end = start + (item.minutes ?? DEFAULT_MINUTES) * MINUTE;
  if (end <= now) return item.logged ? 'done' : 'need';
  if (start <= now) return 'live';
  return start - now <= SOON_MINUTES * MINUTE ? 'soon' : 'upcoming';
};

export type Chosen =
  { kind: 'consultation'; item: CalendarConsultation } | { kind: 'call'; item: CalendarCall };

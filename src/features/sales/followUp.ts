import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import type { TaskSummary } from '@/lib/tasks/api';
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

/**
 * The customer's meeting at the office still to come that is their follow-up (S79): the meeting is
 * the next step then, so no other follow-up time is asked for. Null without one, or while Django
 * doesn't link them (`visitFollowUp`).
 */
export function meetingAhead(
  customer: { tasks: readonly TaskSummary[]; lead: { visit_at?: string | null } | null },
  now = Date.now(),
): string | null {
  if (!ON_SERVER.visitFollowUp) return null;
  // The lead names it whoever's task it is (a sales manager's page); the tasks, a customer with none.
  const at =
    customer.lead?.visit_at ??
    customer.tasks.find((task) => task.visit && new Date(task.visit.starts_at).getTime() > now)
      ?.visit?.starts_at ??
    null;
  return at !== null && new Date(at).getTime() > now ? at : null;
}

/** Django refused because a meeting at the office is the follow-up (409 `visit`, S79). */
export function isVisitConflict(error: unknown): boolean {
  return error instanceof ApiError && (error.body as { code?: unknown } | null)?.code === 'visit';
}

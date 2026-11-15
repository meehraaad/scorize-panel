import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import type { TaskSummary } from '@/lib/tasks/api';
import { fromLocalInput, quickWhen } from '@/lib/when';

/** Quick follow-up times; any other is a pick on the seller's week (`other`). */
export const FOLLOWS = ['evening', 'tomorrow', 'three'] as const;
export type Follow = (typeof FOLLOWS)[number] | 'week' | 'other';

/** The time a choice stands for: a quick one from now, `other` the picked `date`. */
export function followAtOf(follow: Follow, date: string): string | null {
  return follow === 'other' ? fromLocalInput(date) : quickWhen(follow).toISOString();
}

/**
 * The customer's meeting at the office still to come that is their follow-up (S79): the meeting is
 * the next step then, so no other follow-up time is asked for. Null without one, or while Django
 * doesn't link them (`visitFollowUp`).
 */
export function meetingAhead(tasks: readonly TaskSummary[], now = Date.now()): string | null {
  if (!ON_SERVER.visitFollowUp) return null;
  const visit = tasks.find(
    (task) => task.visit && new Date(task.visit.starts_at).getTime() > now,
  )?.visit;
  return visit?.starts_at ?? null;
}

/** Django refused because a meeting at the office is the follow-up (409 `visit`, S79). */
export function isVisitConflict(error: unknown): boolean {
  return error instanceof ApiError && (error.body as { code?: unknown } | null)?.code === 'visit';
}

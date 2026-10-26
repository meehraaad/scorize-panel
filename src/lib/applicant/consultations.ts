import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';

/**
 * Booked consultations: the list, read by the consultations page and the new-user home (its next
 * session). Any account (booking doesn't need a contract). Shape: docs/backend-changes.md H39.
 */

export interface Consultation {
  id: number;
  title: string;
  starts_at: string;
  minutes: number;
  mode: 'online' | 'in_person';
  consultant: string | null;
  /** What the session is about, written by staff. */
  summary: string | null;
  /** The applicant has filled the session information (shown before upcoming sessions). */
  info_complete: boolean;
}

export const CONSULTATIONS_KEY = [...APPLICANT_KEY, 'consultations'] as const;

export const consultationsQuery = queryOptions({
  queryKey: CONSULTATIONS_KEY,
  queryFn: ({ signal }) =>
    api<{ results: Consultation[] }>('/applicant/v1/consultations/', { signal }),
  staleTime: 60_000,
});

/** Upcoming sessions first (soonest first), then past ones (latest first). */
export function splitSessions(results: Consultation[], now = Date.now()) {
  const time = (item: Consultation) => new Date(item.starts_at).getTime();
  const upcoming = results.filter((item) => time(item) >= now).sort((a, b) => time(a) - time(b));
  const past = results.filter((item) => time(item) < now).sort((a, b) => time(b) - time(a));
  return { upcoming, past };
}

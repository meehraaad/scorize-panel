import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';

/**
 * Booked consultations: the list, read by the consultations page and the new-user home (its next
 * session, or the survey after the last one). Any account (booking doesn't need a contract).
 * Shapes: docs/backend-changes.md H39, H62.
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
  /** The survey after the session (H62): null until answered. */
  feedback: ConsultationFeedback | null;
}

export const FEEDBACK_CLEAR = ['yes', 'partly', 'no'] as const;
export const FEEDBACK_NEXT = ['contract', 'think', 'cost', 'compare'] as const;

export interface ConsultationFeedbackAnswer {
  /** The consultant, 1 to 5. */
  rating: number;
  clear: (typeof FEEDBACK_CLEAR)[number];
  next: (typeof FEEDBACK_NEXT)[number];
  comment: string;
}

export interface ConsultationFeedback extends ConsultationFeedbackAnswer {
  created_at: string;
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

/** How long after a session its survey stays on the new-user home. */
const RECENT_MS = 30 * 86_400_000;

/** The last session held within a month, when none is booked ahead: its survey is due. */
export function recentSession(results: Consultation[], now = Date.now()) {
  const { upcoming, past } = splitSessions(results, now);
  if (upcoming.length) return undefined;
  return past.find((item) => now - new Date(item.starts_at).getTime() < RECENT_MS);
}

/** The survey after a session: once, and the seller hears of it (Django makes or tells a lead). */
export function useSendFeedback(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answer: ConsultationFeedbackAnswer) =>
      api<ConsultationFeedback>(`/applicant/v1/consultations/${String(id)}/feedback/`, {
        method: 'POST',
        body: answer,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: CONSULTATIONS_KEY }),
  });
}

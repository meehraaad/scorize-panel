import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';

/**
 * Booked consultations: the list, read by the home (the next session, the survey after the last
 * one, every session) and the services page. What the home does to one is in ./consultationActions. Any account (booking doesn't need a contract).
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

export interface ConsultationFeedbackAnswer {
  /** The consultant, 1 to 5. */
  rating: number;
  clear: 'yes' | 'partly' | 'no';
  next: 'contract' | 'think' | 'cost' | 'compare';
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

/** The query parameter that opens a session's details over the home (`/?session=41`). */
export const SESSION_PARAM = 'session';

/** Where a session's details open: over the home, which lists every session. */
export const sessionHref = (id: number) => `/?${SESSION_PARAM}=${String(id)}`;

/** Upcoming sessions first (soonest first), then past ones (latest first). */
export function splitSessions(results: Consultation[], now = Date.now()) {
  const time = (item: Consultation) => new Date(item.starts_at).getTime();
  const upcoming = results.filter((item) => time(item) >= now).sort((a, b) => time(a) - time(b));
  const past = results.filter((item) => time(item) < now).sort((a, b) => time(b) - time(a));
  return { upcoming, past };
}

/** How long after a session its survey stays on the new-user home. */
const RECENT_MS = 30 * 86_400_000;

/**
 * The last session, once it has ended and for a month after, when none is booked ahead: its survey is due.
 * Django texts the link as it ends (H62), so the card is there when the person opens it.
 */
export function recentSession(results: Consultation[], now = Date.now()) {
  const { upcoming, past } = splitSessions(results, now);
  const last = past[0];
  if (upcoming.length || !last) return undefined;
  const ended = now - (new Date(last.starts_at).getTime() + last.minutes * 60_000);
  return ended >= 0 && ended < RECENT_MS ? last : undefined;
}

export interface SessionSummary {
  id: number;
  at: string;
  kind: string;
  customer_summary: string;
  reservation: number | null;
  authors: string[];
}

interface SessionSummaryPage {
  results: SessionSummary[];
  has_more: boolean;
}

/**
 * Shared contact/session advice, including leads without a booking or a contract: read by the
 * consultations pages and the contract tab without a contract.
 */
export const sessionSummariesQuery = (reservation?: number) =>
  infiniteQueryOptions({
    queryKey: [...CONSULTATIONS_KEY, 'session-summaries', reservation ?? null],
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam !== null) params.set('before', String(pageParam));
      if (reservation !== undefined) params.set('reservation', String(reservation));
      return api<SessionSummaryPage>(`/applicant/v1/session-summaries/?${params.toString()}`, {
        signal,
      });
    },
    initialPageParam: null as number | null,
    getNextPageParam: (page) => (page.has_more ? page.results.at(-1)?.id : undefined),
    staleTime: 30_000,
  });

/** One session with what the consultant reads beforehand and its invoice (H39–H41). */
export interface ConsultationInfo {
  university: string;
  major: string;
  degree: string;
  notes: string;
}

export interface ConsultationDetail extends Consultation {
  info: ConsultationInfo;
  invoice: { amount: number; paid_at: string | null; payment_id: number | null };
}

/** One session; null when it isn't the user's (or doesn't exist). */
export const consultationQuery = (id: number) =>
  queryOptions({
    queryKey: [...CONSULTATIONS_KEY, id],
    queryFn: async ({ signal }): Promise<ConsultationDetail | null> => {
      try {
        return await api<ConsultationDetail>(`/applicant/v1/consultations/${String(id)}/`, {
          signal,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });

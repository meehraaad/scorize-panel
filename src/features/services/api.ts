import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';

/**
 * "Other services" (canvas V6 section 9): the wallet, the next webinar, the applicant's packages,
 * consultations and events, and the GPA calculator. Open to every account, with or without a
 * contract. Shapes: docs/backend-changes.md H36–H38 (detail pages: H42–H44).
 */

export interface Webinar {
  id: number;
  title: string;
  starts_at: string;
  /** Seats left; null when unlimited. */
  seats_left: number | null;
  /** Toman; 0 for a free webinar. */
  price: number;
  /** The early price ends then (the countdown); null without one. */
  discount_ends_at: string | null;
  registered: boolean;
}

export interface Package {
  id: number;
  /** A short tag on the thumbnail ("TOEFL", "WEB"). */
  tag: string;
  name: string;
  /** Written by the server: progress or purchase date. */
  meta: string;
  /** Where to watch or use it (main site). */
  url: string;
}

export interface Offer {
  name: string;
  /** Toman. */
  price: number;
  old_price: number | null;
  /** Written by the server ("30% off until 10 Aban"). */
  label: string;
  url: string;
}

export interface Consultation {
  id: number;
  title: string;
  starts_at: string;
}

export interface ServiceEvent {
  id: number;
  title: string;
  starts_at: string;
  online: boolean;
  /** `upcoming`: join link once it opens; `held`: its video, when published. */
  status: 'upcoming' | 'held';
  join_url: string | null;
  video_url: string | null;
  /** The event's page (main site). */
  url: string;
}

export interface GpaCourse {
  name: string;
  credits: number;
  /** Out of 20. */
  grade: number;
}

export interface ServicesData {
  /** Wallet credit, toman. */
  credit: number;
  webinar: Webinar | null;
  packages: Package[];
  offer: Offer | null;
  consultations: { upcoming: Consultation[]; total: number };
  events: ServiceEvent[];
  gpa: { courses: GpaCourse[]; result: number | null };
}

const BASE = '/applicant/v1/services';

export const servicesQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'services'],
  queryFn: ({ signal }) => api<ServicesData>(`${BASE}/`, { signal }),
  staleTime: 60_000,
});

/**
 * Registers for a webinar. Free: registered at once (`payment_id` null). Paid: an invoice to pay
 * on the payment page.
 */
export function useRegisterWebinar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ payment_id: number | null }>(`${BASE}/webinars/${String(id)}/register/`, {
        method: 'POST',
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

/** Saves the courses; the server computes the GPA (the method universities use, out of 4). */
export function useSaveGpa() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (courses: GpaCourse[]) =>
      api<{ result: number }>(`${BASE}/gpa/`, { method: 'PUT', body: { courses } }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...APPLICANT_KEY, 'services'] }),
  });
}

export interface Lesson {
  id: number;
  title: string;
  minutes: number;
  /** Opens the lesson in the secure player (SpotPlayer) with the user's licence. */
  url: string;
}

export interface PackageDetail {
  id: number;
  tag: string;
  name: string;
  description: string;
  lessons: Lesson[];
  /** Where the user left off; null before the first lesson. */
  current_lesson: number | null;
  review: { text: string; submitted_at: string } | null;
  /** Toman of wallet credit for a review; null when the offer isn't running. */
  review_credit: number | null;
}

export interface EventDetail {
  id: number;
  kind: 'webinar' | 'event';
  title: string;
  starts_at: string;
  online: boolean;
  /** For in-person events. */
  location: string | null;
  description: string;
  registered: boolean;
  /** Set once the room opens (shortly before it starts). */
  join_url: string | null;
  /** Set once the recording is published. */
  video_url: string | null;
  invoice: { amount: number; paid_at: string | null } | null;
}

const orNull = async <T>(load: () => Promise<T>): Promise<T | null> => {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

export const packageQuery = (id: number) =>
  queryOptions({
    queryKey: [...APPLICANT_KEY, 'services', 'package', id],
    queryFn: ({ signal }) =>
      orNull(() => api<PackageDetail>(`${BASE}/packages/${String(id)}/`, { signal })),
    staleTime: 60_000,
  });

export const eventQuery = (id: number) =>
  queryOptions({
    queryKey: [...APPLICANT_KEY, 'services', 'event', id],
    queryFn: ({ signal }) =>
      orNull(() => api<EventDetail>(`${BASE}/events/${String(id)}/`, { signal })),
    staleTime: 60_000,
  });

export function useReviewPackage(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api(`${BASE}/packages/${String(id)}/review/`, { method: 'POST', body: { text } }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...APPLICANT_KEY, 'services'] }),
  });
}

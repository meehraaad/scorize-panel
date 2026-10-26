import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { ON_SERVER } from '@/lib/applicant/onServer';

/**
 * The writing the new user's documents tab offers next to the documents to send (no contract):
 * each service's price, the person's own order of it, a customer's voice or video about it, and
 * recent admissions. A form opens before paying; its final submit asks for the payment.
 * Shapes: docs/backend-changes.md H66.
 */

export const OFFERED_KINDS = ['sop', 'cv', 'recommendation'] as const;
export type OfferedKind = (typeof OFFERED_KINDS)[number];

export interface WritingOffer {
  kind: OfferedKind;
  /** Toman, with a running discount applied. */
  price: number;
  /** The price before the discount, while one runs. */
  old_price: number | null;
  discount_ends_at: string | null;
  /** The person's own order of this service: paid or not yet, and where its writing is. */
  order: { paid: boolean; step: 'form' | 'writing' | 'ready' } | null;
  /** A customer's voice or video about this service (the name is theirs). */
  testimonial: {
    name: string;
    audio: string | null;
    video: string | null;
    poster: string | null;
  } | null;
}

export interface AdmissionSample {
  id: number;
  university: string;
  field: string | null;
  degree: 'high_school' | 'bachelor' | 'master' | 'phd' | null;
  ielts: number | null;
  toefl: number | null;
  gpa: number | null;
  date: string | null;
}

export interface WritingOffers {
  /** The contract has writing: every service is in it, none is offered. */
  included: boolean;
  offers: WritingOffer[];
  samples: AdmissionSample[];
}

const NONE: WritingOffers = { included: false, offers: [], samples: [] };
const OFFERS_KEY = [...APPLICANT_KEY, 'writing-offers'] as const;

export const writingOffersQuery = queryOptions({
  queryKey: OFFERS_KEY,
  queryFn: ({ signal }) =>
    ON_SERVER.writingOffers
      ? api<WritingOffers>('/applicant/v1/writing-offers/', { signal })
      : Promise.resolve(NONE),
  staleTime: 5 * 60_000,
});

/** Opens a writing form before paying (Django makes the order and tells a seller). */
export function useStartWriting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (kind: OfferedKind) =>
      api(`/applicant/v1/writing/${kind}/start/`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

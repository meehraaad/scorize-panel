import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { uploadFile, type UploadMessages } from '@/lib/upload';

/**
 * The new-user dashboard's steps toward a contract (any account, contract or not): files sent for
 * a free review of the case, and the background the consultant reads before a session (the
 * office's tablet form). Shapes: docs/backend-changes.md H59, H60.
 */

export const REVIEW_KINDS = [
  'transcript',
  'cv',
  'language',
  'passport',
  'degree',
  'sop',
  'recommendation',
  'other',
] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

/** What the free review takes (Django checks again, from the content). */
export const REVIEW_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const REVIEW_MAX_BYTES = 10 * 1024 * 1024;
/** Django answers 409 past this many files. */
export const MAX_REVIEW_DOCUMENTS = 20;

export interface ReviewDocument {
  id: number;
  kind: ReviewKind;
  url: string;
  /** File extension in capitals: PDF, JPG. */
  ext: string;
  uploaded_at: string;
}

const BASE = '/applicant/v1';
const REVIEW_KEY = [...APPLICANT_KEY, 'review-documents'] as const;
const BACKGROUND_KEY = [...APPLICANT_KEY, 'background'] as const;

export const reviewDocumentsQuery = queryOptions({
  queryKey: REVIEW_KEY,
  queryFn: ({ signal }) =>
    api<{ results: ReviewDocument[] }>(`${BASE}/review-documents/`, { signal }).then(
      (body) => body.results,
    ),
  staleTime: 60_000,
});

/** One file for the free review, under the upload toast; the sales team hears of it. */
export function useUploadReviewDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      file,
      messages,
    }: {
      kind: ReviewKind;
      file: File;
      messages?: UploadMessages;
    }) => {
      const body = new FormData();
      body.append('kind', kind);
      body.append('file', file);
      return uploadFile<ReviewDocument>(`${BASE}/review-documents/`, body, file, messages);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: REVIEW_KEY }),
  });
}

export function useDeleteReviewDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`${BASE}/review-documents/${String(id)}/`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: REVIEW_KEY }),
  });
}

export const BACKGROUND_DEGREES = ['diploma', 'bachelor', 'master', 'phd'] as const;
export type BackgroundDegree = (typeof BACKGROUND_DEGREES)[number];

export interface BackgroundPersonal {
  city: string;
  /** ISO date. */
  birth_date: string | null;
  work_years: number;
  articles: number;
}

export interface BackgroundEducation {
  degree: BackgroundDegree;
  /** A study field id (`fields`). */
  field: number | null;
  university: string;
  graduation_year: number | null;
  /** Out of 20, 4 or 100. */
  gpa: number;
}

export interface BackgroundExam {
  exam: number;
  score: number;
  date: string | null;
}

export interface Background {
  personal: BackgroundPersonal;
  educations: (BackgroundEducation & { id: number; field_name: string | null })[];
  exams: (BackgroundExam & { verified: boolean })[];
  /** Enough for the consultant: a city and one degree with its university and GPA. */
  complete: boolean;
  fields: { id: number; name: string }[];
  exam_options: { id: number; name: string; min: number; max: number }[];
}

export interface BackgroundWrite {
  personal: BackgroundPersonal;
  educations: BackgroundEducation[];
  exams: BackgroundExam[];
}

export const backgroundQuery = queryOptions({
  queryKey: BACKGROUND_KEY,
  queryFn: ({ signal }) => api<Background>(`${BASE}/background/`, { signal }),
  staleTime: 5 * 60_000,
});

/** Saves the whole form (degrees and exams are replaced by what is sent). */
export function useSaveBackground() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: BackgroundWrite) =>
      api<Background>(`${BASE}/background/`, { method: 'PUT', body }),
    onSuccess: (saved) => client.setQueryData(BACKGROUND_KEY, saved),
  });
}

/** The dashboard's offers to start with (H63): any account. */
export interface StartOffers {
  /** The consultation it offers and books; null when none is set up. */
  consultation: {
    type: number;
    title: string;
    minutes: number;
    mode: 'online' | 'in_person';
    /** Toman, after a running discount. */
    price: number;
    /** Toman before the discount, while there is one. */
    full_price: number | null;
    /** The nearest free start times (up to 3), soonest first. */
    slots: string[];
  } | null;
  /** The full application from the sales price list, split over the most instalments. */
  contract: {
    price: number;
    instalments: number;
    instalment: number;
    /** The price includes the SOP and CV. */
    writing: boolean;
  } | null;
  /** The seller assigned to the person's open lead ("call me" reaches them). */
  consultant: { name: string; picture: string | null } | null;
}

const START_KEY = [...APPLICANT_KEY, 'start'] as const;

const NO_OFFERS: StartOffers = { consultation: null, contract: null, consultant: null };

export const startQuery = queryOptions({
  queryKey: START_KEY,
  queryFn: ({ signal }) =>
    ON_SERVER.start ? api<StartOffers>(`${BASE}/start/`, { signal }) : Promise.resolve(NO_OFFERS),
  // Free times change as people book: fresh enough for a visit, not for a day.
  staleTime: 60_000,
});

/**
 * Books a consultation at one of its times (H64): the dashboard's, or any on the booking calendar.
 * `payment_id`: its invoice, paid on the purchase page; `paid`: credit paid it all (PAY4).
 */
export function useBookConsultation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: number; starts_at: string }) =>
      api<{ consultation: number; payment_id: number; paid: boolean }>(
        `${BASE}/consultations/book/`,
        { method: 'POST', body },
      ),
    // Paid by credit, the session is in the consultations list now; a taken time leaves the offers.
    onSettled: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

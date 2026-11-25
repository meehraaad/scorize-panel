import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import {
  type ReviewKind,
  type ReviewDocument,
  BASE,
  REVIEW_KEY,
  BACKGROUND_KEY,
  type Background,
  type BackgroundWrite,
} from './journey';

/**
 * The mutations of `./journey`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
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

/** Saves the whole form (degrees and exams are replaced by what is sent). */
export function useSaveBackground() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: BackgroundWrite) =>
      api<Background>(`${BASE}/background/`, { method: 'PUT', body }),
    onSuccess: (saved) => client.setQueryData(BACKGROUND_KEY, saved),
  });
}

/**
 * Books a consultation at one of its times (H64): the dashboard's, or any on the booking calendar.
 * `payment_id`: its invoice, paid on the purchase page; `paid`: credit paid it all (PAY4).
 */
export function useBookConsultation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: number; starts_at: string }) => {
      if (ON_SERVER.acquisition) {
        void import('@/lib/acquisition')
          .then(({ reportConsultationStart }) => reportConsultationStart())
          .catch(() => undefined);
      }
      return api<{ consultation: number; payment_id: number; paid: boolean }>(
        `${BASE}/consultations/book/`,
        { method: 'POST', body },
      );
    },
    // Paid by credit, the session is in the consultations list now; a taken time leaves the offers.
    onSettled: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

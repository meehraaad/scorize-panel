import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import type { Answers, FormType } from './formSpec';

/**
 * Writing information forms (SOP, CV, …). Shapes: docs/backend-changes.md H12–H16.
 * The form saves drafts as the applicant types; "final" locks it and starts the writing.
 */

export interface WritingForm {
  /** is_final: no more editing, the writer starts. */
  is_final: boolean;
  final_at: string | null;
  updated_at: string | null;
  /**
   * Answers keyed by Django field names. Lists are arrays of entries; read-only extras (the CV's
   * research interests, its photo URL) come along.
   */
  answers: Answers;
  /** Number the writer calls to coordinate; defaults to the account's phone. */
  contact_phone: string | null;
  /** Writing orders in the contract, for the tabs: 'sop', 'cv', … */
  orders: string[];
  /** How many of this order the contract has (recommendation letters); absent: one. */
  count?: number;
  /**
   * An order the person started before paying (no contract, H66): its price, paid at the final
   * submit. Null or absent once paid, and for a contract's orders.
   */
  purchase?: { price: number } | null;
}

/** What the photo field accepts (the CV's pass_photo). The server checks again. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const url = (type: FormType) => `/applicant/v1/writing/${type}/`;
export const writingKey = (type: FormType) => [...APPLICANT_KEY, 'writing', type] as const;

export const writingQuery = (type: FormType) =>
  queryOptions({
    queryKey: writingKey(type),
    queryFn: async ({ signal }): Promise<WritingForm | null> => {
      try {
        return await api<WritingForm>(url(type), { signal });
      } catch (error) {
        // This writing service isn't in the contract (or there's no applicant file).
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    // The page keeps its own draft while open; don't refetch under the applicant's hands.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

function useUpdateCache(type: FormType) {
  const client = useQueryClient();
  return (change: Partial<WritingForm>) => {
    client.setQueryData<WritingForm | null>(writingKey(type), (previous) =>
      previous
        ? { ...previous, ...change, answers: { ...previous.answers, ...change.answers } }
        : previous,
    );
  };
}

/** Saves changed answers (a draft). Only the server's timestamp goes back into the cache. */
export function useSaveWriting(type: FormType) {
  const update = useUpdateCache(type);
  return useMutation({
    mutationFn: (changes: { answers?: Answers; contact_phone?: string }) =>
      api<{ updated_at: string }>(url(type), { method: 'PATCH', body: changes }),
    onSuccess: ({ updated_at }, changes) => {
      update({
        updated_at,
        answers: changes.answers ?? {},
        ...(changes.contact_phone === undefined ? {} : { contact_phone: changes.contact_phone }),
      });
    },
  });
}

/** Uploads a photo field (multipart); the server answers with the stored file's URL. */
export function useUploadPhoto(type: FormType, name: string) {
  const update = useUpdateCache(type);
  return useMutation({
    mutationFn: ({ file, messages }: { file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append(name, file);
      return uploadFile<{ url: string; updated_at: string }>(
        `${url(type)}${name}/`,
        body,
        file,
        messages,
      );
    },
    onSuccess: ({ url: stored, updated_at }) => {
      update({ updated_at, answers: { [name]: stored } });
    },
  });
}

/** The server refuses a final submit with missing required answers: { missing: [...] }. */
export function missingFromError(error: unknown): string[] {
  if (error instanceof ApiError && error.status === 400) {
    const body = error.body as { missing?: string[] } | null;
    return body?.missing ?? [];
  }
  return [];
}

/**
 * The final submit of an order not paid yet: the answers are saved and Django names the payment to
 * make (402). After paying, the final submit sends the form to the writer.
 */
export function paymentFromError(error: unknown): number | null {
  if (error instanceof ApiError && error.status === 402) {
    const body = error.body as { payment_id?: number } | null;
    return body?.payment_id ?? null;
  }
  return null;
}

/** A transfer receipt for this order waits for the team (409 `in_review`). */
export function receiptInReview(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.body as { code?: string } | null)?.code === 'in_review'
  );
}

export function useSubmitWriting(type: FormType) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answers: Answers) =>
      api(`${url(type)}final/`, { method: 'POST', body: { answers } }),
    // The documents and home pages show the writing step: refresh them all.
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, uploadApi } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { UploadFailed, uploadWithToast, type UploadMessages } from '@/lib/upload';

/**
 * "Documents & writing" of the applicant panel. Shapes: docs/backend-changes.md H8–H11.
 * One request for the page; uploads, deletes and interest changes refresh every applicant page
 * (the home page shows document progress too).
 */

/** A document the team asked for that has no file yet (UploadRequiredDocument without a file). */
export interface RequiredDocument {
  id: number;
  name: string;
  deadline: string | null;
  /** Why an earlier file was sent back, written by the supervisor. */
  note: string | null;
}

export interface CaseFile {
  id: number;
  name: string;
  url: string;
  /** File extension in capitals: PDF, JPG, DOCX. */
  ext: string;
  uploaded_at: string;
  /** "me": uploaded by the applicant; "team": delivered by the writing team. */
  source: 'me' | 'team';
  /** The applicant may still remove it (until the supervisor has reviewed it). */
  can_delete: boolean;
  /** Own files: `review` until the supervisor has checked them; the team's files are `approved`. */
  state: 'review' | 'approved';
}

export type WritingType = 'sop' | 'cv' | 'recommendation' | 'ps' | 'ds' | 'pl';

export interface WritingOrder {
  type: WritingType;
  /** form: waiting for the applicant's information; writing: with the team; ready: delivered. */
  step: 'form' | 'writing' | 'ready';
  delivered_at: string | null;
  /** The delivered file, when ready. */
  file_url: string | null;
  /** A draft waits for the applicant to approve it or ask for changes (the step "your review"). */
  draft_waiting: boolean;
  /** While the team writes: when the next version is due. */
  due_at: string | null;
}

export interface DocumentsData {
  progress: { uploaded: number; required: number };
  required: RequiredDocument[];
  files: CaseFile[];
  /** null: the contract has no writing services (the section is hidden). */
  writing: WritingOrder[] | null;
  /** Research interests the professor-email bot searches with (in English). */
  interests: string[];
}

/** What the upload form accepts. The server checks again. */
export const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_INTEREST_LENGTH = 64;

const BASE = '/applicant/v1';

export const documentsQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'documents'],
  queryFn: async ({ signal }): Promise<DocumentsData | null> => {
    try {
      return await api<DocumentsData>(`${BASE}/documents/`, { signal });
    } catch (error) {
      // No applicant file yet (no contract).
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});

function useApplicantMutation<T>(mutationFn: (variables: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

/**
 * Sends the chosen files, one request per document, under one upload toast, and reports which
 * ones failed.
 */
export function useUploadDocuments() {
  return useApplicantMutation(
    async ({
      uploads,
      messages,
    }: {
      uploads: { id: number; file: File }[];
      messages?: UploadMessages;
    }) => {
      try {
        await uploadWithToast(
          uploads.map(({ id, file }) => ({
            name: file.name,
            size: file.size,
            send: (onProgress, signal) => {
              const body = new FormData();
              body.append('file', file);
              return uploadApi(`${BASE}/documents/${String(id)}/upload/`, body, {
                onProgress,
                signal,
              });
            },
          })),
          messages,
        );
      } catch (error) {
        if (error instanceof UploadFailed)
          throw new UploadError(error.failed.flatMap((index) => uploads[index]?.id ?? []));
        throw error;
      }
    },
  );
}

/** Some uploads failed; the rest went through. */
export class UploadError extends Error {
  constructor(readonly ids: number[]) {
    super('Upload failed');
    this.name = 'UploadError';
  }
}

export function useDeleteFile() {
  return useApplicantMutation((id: number) =>
    api(`${BASE}/documents/files/${String(id)}/`, { method: 'DELETE' }),
  );
}

export function useSaveInterests() {
  return useApplicantMutation((interests: string[]) =>
    api(`${BASE}/research-interests/`, { method: 'PUT', body: { interests } }),
  );
}

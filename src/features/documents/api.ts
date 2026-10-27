import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadApi } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { UploadFailed, uploadWithToast, type UploadMessages } from '@/lib/upload';

/**
 * "Documents & writing" of the applicant panel. Shapes: docs/backend-changes.md H8–H11.
 * One request for the page; uploads, deletes and interest changes refresh every applicant page
 * (the home page shows document progress too).
 */

export {
  documentsQuery,
  type CaseFile,
  type DocumentsData,
  type RequiredDocument,
  type WritingOrder,
  type WritingType,
} from '@/lib/applicant/documents';

/** What the upload form accepts. The server checks again. */
export const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const BASE = '/applicant/v1';

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

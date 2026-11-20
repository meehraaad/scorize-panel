import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadApi } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { UploadFailed, uploadWithToast, type UploadMessages } from '@/lib/upload';
import { BASE, UploadError } from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
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

export function useDeleteFile() {
  return useApplicantMutation((id: number) =>
    api(`${BASE}/documents/files/${String(id)}/`, { method: 'DELETE' }),
  );
}

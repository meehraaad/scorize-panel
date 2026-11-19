import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { WRITER_KEY, WRITER_API, type OrderVersion } from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** Sends a new version to the applicant, or the final file to the case's documents. */
export function useSendVersion(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      note,
      final,
      messages,
    }: {
      file: File;
      note: string;
      final: boolean;
      messages?: UploadMessages;
    }) => {
      const body = new FormData();
      body.append('file', file);
      body.append('note', note);
      body.append('final', String(final));
      return uploadFile<OrderVersion>(
        `${WRITER_API}/orders/${String(id)}/versions/`,
        body,
        file,
        messages,
      );
    },
    onSuccess: () => client.invalidateQueries({ queryKey: WRITER_KEY }),
  });
}

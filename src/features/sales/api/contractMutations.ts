import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SALES_API } from '@/lib/sales/api';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { handoffQuery } from './contract';

/**
 * The mutations of `./contract`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
export function useUploadScan(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, messages }: { file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append('file', file);
      return uploadFile(
        `${SALES_API}/customers/${String(id)}/contract/scan/`,
        body,
        file,
        messages,
      );
    },
    onSuccess: () => client.invalidateQueries({ queryKey: handoffQuery(id).queryKey }),
  });
}

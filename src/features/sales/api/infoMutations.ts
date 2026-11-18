import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerKey } from './customer';
import { infoQuery, type InfoSection, saveSection } from './info';

/**
 * The mutations of `./info`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** Saves one section and answers the stored info. */
export function useSaveInfo(id: number) {
  const client = useQueryClient();
  return useMutation({
    // Fail visibly when offline; the editor retains input and retries on reconnection.
    networkMode: 'always',
    mutationFn: (section: InfoSection) => saveSection(id, section),
    onSuccess: (data) => {
      client.setQueryData(infoQuery(id).queryKey, data);
      return client.invalidateQueries({ queryKey: customerKey(id), exact: true });
    },
  });
}

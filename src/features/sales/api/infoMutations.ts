import { hashKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { SALES_KEY } from '@/lib/sales/api';
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
      const info = infoQuery(id).queryKey;
      const before = client.getQueryData(info)?.personal;
      client.setQueryData(info, data);
      const renamed =
        before?.first_name !== data.personal.first_name ||
        before.last_name !== data.personal.last_name;
      if (!renamed) return client.invalidateQueries({ queryKey: customerKey(id), exact: true });
      // Django copies the name to the account, which the header, lists, board, search and
      // calendar show: all sales data refreshes, open views at once, the rest when next shown.
      // Not awaited, so the editor's next save doesn't wait for every open list.
      const own = hashKey(info);
      void client.invalidateQueries({
        queryKey: SALES_KEY,
        predicate: (query) => query.queryHash !== own,
      });
    },
  });
}

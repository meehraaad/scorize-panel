import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import { type BulkChange, createLead } from './leads';

/**
 * The mutations of `./leads`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** Several leads at once from the list (S13; tags S49). */
export function useBulkLeads() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, change }: { ids: number[]; change: BulkChange }) =>
      api(`${SALES_API}/leads/bulk/`, { method: 'POST', body: { ids, ...change } }),
    // Not awaited: the action is done when Django answers; the sales lists refresh behind it.
    onSuccess: () => void client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export function useCreateLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createLead,
    // Not awaited: the action is done when Django answers; the sales lists refresh behind it.
    onSuccess: () => void client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

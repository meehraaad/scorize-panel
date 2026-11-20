import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import {
  type ConsultationTypeRow,
  type ConsultationTypeInput,
  BASE,
  KEY,
} from './consultationTypes';

/**
 * The mutations of `./consultationTypes`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** Puts Django's fresh row in the list, so the page shows it without asking again. */
function useStore() {
  const client = useQueryClient();
  return (row: ConsultationTypeRow) => {
    client.setQueryData(KEY, (data: { types: ConsultationTypeRow[] } | undefined) =>
      data
        ? {
            types: data.types.some((item) => item.id === row.id)
              ? data.types.map((item) => (item.id === row.id ? row : item))
              : [...data.types, row],
          }
        : data,
    );
    // The seller's sell window and the booking pages list the types too.
    void client.invalidateQueries({
      queryKey: SALES_KEY,
      predicate: (query) => JSON.stringify(query.queryKey) !== JSON.stringify(KEY),
    });
  };
}

/** Make a type (no `id`) or change one. */
export function useSaveConsultationType() {
  const store = useStore();
  return useMutation({
    mutationFn: ({ id, ...body }: ConsultationTypeInput & { id?: number }) =>
      id === undefined
        ? api<ConsultationTypeRow>(`${BASE}/`, { method: 'POST', body })
        : api<ConsultationTypeRow>(`${BASE}/${String(id)}/`, { method: 'PATCH', body }),
    onSuccess: store,
  });
}

export function useAddClosure(id: number) {
  const store = useStore();
  return useMutation({
    mutationFn: (body: { date: string; time: string | null }) =>
      api<ConsultationTypeRow>(`${BASE}/${String(id)}/closures/`, { method: 'POST', body }),
    onSuccess: store,
  });
}

export function useRemoveClosure() {
  const store = useStore();
  return useMutation({
    mutationFn: (closure: number) =>
      api<ConsultationTypeRow>(`${SALES_API}/manager/consultation-closures/${String(closure)}/`, {
        method: 'DELETE',
      }),
    onSuccess: store,
  });
}

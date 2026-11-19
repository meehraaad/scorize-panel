import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { LeadSourceRow } from '@/lib/leads/api';
import { MARKETING_API, MARKETING_KEY } from './api';

/**
 * Lead sources (Django `api/marketing/v1/sources.py`): the system's are listed first and can't
 * change; the team adds, renames, archives and deletes its own. Deleting one that leads use
 * archives it instead, so those leads keep its name. Uploads: `leads/import/` (the sales
 * manager's CSV upload; the leads go to the sales queue).
 */
export const SOURCES_KEY = [...MARKETING_KEY, 'sources'] as const;
export const LEADS_IMPORT_API = `${MARKETING_API}/leads/import`;

export const sourcesQuery = queryOptions({
  queryKey: SOURCES_KEY,
  queryFn: ({ signal }) => api<LeadSourceRow[]>(`${MARKETING_API}/sources/`, { signal }),
});

export function useAddSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<LeadSourceRow>(`${MARKETING_API}/sources/`, { method: 'POST', body: { name } }),
    onSuccess: () => client.invalidateQueries({ queryKey: SOURCES_KEY }),
  });
}

export function useEditSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; active?: boolean }) =>
      api<LeadSourceRow>(`${MARKETING_API}/sources/${id}/`, { method: 'PATCH', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: SOURCES_KEY }),
  });
}

/** Resolves to the archived row when leads use the source, or null when it was deleted. */
export function useDeleteSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<LeadSourceRow | null>(`${MARKETING_API}/sources/${id}/`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: SOURCES_KEY }),
  });
}

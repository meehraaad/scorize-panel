import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ACCESS_API, ACCESS_KEY, type AccessPerson } from './api';

/*
 * One person's access, apart from `./api` (which the panels' routes load first): this comes only
 * with the access dialog and the staff file's access tab.
 */
/** One person's access, by their account id (the staff file's access tab). */
export const personQuery = (id: number) =>
  queryOptions({
    queryKey: [...ACCESS_KEY, 'person', id],
    queryFn: ({ signal }) => api<AccessPerson>(`${ACCESS_API}/people/${String(id)}/`, { signal }),
  });

/**
 * Saves one person's groups and direct keys (the whole lists). Shared by the access pages and the
 * staff file's access tab; every list of the access pages follows (counts, members, history).
 */
export function useSavePerson(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: Partial<Pick<AccessPerson, 'groups' | 'keys'>>) =>
      api<AccessPerson>(`${ACCESS_API}/people/${String(id)}/`, { method: 'PATCH', body: change }),
    onSuccess: () => client.invalidateQueries({ queryKey: ACCESS_KEY }),
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { api } from '@/lib/api/client';
import {
  ACCESS_API,
  ACCESS_PATH,
  HR_ACCESS_PATH,
  ACCESS_KEY,
  type AccessGroup,
  type AccessPerson,
  type GroupInput,
} from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** The access pages' root for the panel they are open in. */
export function useAccessPath() {
  return useLocation().pathname.startsWith(HR_ACCESS_PATH) ? HR_ACCESS_PATH : ACCESS_PATH;
}

/** Every change reaches every list here (counts, members, the history). */
function useAccessMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ACCESS_KEY }),
  });
}

export { useSavePerson } from '@/lib/access/people';

export const useAddGroup = () =>
  useAccessMutation((group: GroupInput) =>
    api<AccessGroup>(`${ACCESS_API}/groups/`, { method: 'POST', body: group }),
  );

export const useSaveGroup = (id: number) =>
  useAccessMutation((change: Partial<GroupInput>) =>
    api<AccessGroup>(`${ACCESS_API}/groups/${String(id)}/`, { method: 'PATCH', body: change }),
  );

export const useDeleteGroup = (id: number) =>
  useAccessMutation(() => api(`${ACCESS_API}/groups/${String(id)}/`, { method: 'DELETE' }));

export const useAddMember = (group: number) =>
  useAccessMutation((user: number) =>
    api<AccessPerson>(`${ACCESS_API}/groups/${String(group)}/members/`, {
      method: 'POST',
      body: { user },
    }),
  );

export const useRemoveMember = (group: number) =>
  useAccessMutation((user: number) =>
    api(`${ACCESS_API}/groups/${String(group)}/members/${String(user)}/`, { method: 'DELETE' }),
  );

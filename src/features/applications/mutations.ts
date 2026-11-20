import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { BASE } from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
export function useShowcaseAnswer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allowed }: { id: number; allowed: boolean }) =>
      api(`${BASE}/applications/${String(id)}/showcase/`, { method: 'POST', body: { allowed } }),
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

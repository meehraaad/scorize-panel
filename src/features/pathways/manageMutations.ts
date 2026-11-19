import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  MANAGE_PATHWAYS_API,
  MANAGE_PATHWAYS_KEY,
  type PathwayDetail,
  type PathwayInput,
  type TryResult,
} from './manageApi';
import type { Answers } from '@/lib/applicant/pathways';

/** The mutations of `./manageApi`, kept apart so they load with the editor, not the first page. */
function useSave<TInput>(mutationFn: (input: TInput) => Promise<PathwayDetail>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (detail) => {
      client.setQueryData([...MANAGE_PATHWAYS_KEY, 'detail', detail.id], detail);
      return client.invalidateQueries({ queryKey: [...MANAGE_PATHWAYS_KEY, 'list'] });
    },
  });
}

export const useCreatePathway = () =>
  useSave((input: PathwayInput) =>
    api<PathwayDetail>(`${MANAGE_PATHWAYS_API}/`, { method: 'POST', body: input }),
  );

export const useUpdatePathway = (id: number) =>
  useSave((input: PathwayInput) =>
    api<PathwayDetail>(`${MANAGE_PATHWAYS_API}/${id}/`, { method: 'PUT', body: input }),
  );

export const useVerifyPathway = (id: number) =>
  useSave((reviewBy: string | null) =>
    api<PathwayDetail>(`${MANAGE_PATHWAYS_API}/${id}/verify/`, {
      method: 'POST',
      body: { review_by: reviewBy },
    }),
  );

export const useTryPathway = () =>
  useMutation({
    mutationFn: ({ pathway, answers }: { pathway: PathwayInput; answers: Answers }) =>
      api<TryResult>(`${MANAGE_PATHWAYS_API}/try/`, { method: 'POST', body: { pathway, answers } }),
  });

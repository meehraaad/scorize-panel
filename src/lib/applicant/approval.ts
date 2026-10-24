import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/** Every applicant-panel query key starts with this, so one change refreshes every page. */
export const APPLICANT_KEY = ['applicant'] as const;

/** apply.models.Degree, shared by every applicant page (labels: common `degree.<n>`). */
export type Degree = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The applicant approves or rejects an application the team prepared
 * (ApplicationResult.applicant_approval_status; docs/backend-changes.md H2).
 * Used by the home page and the applications page, so it refreshes both.
 */
export function useApproveApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      api(`/applicant/v1/applications/${String(id)}/approval/`, {
        method: 'POST',
        body: { approved },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

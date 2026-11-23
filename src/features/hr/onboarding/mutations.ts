import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { sessionQuery } from '@/lib/auth/session';
import type { StaffFile } from '../api';
import { useFileMutation } from '../mutations';
import { onboardingPath, type Onboarding, type OnboardingAnswers } from './api';
import { MY_ONBOARDING_API, myOnboardingQuery } from './me';

/**
 * The form's writes, apart from its queries (the routes' page data imports those). The hire's
 * writes answer the form and put it in the cache; HR's answer the staff file, like every HR write.
 */

/** The hire's: each answers the form. */
function useMyMutation<V>(send: (value: V) => Promise<Onboarding>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => client.setQueryData(myOnboardingQuery.queryKey, data),
  });
}

/** A draft: whatever is typed so far, checked only for type and length. */
export const useSaveDraft = () =>
  useMyMutation((answers: Partial<OnboardingAnswers>) =>
    api<Onboarding>(MY_ONBOARDING_API, { method: 'PATCH', body: answers }),
  );

/**
 * Sends the form to HR: the last answers are saved first, so a submit never loses the latest
 * typing. Whoami's `staff.onboarding` changes, so the session is read again.
 */
export function useSubmitOnboarding() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (answers: OnboardingAnswers) => {
      await api<Onboarding>(MY_ONBOARDING_API, { method: 'PATCH', body: answers });
      return api<Onboarding>(`${MY_ONBOARDING_API}submit/`, { method: 'POST' });
    },
    onSuccess: (data) => {
      client.setQueryData(myOnboardingQuery.queryKey, data);
      return client.invalidateQueries({ queryKey: sessionQuery.queryKey });
    },
  });
}

export const useDeleteOnboardingFile = () =>
  useMyMutation((id: number) =>
    api<Onboarding>(`${MY_ONBOARDING_API}files/${String(id)}/`, { method: 'DELETE' }),
  );

/** HR sends the form to a staff member who has none open. */
export const useSendOnboarding = (staffId: number) =>
  useFileMutation(() => api<StaffFile>(onboardingPath(staffId), { method: 'POST' }));

export type ReviewAction =
  | { action: 'approve' }
  | { action: 'cancel' }
  | {
      action: 'return';
      note: string;
    };

/** HR's answer to a submitted form: approve (into the file), return with a note, or cancel. */
export const useReviewOnboarding = (staffId: number) =>
  useFileMutation((review: ReviewAction) =>
    api<StaffFile>(onboardingPath(staffId, review.action), {
      method: 'POST',
      ...(review.action === 'return' && { body: { note: review.note } }),
    }),
  );

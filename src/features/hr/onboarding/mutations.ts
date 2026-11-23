import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { sessionQuery } from '@/lib/auth/session';
import i18n from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { UploadFailed, uploadFile } from '@/lib/upload';
import type { StaffFile } from '../api';
import { useFileMutation } from '../mutations';
import { onboardingPath, type Onboarding, type OnboardingAnswers } from './api';
import { MY_ONBOARDING_API, myOnboardingFilesPath, myOnboardingQuery } from './me';

/**
 * The form's writes, apart from its queries (the routes' page data imports those). The hire's
 * writes answer the form and put it in the cache; HR's answer the staff file, like every HR write.
 */

/**
 * The hire's writes run one after another (drafts, uploads, deletes, the submit): each answer is
 * the whole form, so one arriving late can't put back an older form (a file just added gone, a
 * draft landing between the submit's save and send).
 */
const MY_SCOPE = { id: 'my-onboarding' };

/** The form changed elsewhere: HR cancelled or approved it, or it was sent already (404, 409). */
export const isGone = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 409);

/** After a 404 or 409 the page reads the form again and shows where it stands now. */
function refreshIfGone(client: QueryClient, error: unknown, say: boolean) {
  if (!isGone(error)) return;
  if (say) toast.info(i18n.t('hr:onboarding.changed'));
  void client.invalidateQueries({ queryKey: myOnboardingQuery.queryKey });
  void client.invalidateQueries({ queryKey: sessionQuery.queryKey });
}

/** The hire's: each answers the form. */
function useMyMutation<V>(send: (value: V) => Promise<Onboarding>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    scope: MY_SCOPE,
    onSuccess: (data) => client.setQueryData(myOnboardingQuery.queryKey, data),
    onError: (error) => refreshIfGone(client, error, true),
  });
}

/** One file of the form, under the upload toast (which also says when it failed). */
export function useUploadOnboardingFile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, file }: { kind: string; file: File }) => {
      const body = new FormData();
      body.append('kind', kind);
      body.append('file', file);
      return uploadFile<Onboarding>(myOnboardingFilesPath, body, file, {
        done: i18n.t('hr:onboarding.file.uploaded'),
      });
    },
    scope: MY_SCOPE,
    onSuccess: (data) => client.setQueryData(myOnboardingQuery.queryKey, data),
    // The upload toast already says it failed; the page only catches up.
    onError: (error) =>
      refreshIfGone(client, error instanceof UploadFailed ? error.errors[0] : error, false),
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
    scope: MY_SCOPE,
    onError: (error) => refreshIfGone(client, error, true),
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

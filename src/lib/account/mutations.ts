import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ACCOUNT_KEY, type AccountData, BASE } from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
function useAccountMutation<T, R = unknown>(mutationFn: (variables: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ACCOUNT_KEY }),
  });
}

/** Marks notifications read: the given ones, or all of them. */
export function useMarkRead() {
  return useAccountMutation((ids?: number[]) =>
    api(`${BASE}/notifications/read/`, { method: 'POST', body: ids ? { ids } : {} }),
  );
}

export function useUpdateAccount() {
  return useAccountMutation(
    (changes: Partial<Pick<AccountData, 'first_name' | 'last_name' | 'channels' | 'referral'>>) =>
      api(`${BASE}/account/`, { method: 'PATCH', body: changes }),
  );
}

export function useResendEmail() {
  return useMutation({
    mutationFn: () => api(`${BASE}/account/email/resend/`, { method: 'POST' }),
  });
}

/** 400 when the current password is wrong or the new one too weak. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current: string; new: string }) =>
      api(`${BASE}/account/password/`, { method: 'POST', body }),
  });
}

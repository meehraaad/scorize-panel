import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { safeHref } from '@/lib/url';
import {
  type ProfileField,
  type PaymentData,
  type DiscountResult,
  BASE,
  paymentQuery,
  offerAgreementQuery,
} from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
function useApplicantMutation<T, R = unknown>(mutationFn: (variables: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

/** Saves one detail; the server answers with the stored (normalized) value. */
export function useSaveProfileField() {
  return useApplicantMutation(({ field, value }: { field: ProfileField; value: string }) =>
    api<Partial<Record<ProfileField, string>>>(`${BASE}/profile/`, {
      method: 'PATCH',
      body: { [field]: value },
    }),
  );
}

/**
 * Starts an online payment: where the bank is, and whether the connection looks foreign (the bank
 * opens only from Iran: the page asks to turn off the VPN first).
 */
export function useStartOnlinePayment() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { redirect_url, outside_iran } = await api<{
        redirect_url: string;
        outside_iran?: boolean;
      }>(`${BASE}/payments/${String(id)}/online/`, { method: 'POST' });
      // Never navigate to a javascript: or data: URL, even one the API sent.
      const target = safeHref(redirect_url);
      if (!target) throw new Error('Unsafe payment redirect');
      return { redirect_url: target, outside_iran: outside_iran ?? false };
    },
  });
}

/** Writes the page's answer into the cache, so the page shows it without another request. */
function usePaymentWrite<T>(mutationFn: (variables: T) => Promise<PaymentData>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (payment) => {
      client.setQueryData(paymentQuery(payment.id).queryKey, payment);
      // A credit that now covers it all paid it: what it bought is in the lists now.
      if (payment.status === 'paid') void client.invalidateQueries({ queryKey: APPLICANT_KEY });
    },
  });
}

/** Takes the wallet credit, or gives it back (PAY5). */
export function useUseCredit() {
  return usePaymentWrite(({ id, use }: { id: number; use: boolean }) =>
    api<PaymentData>(`${BASE}/payments/${String(id)}/`, {
      method: 'PATCH',
      body: { use_credit: use },
    }),
  );
}

/** Takes one item out of the cart before the bank; the rest is priced again. */
export function useRemoveItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, item }: { id: number; item: number }) =>
      api<PaymentData>(`${BASE}/payments/${String(id)}/items/${String(item)}/`, {
        method: 'DELETE',
      }),
    onSuccess: (payment) => {
      client.setQueryData(paymentQuery(payment.id).queryKey, payment);
      // The item's own page (a seat, a booked time) no longer waits for this invoice.
      void client.invalidateQueries({
        queryKey: APPLICANT_KEY,
        predicate: (query) => query.queryKey[1] !== 'payment',
      });
    },
  });
}

/** Applies a discount code (`''` removes it); `result` says why one didn't apply. */
export function useApplyCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }: { id: number; code: string }) =>
      api<{ result: DiscountResult; payment: PaymentData }>(
        `${BASE}/payments/${String(id)}/discount/`,
        { method: 'POST', body: { code } },
      ),
    onSuccess: ({ payment }) => client.setQueryData(paymentQuery(payment.id).queryKey, payment),
  });
}

/**
 * A new invoice for an expired or failed one (PAY1, PAY2): its id, or null when the seller was
 * asked for one.
 */
export function useRenewPayment() {
  return useApplicantMutation((id: number) =>
    api<{ payment_id: number | null }>(`${BASE}/payments/${String(id)}/renew/`, {
      method: 'POST',
    }),
  );
}

export function useUploadReceipt() {
  return useApplicantMutation(
    ({ id, file, messages }: { id: number; file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append('receipt', file);
      return uploadFile(`${BASE}/payments/${String(id)}/receipt/`, body, file, messages);
    },
  );
}

/** Registers: the invoice to pay, or registered at once (free, or the credit covered it). */
export function useRegisterCampaign() {
  return useApplicantMutation((slug: string) =>
    api<{ payment_id: number; paid: boolean }>(
      `${BASE}/campaigns/${encodeURIComponent(slug)}/register/`,
      { method: 'POST' },
    ),
  );
}

function useOfferChange<T>(mutationFn: (variables: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => client.invalidateQueries({ queryKey: offerAgreementQuery.queryKey }),
  });
}

export const useAgreeToOffer = () =>
  useOfferChange((version: number) =>
    api(`${BASE}/offer/agree/`, { method: 'POST', body: { version } }),
  );

export const useAskAboutOffer = () =>
  useOfferChange((body: { version: number; clause: string; text: string }) =>
    api(`${BASE}/offer/remarks/`, { method: 'POST', body }),
  );

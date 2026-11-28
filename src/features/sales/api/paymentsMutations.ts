import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { METHOD_CODE, staffPayment, type PaymentAction } from './payments';

/**
 * The mutations of `./payments`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/**
 * What a seller does to an invoice: decline a receipt (with an optional reason the customer sees), change the method, text the invoice link
 * (S24) or change the destination account (S25).
 * Confirming a receipt: useConfirmReceipt (lib/sales).
 */
export function usePaymentAction(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ payment, action }: { payment: number; action: PaymentAction }) => {
      switch (action.kind) {
        case 'decline':
          return api(`${staffPayment(customer, payment)}/decline_receipt/`, {
            method: 'PATCH',
            body: { reason: action.reason },
          });
        case 'method':
          return api(
            `${staffPayment(customer, payment)}/change_method/${String(METHOD_CODE[action.method])}/`,
            { method: 'PATCH' },
          );
        case 'factor':
          return api(`${SALES_API}/payments/${String(payment)}/factor/`, { method: 'POST' });
        case 'wallet':
          return api(`${SALES_API}/payments/${String(payment)}/`, {
            method: 'PATCH',
            body: { wallet: action.wallet },
          });
      }
    },
    // Not awaited: the action is done when Django answers; the sales lists refresh behind it.
    onSuccess: () => void client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

/**
 * A receipt the customer sent the seller (by phone or a messenger), recorded on an instalment of their contract: paid
 * at once when the seller confirms receipts, else it waits for review. `wallet`: the card account it went to.
 */
export function useInstalmentReceipt() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      instalment,
      file,
      wallet,
      messages,
    }: {
      instalment: number;
      file: File;
      wallet: number | null;
      messages?: UploadMessages;
    }) => {
      const body = new FormData();
      body.append('receipt', file);
      if (wallet !== null) body.append('wallet', String(wallet));
      return uploadFile<{ status: 'paid' | 'review'; payment: number }>(
        `${SALES_API}/instalments/${String(instalment)}/receipt/`,
        body,
        file,
        messages,
      );
    },
    // Not awaited: the action is done when Django answers; the sales lists refresh behind it.
    onSuccess: () => void client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

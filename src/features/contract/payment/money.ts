import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import { paymentQuery, type PaymentData, type PaymentItem } from '../api';

/** The invoice's amounts in its currency ("۱٬۸۰۰٬۰۰۰ تومان", "۸۵۰ یورو"). */
export function useMoney(currency: string | null) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  return (amount: number) => f.price(amount, currency, (value) => t('amount', { amount: value }));
}

/** An item's price after the admin's discount and the code: what it costs before credit and tax. */
export const itemPrice = (item: PaymentItem) =>
  (item.discounted_price ?? item.price) - item.code_discount;

/** A line under an item: a session's time, else nothing. */
export function useItemNote() {
  const f = useFormat();
  return (item: PaymentItem) => (item.note ? f.dateTime(item.note) : null);
}

/** Minutes left before an unpaid invoice expires, ticking; reloads the invoice when it runs out. */
export function useMinutesLeft(payment: PaymentData) {
  const client = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const expires = payment.expires_at ? new Date(payment.expires_at).getTime() : null;

  useEffect(() => {
    if (expires === null) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [expires]);

  const left = expires === null ? null : Math.max(0, Math.ceil((expires - now) / 60_000));
  useEffect(() => {
    if (left === 0) void client.invalidateQueries({ queryKey: paymentQuery(payment.id).queryKey });
  }, [left, client, payment.id]);
  return left;
}

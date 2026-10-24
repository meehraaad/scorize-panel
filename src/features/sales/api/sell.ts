import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import { customerKey } from './customer';
import type { PaymentMethod } from './payments';
import type { ProductCategory } from './purchases';

export interface Product {
  id: number;
  category: ProductCategory;
  title: string;
  /** Localized ("Online or in person", "Delivered in 7 working days"). */
  detail: string;
  /** Toman; 0 = free. */
  price: number;
  /** Consultations: free times to book. */
  slots: { id: number; starts_at: string; consultant: string }[];
}

export const productsQuery = queryOptions({
  queryKey: [...SALES_KEY, 'products'],
  queryFn: ({ signal }) => api<{ products: Product[] }>(`${SALES_API}/products/`, { signal }),
  staleTime: 5 * 60_000,
});

export interface SaleQuote {
  subtotal: number;
  discount: number;
  total: number;
  /** finance.types.DiscountCheckResult, by name; null when the code is fine or none was given. */
  discount_error: 'invalid' | 'used_by_user' | 'max_use_exceeded' | null;
}

export interface NewSale {
  products: number[];
  slot?: number;
  discount_code?: string;
  use_credit: boolean;
  method: PaymentMethod;
}

/** The price with a discount code, as the cart would compute it (check-content; S29). */
export function useQuote(customer: number) {
  return useMutation({
    mutationFn: (sale: Pick<NewSale, 'products' | 'discount_code' | 'use_credit'>) =>
      api<SaleQuote>(`${SALES_API}/customers/${String(customer)}/sell/quote/`, {
        method: 'POST',
        body: sale,
      }),
  });
}

/** Creates the invoice in the customer's name and texts them the payment link (S30). */
export function useSell(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sale: NewSale) =>
      api<{ payment: number }>(`${SALES_API}/customers/${String(customer)}/sell/`, {
        method: 'POST',
        body: sale,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKey(customer) }),
  });
}

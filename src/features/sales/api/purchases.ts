import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API } from '@/lib/sales/api';
import { customerKey } from './customer';

export type ProductCategory = 'consultation' | 'writing' | 'package' | 'event';

export interface Purchase {
  /** Invoice id. */
  id: number;
  category: ProductCategory;
  title: string;
  /** Localized line ("Monday 28 Mehr · 11:00 · online · consultant: …", "SpotPlayer licence active"). */
  detail: string;
  /** Toman. */
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  at: string;
  /** Consultations: the reservation, and whether its session took place and was logged. */
  session: { reservation: number; starts_at: string; logged: boolean } | null;
}

export interface PurchasesData {
  /** Paid total, toman. */
  total: number;
  sessions: { held: number; upcoming: number };
  failed: { count: number; last_at: string } | null;
  items: Purchase[];
}

export const purchasesQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'purchases'],
    queryFn: ({ signal }) =>
      api<PurchasesData>(`${SALES_API}/customers/${String(id)}/purchases/`, { signal }),
  });

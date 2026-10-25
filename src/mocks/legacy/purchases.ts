import { api } from '@/lib/api/client';
import {
  FINANCE_TYPE,
  STAFF_API,
  allPages,
  type DjangoReservation,
  type DjangoUserDetail,
  type DjangoUserInvoice,
  type Page,
} from '../djangoStaff';
import { invoiceTitle, PAYMENT_STATUSES } from './payments';

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

const CATEGORY: Partial<Record<number, ProductCategory>> = {
  [FINANCE_TYPE.consultation]: 'consultation',
  [FINANCE_TYPE.writing]: 'writing',
  [FINANCE_TYPE.event]: 'event',
  [FINANCE_TYPE.campaign]: 'event',
};

const STATUS: Record<(typeof PAYMENT_STATUSES)[number], Purchase['status']> = {
  pending: 'pending',
  pending_receipt: 'pending',
  paid: 'paid',
  paid_by_receipt: 'paid',
  expired: 'failed',
  failed: 'failed',
  receipt_declined: 'failed',
};

/**
 * The customer's purchases from Django's InvoiceViewSet (one row per invoice) until S21 ships.
 * Sessions are matched to the seller's reservations (by code) for the log link; `detail` is the
 * invoice type as Django words it.
 */
export async function fetchPurchases(id: number, signal?: AbortSignal): Promise<PurchasesData> {
  const base = `${STAFF_API}/users/${String(id)}`;
  const [invoices, user] = await Promise.all([
    allPages<DjangoUserInvoice>(`${base}/invoices/?ordering=-id`, signal),
    api<DjangoUserDetail>(`${base}/`, { signal }),
  ]);
  const hasSessions = invoices.some((item) => item.related);
  const reservations =
    hasSessions && user.phone_number
      ? (
          await api<Page<DjangoReservation>>(
            `${STAFF_API}/consultation-reservations/?search=${encodeURIComponent(user.phone_number)}&page_size=50`,
            { signal },
          )
        ).results
      : [];
  const items = invoices.map((item): Purchase => {
    const reservation = item.related
      ? reservations.find((entry) => entry.unique_code === item.related?.unique_code)
      : undefined;
    return {
      id: item.id,
      category: CATEGORY[item.type] ?? 'package',
      title: invoiceTitle(item, item.payment),
      detail: item.type_display,
      amount: item.amount,
      status: STATUS[PAYMENT_STATUSES[item.payment.status] ?? 'pending'],
      at: item.payment.payment_date ?? item.payment.creation_datetime,
      session:
        item.related && reservation
          ? {
              reservation: reservation.id,
              starts_at: item.related.date,
              logged: reservation.is_called,
            }
          : null,
    };
  });
  const paid = items.filter((item) => item.status === 'paid');
  const failed = items.filter((item) => item.status === 'failed');
  const now = Date.now();
  const sessions = invoices
    .filter(
      (item) =>
        item.related && STATUS[PAYMENT_STATUSES[item.payment.status] ?? 'pending'] === 'paid',
    )
    .map((item) => new Date(item.related?.date ?? '').getTime());
  return {
    total: paid.reduce((sum, item) => sum + item.amount, 0),
    sessions: {
      held: sessions.filter((time) => time < now).length,
      upcoming: sessions.filter((time) => time >= now).length,
    },
    failed: failed[0] ? { count: failed.length, last_at: failed[0].at } : null,
    items,
  };
}

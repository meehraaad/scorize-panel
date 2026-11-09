import { http, HttpResponse } from 'msw';
import type {
  ApplyFile,
  NewSale,
  ClauseEdit,
  Offer,
  OfferData,
  Product,
  SaleQuote,
} from '@/features/sales/api';
import { recordVersion } from './agreement';
import { notFound } from './session';
import { ERFAN, failed, stateOrError, type SalesState } from './sales';
import { addPayment, staffData } from './staff';

/**
 * Fake planned customer endpoints (docs/backend-changes.md S24–S33): the application file, product
 * sale, invoice SMS and offer. Payments, purchases and details come from Django's existing staff
 * API (src/mocks/staff.ts); a sale made here is written there, so the payments tab shows it.
 */

const BASE = '/api/sales/v1';
const DAY = 86_400_000;
const inDays = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

/** finance.Wallet ids a card transfer can go to. */
const WALLETS = [1, 2];

const paymentExists = (id: unknown) =>
  staffData().payments.some((row) => row.data.id === Number(id));

const PRODUCTS: Product[] = [
  {
    id: 1,
    category: 'consultation',
    title: 'مشاوره‌ی اپلای ارشد · ۳۰ دقیقه',
    detail: 'آنلاین یا حضوری',
    price: 1_500_000,
    slots: [],
  },
  {
    id: 2,
    category: 'consultation',
    title: 'مشاوره‌ی اپلای دکتری · ۴۵ دقیقه',
    detail: 'آنلاین یا حضوری',
    price: 2_200_000,
    slots: [],
  },
  {
    id: 3,
    category: 'consultation',
    title: 'مشاوره‌ی ویزای تحصیلی',
    detail: 'حضوری',
    price: 1_800_000,
    slots: [],
  },
  {
    id: 4,
    category: 'writing',
    title: 'نگارش انگیزه‌نامه (ارشد)',
    detail: 'تحویل ۷ روز کاری',
    price: 6_000_000,
    slots: [],
  },
  {
    id: 5,
    category: 'writing',
    title: 'نگارش رزومه',
    detail: 'تحویل ۵ روز کاری',
    price: 3_500_000,
    slots: [],
  },
  {
    id: 6,
    category: 'writing',
    title: 'نگارش توصیه‌نامه',
    detail: 'هر توصیه‌نامه',
    price: 2_000_000,
    slots: [],
  },
  {
    id: 7,
    category: 'package',
    title: 'بسته‌ی نمونه انگیزه‌نامه‌های ارشد',
    detail: 'دانلودی',
    price: 1_500_000,
    slots: [],
  },
  {
    id: 8,
    category: 'package',
    title: 'بسته‌ی جامع اپلای هلند',
    detail: 'ویدیو + فایل',
    price: 2_900_000,
    slots: [],
  },
  {
    id: 9,
    category: 'event',
    title: 'وبینار «اپلای کانادا ۲۰۲۷»',
    detail: 'پنجشنبه ۸ آبان',
    price: 450_000,
    slots: [],
  },
  {
    id: 10,
    category: 'event',
    title: 'رویداد «تحصیل رایگان ترکیه»',
    detail: 'حضوری · ۱۵ آبان',
    price: 0,
    slots: [],
  },
];

/** Consultations get free times relative to today, so the list never shows the past. */
const products = (): Product[] =>
  PRODUCTS.map((product) =>
    product.category === 'consultation'
      ? {
          ...product,
          slots: [
            { id: product.id * 10 + 1, starts_at: inDays(1, 11), consultant: 'حسین رحیمی' },
            { id: product.id * 10 + 2, starts_at: inDays(1, 15), consultant: 'حسین رحیمی' },
            { id: product.id * 10 + 3, starts_at: inDays(2, 10), consultant: 'الهام رضوی' },
          ],
        }
      : product,
  );

/** Discount codes: 10% off, or one the customer already used. */
const CODES: Record<string, number | 'used_by_user'> = { SCORIZE10: 10, USED: 'used_by_user' };

function quoteOf(items: number[], code?: string): SaleQuote {
  const subtotal = PRODUCTS.filter((product) => items.includes(product.id)).reduce(
    (sum, product) => sum + product.price,
    0,
  );
  const rule = code ? CODES[code.toUpperCase()] : undefined;
  if (code && rule === undefined)
    return { subtotal, discount: 0, total: subtotal, discount_error: 'invalid' };
  if (rule === 'used_by_user')
    return { subtotal, discount: 0, total: subtotal, discount_error: 'used_by_user' };
  const discount = rule ? Math.round((subtotal * rule) / 100) : 0;
  return { subtotal, discount, total: subtotal - discount, discount_error: null };
}

const ERFAN_FILE: ApplyFile = {
  status: 'در حال اپلای',
  applies: { used: 4, total: 6 },
  admissions: 1,
  emails: { sent: 85, total: 120 },
  contract: {
    active: true,
    features: ['admission', 'writing'],
    start: '2026-11-22',
    end: '2027-11-22',
    degree: 2,
    countries: ['هلند', 'آلمان'],
    supervisors: ['مریم کاظمی'],
    consultant: 'حسین رحیمی',
    file_url: '#',
  },
  applications: [
    {
      id: 1,
      university: 'University of Twente',
      program: 'MSc Computer Science',
      fee_paid: true,
      status: 'accepted',
    },
    {
      id: 2,
      university: 'TU Delft',
      program: 'MSc Computer Science',
      fee_paid: true,
      status: 'submitted',
    },
    {
      id: 3,
      university: 'RWTH Aachen',
      program: 'MSc Data Science',
      fee_paid: false,
      status: 'ready',
    },
    {
      id: 4,
      university: 'University of Amsterdam',
      program: 'MSc AI',
      fee_paid: true,
      status: 'rejected',
    },
  ],
};

/** Django's standard contract (`ContractClause`, S51), as the admin keeps it. */
export const STANDARD_CLAUSES: OfferData['options']['clauses'] = [
  {
    id: 1,
    title: 'موضوع قرارداد',
    text: 'اسکورایز در انتخاب دانشگاه، آماده‌سازی مدارک و ثبت درخواست پذیرش، مشاوره و همراهی می‌کند.',
    // A fixed clause (S64): the seller can't change it.
    locked: true,
  },
  {
    id: 2,
    title: 'تعهدات متقاضی',
    text: 'متقاضی مدارک خواسته‌شده را تا ۷ روز پس از درخواست کارشناس ارائه می‌کند.',
    locked: false,
  },
  {
    id: 3,
    title: 'فسخ قرارداد',
    text: 'تا ۷ روز پس از امضا، با فسخ قرارداد کل مبلغ پرداختی بازگردانده می‌شود.',
    locked: false,
  },
];

/** Django's `clean_edits`: an "edit" that leaves a standard clause as it is drops out. */
function cleanClauses(rows: ClauseEdit[]): ClauseEdit[] | null {
  const kept: ClauseEdit[] = [];
  for (const row of rows) {
    if (row.clause === null) {
      if (row.removed) continue;
      if (!row.title.trim() || !row.text.trim()) return null;
      kept.push(row);
      continue;
    }
    const base = STANDARD_CLAUSES.find((clause) => clause.id === row.clause);
    if (!base || kept.some((edit) => edit.clause === row.clause)) return null;
    const changed =
      row.removed ||
      (row.title.trim() || base.title) !== base.title ||
      row.text.trim() !== base.text;
    if (base.locked && changed) return null;
    if (row.removed) {
      kept.push({ ...row, title: base.title, text: base.text });
      continue;
    }
    if (!row.text.trim()) return null;
    const title = row.title.trim() || base.title;
    if (title !== base.title || row.text.trim() !== base.text)
      kept.push({ ...row, title, text: row.text.trim() });
  }
  return kept;
}

const OFFER_OPTIONS: OfferData['options'] = {
  features: [
    { key: 'admission', price: 70_000_000 },
    { key: 'visa', price: 40_000_000 },
    { key: 'writing', price: 25_000_000 },
  ],
  degrees: [1, 2, 3],
  durations: [6, 12, 18],
  countries: ['هلند', 'آلمان', 'کانادا', 'ایتالیا', 'سوئد', 'انگلستان', 'آمریکا', 'ترکیه'],
  discounts: [0, 5, 10, 15],
  approval_above: 10,
  min_prepayment: 30,
  max_applies: 30,
  instalments: [1, 2, 3, 4],
  clauses: STANDARD_CLAUSES,
};

const customerOrError = (data: SalesState, id: unknown) =>
  data.customers.find((item) => item.id === Number(id)) ?? null;

export const salesCustomerHandlers = [
  // Planned (S24, S25): text the invoice, choose the destination account. Django doesn't report
  // either back yet, so the payments tab doesn't show them.
  http.post(`${BASE}/payments/:id/factor/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    return paymentExists(params.id) ? new HttpResponse(null, { status: 204 }) : notFound();
  }),

  http.patch(`${BASE}/payments/:id/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    if (!paymentExists(params.id)) return notFound();
    const { wallet } = (await request.json()) as { wallet: number };
    return WALLETS.includes(wallet)
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json({ wallet: ['invalid'] }, { status: 400 });
  }),

  http.get(`${BASE}/customers/:id/apply/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    return Number(params.id) === ERFAN ? HttpResponse.json(ERFAN_FILE) : notFound();
  }),

  http.get(`${BASE}/products/`, () => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json({ products: products() });
  }),

  http.post(`${BASE}/customers/:id/sell/quote/`, async ({ request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const body = (await request.json()) as Pick<NewSale, 'products' | 'discount_code'>;
    return HttpResponse.json(quoteOf(body.products, body.discount_code));
  }),

  http.post(`${BASE}/customers/:id/sell/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = customerOrError(data, params.id);
    if (!item) return notFound();
    const sale = (await request.json()) as NewSale;
    const chosen = PRODUCTS.filter((product) => sale.products.includes(product.id));
    if (chosen.length === 0) return HttpResponse.json({ products: ['required'] }, { status: 400 });
    if (chosen.some((product) => product.category === 'consultation') && !sale.slot)
      return HttpResponse.json({ slot: ['required'] }, { status: 400 });
    // Django keeps one invoice per product; a discount lowers the invoices' amounts.
    const { total, subtotal } = quoteOf(sale.products, sale.discount_code);
    const id = addPayment(
      item.id,
      chosen.map((product) => ({
        title: product.title,
        price: Math.round((product.price * total) / (subtotal || 1)),
        category: product.category,
      })),
      sale.method,
    );
    return HttpResponse.json({ payment: id }, { status: 201 });
  }),

  http.get(`${BASE}/customers/:id/offer/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = customerOrError(data, params.id);
    if (!item) return notFound();
    const draft = data.offers.get(item.id) ?? null;
    const body: OfferData = {
      options: OFFER_OPTIONS,
      draft,
      state: item.lead.stage === 'draft' ? 'submitted' : draft ? 'saved' : 'none',
    };
    return HttpResponse.json(body);
  }),

  http.post(`${BASE}/customers/:id/offer/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = customerOrError(data, params.id);
    if (!item) return notFound();
    const { action, ...offer } = (await request.json()) as Offer & { action: string };
    if (offer.features.length === 0 || offer.countries.length === 0)
      return HttpResponse.json({ features: ['required'] }, { status: 400 });
    if (action === 'send' && offer.discount > OFFER_OPTIONS.approval_above)
      return HttpResponse.json({ discount: ['needs_approval'] }, { status: 400 });
    // Django's S47 checks: the prepayment first and only first, a date on dated rows.
    const [first, ...rest] = offer.schedule;
    if (
      first?.when !== 'signing' ||
      rest.some((row) => row.when === 'signing') ||
      offer.schedule.some((row) => row.amount < 1 || (row.when === 'date' && !row.date))
    )
      return HttpResponse.json({ schedule: ['invalid'] }, { status: 400 });
    const total = offer.features.reduce(
      (sum, key) => sum + (OFFER_OPTIONS.features.find((entry) => entry.key === key)?.price ?? 0),
      0,
    );
    const amount = Math.round(total * (1 - offer.discount / 100));
    if (action !== 'save' && offer.schedule.reduce((sum, row) => sum + row.amount, 0) !== amount)
      return HttpResponse.json({ schedule: ['total'] }, { status: 400 });
    const clauses = cleanClauses(offer.clauses);
    if (!clauses) return HttpResponse.json({ clauses: ['invalid'] }, { status: 400 });
    data.offers.set(item.id, { ...offer, clauses });
    item.lead.amount = amount;
    if (action !== 'save') {
      recordVersion(
        { id: item.id, name: item.name },
        { ...offer, clauses },
        amount,
        action === 'submit' ? 'submitted' : 'sent',
        STANDARD_CLAUSES,
      );
      item.lead.stage = action === 'submit' ? 'draft' : 'offer';
      item.lead.stage_since = new Date().toISOString();
      item.lead.manager = action === 'submit';
    }
    return new HttpResponse(null, { status: 201 });
  }),
];

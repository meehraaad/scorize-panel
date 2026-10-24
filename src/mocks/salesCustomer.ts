import { http, HttpResponse } from 'msw';
import type {
  ApplyFile,
  CustomerInfo,
  InfoSection,
  NewSale,
  Offer,
  OfferData,
  PaymentRow,
  Product,
  PurchasesData,
  SaleQuote,
} from '@/features/sales/api';
import { notFound } from './session';
import { ERFAN, failed, newId, stateOrError, type MockCustomer, type SalesState } from './sales';

/**
 * Fake customer sub-tabs, product sale and offer (docs/backend-changes.md S21–S33), on the same
 * state as src/mocks/sales.ts. Erfan (105) has the design's data; other customers start empty.
 */

const BASE = '/api/sales/v1';
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const inDays = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const WALLETS = [
  { id: 1, name: 'حساب شرکت · بانک اول' },
  { id: 2, name: 'حساب شرکت · بانک دوم' },
];

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

const payment = (
  id: number,
  what: string,
  lines: [string, number][],
  status: PaymentRow['status'],
  method: PaymentRow['method'],
  days: number,
  extra: Partial<PaymentRow> = {},
): PaymentRow => ({
  id,
  what,
  amount: lines.reduce((sum, [, amount]) => sum + amount, 0),
  method,
  status,
  created_at: daysAgo(days),
  lines: lines.map(([label, amount]) => ({ label, amount })),
  wallet: 1,
  reference: null,
  receipt: null,
  factor: null,
  pay_url: `https://scorize.com/panel/payments/${String(id)}`,
  ...extra,
});

function paymentsOf(data: SalesState, id: number): PaymentRow[] {
  let list = data.payments.get(id);
  if (!list) {
    list =
      id === ERFAN
        ? [
            payment(
              5021,
              'نگارش انگیزه‌نامه و رزومه',
              [
                ['نگارش انگیزه‌نامه (ارشد)', 6_000_000],
                ['نگارش رزومه', 3_500_000],
              ],
              'pending_receipt',
              'receipt',
              0,
              {
                receipt: {
                  url: '#',
                  uploaded_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
                },
              },
            ),
            payment(
              4988,
              'مشاوره‌ی اپلای ارشد',
              [['مشاوره‌ی اپلای ارشد · ۳۰ دقیقه', 1_500_000]],
              'paid',
              'online',
              6,
              { reference: '000483920115' },
            ),
            payment(
              4970,
              'مشاوره‌ی اپلای ارشد',
              [['مشاوره‌ی اپلای ارشد · ۳۰ دقیقه', 1_500_000]],
              'failed',
              'online',
              8,
            ),
            payment(
              4902,
              'بسته‌ی نمونه انگیزه‌نامه‌ها',
              [['بسته‌ی نمونه انگیزه‌نامه‌های ارشد', 1_500_000]],
              'pending',
              'online',
              1,
              {
                factor: { sent_at: daysAgo(1), opened: false },
              },
            ),
          ]
        : [];
    data.payments.set(id, list);
  }
  return list;
}

function purchasesOf(data: SalesState, id: number): PurchasesData {
  const erfan = id === ERFAN;
  const sold = paymentsOf(data, id)
    .filter((row) => !erfan || row.id > 5021)
    .map((row) => ({
      id: row.id,
      category:
        PRODUCTS.find((product) => product.title === row.lines[0]?.label)?.category ?? 'package',
      title: row.what,
      detail: row.lines.map((line) => line.label).join('، '),
      amount: row.amount,
      status:
        row.status === 'paid' || row.status === 'paid_by_receipt'
          ? ('paid' as const)
          : row.status === 'failed'
            ? ('failed' as const)
            : ('pending' as const),
      at: row.created_at,
      session: null,
    }));
  const items: PurchasesData['items'] = erfan
    ? [
        {
          id: 4988,
          category: 'consultation',
          title: 'مشاوره‌ی اپلای ارشد · ۳۰ دقیقه',
          detail: 'آنلاین · مشاور: حسین رحیمی',
          amount: 1_500_000,
          status: 'paid',
          at: daysAgo(6),
          session: { reservation: 9, starts_at: daysAgo(5), logged: true },
        },
        {
          id: 4970,
          category: 'consultation',
          title: 'مشاوره‌ی اپلای ارشد · ۳۰ دقیقه',
          detail: 'خرید ناموفق · درگاه خطا داد',
          amount: 1_500_000,
          status: 'failed',
          at: daysAgo(8),
          session: null,
        },
        {
          id: 4310,
          category: 'event',
          title: 'وبینار «اپلای هلند ۲۰۲۷»',
          detail: 'لایسنس SpotPlayer فعال',
          amount: 600_000,
          status: 'paid',
          at: daysAgo(22),
          session: null,
        },
        {
          id: 4122,
          category: 'package',
          title: 'بسته‌ی «نمونه انگیزه‌نامه‌های ارشد»',
          detail: 'دانلودی',
          amount: 1_500_000,
          status: 'paid',
          at: daysAgo(36),
          session: null,
        },
        ...sold,
      ]
    : sold;
  const paid = items.filter((item) => item.status === 'paid');
  const fails = items.filter((item) => item.status === 'failed');
  return {
    total: paid.reduce((sum, item) => sum + item.amount, 0),
    sessions: {
      held: items.filter(
        (item) => item.session && new Date(item.session.starts_at).getTime() < Date.now(),
      ).length,
      upcoming: items.filter(
        (item) => item.session && new Date(item.session.starts_at).getTime() >= Date.now(),
      ).length,
    },
    failed: fails.length ? { count: fails.length, last_at: fails[0]?.at ?? '' } : null,
    items,
  };
}

const CHOICES: CustomerInfo['choices'] = {
  gender: [
    { value: 'm', label: 'آقا' },
    { value: 'f', label: 'خانم' },
  ],
  marital: [
    { value: 'single', label: 'مجرد' },
    { value: 'married', label: 'متأهل' },
  ],
  military: [
    { value: 'exempt_study', label: 'معافیت تحصیلی' },
    { value: 'done', label: 'پایان خدمت' },
    { value: 'exempt', label: 'معافیت دائم' },
  ],
  budget: [
    { value: '1', label: 'کمتر از ۵۰۰ میلیون تومان' },
    { value: '2', label: 'بین ۵۰۰ میلیون تا ۱ میلیارد تومان' },
    { value: '3', label: 'بیشتر از ۱ میلیارد تومان' },
  ],
  degree: [
    { value: '0', label: 'دیپلم' },
    { value: '1', label: 'کارشناسی' },
    { value: '2', label: 'کارشناسی ارشد' },
    { value: '3', label: 'دکترا' },
  ],
  exam: [
    { value: 'ielts', label: 'IELTS Academic' },
    { value: 'toefl', label: 'TOEFL iBT' },
    { value: 'gre', label: 'GRE' },
  ],
};

function infoOf(data: SalesState, item: MockCustomer): CustomerInfo {
  let info = data.info.get(item.id);
  if (!info) {
    const [first = '', ...rest] = item.name.split(' ');
    const erfan = item.id === ERFAN;
    info = {
      personal: {
        first_name: first,
        last_name: rest.join(' '),
        father_name: erfan ? 'مهدی' : '',
        birth_date: erfan ? '2001-07-03' : '',
        gender: erfan ? 'm' : '',
        marital: erfan ? 'single' : '',
        military: erfan ? 'exempt_study' : '',
        city: erfan ? 'شیراز' : '',
        work_years: erfan ? '2' : '',
      },
      goal: {
        wanted_degree: item.degree === null ? '' : String(item.degree),
        budget: erfan ? '2' : '',
        countries: item.countries.join('، '),
        language: erfan ? 'آیلتس ۶٫۵' : '',
      },
      education: erfan
        ? [
            {
              id: 1,
              degree: '1',
              field: 'مهندسی کامپیوتر',
              university: 'دانشگاه شیراز',
              gpa: '16.2',
            },
            {
              id: 2,
              degree: '0',
              field: 'ریاضی فیزیک',
              university: 'دبیرستان علامه طباطبایی',
              gpa: '18.7',
            },
          ]
        : [],
      exams: erfan ? [{ id: 1, exam: 'ielts', score: '6.5', date: '2026-08-01' }] : [],
      choices: CHOICES,
      tablet_url: '#',
      updated_at: daysAgo(3),
    };
    data.info.set(item.id, info);
  }
  return info;
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
  instalments: [1, 2, 3, 4],
};

const customerOrError = (data: SalesState, id: unknown) =>
  data.customers.find((item) => item.id === Number(id)) ?? null;

export const salesCustomerHandlers = [
  http.get(`${BASE}/customers/:id/purchases/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = customerOrError(data, params.id);
    return item ? HttpResponse.json(purchasesOf(data, item.id)) : notFound();
  }),

  http.get(`${BASE}/customers/:id/payments/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = customerOrError(data, params.id);
    return item
      ? HttpResponse.json({ wallets: WALLETS, results: paymentsOf(data, item.id) })
      : notFound();
  }),

  // Existing Django endpoints (PaymentViewSet.decline_receipt / change_method).
  http.patch('/api/profile/staff/v1/users/:user/payments/:id/decline_receipt/', ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const row = paymentsOf(data, Number(params.user)).find((item) => item.id === Number(params.id));
    if (row?.status !== 'pending_receipt')
      return HttpResponse.json(
        { message: 'رسید پرداخت در انتظار تایید وجود ندارد!' },
        { status: 400 },
      );
    row.status = 'receipt_declined';
    return HttpResponse.json({ message: 'رسید پرداخت با موفقیت رد شد.' });
  }),

  http.patch(
    '/api/profile/staff/v1/users/:user/payments/:id/change_method/:method/',
    ({ params }) => {
      const data = stateOrError();
      if (failed(data)) return data;
      const row = paymentsOf(data, Number(params.user)).find(
        (item) => item.id === Number(params.id),
      );
      if (row?.status !== 'pending')
        return HttpResponse.json({ message: 'روش پرداخت قابل تغییر نیست!' }, { status: 400 });
      row.method = params.method === '1' ? 'receipt' : 'online';
      return HttpResponse.json({ message: 'روش پرداخت با موفقیت تغییر کرد.' });
    },
  ),

  http.post(`${BASE}/payments/:id/factor/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const row = [...data.payments.values()].flat().find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    row.factor = { sent_at: new Date().toISOString(), opened: false };
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch(`${BASE}/payments/:id/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const row = [...data.payments.values()].flat().find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    const { wallet } = (await request.json()) as { wallet: number };
    if (!WALLETS.some((item) => item.id === wallet))
      return HttpResponse.json({ wallet: ['invalid'] }, { status: 400 });
    row.wallet = wallet;
    return HttpResponse.json(row);
  }),

  http.get(`${BASE}/customers/:id/info/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = customerOrError(data, params.id);
    return item ? HttpResponse.json(infoOf(data, item)) : notFound();
  }),

  http.patch(`${BASE}/customers/:id/info/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = customerOrError(data, params.id);
    if (!item) return notFound();
    const section = (await request.json()) as InfoSection;
    const info = infoOf(data, item);
    Object.assign(info, section, { updated_at: new Date().toISOString() });
    // New rows get ids, like Django would.
    info.education = info.education.map((row) => ({ ...row, id: row.id ?? newId() }));
    info.exams = info.exams.map((row) => ({ ...row, id: row.id ?? newId() }));
    if (section.personal)
      item.name = `${section.personal.first_name} ${section.personal.last_name}`.trim();
    return HttpResponse.json(info);
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
    const quote = quoteOf(sale.products, sale.discount_code);
    const id = newId();
    const lines: [string, number][] = chosen.map((product) => [product.title, product.price]);
    if (quote.discount) lines.push(['تخفیف', -quote.discount]);
    paymentsOf(data, item.id).unshift(
      payment(
        id,
        chosen.map((product) => product.title).join('، '),
        lines,
        'pending',
        sale.method,
        0,
        {
          factor: { sent_at: new Date().toISOString(), opened: false },
        },
      ),
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
    data.offers.set(item.id, offer);
    const total = offer.features.reduce(
      (sum, key) => sum + (OFFER_OPTIONS.features.find((entry) => entry.key === key)?.price ?? 0),
      0,
    );
    item.lead.amount = Math.round(total * (1 - offer.discount / 100));
    if (action !== 'save') {
      item.lead.stage = action === 'submit' ? 'draft' : 'offer';
      item.lead.stage_since = new Date().toISOString();
      item.lead.manager = action === 'submit';
    }
    return new HttpResponse(null, { status: 201 });
  }),
];

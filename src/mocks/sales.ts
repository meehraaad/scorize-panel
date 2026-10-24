import { http, HttpResponse } from 'msw';
import type {
  BoardCard,
  BoardData,
  CallItem,
  ConsultationRange,
  ConsultationsData,
  ContactLog,
  CustomerData,
  HistoryEvent,
  LeadRow,
  LeadsData,
  MonthData,
  NewLead,
  NextStep,
  CustomerInfo,
  Offer,
  PaymentRow,
  PendingReceipt,
  TodayData,
} from '@/features/sales/api';
import { BOARD_STAGES } from '@/features/sales/api';
import {
  STAGES,
  scoreBand,
  type Degree,
  type LeadSource,
  type LeadStage,
  type LostReason,
} from '@/lib/sales/api';
import type { TaskSummary } from '@/lib/tasks/api';
import { forbidden, notFound, storage } from './session';

/**
 * Fake sales-panel API (docs/backend-changes.md S1–S20) and the staff tasks endpoint (T1–T12).
 * Nima (user 3, sales team) is the seller; everyone else gets 403, like Django's IsSeller.
 * One list of customers feeds every page, so a logged call shows up on Today, Leads and the board.
 */

const SELLERS = new Set([3]);
const BASE = '/api/sales/v1';
export const SELLER = 'نیما رستمی';

const MINUTE = 60_000;
const DAY = 86_400_000;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
/** Today (+ `days`) at hh:mm, local time. */
const at = (hour: number, minute = 0, days = 0) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export interface MockLead {
  id: number;
  source: LeadSource;
  cause: string;
  /** Today's "why call" line. */
  reason: string;
  score: number;
  stage: LeadStage;
  lost_reason: LostReason | null;
  follow_up_at: string | null;
  last_contact: { at: string; summary: string } | null;
  created_at: string;
  stage_since: string;
  summary: string;
  amount: number | null;
  paid: number | null;
  manager: boolean;
  receipt: boolean;
}

export interface MockCustomer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  degree: Degree | null;
  field: string | null;
  countries: string[];
  budget: string | null;
  lead: MockLead;
}

let nextId = 500;
/** A fresh id for anything the mock creates. */
export const newId = () => nextId++;

const lead = (
  id: number,
  source: LeadSource,
  cause: string,
  reason: string,
  score: number,
  stage: LeadStage,
  extra: Partial<MockLead> = {},
): MockLead => ({
  id,
  source,
  cause,
  reason,
  score,
  stage,
  lost_reason: null,
  follow_up_at: null,
  last_contact: null,
  created_at: daysAgo(3),
  stage_since: daysAgo(2),
  summary: reason,
  amount: null,
  paid: null,
  manager: false,
  receipt: false,
  ...extra,
});

const customer = (
  id: number,
  name: string,
  phone: string,
  degree: Degree | null,
  countries: string[],
  item: MockLead,
  extra: Partial<MockCustomer> = {},
): MockCustomer => ({
  id,
  name,
  phone,
  email: `user${String(id)}@example.com`,
  degree,
  field: null,
  countries,
  budget: null,
  lead: item,
  ...extra,
});

export const ERFAN = 105;

function customers(): MockCustomer[] {
  return [
    customer(
      101,
      'کیانا رضوی',
      '09121234418',
      2,
      ['کانادا'],
      lead(
        1,
        'failed_purchase',
        'مشاوره‌ی اپلای کانادا',
        'پرداخت ۴٫۵ میلیون تومانی «مشاوره‌ی اپلای کانادا» ناموفق شد · ارشد · بودجه بالای ۱ میلیارد',
        86,
        'new',
        {
          created_at: minutesAgo(4),
          stage_since: minutesAgo(4),
          summary: 'خرید ناموفق مشاوره‌ی کانادا',
        },
      ),
    ),
    customer(
      102,
      'پویا عسگری',
      '09351232207',
      3,
      ['آمریکا'],
      lead(
        2,
        'call_request',
        'از صفحه‌ی قفل «اپلای‌ها»',
        'از پنل «درخواست تماس مشاور» زد، روی صفحه‌ی قفل «اپلای‌ها» · دکتری آمریکا · آیلتس ۷',
        74,
        'new',
        { created_at: minutesAgo(10), stage_since: minutesAgo(10), summary: 'درخواست تماس از پنل' },
      ),
    ),
    customer(
      103,
      'هانیه کرمی',
      '09129876543',
      1,
      ['ایتالیا'],
      lead(
        3,
        'campaign',
        'وبینار «پذیرش بدون آزمون زبان در ایتالیا»',
        'در وبینار «پذیرش بدون آزمون زبان در ایتالیا» ثبت‌نام کرد · کارشناسی',
        52,
        'new',
        { created_at: minutesAgo(33), stage_since: minutesAgo(33), summary: 'وبینار ایتالیا' },
      ),
    ),
    customer(
      104,
      'محمد یزدانی',
      '09191238031',
      2,
      ['آلمان'],
      lead(
        4,
        'consultation',
        'مشاوره‌ی اپلای ارشد · ۳ روز پیش',
        'پیشنهاد «اپلای کامل آلمان» را دیروز گرفت · گفت با خانواده مشورت می‌کند',
        81,
        'offer',
        {
          follow_up_at: at(11),
          last_contact: { at: daysAgo(1), summary: 'پیشنهاد اپلای کامل' },
          stage_since: daysAgo(1),
          summary: 'اپلای کامل آلمان · ۸ اپلای',
          amount: 110_000_000,
        },
      ),
    ),
    customer(
      ERFAN,
      'عرفان ملکی',
      '09101236194',
      2,
      ['هلند', 'آلمان'],
      lead(
        5,
        'consultation',
        'مشاوره‌ی ۳۰ دقیقه‌ای · هفته‌ی پیش',
        'مشاوره‌ی ۳۰ دقیقه‌ای خریده، قرارداد ندارد · آیلتس ۶٫۵',
        63,
        'consulted',
        {
          follow_up_at: at(14, 30),
          last_contact: { at: daysAgo(4), summary: 'جلسه‌ی مشاوره' },
          created_at: daysAgo(8),
          stage_since: daysAgo(4),
          summary: 'مشاوره‌ی ارشد هلند',
          amount: 95_000_000,
        },
      ),
      {
        field: 'هوش مصنوعی',
        budget: '۵۰۰ میلیون تا ۱ میلیارد تومان',
        email: 'erfan.m@example.com',
      },
    ),
    customer(
      106,
      'سمیرا نوروزی',
      '09121237756',
      2,
      ['کانادا'],
      lead(
        6,
        'campaign',
        'وبینار «اپلای کانادا ۲۰۲۷»',
        'دو بار جواب نداد · پیامک تماس بی‌پاسخ رفته · ارشد کانادا',
        68,
        'contacted',
        {
          follow_up_at: daysAgo(2),
          last_contact: { at: daysAgo(3), summary: '۲ تماس بی‌پاسخ' },
          stage_since: daysAgo(9),
          summary: '۲ تماس بی‌پاسخ · پیامک رفت',
        },
      ),
    ),
    customer(
      107,
      'فرناز قاسمی',
      '09121231111',
      2,
      ['انگلستان'],
      lead(7, 'failed_purchase', 'نگارش SOP', 'خرید ناموفق «نگارش SOP» · دیروز ۲۱:۴۰', 57, 'new', {
        created_at: daysAgo(1),
        stage_since: daysAgo(1),
        summary: 'خرید ناموفق نگارش SOP',
      }),
    ),
    customer(
      108,
      'بهراد تقوی',
      '09011233382',
      2,
      ['هلند'],
      lead(
        8,
        'chance_estimate',
        'شانس «خوب» برای هلند',
        'از تخمین شانس پذیرش: شانس «خوب» برای هلند · بودجه ۵۰۰ م تا ۱ میلیارد',
        49,
        'new',
        { created_at: daysAgo(1), stage_since: daysAgo(1), summary: 'تخمین شانس پذیرش هلند' },
      ),
    ),
    customer(
      109,
      'لیلا امینی',
      '09391235512',
      1,
      ['ترکیه'],
      lead(
        9,
        'failed_purchase',
        'رویداد «تحصیل رایگان ترکیه»',
        'بودجه را کافی ندانست · خواست ماه بعد دوباره تماس بگیریم',
        38,
        'contacted',
        {
          follow_up_at: at(17),
          last_contact: { at: daysAgo(7), summary: 'گفت ماه بعد' },
          stage_since: daysAgo(6),
          summary: 'بودجه را کافی ندانست',
        },
      ),
    ),
    customer(
      110,
      'داوود صالحی',
      '09121232290',
      2,
      ['کانادا'],
      lead(
        10,
        'consultation',
        'مشاوره‌ی اپلای کانادا',
        'قرارداد اقساطی را پرسید · منتظر جواب پدرش',
        33,
        'offer',
        {
          follow_up_at: daysAgo(1),
          last_contact: { at: daysAgo(3), summary: 'پیشنهاد اقساطی' },
          stage_since: daysAgo(8),
          summary: 'اپلای + ویزا کانادا · اقساطی',
          amount: 185_000_000,
        },
      ),
    ),
    customer(
      111,
      'نازنین کریمی',
      '09121233344',
      2,
      ['ایتالیا'],
      lead(
        11,
        'consultation',
        'مشاوره‌ی ویزای تحصیلی',
        'پیش‌نویس قرارداد منتظر تأیید مدیر',
        77,
        'draft',
        {
          last_contact: { at: minutesAgo(300), summary: 'پیش‌نویس قرارداد' },
          stage_since: minutesAgo(300),
          summary: 'ویزای تحصیلی + اپلای ایتالیا',
          amount: 120_000_000,
          manager: true,
        },
      ),
    ),
    customer(
      112,
      'کیان مرادی',
      '09121231045',
      2,
      ['ایتالیا'],
      lead(12, 'manual', 'معرفی از طرف یک متقاضی سابق', 'قسط اول پرداخت شد', 77, 'won', {
        last_contact: { at: minutesAgo(120), summary: 'قسط اول پرداخت شد' },
        stage_since: minutesAgo(120),
        summary: 'اپلای کامل ایتالیا',
        amount: 120_000_000,
        paid: 12_000_000,
        receipt: true,
      }),
    ),
    customer(
      113,
      'نیما رستگار',
      '09121239908',
      3,
      ['کانادا'],
      lead(13, 'campaign', 'لندینگ «بورسیه‌ی دکتری»', 'بودجه کافی نیست', 41, 'lost', {
        lost_reason: 'budget',
        last_contact: { at: daysAgo(14), summary: 'گفت بودجه ندارد' },
        stage_since: daysAgo(14),
      }),
    ),
  ];
}

interface MockConsultation {
  id: number;
  customer: number;
  type: { id: number; name: string };
  mode: 'online' | 'in_person';
  minutes: number;
  starts_at: string;
  logged: boolean;
  meeting_url: string | null;
}

const MASTER = { id: 1, name: 'مشاوره‌ی اپلای ارشد' };
const PHD = { id: 2, name: 'مشاوره‌ی اپلای دکتری' };
const VISA = { id: 3, name: 'مشاوره‌ی ویزای تحصیلی' };
const TYPES = [MASTER, PHD, VISA];

const consultations = (): MockConsultation[] => [
  {
    id: 1,
    customer: 106,
    type: MASTER,
    mode: 'online',
    minutes: 30,
    starts_at: at(16, 0, -1),
    logged: false,
    meeting_url: null,
  },
  {
    id: 2,
    customer: 109,
    type: VISA,
    mode: 'in_person',
    minutes: 45,
    starts_at: at(11, 0, -1),
    logged: false,
    meeting_url: null,
  },
  {
    id: 3,
    customer: 104,
    type: MASTER,
    mode: 'online',
    minutes: 30,
    starts_at: at(10, 30),
    logged: true,
    meeting_url: null,
  },
  {
    id: 4,
    customer: 111,
    type: VISA,
    mode: 'in_person',
    minutes: 45,
    starts_at: new Date(Date.now() + 20 * MINUTE).toISOString(),
    logged: false,
    meeting_url: null,
  },
  {
    id: 5,
    customer: 110,
    type: PHD,
    mode: 'online',
    minutes: 30,
    starts_at: new Date(Date.now() + 5 * 3_600_000).toISOString(),
    logged: false,
    meeting_url: 'https://meet.example.com/abc',
  },
  {
    id: 6,
    customer: ERFAN,
    type: MASTER,
    mode: 'in_person',
    minutes: 30,
    starts_at: at(15, 30, 2),
    logged: false,
    meeting_url: null,
  },
];

export interface SalesState {
  customers: MockCustomer[];
  consultations: MockConsultation[];
  receipts: PendingReceipt[];
  history: Map<number, HistoryEvent[]>;
  tasks: Map<number, TaskSummary[]>;
  /** Per customer, filled on first use by src/mocks/salesCustomer.ts. */
  payments: Map<number, PaymentRow[]>;
  info: Map<number, CustomerInfo>;
  offers: Map<number, Offer>;
}

function erfanHistory(): HistoryEvent[] {
  const event = (
    id: string,
    kind: HistoryEvent['kind'],
    when: string,
    text: string,
    extra: Partial<HistoryEvent> = {},
  ): HistoryEvent => ({
    id,
    kind,
    at: when,
    author: SELLER,
    channel: null,
    title: null,
    text,
    stage: null,
    ...extra,
  });
  return [
    event(
      'contact-5',
      'call',
      daysAgo(4),
      'بعد از مشاوره زنگ زدم. هلند گزینه‌ی اول است، آلمان دوم. نمره‌ی آیلتس ۶٫۵ دارد. منتظر صحبت با خانواده.',
      { stage: 'consulted' },
    ),
    event(
      'reservation-9',
      'meeting',
      daysAgo(5),
      'مشاوره‌ی ۳۰ دقیقه‌ای اپلای ارشد. پیشنهاد مشاور: ۶ اپلای هلند و آلمان، شروع نگارش از آذر.',
      { author: 'حسین رحیمی' },
    ),
    event('payment-31', 'payment', daysAgo(6), '۱٫۵ میلیون تومان · پرداخت آنلاین موفق', {
      author: null,
      title: 'مشاوره‌ی اپلای ارشد',
    }),
    event('contact-4', 'no_answer', daysAgo(7), 'پیامک «تماس بی‌پاسخ» خودکار ارسال شد.'),
    event('contact-3', 'message', daysAgo(7), 'پیام آماده‌ی «معرفی و لینک رزرو مشاوره» ارسال شد.', {
      channel: 'whatsapp',
    }),
    event('payment-30', 'payment_failed', daysAgo(8), 'مشاوره‌ی اپلای ارشد · درگاه بانک خطا داد.', {
      author: null,
      title: 'مشاوره‌ی اپلای ارشد',
    }),
    event(
      'lead-5',
      'lead',
      daysAgo(8),
      'علت: خرید ناموفق مشاوره · اولین تماس ۱۱ ساعت بعد (هدف: ۱۵ دقیقه)',
    ),
  ];
}

function erfanTasks(): TaskSummary[] {
  return [
    {
      id: 1,
      kind: 'mine',
      status: 'open',
      text: 'بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود',
      due_at: at(14, 30),
      owner: SELLER,
      creator: SELLER,
      team: null,
      automatic: false,
    },
    {
      id: 2,
      kind: 'request',
      status: 'seen',
      text: 'جلسه‌ی دوم مشاوره درباره‌ی بورسیه‌های هلند',
      due_at: daysAgo(1),
      owner: 'حسین رحیمی',
      creator: SELLER,
      team: null,
      automatic: false,
    },
    {
      id: 3,
      kind: 'team',
      status: 'queued',
      text: 'نمونه‌ی انگیزه‌نامه‌ی ارشد هوش مصنوعی برای عرفان',
      due_at: at(18, 0, 2),
      owner: null,
      creator: null,
      team: 'writing',
      automatic: true,
    },
  ];
}

const salesState = (): SalesState => ({
  customers: customers(),
  consultations: consultations(),
  receipts: [
    {
      payment: 41,
      customer: 112,
      name: 'کیان مرادی',
      amount: 12_000_000,
      what: 'قسط اول قرارداد اپلای کامل',
      method: 'card',
      uploaded_at: minutesAgo(120),
      receipt_url: '#',
    },
    {
      payment: 42,
      customer: 104,
      name: 'محمد یزدانی',
      amount: 3_500_000,
      what: 'نگارش رزومه',
      method: 'iban',
      uploaded_at: daysAgo(1),
      receipt_url: '#',
    },
  ],
  history: new Map([[ERFAN, erfanHistory()]]),
  tasks: new Map([[ERFAN, erfanTasks()]]),
  payments: new Map(),
  info: new Map(),
  offers: new Map(),
});

let state: SalesState | null = null;

export function stateOrError(): SalesState | Response {
  const user = storage.get();
  if (!user || !SELLERS.has(user)) return forbidden();
  state ??= salesState();
  return state;
}

export const failed = (value: SalesState | Response): value is Response =>
  value instanceof Response;

const startOfToday = () => new Date(at(0)).getTime();
const endOfToday = () => startOfToday() + DAY;

/** new / today / overdue, or null when the lead isn't due today. */
function bucketOf(item: MockLead): CallItem['bucket'] | null {
  if (item.stage === 'won' || item.stage === 'lost' || item.stage === 'draft') return null;
  if (item.stage === 'new' && !item.last_contact) return 'new';
  if (!item.follow_up_at) return null;
  const due = new Date(item.follow_up_at).getTime();
  if (due < startOfToday()) return 'overdue';
  return due < endOfToday() ? 'today' : null;
}

const BUCKET_ORDER = { new: 0, overdue: 1, today: 2 } as const;

function todayOf(data: SalesState): TodayData {
  const fresh = data.customers.filter(
    (item) => item.lead.stage === 'new' && !item.lead.last_contact,
  );
  const calls = data.customers
    .map((item) => ({ item, bucket: bucketOf(item.lead) }))
    .filter(
      (entry): entry is { item: MockCustomer; bucket: CallItem['bucket'] } => entry.bucket !== null,
    )
    .sort(
      (a, b) =>
        BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || b.item.lead.score - a.item.lead.score,
    )
    .map(({ item, bucket }) => ({
      lead: item.lead.id,
      customer: item.id,
      name: item.name,
      phone: item.phone,
      score: item.lead.score,
      reason: item.lead.reason,
      stage: item.lead.stage,
      bucket,
      follow_up_at: item.lead.follow_up_at,
    }));
  const nameOf = (id: number) => data.customers.find((item) => item.id === id)?.name ?? '';
  return {
    hot: fresh
      .filter((item) => Date.now() - new Date(item.lead.created_at).getTime() < DAY)
      .sort((a, b) => a.lead.created_at.localeCompare(b.lead.created_at))
      .map((item) => ({
        lead: item.lead.id,
        customer: item.id,
        name: item.name,
        phone: item.phone,
        score: item.lead.score,
        created_at: item.lead.created_at,
        reason: item.lead.reason,
        source: item.lead.source,
      })),
    calls,
    tasks: { overdue: 3, requests: 3, team: 2 },
    consultations: data.consultations
      .filter((item) => {
        const time = new Date(item.starts_at).getTime();
        return time >= startOfToday() && time < endOfToday();
      })
      .map((item) => ({
        id: item.id,
        customer: item.customer,
        name: nameOf(item.customer),
        type: item.type.name,
        mode: item.mode,
        starts_at: item.starts_at,
        logged: item.logged,
      })),
    receipts: data.receipts,
    month: {
      won: data.customers.filter((item) => item.lead.stage === 'won').length + 6,
      target: 12,
      conversion: 0.18,
      first_call_minutes: 22,
      working_days_left: 8,
      drafts_waiting: data.customers.filter((item) => item.lead.stage === 'draft').length,
    },
    upsell: [
      { kind: 'admitted', customer: 120, name: 'زهرا موسوی', university: 'Uppsala University' },
      { kind: 'ending', customer: 121, name: 'علی نوری', days: 14, admissions: 2 },
      {
        kind: 'no_contract',
        customers: [
          { id: 122, name: 'سارا حیدری' },
          { id: 123, name: 'کامران زارع' },
          { id: 124, name: 'یاسمن شریفی' },
        ],
      },
    ],
  };
}

function rowOf(item: MockCustomer): LeadRow {
  return {
    id: item.lead.id,
    customer: item.id,
    name: item.name,
    phone: item.phone,
    degree: item.degree,
    countries: item.countries,
    source: item.lead.source,
    cause: item.lead.cause,
    score: item.lead.score,
    stage: item.lead.stage,
    lost_reason: item.lead.lost_reason,
    follow_up_at: item.lead.follow_up_at,
    last_contact: item.lead.last_contact,
    created_at: item.lead.created_at,
  };
}

const PAGE_SIZE = 10;

function leadsOf(data: SalesState, url: URL): LeadsData {
  const params = url.searchParams;
  const search = (params.get('search') ?? '').trim();
  const overdue = params.get('overdue') === '1';
  const base = data.customers.filter(
    (item) =>
      (!params.get('source') || item.lead.source === params.get('source')) &&
      (!params.get('band') || scoreBand(item.lead.score) === params.get('band')) &&
      (!overdue || bucketOf(item.lead) === 'overdue') &&
      (!search ||
        item.name.includes(search) ||
        item.phone.includes(search) ||
        (item.email ?? '').includes(search)),
  );
  const stage = params.get('stage');
  const matching = base.filter((item) => !stage || item.lead.stage === stage);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const counts = Object.fromEntries([
    ['all', base.length],
    ...STAGES.map((value) => [value, base.filter((item) => item.lead.stage === value).length]),
  ]) as LeadsData['counts'];
  const fresh = data.customers.filter((item) => bucketOf(item.lead) === 'new');
  const oldest = fresh.reduce<number | null>((max, item) => {
    const minutes = Math.round((Date.now() - new Date(item.lead.created_at).getTime()) / MINUTE);
    return max === null || minutes > max ? minutes : max;
  }, null);
  const overdueLeads = data.customers.filter((item) => bucketOf(item.lead) === 'overdue');
  const today = data.customers.filter((item) => bucketOf(item.lead) === 'today');
  return {
    counts,
    stats: {
      new_waiting: fresh.length,
      oldest_new_minutes: oldest,
      today: today.length,
      today_before_noon: today.filter(
        (item) => new Date(item.lead.follow_up_at ?? 0).getHours() < 12,
      ).length,
      overdue: overdueLeads.length,
      max_overdue_days: Math.max(
        0,
        ...overdueLeads.map((item) =>
          Math.ceil((Date.now() - new Date(item.lead.follow_up_at ?? 0).getTime()) / DAY),
        ),
      ),
      first_call_minutes: 22,
    },
    count: matching.length,
    page_size: PAGE_SIZE,
    results: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(rowOf),
  };
}

function nextOf(item: MockLead): NextStep | null {
  if (item.stage === 'new' && !item.last_contact) return { kind: 'call_now' };
  if (item.manager) return { kind: 'manager' };
  if (item.receipt) return { kind: 'receipt' };
  return item.follow_up_at ? { kind: 'follow_up', at: item.follow_up_at } : null;
}

const CARDS_PER_COLUMN = 3;

function boardOf(data: SalesState): BoardData {
  const card = (item: MockCustomer): BoardCard => ({
    lead: item.lead.id,
    customer: item.id,
    name: item.name,
    score: item.lead.score,
    summary: item.lead.summary,
    amount: item.lead.amount,
    paid: item.lead.paid,
    stage_since: item.lead.stage_since,
    next: nextOf(item.lead),
  });
  const columns = BOARD_STAGES.map((stage) => {
    const items = data.customers.filter((item) => item.lead.stage === stage);
    const priced = items.filter((item) => item.lead.amount !== null);
    return {
      stage,
      count: items.length,
      value: priced.length ? priced.reduce((sum, item) => sum + (item.lead.amount ?? 0), 0) : null,
      cards: items.slice(0, CARDS_PER_COLUMN).map(card),
    };
  });
  const lost = data.customers.filter((item) => item.lead.stage === 'lost');
  return {
    open_value: data.customers
      .filter((item) => item.lead.stage === 'offer' || item.lead.stage === 'draft')
      .reduce((sum, item) => sum + (item.lead.amount ?? 0), 0),
    columns,
    lost: {
      total: lost.length + 4,
      reasons: [
        {
          reason: 'budget',
          count: 2 + lost.filter((item) => item.lead.lost_reason === 'budget').length,
        },
        { reason: 'competitor', count: 1 },
        { reason: 'gave_up', count: 1 },
        { reason: 'no_answer', count: 1 },
      ],
    },
  };
}

function customerOf(data: SalesState, item: MockCustomer): CustomerData {
  const first = item.name.split(' ')[0] ?? item.name;
  const erfan = item.id === ERFAN;
  return {
    id: item.id,
    name: item.name,
    phone: item.phone,
    email: item.email,
    lead: {
      id: item.lead.id,
      source: item.lead.source,
      stage: item.lead.stage,
      score: item.lead.score,
      follow_up_at: item.lead.follow_up_at,
      lost_reason: item.lead.lost_reason,
      seller: SELLER,
    },
    headline: {
      degree: item.degree,
      field: item.field,
      countries: item.countries,
      budget: item.budget,
    },
    score_factors: erfan
      ? [
          { label: 'مشاوره‌ی پولی خریده', points: 20 },
          { label: 'بودجه ۵۰۰ م تا ۱ میلیارد', points: 15 },
          { label: 'آیلتس ۶٫۵ دارد', points: 12 },
          { label: 'معدل ۱۶٫۲ · کامپیوتر', points: 10 },
          { label: 'هلند: کشور با نرخ پذیرش بالا', points: 8 },
          { label: '۴ روز بدون تماس', points: -2 },
        ]
      : [{ label: 'منبع لید', points: Math.round(item.lead.score / 2) }],
    similar: erfan
      ? {
          background: 'کارشناسی کامپیوتر، معدل ۱۵٫۵ تا ۱۷',
          count: 4,
          universities: ['TU Delft', 'University of Twente', 'TU Munich', 'RWTH Aachen'],
        }
      : null,
    profile: erfan
      ? [
          { key: 'current_degree', value: 'کارشناسی کامپیوتر · فارغ‌التحصیل' },
          { key: 'wanted_degree', value: 'کارشناسی ارشد' },
          { key: 'gpa', value: '۱۶٫۲' },
          { key: 'language', value: 'IELTS 6.5' },
          { key: 'countries', value: 'هلند، آلمان' },
          { key: 'budget', value: '۵۰۰ م تا ۱ میلیارد تومان' },
          { key: 'city', value: 'شیراز' },
          { key: 'military', value: 'معافیت تحصیلی' },
          { key: 'referral', value: 'اینستاگرام' },
        ]
      : [{ key: 'countries', value: item.countries.join('، ') }],
    purchases: erfan
      ? [
          { label: 'مشاوره‌ی اپلای ارشد · ۳۰ دقیقه', status: 'paid' },
          { label: 'وبینار «اپلای هلند»', status: 'paid' },
        ]
      : [],
    credit: 0,
    counts: { purchases: erfan ? 3 : 0, payments: erfan ? 4 : 0 },
    tasks: data.tasks.get(item.id) ?? [],
    templates: [
      {
        id: 1,
        title: 'پیگیری بعد از مشاوره',
        text: `سلام ${first} جان، ${SELLER} از اسکورایز هستم. امیدوارم مشاوره مفید بوده باشد. پیشنهاد اپلای را آماده کردم؛ کی وقت دارید ۱۰ دقیقه صحبت کنیم؟`,
      },
      {
        id: 2,
        title: 'ارسال پیشنهاد و اقساط',
        text: `سلام ${first} جان، پیشنهاد اپلای با پرداخت ۳ قسطی در پنل شما قرار گرفت. لینک: scorize.com/panel`,
      },
      {
        id: 3,
        title: 'تماس بی‌پاسخ',
        text: `سلام ${first} جان، چند دقیقه پیش تماس گرفتم و موفق به صحبت نشدیم. هر زمان راحت بودید همین‌جا خبر بدهید.`,
      },
    ],
    colleagues: [
      { id: 21, name: 'حسین رحیمی', role: 'مشاور این مشتری' },
      { id: 7, name: 'مریم کاظمی', role: 'سوپروایزر' },
      { id: 22, name: 'الهام رضوی', role: 'سرپرست تیم نگارش' },
    ],
  };
}

const HISTORY_PAGE = 5;

const STAGE_RANK = Object.fromEntries(STAGES.map((stage, index) => [stage, index])) as Record<
  LeadStage,
  number
>;

function logContact(data: SalesState, item: MockCustomer, log: ContactLog) {
  const now = new Date().toISOString();
  const noAnswer = log.channel === 'call' && log.outcome === 'no_answer';
  const kind: HistoryEvent['kind'] = noAnswer
    ? 'no_answer'
    : log.channel === 'call'
      ? 'call'
      : log.channel === 'meeting'
        ? 'meeting'
        : 'message';
  const history = data.history.get(item.id) ?? [];
  history.unshift({
    id: `contact-${String(nextId++)}`,
    kind,
    at: now,
    author: SELLER,
    channel: kind === 'message' ? log.channel : null,
    title: null,
    text: noAnswer ? 'پیامک «تماس بی‌پاسخ» خودکار ارسال شد.' : log.notes,
    stage: log.stage ?? null,
  });
  data.history.set(item.id, history);
  // An unanswered call doesn't count as reaching the customer (S4).
  if (!noAnswer) {
    item.lead.last_contact = { at: now, summary: log.notes.slice(0, 40) || 'تماس' };
    if (item.lead.stage === 'new') item.lead.stage = 'contacted';
  }
  if (log.stage && log.stage !== item.lead.stage) {
    item.lead.stage = log.stage;
    item.lead.stage_since = now;
    item.lead.lost_reason = log.stage === 'lost' ? (log.lost_reason ?? null) : null;
  }
  // No answer: a follow-up for tomorrow is made automatically.
  item.lead.follow_up_at = noAnswer ? at(10, 0, 1) : log.follow_up_at;
  if (log.reservation) {
    const session = data.consultations.find((entry) => entry.id === log.reservation);
    if (session) session.logged = true;
  }
}

function monthOf(data: SalesState): MonthData {
  const won = data.customers.filter((item) => item.lead.stage === 'won').length + 6;
  return {
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    won,
    target: 12,
    elapsed: 0.74,
    working_days_left: 8,
    sales: 640_000_000,
    commission: null,
    drafts_waiting: data.customers.filter((item) => item.lead.stage === 'draft').length,
    rank: { position: 2, of: 5 },
    funnel: { leads: 48, reached: 41, consulted: 18, offered: 12, won },
    team_conversion: 0.12,
    weeks: [48, 35, 26, 22],
    sources: [
      { source: 'consultation', leads: 9, won: 3 },
      { source: 'call_request', leads: 6, won: 2 },
      { source: 'failed_purchase', leads: 14, won: 1 },
      { source: 'campaign', leads: 12, won: 1 },
      { source: 'chance_estimate', leads: 7, won: 0 },
    ],
  };
}

function consultationsOf(data: SalesState, url: URL): ConsultationsData {
  const now = Date.now();
  const weekEnd = startOfToday() + 7 * DAY;
  const inRange = (item: MockConsultation, range: ConsultationRange) => {
    const time = new Date(item.starts_at).getTime();
    if (range === 'today') return time >= startOfToday() && time < endOfToday();
    if (range === 'week') return time >= startOfToday() - DAY && time < weekEnd;
    if (range === 'past') return time < now;
    return true;
  };
  const range = (url.searchParams.get('range') ?? 'week') as ConsultationRange;
  const type = Number(url.searchParams.get('type')) || null;
  const unlogged = url.searchParams.get('unlogged') === '1';
  const ranges: ConsultationRange[] = ['today', 'week', 'past', 'all'];
  const person = (id: number) => data.customers.find((item) => item.id === id);
  return {
    counts: Object.fromEntries(
      ranges.map((value) => [
        value,
        data.consultations.filter((item) => inRange(item, value)).length,
      ]),
    ) as ConsultationsData['counts'],
    unlogged: data.consultations.filter(
      (item) => !item.logged && new Date(item.starts_at).getTime() < now,
    ).length,
    types: TYPES,
    results: data.consultations
      .filter(
        (item) =>
          inRange(item, range) &&
          (type === null || item.type.id === type) &&
          (!unlogged || (!item.logged && new Date(item.starts_at).getTime() < now)),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((item) => ({
        ...item,
        name: person(item.customer)?.name ?? '',
        phone: person(item.customer)?.phone ?? '',
      })),
  };
}

export const salesHandlers = [
  http.get(`${BASE}/today/`, () => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json(todayOf(data));
  }),

  http.get(`${BASE}/leads/`, ({ request }) => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json(leadsOf(data, new URL(request.url)));
  }),

  http.post(`${BASE}/leads/`, async ({ request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const body = (await request.json()) as NewLead;
    if (!/^09\d{9}$/.test(body.phone))
      return HttpResponse.json({ phone: ['invalid'] }, { status: 400 });
    if (data.customers.some((item) => item.phone === body.phone))
      return HttpResponse.json({ phone: ['exists'] }, { status: 400 });
    const id = nextId++;
    data.customers.push(
      customer(
        id,
        `${body.first_name} ${body.last_name}`.trim(),
        body.phone,
        null,
        [],
        lead(id, 'manual', body.note || 'ثبت دستی', body.note || 'ثبت دستی', 40, 'new', {
          created_at: new Date().toISOString(),
          stage_since: new Date().toISOString(),
        }),
      ),
    );
    return HttpResponse.json({ customer: id }, { status: 201 });
  }),

  http.post(`${BASE}/leads/bulk/`, async ({ request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const body = (await request.json()) as {
      ids: number[];
      stage?: LeadStage;
      follow_up_at?: string;
    };
    for (const item of data.customers.filter((entry) => body.ids.includes(entry.lead.id))) {
      if (body.stage && STAGE_RANK[body.stage] >= 0) {
        item.lead.stage = body.stage;
        item.lead.stage_since = new Date().toISOString();
      }
      if (body.follow_up_at) item.lead.follow_up_at = body.follow_up_at;
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/board/`, () => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json(boardOf(data));
  }),

  http.get(`${BASE}/customers/:id/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = data.customers.find((entry) => entry.id === Number(params.id));
    return item ? HttpResponse.json(customerOf(data, item)) : notFound();
  }),

  http.get(`${BASE}/customers/:id/history/`, ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const id = Number(params.id);
    if (!data.customers.some((entry) => entry.id === id)) return notFound();
    const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
    const all = data.history.get(id) ?? [];
    return HttpResponse.json({
      results: all.slice((page - 1) * HISTORY_PAGE, page * HISTORY_PAGE),
      next: page * HISTORY_PAGE < all.length ? page + 1 : null,
    });
  }),

  http.post(`${BASE}/customers/:id/contacts/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = data.customers.find((entry) => entry.id === Number(params.id));
    if (!item) return notFound();
    const log = (await request.json()) as ContactLog;
    if (log.stage === 'lost' && !log.lost_reason)
      return HttpResponse.json({ lost_reason: ['required'] }, { status: 400 });
    logContact(data, item, log);
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(`${BASE}/customers/:id/notes/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const id = Number(params.id);
    if (!data.customers.some((entry) => entry.id === id)) return notFound();
    const { text } = (await request.json()) as { text: string };
    const history = data.history.get(id) ?? [];
    history.unshift({
      id: `note-${String(nextId++)}`,
      kind: 'note',
      at: new Date().toISOString(),
      author: SELLER,
      channel: null,
      title: null,
      text,
      stage: null,
    });
    data.history.set(id, history);
    return new HttpResponse(null, { status: 201 });
  }),

  http.get(`${BASE}/month/`, () => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json(monthOf(data));
  }),

  http.get(`${BASE}/consultations/`, ({ request }) => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json(consultationsOf(data, new URL(request.url)));
  }),

  // Existing Django endpoint (PaymentViewSet.confirm_receipt).
  http.patch('/api/profile/staff/v1/users/:user/payments/:id/confirm_receipt/', ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const index = data.receipts.findIndex(
      (item) => item.payment === Number(params.id) && item.customer === Number(params.user),
    );
    const payment = data.payments
      .get(Number(params.user))
      ?.find((item) => item.id === Number(params.id) && item.status === 'pending_receipt');
    if (index < 0 && !payment)
      return HttpResponse.json(
        { message: 'رسید پرداخت در انتظار تایید وجود ندارد!' },
        { status: 400 },
      );
    if (index >= 0) data.receipts.splice(index, 1);
    if (payment) payment.status = 'paid_by_receipt';
    return HttpResponse.json({ message: 'رسید پرداخت با موفقت تایید شد.' });
  }),
];

/** Forget the seller's changes (tests, logout). */
export function resetSalesMocks() {
  state = null;
}

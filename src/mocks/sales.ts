import { http, HttpResponse } from 'msw';
import type {
  ActivityInput,
  BoardCard,
  BoardColumn,
  BoardData,
  CallItem,
  MoveSteps,
  NextStep,
  Offer,
  PendingReceipt,
  StageActivity,
  StageInput,
  StagesData,
  TodayData,
} from '@/features/sales/api';
import type { MonthData } from '@/features/sales/api/month';
import { type Degree, type LeadSource, type LeadStage, type LostReason } from '@/lib/sales/api';
import { forbidden, notFound, pageOf, storage } from './session';
import { staffData } from './staff';

/**
 * Fake sales-panel API (docs/backend-changes.md S1–S20) and the staff tasks endpoint (T1–T12).
 * Nima (user 3, sales team) is the seller; everyone else gets 403, like Django's IsSeller.
 * One list of customers feeds every page, so a logged call shows up on Today, Leads and the board.
 */

/** Nima (seller) and Reza (sales manager). */
const SELLERS = new Set([3, 4]);
const NIMA = 3;
/** Nima's SupportStaff.full_name (src/mocks/handlers.ts). */
const NIMA_NAME = 'نیما رستمی';
const BASE = '/api/sales/v1';
/** Every mock account's password (same as the login mock). */
export const MONTH_PASSWORD = 'password123';
/** Django's `RECEIPTS_PAGE` (api/sales/v1/seller.py). */
const RECEIPTS_PAGE = 10;
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
  /** The team column (S48) while its phase is `stage`. */
  board_stage: number | null;
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
  board_stage: null,
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

/** The customers every sales mock shares (also the users of the fake staff API, src/mocks/staff.ts). */
export function customers(): MockCustomer[] {
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

/** A team column as Django stores it (SalesStage + StageActivity, S48). */
export interface MockStage {
  id: number;
  name: string;
  phase: 'contacted' | 'consulted' | 'offer';
  max_days: number | null;
  activities: StageActivity[];
}

/** Ready messages (Django's MessageTemplate) a column's `message` activity can show. */
export const MESSAGE_TEMPLATES = [
  {
    id: 1,
    title: 'پیشنهاد فرستاده شد',
    text: 'سلام {customer} عزیز، پیشنهاد را برایتان فرستادم. هر سؤالی داشتید بپرسید. {seller}',
  },
];

let activityId = 700;
/** The settings Django keeps for an activity of this kind (api/sales/v1/stages.py). */
function activityOf(input: ActivityInput): StageActivity {
  const timed = input.kind === 'follow_up' || input.kind === 'task';
  const form = timed || input.kind === 'note';
  const template = MESSAGE_TEMPLATES.find((item) => item.id === input.template) ?? null;
  return {
    id: activityId++,
    kind: input.kind,
    required: input.kind === 'follow_up' || (input.required && form),
    settings: {
      ...(timed && { days: input.days ?? 1, hour: input.hour ?? 10 }),
      ...(form && { text: input.text ?? '' }),
      ...(input.kind === 'message' && { template }),
    },
  };
}

/** Django's default columns, one per middle stage (user_profile/board.py). */
const defaultStages = (): MockStage[] => [
  {
    id: 501,
    name: 'تماس گرفته شد',
    phase: 'contacted',
    max_days: 3,
    activities: [activityOf({ kind: 'follow_up', required: true })],
  },
  {
    id: 502,
    name: 'مشاوره شد',
    phase: 'consulted',
    max_days: 5,
    activities: [
      activityOf({ kind: 'follow_up', required: true }),
      activityOf({ kind: 'offer', required: false }),
    ],
  },
  {
    id: 503,
    name: 'پیشنهاد ارسال شد',
    phase: 'offer',
    max_days: 7,
    activities: [
      activityOf({ kind: 'follow_up', required: true, days: 2 }),
      activityOf({ kind: 'message', required: false, template: 1 }),
    ],
  },
];

export interface SalesState {
  customers: MockCustomer[];
  consultations: MockConsultation[];
  offers: Map<number, Offer>;
  stages: MockStage[];
}

const salesState = (): SalesState => ({
  customers: customers(),
  consultations: consultations(),
  offers: new Map(),
  stages: defaultStages(),
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

const BUCKET_ORDER = { new: 0, today: 1, overdue: 2 } as const;

/** Receipts waiting in Django (Payment PENDING_RECEIPT of the seller's customers), oldest first. */
function receiptsOf(): PendingReceipt[] {
  const db = staffData();
  return db.payments
    .filter((row) => row.data.status === 5)
    .map(({ user, data: payment }) => {
      const person = db.users.get(user);
      return {
        payment: payment.id,
        customer: user,
        name: person ? `${person.first_name} ${person.last_name}` : '',
        amount: payment.amount,
        what:
          payment.description ??
          payment.invoices.map((item) => item.purchasable?.title ?? item.type_display).join('، '),
        method: 'card' as const,
        uploaded_at: payment.payment_date ?? payment.creation_datetime,
        receipt_url: payment.receipt_file ?? '#',
      };
    })
    .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
}

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
        minutes: item.minutes,
        logged: item.logged,
        meeting_url: item.meeting_url,
      })),
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
      { kind: 'admitted', customer: 120, name: 'زهرا موسوی', university: 'Lund University' },
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

function nextOf(item: MockLead): NextStep | null {
  if (item.stage === 'new' && !item.last_contact) return { kind: 'call_now' };
  if (item.manager) return { kind: 'manager' };
  if (item.receipt) return { kind: 'receipt' };
  return item.follow_up_at ? { kind: 'follow_up', at: item.follow_up_at } : null;
}

const CARDS_PER_COLUMN = 3;

/** The lead's column key, as Django's `column_of` (user_profile/board.py). */
function columnOf(data: SalesState, item: MockLead): string {
  if (item.stage === 'new' || item.stage === 'draft' || item.stage === 'won' || item.stage === 'lost')
    return item.stage;
  const own = data.stages.find((stage) => stage.id === item.board_stage);
  if (own?.phase === item.stage) return String(own.id);
  const first = data.stages.find((stage) => stage.phase === item.stage);
  return first ? String(first.id) : item.stage;
}

function boardOf(data: SalesState, manager: boolean): BoardData {
  const card = (item: MockCustomer): BoardCard => ({
    lead: item.lead.id,
    customer: item.id,
    name: item.name,
    score: item.lead.score,
    summary: item.lead.summary,
    amount: item.lead.amount,
    paid: item.lead.paid,
    stage_since: item.lead.stage_since,
    seller: manager ? NIMA_NAME : null,
    next: nextOf(item.lead),
  });
  const fixed = (stage: 'new' | 'draft' | 'won') => ({
    stage,
    id: null,
    name: null,
    max_days: null,
    activities: [],
  });
  const keys: Omit<BoardColumn, 'count' | 'value' | 'cards'>[] = [
    fixed('new'),
    ...data.stages.map(({ id, name, phase, max_days, activities }) => ({
      stage: phase,
      id,
      name,
      max_days,
      activities,
    })),
    fixed('draft'),
    fixed('won'),
  ];
  const columns = keys.map((column) => {
    const key = column.id === null ? column.stage : String(column.id);
    const items = data.customers.filter((item) => columnOf(data, item.lead) === key);
    const priced = items.filter((item) => item.lead.amount !== null);
    return {
      ...column,
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
    sellers: manager ? [{ id: 8, name: NIMA_NAME }] : [],
  };
}

/** The manager's settings page (api/sales/v1/stages.py `settings_data`). */
export function stagesOf(data: SalesState): StagesData {
  return {
    stages: data.stages.map((stage) => ({
      ...stage,
      cards: data.customers.filter((item) => columnOf(data, item.lead) === String(stage.id))
        .length,
    })),
    templates: MESSAGE_TEMPLATES.map(({ id, title }) => ({ id, title })),
  };
}

let stageId = 600;
/** Saves the whole list like Django's StagesView.put; an error code, or null. */
export function saveStages(
  data: SalesState,
  body: { stages: StageInput[]; moves: { source: number; to: number }[] },
): string | null {
  const order = ['contacted', 'consulted', 'offer'];
  const phases = body.stages.map((stage) => order.indexOf(stage.phase));
  if (phases.some((value, index) => index > 0 && value < (phases[index - 1] ?? 0))) return 'order';
  if (new Set(phases).size !== order.length) return 'phases';
  const kept = new Set(body.stages.flatMap((stage) => (stage.id === null ? [] : [stage.id])));
  const moves = new Map(body.moves.map((move) => [move.source, move.to]));
  for (const stage of data.stages.filter((item) => !kept.has(item.id))) {
    const cards = data.customers.filter((item) => columnOf(data, item.lead) === String(stage.id));
    const to = moves.get(stage.id);
    if (cards.length && to === undefined) return 'moves';
    const target = body.stages.find((item) => item.id === to);
    for (const item of cards) {
      if (!target) continue;
      item.lead.board_stage = to ?? null;
      item.lead.stage = target.phase;
    }
  }
  data.stages = body.stages.map((stage) => ({
    id: stage.id ?? stageId++,
    name: stage.name,
    phase: stage.phase,
    max_days: stage.max_days,
    activities: (stage.activities.some((activity) => activity.kind === 'follow_up')
      ? stage.activities
      : [{ kind: 'follow_up' as const, required: true }, ...stage.activities]
    ).map(activityOf),
  }));
  return null;
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

/** The calendar's types (S47): the mock's three, with Google Calendar colours. */
const CALENDAR_TYPES = [
  { ...MASTER, mode: 'online', color: '3' },
  { ...PHD, mode: 'online', color: '9' },
  { ...VISA, mode: 'in_person', color: '2' },
];
/** In-person arrivals marked in this run (reservation → when). */
const arrivals = new Map<number, string>();

/** The seller's consultations and timed follow-ups between two days (`YYYY-MM-DD`, both included). */
function calendarOf(data: SalesState, from: string, to: string) {
  const lastId = Math.max(...data.consultations.map((item) => item.id));
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime() + DAY;
  const inRange = (value: string | null) =>
    value !== null && new Date(value).getTime() >= start && new Date(value).getTime() < end;
  const nameOf = (id: number) => data.customers.find((item) => item.id === id);
  return {
    types: CALENDAR_TYPES,
    consultations: data.consultations
      .filter((item) => inRange(item.starts_at))
      .map((item) => ({
        id: item.id,
        customer: item.customer,
        name: nameOf(item.customer)?.name ?? '',
        phone: nameOf(item.customer)?.phone ?? '',
        type: item.type.id,
        mode: item.mode,
        minutes: item.minutes,
        starts_at: item.starts_at,
        logged: item.logged,
        // The tablet form: filled by every other customer.
        form: item.id % 2 === 1,
        arrived_at: arrivals.get(item.id) ?? null,
        // All Nima's; Reza (manager) sees them as someone else's, the last as nobody's yet.
        mine: storage.get() === NIMA,
        seller: storage.get() !== NIMA && item.id === lastId ? null : NIMA_NAME,
      })),
    calls: todayOf(data)
      .calls.filter((row) => inRange(row.follow_up_at))
      .map(({ lead, customer, name, phone, reason, follow_up_at }) => ({
        lead,
        customer,
        name,
        phone,
        reason,
        follow_up_at,
      })),
  };
}

export const salesHandlers = [
  http.get(`${BASE}/consultations/calendar/`, ({ request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const query = new URL(request.url).searchParams;
    return HttpResponse.json(calendarOf(data, query.get('from') ?? '', query.get('to') ?? ''));
  }),
  http.post(`${BASE}/consultations/:id/arrived/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const found = data.consultations.find((item) => item.id === Number(params.id));
    if (!found) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
    if (found.mode !== 'in_person')
      return HttpResponse.json(
        { detail: ['Only an in-person consultation has an arrival.'] },
        { status: 400 },
      );
    const when = arrivals.get(found.id) ?? new Date().toISOString();
    arrivals.set(found.id, when);
    return HttpResponse.json({ arrived_at: when });
  }),

  http.get(`${BASE}/today/:section?`, ({ request, params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const today = todayOf(data);
    if (params.section === 'outreach') {
      const url = new URL(request.url);
      const bucket = url.searchParams.get('bucket') ?? 'all';
      const hotUrl = new URL(request.url);
      hotUrl.searchParams.set('page', url.searchParams.get('hot_page') ?? '1');
      return HttpResponse.json({
        hot: pageOf(new Request(hotUrl), today.hot, 50),
        calls: {
          ...pageOf(
            request,
            today.calls.filter((row) => bucket === 'all' || row.bucket === bucket),
            6,
          ),
          counts: Object.fromEntries(
            ['all', 'new', 'today', 'overdue'].map((key) => [
              key,
              today.calls.filter((row) => key === 'all' || row.bucket === key).length,
            ]),
          ),
        },
      });
    }
    if (params.section === 'activity')
      return HttpResponse.json({
        tasks: today.tasks,
        consultations: pageOf(request, today.consultations, 20),
        calendar_calls: pageOf(
          request,
          today.calls.filter(
            (row) =>
              row.follow_up_at &&
              new Date(row.follow_up_at).getTime() >= startOfToday() &&
              new Date(row.follow_up_at).getTime() < endOfToday(),
          ),
          50,
        ),
      });
    if (params.section === 'insights')
      return HttpResponse.json({ month: today.month, upsell: today.upsell });
    return HttpResponse.json(today);
  }),

  http.get(`${BASE}/receipts/`, ({ request }) => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json(pageOf(request, receiptsOf(), RECEIPTS_PAGE));
  }),

  http.post(`${BASE}/leads/bulk/`, async ({ request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const body = (await request.json()) as {
      ids: number[];
      stage?: LeadStage;
      follow_up_at?: string;
    };
    const openStages: readonly LeadStage[] = ['new', 'contacted', 'consulted', 'offer'];
    if (body.stage && !openStages.includes(body.stage)) {
      return HttpResponse.json({ stage: ['invalid_choice'] }, { status: 400 });
    }
    for (const item of data.customers.filter(
      (entry) => body.ids.includes(entry.lead.id) && openStages.includes(entry.lead.stage),
    )) {
      if (body.stage) {
        item.lead.stage = body.stage;
        item.lead.stage_since = new Date().toISOString();
      }
      if (body.follow_up_at) item.lead.follow_up_at = body.follow_up_at;
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/board/`, () => {
    const data = stateOrError();
    return failed(data) ? data : HttpResponse.json(boardOf(data, storage.get() !== NIMA));
  }),

  // S48: a card into another column, with what that column asks for.
  http.post(`${BASE}/leads/:id/move/`, async ({ params, request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const item = data.customers.find((entry) => entry.lead.id === Number(params.id));
    if (!item) return notFound();
    if (!['new', 'contacted', 'consulted', 'offer'].includes(item.lead.stage))
      return HttpResponse.json({ detail: 'contract_stage' }, { status: 409 });
    const body = (await request.json()) as { to: string; steps?: MoveSteps };
    const steps = body.steps ?? {};
    if (body.to === 'new') {
      item.lead.board_stage = null;
      if (item.lead.stage !== 'new') item.lead.stage_since = new Date().toISOString();
      item.lead.stage = 'new';
      return new HttpResponse(null, { status: 204 });
    }
    const column = data.stages.find((stage) => String(stage.id) === body.to);
    if (!column) return HttpResponse.json({ to: ['invalid'] }, { status: 400 });
    const missing = column.activities.filter(
      (activity) =>
        (activity.required || activity.kind === 'follow_up') &&
        (activity.kind === 'follow_up' || activity.kind === 'task' || activity.kind === 'note') &&
        !steps[activity.kind],
    );
    if (missing.length)
      return HttpResponse.json(
        { steps: Object.fromEntries(missing.map((activity) => [activity.kind, ['required']])) },
        { status: 400 },
      );
    if (item.lead.stage !== column.phase) item.lead.stage_since = new Date().toISOString();
    item.lead.stage = column.phase;
    item.lead.board_stage = column.id;
    item.lead.lost_reason = null;
    if (steps.follow_up) item.lead.follow_up_at = steps.follow_up.due_at;
    return new HttpResponse(null, { status: 204 });
  }),

  // Planned (S17): a quick note. Django's history has no notes yet, so it doesn't show there.
  http.post(`${BASE}/customers/:id/notes/`, ({ params }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    return data.customers.some((entry) => entry.id === Number(params.id))
      ? new HttpResponse(null, { status: 201 })
      : notFound();
  }),

  // Read with the seller's password, on every visit (400 when wrong).
  http.post(`${BASE}/month/`, async ({ request }) => {
    const data = stateOrError();
    if (failed(data)) return data;
    const body = (await request.json()) as { password?: string };
    return body.password === MONTH_PASSWORD
      ? HttpResponse.json(monthOf(data))
      : HttpResponse.json({ password: ['The password is wrong.'] }, { status: 400 });
  }),
];

/** Forget the seller's changes (tests, logout). */
export function resetSalesMocks() {
  state = null;
  arrivals.clear();
}

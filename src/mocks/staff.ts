import { http, HttpResponse } from 'msw';
import {
  CONTACT_TYPE,
  FINANCE_TYPE,
  LEAD_CAUSE,
  TEAM,
  TODO_TYPE,
  type DjangoConsultationType,
  type DjangoContact,
  type DjangoCountry,
  type DjangoEducation,
  type DjangoExam,
  type DjangoExamScore,
  type DjangoHistoryItem,
  type DjangoInvoice,
  type DjangoLead,
  type DjangoPayment,
  type DjangoPersonal,
  type DjangoReservation,
  type DjangoStaff,
  type DjangoStudyField,
  type DjangoTodo,
  type DjangoTodoComment,
  type DjangoUser,
  type DjangoUserDetail,
  type DjangoUserInfo,
} from '@/lib/staff/api';
import { customers, ERFAN } from './sales';
import { forbidden, notFound, storage } from './session';

/**
 * Fake of Django's **existing** staff REST API (api/user_profile/staff and its lookups), the one
 * the panel uses until the panel endpoints ship. Field for field the serializers' JSON, with the
 * same permissions (IsSeller, IsSupportStaff), pagination (15 per page, `page_size` up to 50) and
 * filters the pages send. Its users are the sales mock's customers (src/mocks/sales.ts).
 */

const API = '/api';
const STAFF = `${API}/profile/staff/v1`;
const PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const later = (ms: number) => new Date(Date.now() + ms).toISOString();
/** Today (+ `days`) at hh:mm, local time. */
const at = (hour: number, minute = 0, days = 0) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
/** YYYY-MM-DD in local time (a DateField). */
export const localDate = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// ── Staff and who may call what ──────────────────────────────────────────────────────────────

const staff = (
  id: number,
  full_name: string,
  team: number,
  user: number,
  phone: string,
): DjangoStaff => {
  const [first_name = '', ...rest] = full_name.split(' ');
  return {
    id,
    full_name,
    picture: null,
    team,
    team_display: null,
    user: { id: user, first_name, last_name: rest.join(' '), email: null, phone_number: phone },
  };
};

const STAVES: DjangoStaff[] = [
  staff(7, 'مریم کاظمی', TEAM.executive, 2, '09120000001'),
  staff(8, 'نیما رستمی', TEAM.sales, 3, '09120000002'),
  staff(9, 'رضا کامرانی', TEAM.sales, 4, '09120000003'),
  staff(10, 'حسین رحیمی', TEAM.sales, 20, '09120000010'),
  staff(11, 'الهام رضوی', TEAM.writing, 21, '09120000011'),
  staff(12, 'سحر نادری', TEAM.language, 22, '09120000012'),
  staff(13, 'امیر توکلی', TEAM.writing, 23, '09120000013'),
];
export const NIMA_STAFF = 8;
const HOSSEIN = 10;

/** Without the nested `user`: how DSupportStaffSerializer nests in most responses. */
const brief = (id: number | null) => {
  const found = STAVES.find((item) => item.id === id);
  if (!found) return null;
  const { user: _user, ...rest } = found;
  return rest;
};

/** The logged-in user's SupportStaff, or null for customers. */
const meStaff = () => STAVES.find((item) => item.user?.id === storage.get()) ?? null;
/** `request.user.is_seller`: sales or support team (the mock's sellers: Nima, Reza). */
const isSeller = () => {
  const me = meStaff();
  return me !== null && (me.team === TEAM.sales || me.team === TEAM.support);
};
/** `can_assign_to_seller` / `can_manage_staff_todo`: the sales manager. */
const isManager = () => storage.get() === 4;

// ── Data ─────────────────────────────────────────────────────────────────────────────────────

interface Row<T> {
  user: number;
  data: T;
}

interface StaffDb {
  users: Map<number, DjangoUserDetail>;
  personal: Row<DjangoPersonal>[];
  info: Row<DjangoUserInfo>[];
  education: Row<DjangoEducation>[];
  examScores: Row<DjangoExamScore>[];
  payments: Row<DjangoPayment>[];
  contacts: (Row<DjangoContact> & { lead: number | null; reservation: number | null })[];
  leads: DjangoLead[];
  reservations: (DjangoReservation & { user: number })[];
  todos: DjangoTodo[];
  comments: DjangoTodoComment[];
}

let nextId = 9000;
const newId = () => nextId++;

export const EXAMS: DjangoExam[] = [
  { id: 1, name: 'IELTS Academic', min: 0, max: 9 },
  { id: 2, name: 'TOEFL iBT', min: 0, max: 120 },
  { id: 3, name: 'GRE', min: 260, max: 340 },
];

const COUNTRIES: DjangoCountry[] = [
  { id: 1, country: 'Canada', persian_name: 'کانادا' },
  { id: 2, country: 'Germany', persian_name: 'آلمان' },
  { id: 3, country: 'Netherlands', persian_name: 'هلند' },
  { id: 4, country: 'Italy', persian_name: 'ایتالیا' },
  { id: 5, country: 'United States', persian_name: 'آمریکا' },
  { id: 6, country: 'Sweden', persian_name: 'سوئد' },
  { id: 7, country: 'Turkey', persian_name: 'ترکیه' },
  { id: 8, country: 'United Kingdom', persian_name: 'انگلستان' },
];

const STUDY_FIELDS: DjangoStudyField[] = [
  { id: 1, name: 'Computer Engineering', name_persian: 'مهندسی کامپیوتر' },
  { id: 2, name: 'Mathematics and Physics', name_persian: 'ریاضی فیزیک' },
  { id: 3, name: 'Artificial Intelligence', name_persian: 'هوش مصنوعی' },
  { id: 4, name: 'Electrical Engineering', name_persian: 'مهندسی برق' },
  { id: 5, name: 'Civil Engineering', name_persian: 'مهندسی عمران' },
];

const CONSULTATION_TYPES: DjangoConsultationType[] = [
  [1, 'مشاوره‌ی اپلای ارشد', 1_500_000],
  [2, 'مشاوره‌ی اپلای دکتری', 2_200_000],
  [3, 'مشاوره‌ی ویزای تحصیلی', 1_800_000],
].map(([id, title, price]) => ({
  id: Number(id),
  title: String(title),
  price: Number(price),
  discounted_price: Number(price),
  is_taxed: false,
  type: 2,
  type_display: 'غیر حضوری',
  is_active: true,
}));

const purchasable = (id: number, title: string, price: number, type?: number) => ({
  id,
  title,
  price,
  discounted_price: price,
  is_taxed: false,
  ...(type === undefined ? {} : { type }),
});

const TYPE_DISPLAY: Record<number, string> = {
  [FINANCE_TYPE.general]: 'پرداخت نامعین',
  [FINANCE_TYPE.consultation]: 'رزرو مشاوره',
  [FINANCE_TYPE.writing]: 'سفارش نگارش',
  [FINANCE_TYPE.product]: 'خرید محصول',
  [FINANCE_TYPE.event]: 'ثبت نام رویداد',
};

const invoice = (
  type: number,
  item: ReturnType<typeof purchasable>,
  related: DjangoInvoice['related'] = null,
): DjangoInvoice => ({
  id: newId(),
  type,
  type_display: TYPE_DISPLAY[type] ?? '',
  amount: item.price,
  real_amount: null,
  amount_without_discount: item.price,
  used_credit: null,
  discount_code: null,
  purchasable: item,
  related,
});

const STATUS_DISPLAY = [
  'در حال پرداخت',
  'پرداخت شده',
  'پرداخت شده با رسید',
  'منقضی شده',
  'ناموفق',
  'منتظر بررسی فایل رسید',
  'رسید رد شده',
];

const paymentRow = (
  id: number,
  status: number,
  invoices: DjangoInvoice[],
  created: string,
  extra: Partial<DjangoPayment> = {},
): DjangoPayment => ({
  id,
  wallet: 1,
  assigned_wallet: null,
  handler: brief(NIMA_STAFF),
  amount: invoices.reduce((sum, item) => sum + item.amount, 0),
  receipt_file: null,
  creation_datetime: created,
  payment_date: status === 1 || status === 2 ? created : null,
  description: null,
  status,
  status_display: STATUS_DISPLAY[status] ?? '',
  authority: null,
  used_credit: null,
  invoices,
  ...extra,
});

/** A reservation's session as an invoice links it (ConsultationReservationSerializer). */
const reservationRef = (reservation: StaffDb['reservations'][number]) => ({
  unique_code: reservation.unique_code,
  consultation_type: reservation.consultation_type,
  date: reservation.date,
  sent_reminder: true,
  sent_survey: false,
  meeting: reservation.meeting,
});

function seedPayments(erfanSession: StaffDb['reservations'][number]): Row<DjangoPayment>[] {
  const master = purchasable(1, 'مشاوره‌ی اپلای ارشد', 1_500_000, 2);
  // Receipts other customers uploaded (sales Today lists them).
  const receipts = [
    {
      user: 112,
      data: paymentRow(
        41,
        5,
        [{ ...invoice(FINANCE_TYPE.general, purchasable(0, '', 12_000_000)), purchasable: null }],
        ago(3 * DAY),
        {
          description: 'قسط اول قرارداد اپلای کامل',
          receipt_file: '/new-media/receipts/41.jpg',
          payment_date: ago(2 * HOUR),
        },
      ),
    },
    {
      user: 104,
      data: paymentRow(
        42,
        5,
        [invoice(FINANCE_TYPE.writing, purchasable(5, 'نگارش رزومه', 3_500_000))],
        ago(2 * DAY),
        { receipt_file: '/new-media/receipts/42.jpg', payment_date: ago(DAY) },
      ),
    },
  ];
  const erfan = [
    paymentRow(
      5021,
      5,
      [
        invoice(FINANCE_TYPE.writing, purchasable(4, 'نگارش انگیزه‌نامه (ارشد)', 6_000_000)),
        invoice(FINANCE_TYPE.writing, purchasable(5, 'نگارش رزومه', 3_500_000)),
      ],
      ago(DAY),
      { receipt_file: '/new-media/receipts/5021.jpg', payment_date: ago(2 * HOUR) },
    ),
    paymentRow(
      4988,
      1,
      [invoice(FINANCE_TYPE.consultation, master, reservationRef(erfanSession))],
      ago(6 * DAY),
    ),
    paymentRow(4970, 4, [invoice(FINANCE_TYPE.consultation, master)], ago(8 * DAY)),
    paymentRow(
      4902,
      0,
      [invoice(FINANCE_TYPE.product, purchasable(7, 'بسته‌ی نمونه انگیزه‌نامه‌ها', 1_500_000))],
      ago(DAY),
      { authority: 'A00000000000000000000000000000004902' },
    ),
    paymentRow(
      4310,
      1,
      [invoice(FINANCE_TYPE.event, purchasable(9, 'وبینار «اپلای هلند ۲۰۲۷»', 600_000))],
      ago(22 * DAY),
    ),
  ].map((data) => ({ user: ERFAN, data }));
  return [...receipts, ...erfan];
}

const LEAD_CAUSE_OF = {
  failed_purchase: LEAD_CAUSE.failed_consultation,
  campaign: LEAD_CAUSE.campaign,
} as Record<string, number>;
const CAUSE_DISPLAY: Record<number, string> = {
  [LEAD_CAUSE.failed_product]: 'خرید ناموفق محصول',
  [LEAD_CAUSE.failed_writing]: 'خرید ناموفق SOP, CV, ...',
  [LEAD_CAUSE.failed_consultation]: 'رزرو ناموفق مشاوره',
  [LEAD_CAUSE.failed_event]: 'رزرو ناموفق رویداد',
  [LEAD_CAUSE.campaign]: 'کمپین',
};

function staffDb(): StaffDb {
  const people = customers();
  const users = new Map<number, DjangoUserDetail>(
    people.map((person) => {
      const [first_name = '', ...rest] = person.name.split(' ');
      return [
        person.id,
        {
          id: person.id,
          first_name,
          last_name: rest.join(' '),
          email: person.email,
          phone_number: person.phone,
          date_joined: person.lead.created_at,
          last_login: null,
          credit: person.id === ERFAN ? 250_000 : 0,
          user_referrer: null,
        },
      ];
    }),
  );
  const userOf = (id: number): DjangoUser => {
    const {
      date_joined: _d,
      last_login: _l,
      credit: _c,
      user_referrer: _r,
      ...user
    } = users.get(id) as DjangoUserDetail;
    return user;
  };

  const reservation = (
    id: number,
    user: number,
    type: number,
    date: string,
    assigned: number | null,
  ): StaffDb['reservations'][number] => ({
    id,
    user,
    unique_code: `R${String(id).padStart(6, '0')}`,
    consultation_type: type,
    date,
    sent_reminder: false,
    sent_survey: false,
    meeting: id,
    assigned_staff: brief(assigned),
    is_called: false,
    invoice: { id: id + 7000, payment: { user: userOf(user), status: 1 } },
  });
  const erfanSession = reservation(9, ERFAN, 1, ago(5 * DAY), HOSSEIN);
  const reservations = [
    reservation(1, 106, 1, at(16, 0, -1), NIMA_STAFF),
    reservation(2, 109, 3, at(11, 0, -1), NIMA_STAFF),
    reservation(3, 104, 1, at(10, 30), NIMA_STAFF),
    reservation(4, 111, 3, later(20 * 60_000), NIMA_STAFF),
    reservation(5, 110, 2, later(5 * HOUR), NIMA_STAFF),
    reservation(6, ERFAN, 1, at(15, 30, 2), NIMA_STAFF),
    erfanSession,
  ];

  const contact = (
    id: number,
    user: number,
    type: number,
    datetime: string,
    notes: string,
    link: { lead?: number; reservation?: number; staff?: number } = {},
  ) => ({
    user,
    lead: link.lead ?? null,
    reservation: link.reservation ?? null,
    data: {
      id,
      user,
      support_staves: [brief(link.staff ?? NIMA_STAFF) as DjangoStaff],
      datetime,
      type,
      type_display: '',
      notes,
    },
  });

  return {
    users,
    personal: [
      {
        user: ERFAN,
        data: {
          id: 1,
          first_name: 'عرفان',
          last_name: 'ملکی',
          father_name: 'مهدی',
          birth_date: '2001-07-03',
          marital_status: 1,
          gender: 1,
          military_service_status: 2,
          city_of_residence: 'شیراز',
          years_of_work_experience: 2,
          desired_degree: 2,
          desired_countries: [COUNTRIES[2], COUNTRIES[1]] as DjangoCountry[],
          new_current_degree: null,
          current_gpa: 16.2,
          current_lang_level: 'آیلتس ۶٫۵',
          budget: 2,
        },
      },
    ],
    info: [
      {
        user: ERFAN,
        data: {
          id: 1,
          category: null,
          probability_of_signing_contract: 63,
          notes: 'پدرش هزینه را می‌دهد؛ تا آخر هفته خبر می‌دهند.',
          referred_from: 'ins',
          referred_from_display: 'اینستاگرام',
        },
      },
    ],
    education: [
      {
        user: ERFAN,
        data: {
          id: 1,
          degree: 1,
          degree_display: 'کارشناسی',
          study_field: STUDY_FIELDS[0] ?? null,
          name_of_university_or_school: 'دانشگاه شیراز',
          year_of_graduation: 2024,
          gpa: 16.2,
        },
      },
    ],
    examScores: [
      {
        user: ERFAN,
        data: {
          id: 1,
          exam: EXAMS[0] as DjangoExam,
          score: 6.5,
          is_verified: false,
          date_of_receipt: '2026-08-01',
          description: null,
        },
      },
    ],
    payments: seedPayments(erfanSession),
    contacts: [
      contact(
        5,
        ERFAN,
        CONTACT_TYPE.call,
        ago(4 * DAY),
        'بعد از مشاوره زنگ زدم. هلند گزینه‌ی اول است، آلمان دوم. نمره‌ی آیلتس ۶٫۵ دارد. منتظر صحبت با خانواده.',
        { lead: 5 },
      ),
      contact(
        10,
        ERFAN,
        CONTACT_TYPE.consultation,
        ago(5 * DAY),
        'پیشنهاد مشاور: ۶ اپلای هلند و آلمان، شروع نگارش از آذر.',
        {
          reservation: 9,
          staff: HOSSEIN,
        },
      ),
      contact(4, ERFAN, CONTACT_TYPE.not_answered, ago(7 * DAY), '', { lead: 5 }),
      contact(
        3,
        ERFAN,
        CONTACT_TYPE.messenger,
        ago(7 * DAY),
        'پیام «معرفی و لینک رزرو مشاوره» در واتساپ.',
        {
          lead: 5,
        },
      ),
      contact(11, 104, CONTACT_TYPE.call, ago(2 * DAY), 'پیشنهاد اپلای آلمان را فرستادم.', {
        lead: 4,
      }),
      contact(12, 112, CONTACT_TYPE.call, ago(3 * DAY), 'قرارداد را امضا کرد.', { lead: 12 }),
    ],
    leads: people.map((person) => {
      const cause = LEAD_CAUSE_OF[person.lead.source] ?? LEAD_CAUSE.failed_product;
      return {
        id: person.lead.id,
        assigned_staff: brief(NIMA_STAFF),
        is_called: false,
        user: userOf(person.id),
        cause,
        cause_display: CAUSE_DISPLAY[cause] ?? '',
        creation_date: person.lead.created_at,
        description: person.lead.cause,
        campaign_registration:
          cause === LEAD_CAUSE.campaign ? { campaign: { title: person.lead.cause } } : null,
      };
    }),
    reservations,
    todos: seedTodos(userOf),
    comments: [
      {
        id: 1,
        todo: 201,
        creator: brief(7) as DjangoStaff,
        text: 'شماره‌ی همسرش را هم در پرونده گذاشتم؛ تصمیم با هر دو است.',
        creation_datetime: ago(3 * HOUR),
      },
    ],
  };
}

/** Today at hh:mm, or now when that has passed: deadlines are dates, so it stays today's task. */
const todayAt = (hour: number) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.getTime() > Date.now() ? date.toISOString() : new Date().toISOString();
};

function seedTodos(userOf: (id: number) => DjangoUser): DjangoTodo[] {
  const todo = (
    id: number,
    description: string,
    deadline: string,
    creator: number,
    owners: number[],
    user: number | null,
    extra: Partial<DjangoTodo> = {},
  ): DjangoTodo => ({
    id,
    type: TODO_TYPE.normal,
    creator: brief(creator),
    user: user === null ? null : userOf(user),
    support_staves: owners.map((owner) => brief(owner) as DjangoStaff),
    description,
    creation_date: ago(DAY),
    deadline: localDate(deadline),
    is_done: false,
    comments_count: 0,
    ...extra,
  });
  return [
    todo(
      101,
      'زنگ بزن و جواب خانواده درباره‌ی پیشنهاد اپلای آلمان را بگیر',
      ago(2 * DAY),
      NIMA_STAFF,
      [NIMA_STAFF],
      104,
      {
        type: TODO_TYPE.lead_follow_up,
      },
    ),
    todo(
      102,
      'پیگیری رسید قسط اول؛ کارت‌به‌کارت کرده ولی رسید را نفرستاده',
      ago(DAY),
      NIMA_STAFF,
      [NIMA_STAFF],
      112,
      {
        type: TODO_TYPE.payment_follow_up,
      },
    ),
    todo(103, 'تماس دوم؛ دیروز جواب نداد', todayAt(10), NIMA_STAFF, [NIMA_STAFF], 106, {
      type: TODO_TYPE.lead_follow_up,
    }),
    todo(
      104,
      'بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود',
      todayAt(18),
      NIMA_STAFF,
      [NIMA_STAFF],
      ERFAN,
    ),
    todo(105, 'پیشنهاد اقساطی را برای داوود بفرست', later(DAY), NIMA_STAFF, [NIMA_STAFF], 110),
    todo(106, 'قرارداد کیان را بایگانی کن', ago(DAY), NIMA_STAFF, [NIMA_STAFF], 112, {
      is_done: true,
    }),
    todo(
      201,
      'پذیرش Uppsala گرفت و قرارداد فقط اپلای است؛ خدمات ویزا را پیشنهاد بده. خیلی نگران وقت سفارت است.',
      todayAt(18),
      7,
      [NIMA_STAFF],
      103,
      { comments_count: 1, creation_date: ago(4 * HOUR) },
    ),
    todo(
      202,
      'جلسه‌ی دوم مشاوره را با عرفان هماهنگ کن؛ سؤال‌های بورسیه دارد',
      ago(DAY),
      HOSSEIN,
      [NIMA_STAFF],
      ERFAN,
      {
        creation_date: ago(2 * DAY),
        views: [brief(NIMA_STAFF) as DjangoStaff],
      },
    ),
    todo(401, 'جلسه‌ی دوم مشاوره برای عرفان', later(DAY), NIMA_STAFF, [HOSSEIN], ERFAN),
    todo(
      402,
      'نمونه‌ی انگیزه‌نامه‌ی ارشد هوش مصنوعی برای عرفان',
      later(2 * DAY),
      NIMA_STAFF,
      [11, 13],
      ERFAN,
      {
        type: TODO_TYPE.writing_follow_up,
      },
    ),
  ];
}

let db: StaffDb | null = null;
const data = () => (db ??= staffDb());

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

/** DRF's page: `?page=` and `?page_size=` (BaseAPIPagination). 404 past the last page. */
function paginate(request: Request, items: unknown[], size = PAGE_SIZE) {
  const url = new URL(request.url);
  const pageSize = Math.min(Number(url.searchParams.get('page_size')) || size, MAX_PAGE_SIZE);
  const page = Number(url.searchParams.get('page')) || 1;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  if (page > pages) return HttpResponse.json({ detail: 'Invalid page.' }, { status: 404 });
  const link = (number: number) => {
    const next = new URL(url);
    next.searchParams.set('page', String(number));
    return next.href;
  };
  return HttpResponse.json({
    count: items.length,
    next: page < pages ? link(page + 1) : null,
    previous: page > 1 ? link(page - 1) : null,
    results: items.slice((page - 1) * pageSize, page * pageSize),
  });
}

/** SearchFilter: every word must match one of the fields (icontains). */
const matches = (search: string | null, fields: (string | null | undefined)[]) =>
  !search ||
  search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => fields.some((field) => field?.toLowerCase().includes(word)));

const sellerOrError = () => (isSeller() ? null : forbidden());
const staffOrError = () => (meStaff() ? null : forbidden());

const userOrNotFound = (id: unknown) => data().users.get(Number(id)) ?? null;
const ofUser = <T>(rows: Row<T>[], user: unknown) =>
  rows.filter((row) => row.user === Number(user)).map((row) => row.data);

/** A request body's text field ('' when missing or not text). */
const text = (value: unknown) => (typeof value === 'string' ? value : '');

const badRequest = (errors: object) => HttpResponse.json(errors, { status: 400 });
const message = (text: string, status = 200) => HttpResponse.json({ message: text }, { status });

/** `is_called` of a lead or session: any ContactHistory points at it (StaffAssignable). */
const called = (key: 'lead' | 'reservation', id: number) =>
  data().contacts.some((row) => row[key] === id);

/** A nested user-related collection with list / create / update / destroy (UserRelatedViewSet). */
function nested<T extends { id: number }>(
  path: string,
  rows: () => Row<T>[],
  build: (body: Record<string, unknown>, current: T | null) => T | Response,
  options: { unique?: boolean; destroy?: boolean } = {},
) {
  const base = `${STAFF}/users/:user/${path}`;
  const find = (user: unknown, id: unknown) =>
    rows().find((row) => row.user === Number(user) && row.data.id === Number(id)) ?? null;
  return [
    http.get(`${base}/`, ({ params }) => {
      const error = sellerOrError();
      if (error) return error;
      if (!userOrNotFound(params.user)) return forbidden();
      return HttpResponse.json(ofUser(rows(), params.user));
    }),
    http.post(`${base}/`, async ({ params, request }) => {
      const error = sellerOrError();
      if (error) return error;
      if (!userOrNotFound(params.user)) return forbidden();
      if (options.unique && ofUser(rows(), params.user).length)
        return badRequest({ user_id: ['A related instance already exists for this user.'] });
      const built = build((await request.json()) as Record<string, unknown>, null);
      if (built instanceof Response) return built;
      rows().push({ user: Number(params.user), data: built });
      return HttpResponse.json(built, { status: 201 });
    }),
    http.patch(`${base}/:id/`, async ({ params, request }) => {
      const error = sellerOrError();
      if (error) return error;
      const row = find(params.user, params.id);
      if (!row) return notFound();
      const built = build((await request.json()) as Record<string, unknown>, row.data);
      if (built instanceof Response) return built;
      row.data = built;
      return HttpResponse.json(built);
    }),
    ...(options.destroy
      ? [
          http.delete(`${base}/:id/`, ({ params }) => {
            const error = sellerOrError();
            if (error) return error;
            const row = find(params.user, params.id);
            if (!row) return notFound();
            const list = rows();
            list.splice(list.indexOf(row), 1);
            return new HttpResponse(null, { status: 204 });
          }),
        ]
      : []),
  ];
}

const DEGREE_DISPLAY = ['دیپلم', 'کارشناسی', 'کارشناسی ارشد', 'دکترا'];

function userInfoOf(body: Record<string, unknown>, current: DjangoUserInfo | null) {
  const probability =
    body.probability_of_signing_contract ?? current?.probability_of_signing_contract;
  if (typeof probability === 'number' && (probability < 0 || probability > 100))
    return badRequest({
      probability_of_signing_contract: ['Ensure this value is less than or equal to 100.'],
    });
  return {
    id: current?.id ?? newId(),
    category: current?.category ?? null,
    probability_of_signing_contract: (probability as number | null | undefined) ?? null,
    notes: (body.notes as string | null | undefined) ?? current?.notes ?? null,
    referred_from: current?.referred_from ?? null,
    referred_from_display: current?.referred_from_display ?? null,
  };
}

function personalOf(body: Record<string, unknown>, current: DjangoPersonal | null) {
  const merged = { ...current, ...body } as Record<string, unknown>;
  if (!text(merged.first_name).trim() || !text(merged.last_name).trim())
    return badRequest({ first_name: ['This field is required.'] });
  const countries = (merged.desired_countries ?? []) as (number | DjangoCountry)[];
  return {
    ...(merged as unknown as DjangoPersonal),
    id: current?.id ?? newId(),
    desired_countries: countries
      .map((item) => (typeof item === 'number' ? COUNTRIES.find((c) => c.id === item) : item))
      .filter((item): item is DjangoCountry => Boolean(item)),
  };
}

function educationOf(body: Record<string, unknown>, current: DjangoEducation | null) {
  const merged = { ...current, ...body } as Record<string, unknown>;
  const degree = Number(merged.degree);
  if (merged.degree === null || !(degree in DEGREE_DISPLAY))
    return badRequest({ degree: ['This field is required.'] });
  if (typeof merged.gpa !== 'number' || Number.isNaN(merged.gpa))
    return badRequest({ gpa: ['A valid number is required.'] });
  const field = merged.study_field;
  return {
    id: current?.id ?? newId(),
    degree,
    degree_display: DEGREE_DISPLAY[degree] ?? '',
    study_field:
      typeof field === 'number'
        ? (STUDY_FIELDS.find((item) => item.id === field) ?? null)
        : ((field as DjangoStudyField | null) ?? null),
    name_of_university_or_school: text(merged.name_of_university_or_school),
    year_of_graduation: (merged.year_of_graduation as number | null) ?? null,
    gpa: merged.gpa,
  };
}

function examScoreOf(body: Record<string, unknown>, current: DjangoExamScore | null) {
  const examId = body.exam ?? current?.exam.id;
  const exam = EXAMS.find((item) => item.id === Number(examId));
  if (!exam) return badRequest({ exam: ['This field is required.'] });
  const score = Number(body.score ?? current?.score);
  if (Number.isNaN(score) || score < exam.min || score > exam.max)
    return badRequest({ score: ['Score is not in the valid exam score range!'] });
  return {
    id: current?.id ?? newId(),
    exam,
    score,
    is_verified: current?.is_verified ?? false,
    date_of_receipt: (body.date_of_receipt as string | null | undefined) ?? null,
    description: current?.description ?? null,
  };
}

// ── Contact history (users/<id>/contact-history/) ─────────────────────────────────────────────

const TYPE_LABEL = ['تماس تلفنی', 'جلسه مشاوره', 'پیام رسان', 'ایمیل', 'تیکت', 'تماس بی پاسخ'];

/** user_profile.classes.ContactHistory → HistorySerializer. */
const contactItem = (row: StaffDb['contacts'][number]): DjangoHistoryItem => ({
  unique_id: `contact-${String(row.data.id)}`,
  type:
    row.data.type === CONTACT_TYPE.not_answered
      ? (TYPE_LABEL[5] ?? '')
      : `تماس: ${TYPE_LABEL[row.data.type] ?? ''}`,
  staff: row.data.support_staves.map((item) => item.full_name).join(', '),
  notes: row.data.notes,
  time: row.data.datetime,
  id_: row.data.id,
  contact_type: '0',
  is_called: true,
  is_not_answered: row.data.type === CONTACT_TYPE.not_answered,
});

/** contact_history_list_generator: contacts, leads (with their contacts), paid sessions. */
function historyOf(user: number): (DjangoHistoryItem & { sort: string })[] {
  const db = data();
  const contacts = db.contacts.filter((row) => row.user === user);
  const subs = (key: 'lead' | 'reservation', id: number) =>
    contacts.filter((row) => row[key] === id).map(contactItem);
  return [
    ...contacts
      .filter((row) => row.lead === null && row.reservation === null)
      .map((row) => ({ ...contactItem(row), sort: row.data.datetime })),
    ...db.leads
      .filter((item) => item.user.id === user)
      .map((item) => ({
        unique_id: `lead-${String(item.id)}`,
        type:
          `لید: ${item.cause_display}` +
          (item.campaign_registration && typeof item.campaign_registration.campaign === 'object'
            ? ` - ${item.campaign_registration.campaign.title}`
            : ''),
        staff: '-',
        notes: item.description,
        time: item.creation_date,
        id_: item.id,
        contact_type: '2' as const,
        is_called: called('lead', item.id),
        is_not_answered: null,
        subs: subs('lead', item.id),
        sort: item.creation_date,
      })),
    ...db.reservations
      .filter((item) => item.user === user)
      .map((item) => {
        const type = CONSULTATION_TYPES.find((entry) => entry.id === item.consultation_type);
        return {
          unique_id: `reservation-${String(item.id)}`,
          type: type ? `مشاوره: ${type.title} (${type.type_display})` : 'مشاوره',
          staff: '-',
          notes: `-\nمشاور: ${item.assigned_staff?.full_name ?? '-'}`,
          time: item.date,
          id_: item.id,
          contact_type: '1' as const,
          is_called: called('reservation', item.id),
          is_not_answered: null,
          subs: subs('reservation', item.id),
          // Django sorts sessions by when they were paid; the mock has no payment time.
          sort: item.date,
        };
      }),
  ].sort((a, b) => b.sort.localeCompare(a.sort));
}

// ── Todos ────────────────────────────────────────────────────────────────────────────────────

/** StaffToDoViewSet.get_queryset: managers see all, others what they're on, about, or made. */
const visibleTodos = () => {
  const me = meStaff();
  return data().todos.filter(
    (todo) =>
      isManager() ||
      todo.creator?.id === me?.id ||
      todo.support_staves.some((item) => item.id === me?.id),
  );
};

/** The filters the panel sends (StaffToDoCustomFilter + CustomFilterBackend). */
function filterTodos(todos: DjangoTodo[], url: URL) {
  const query = url.searchParams;
  return todos.filter((todo) => {
    const staves = query.get('support_staves');
    if (staves && !todo.support_staves.some((item) => item.id === Number(staves))) return false;
    const creator = query.get('creator');
    if (creator && todo.creator?.id !== Number(creator)) return false;
    // BooleanField.to_python: 't' / 'True' / '1' or 'f' / 'False' / '0' (others: 400 above).
    const done = query.get('is_done');
    if (done !== null) {
      if (todo.is_done !== ['t', 'True', '1'].includes(done)) return false;
    }
    const user = query.get('user');
    if (user && todo.user?.id !== Number(user)) return false;
    const before = query.get('deadline__lte');
    if (before && todo.deadline > before) return false;
    const after = query.get('deadline__gt');
    if (after && todo.deadline <= after) return false;
    return true;
  });
}

const ordered = (todos: DjangoTodo[], url: URL) => {
  const ordering = url.searchParams.get('ordering');
  const list = [...todos];
  if (ordering === 'deadline') list.sort((a, b) => a.deadline.localeCompare(b.deadline));
  else if (ordering === '-deadline') list.sort((a, b) => b.deadline.localeCompare(a.deadline));
  else list.sort((a, b) => b.id - a.id);
  return list;
};

function todoOf(body: Record<string, unknown>, current: DjangoTodo | null): DjangoTodo | Response {
  const merged = { ...current, ...body } as Record<string, unknown>;
  if (!text(merged.description).trim())
    return badRequest({ description: ['This field may not be blank.'] });
  if (!merged.deadline) return badRequest({ deadline: ['This field is required.'] });
  const staves = (merged.support_staves ?? []) as (number | DjangoStaff)[];
  const user = merged.user as number | DjangoUser | null | undefined;
  const userId = typeof user === 'number' ? user : (user?.id ?? null);
  const userRow = userId === null ? null : data().users.get(userId);
  if (userId !== null && !userRow) return badRequest({ user: ['Invalid pk.'] });
  const {
    date_joined: _d,
    last_login: _l,
    credit: _c,
    user_referrer: _r,
    ...plain
  } = userRow ?? ({} as DjangoUserDetail);
  return {
    id: current?.id ?? newId(),
    type: Number(merged.type ?? TODO_TYPE.normal),
    creator: current?.creator ?? brief(meStaff()?.id ?? null),
    user: userRow ? plain : null,
    support_staves: staves
      .map((item) => brief(typeof item === 'number' ? item : item.id))
      .filter((item): item is NonNullable<typeof item> => item !== null),
    description: text(merged.description),
    creation_date: current?.creation_date ?? new Date().toISOString(),
    deadline: text(merged.deadline),
    is_done: current?.is_done ?? false,
    comments_count: current?.comments_count ?? 0,
    ...(current?.views ? { views: current.views } : {}),
  };
}

// ── Payments created by the planned sale endpoint (S30) ──────────────────────────────────────

/** The planned `customers/<id>/sell/` mock writes its payment here, so the payments tab shows it. */
export function addPayment(
  user: number,
  lines: { title: string; price: number; category: string }[],
  method: 'online' | 'receipt',
) {
  const type = (category: string) =>
    category === 'consultation'
      ? FINANCE_TYPE.consultation
      : category === 'writing'
        ? FINANCE_TYPE.writing
        : category === 'event'
          ? FINANCE_TYPE.event
          : FINANCE_TYPE.product;
  const id = newId();
  data().payments.unshift({
    user,
    data: paymentRow(
      id,
      0,
      lines.map((line, index) =>
        invoice(type(line.category), purchasable(index + 1, line.title, line.price)),
      ),
      new Date().toISOString(),
      method === 'online' ? { authority: `A${String(id).padStart(35, '0')}` } : {},
    ),
  });
  return id;
}

/** The fake Django's records, for planned-endpoint mocks that read them (sales Today, the board). */
export const staffData = () => data();

// ── Handlers ─────────────────────────────────────────────────────────────────────────────────

const paymentOf = (user: unknown, id: unknown) =>
  data().payments.find((row) => row.user === Number(user) && row.data.id === Number(id))?.data ??
  null;

export const staffHandlers = [
  // Lookups.
  http.get(`${API}/apply/v1/countries/`, ({ request }) => {
    const search = new URL(request.url).searchParams.get('search');
    return paginate(
      request,
      COUNTRIES.filter((item) => matches(search, [item.country, item.persian_name])),
      30,
    );
  }),
  http.get(`${API}/apply/v1/study-fields/`, ({ request }) => {
    const search = new URL(request.url).searchParams.get('search');
    return paginate(
      request,
      STUDY_FIELDS.filter((item) => matches(search, [item.name, item.name_persian])),
      30,
    );
  }),
  http.get(`${API}/profile/user/v1/exams/`, ({ request }) =>
    storage.get() ? paginate(request, EXAMS) : forbidden(),
  ),
  http.get(`${API}/consultation/v1/consultation-types/`, ({ request }) =>
    storage.get() ? paginate(request, CONSULTATION_TYPES) : forbidden(),
  ),
  http.get(`${STAFF}/staves/`, ({ request }) => {
    const error = staffOrError();
    if (error) return error;
    const team = new URL(request.url).searchParams.get('team');
    return paginate(
      request,
      STAVES.filter((item) => team === null || item.team === Number(team)),
    );
  }),

  // Customers (UserViewSet): search, and "new user" as the crm makes it.
  http.get(`${STAFF}/users/`, ({ request }) => {
    const error = sellerOrError();
    if (error) return error;
    const search = new URL(request.url).searchParams.get('search');
    const list = [...data().users.values()]
      .filter((user) =>
        matches(search, [user.first_name, user.last_name, user.email, user.phone_number]),
      )
      .map(({ date_joined: _d, last_login: _l, credit: _c, user_referrer: _r, ...user }) => user);
    return paginate(request, list);
  }),
  http.post(`${STAFF}/users/`, async ({ request }) => {
    const error = sellerOrError();
    if (error) return error;
    const body = (await request.json()) as Partial<DjangoUser>;
    const phone = body.phone_number ?? null;
    if (phone !== null && !/^09\d{9}$/.test(phone))
      return badRequest({ phone_number: ['قالب شماره وارد شده اشتباه است!'] });
    if (phone && [...data().users.values()].some((user) => user.phone_number === phone))
      return badRequest({ phone_number: ['user with this شماره تلفن already exists.'] });
    const user: DjangoUserDetail = {
      id: newId(),
      first_name: body.first_name ?? '',
      last_name: body.last_name ?? '',
      email: body.email ?? null,
      phone_number: phone,
      date_joined: new Date().toISOString(),
      last_login: null,
      credit: 0,
      user_referrer: null,
    };
    data().users.set(user.id, user);
    const { date_joined: _d, last_login: _l, credit: _c, user_referrer: _r, ...plain } = user;
    return HttpResponse.json(plain, { status: 201 });
  }),

  // A customer and their details (crm user_detail).
  http.get(`${STAFF}/users/:user/`, ({ params }) => {
    const error = sellerOrError();
    if (error) return error;
    const user = userOrNotFound(params.user);
    return user ? HttpResponse.json(user) : notFound();
  }),
  ...nested('personal-information', () => data().personal, personalOf, { unique: true }),
  ...nested('info', () => data().info, userInfoOf, { unique: true }),
  ...nested('education-degrees', () => data().education, educationOf, { destroy: true }),
  ...nested('exam-scores', () => data().examScores, examScoreOf, { destroy: true }),

  // Payments and invoices (PaymentViewSet, InvoiceViewSet).
  http.get(`${STAFF}/users/:user/payments/`, ({ params, request }) => {
    const error = sellerOrError();
    if (error) return error;
    const list = ofUser(data().payments, params.user).sort((a, b) =>
      b.creation_datetime.localeCompare(a.creation_datetime),
    );
    return paginate(request, list);
  }),
  http.get(`${STAFF}/users/:user/invoices/`, ({ params, request }) => {
    const error = sellerOrError();
    if (error) return error;
    const list = ofUser(data().payments, params.user)
      .sort((a, b) => b.creation_datetime.localeCompare(a.creation_datetime))
      .flatMap(({ invoices, ...payment }) => invoices.map((item) => ({ ...item, payment })));
    return paginate(request, list);
  }),
  http.patch(`${STAFF}/users/:user/payments/:id/confirm_receipt/`, ({ params }) => {
    const error = sellerOrError();
    if (error) return error;
    const payment = paymentOf(params.user, params.id);
    if (!payment) return notFound();
    if (payment.status !== 5) return message('رسید پرداخت در انتظار تایید وجود ندارد!', 400);
    payment.status = 2;
    payment.status_display = STATUS_DISPLAY[2] ?? '';
    return message('رسید پرداخت با موفقت تایید شد.');
  }),
  http.patch(`${STAFF}/users/:user/payments/:id/decline_receipt/`, ({ params }) => {
    const error = sellerOrError();
    if (error) return error;
    const payment = paymentOf(params.user, params.id);
    if (!payment) return notFound();
    if (payment.status !== 5) return message('رسید پرداخت در انتظار تایید وجود ندارد!', 400);
    payment.status = 6;
    payment.status_display = STATUS_DISPLAY[6] ?? '';
    payment.payment_date = null;
    return message('رسید پرداخت با موفقیت رد شد.');
  }),
  http.patch(`${STAFF}/users/:user/payments/:id/change_method/:method/`, ({ params }) => {
    const error = sellerOrError();
    if (error) return error;
    const payment = paymentOf(params.user, params.id);
    if (!payment) return notFound();
    if (payment.status !== 0) return message('روش پرداخت قابل تغییر نیست!', 400);
    const method = Number(params.method);
    if (method !== 0 && method !== 1) return message('روش پرداخت نامعتبر است!', 400);
    payment.authority = method === 0 ? `A${String(payment.id).padStart(35, '0')}` : null;
    return message('روش پرداخت با موفقیت تغییر کرد.');
  }),

  // Contact history (ContactHistoryViewSet).
  http.get(`${STAFF}/users/:user/contact-history/history/`, ({ params, request }) => {
    const error = sellerOrError();
    if (error) return error;
    if (!userOrNotFound(params.user)) return notFound();
    return paginate(
      request,
      historyOf(Number(params.user)).map(({ sort: _sort, ...item }) => item),
    );
  }),
  http.post(`${STAFF}/users/:user/contact-history/`, async ({ params, request }) => {
    const error = sellerOrError();
    if (error) return error;
    const user = Number(params.user);
    if (!userOrNotFound(user)) return forbidden();
    const body = (await request.json()) as {
      user?: number;
      type?: number;
      notes?: string;
      support_staves?: number[];
      parent_unique_id?: string;
    };
    // `user` is a plain serializer field: required, and Django doesn't take it from the URL.
    if (body.user !== user) return badRequest({ user: ['This field is required.'] });
    if (body.type === undefined || !(body.type in TYPE_LABEL))
      return badRequest({ type: ['This field is required.'] });
    if (!body.support_staves?.length)
      return badRequest({ support_staves: ['This list may not be empty.'] });
    const [prefix, parent] = (body.parent_unique_id ?? '').split('-');
    if (body.parent_unique_id && (!parent || (prefix !== 'lead' && prefix !== 'reservation')))
      return badRequest({ parent_unique_id: ['Parent Unique ID is invalid!'] });
    const row = {
      user,
      lead: prefix === 'lead' ? Number(parent) : null,
      reservation: prefix === 'reservation' ? Number(parent) : null,
      data: {
        id: newId(),
        user,
        support_staves: (body.support_staves ?? [])
          .map((id) => brief(id))
          .filter((item): item is NonNullable<typeof item> => item !== null),
        datetime: new Date().toISOString(),
        type: body.type,
        type_display: TYPE_LABEL[body.type] ?? '',
        notes: body.notes ?? null,
      },
    };
    data().contacts.push(row);
    return HttpResponse.json(row.data, { status: 201 });
  }),
  http.patch(`${STAFF}/users/:user/contact-history/:id/send-summery/`, ({ params }) => {
    const error = sellerOrError();
    if (error) return error;
    const row = data().contacts.find(
      (item) => item.user === Number(params.user) && item.data.id === Number(params.id),
    );
    if (!row) return notFound();
    return data().users.get(row.user)?.email
      ? HttpResponse.json({ detail: 'خلاصه جلسه برای مشتری ارسال شد.' })
      : badRequest({ detail: 'برای مشتری ایمیلی ثبت نشده است.' });
  }),

  // Leads and sessions (SaleLeadViewSet, ConsultationReservationViewSet).
  http.get(`${STAFF}/sale-leads/count/`, ({ request }) => {
    const error = staffOrError();
    if (error) return error;
    return HttpResponse.json({ count: leadsFor(new URL(request.url)).length });
  }),
  http.get(`${STAFF}/sale-leads/`, ({ request }) => {
    const error = staffOrError();
    if (error) return error;
    const url = new URL(request.url);
    const list = leadsFor(url).sort((a, b) =>
      url.searchParams.get('ordering') === 'id' ? a.id - b.id : b.id - a.id,
    );
    return paginate(request, list);
  }),
  http.get(`${STAFF}/consultation-reservations/count/`, ({ request }) => {
    const error = staffOrError();
    if (error) return error;
    return HttpResponse.json({ count: reservationsFor(new URL(request.url)).length });
  }),
  http.get(`${STAFF}/consultation-reservations/`, ({ request }) => {
    const error = staffOrError();
    if (error) return error;
    const url = new URL(request.url);
    const list = reservationsFor(url).sort((a, b) =>
      url.searchParams.get('ordering') === '-date'
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date),
    );
    return paginate(
      request,
      list.map(({ user: _user, ...item }) => item),
    );
  }),

  // Tasks (StaffToDoViewSet, ToDoCommentViewSet).
  http.get(`${STAFF}/todos/`, ({ request }) => {
    const error = staffOrError();
    if (error) return error;
    const url = new URL(request.url);
    const done = url.searchParams.get('is_done');
    if (done !== null && !['t', 'True', '1', 'f', 'False', '0'].includes(done))
      return badRequest({ detail: `“${done}” value must be either True or False.` });
    return paginate(
      request,
      ordered(filterTodos(visibleTodos(), url), url).map(({ views: _views, ...todo }) => todo),
    );
  }),
  http.get(`${STAFF}/todos/:id/`, ({ params }) => {
    const error = staffOrError();
    if (error) return error;
    const todo = visibleTodos().find((item) => item.id === Number(params.id));
    if (!todo) return notFound();
    const { comments_count: _count, ...detail } = todo;
    return HttpResponse.json({ ...detail, views: todo.views ?? [] });
  }),
  http.post(`${STAFF}/todos/`, async ({ request }) => {
    const error = staffOrError();
    if (error) return error;
    const built = todoOf((await request.json()) as Record<string, unknown>, null);
    if (built instanceof Response) return built;
    data().todos.push(built);
    return HttpResponse.json(built, { status: 201 });
  }),
  http.patch(`${STAFF}/todos/:id/`, async ({ params, request }) => {
    const error = staffOrError();
    if (error) return error;
    const todo = visibleTodos().find((item) => item.id === Number(params.id));
    if (!todo) return notFound();
    // CanManageToDo: the manager or the creator.
    if (!isManager() && todo.creator?.id !== meStaff()?.id) return forbidden();
    const built = todoOf((await request.json()) as Record<string, unknown>, todo);
    if (built instanceof Response) return built;
    Object.assign(todo, built);
    return HttpResponse.json(todo);
  }),
  http.patch(`${STAFF}/todos/:id/mark_as_done/`, ({ params }) => {
    const error = staffOrError();
    if (error) return error;
    const todo = visibleTodos().find((item) => item.id === Number(params.id));
    if (!todo) return notFound();
    if (todo.is_done) return message('ToDo قبلا انجام شده است!', 400);
    todo.is_done = true;
    return message('ToDo با موفقیت انجام شد.');
  }),
  http.patch(`${STAFF}/todos/:id/add_view/`, ({ params }) => {
    const error = staffOrError();
    if (error) return error;
    const todo = visibleTodos().find((item) => item.id === Number(params.id));
    const me = brief(meStaff()?.id ?? null);
    if (!todo || !me) return notFound();
    todo.views = [...(todo.views ?? []).filter((item) => item.id !== me.id), me];
    return new HttpResponse(null, { status: 200 });
  }),
  http.get(`${STAFF}/todos/:id/comments/`, ({ params, request }) => {
    const error = staffOrError();
    if (error) return error;
    if (!visibleTodos().some((item) => item.id === Number(params.id))) return forbidden();
    return paginate(
      request,
      data()
        .comments.filter((item) => item.todo === Number(params.id))
        .sort((a, b) => b.id - a.id),
    );
  }),
  http.post(`${STAFF}/todos/:id/comments/`, async ({ params, request }) => {
    const error = staffOrError();
    if (error) return error;
    const todo = visibleTodos().find((item) => item.id === Number(params.id));
    const me = brief(meStaff()?.id ?? null);
    if (!todo || !me) return forbidden();
    const { text } = (await request.json()) as { text?: string };
    if (!text?.trim()) return badRequest({ text: ['This field may not be blank.'] });
    const comment = {
      id: newId(),
      todo: todo.id,
      creator: me,
      text,
      creation_datetime: new Date().toISOString(),
    };
    data().comments.push(comment);
    todo.comments_count = (todo.comments_count ?? 0) + 1;
    return HttpResponse.json(comment, { status: 201 });
  }),
];

/** The lead filters the panel sends: search, called or not, cause, creation date, staff. */
function leadsFor(url: URL) {
  const query = url.searchParams;
  const me = meStaff();
  const search = query.get('search');
  const assigned = query.get('assigned_staff');
  const uncalled = query.get('contact_history__isnull');
  const causes = query.get('cause__in')?.split(',').map(Number);
  const since = query.get('creation_date__gte');
  const range = query.get('creation_date__range')?.split(',');
  return data()
    .leads.filter((item) => isManager() || item.assigned_staff?.id === me?.id)
    .filter((item) => assigned === null || String(item.assigned_staff?.id) === assigned)
    .filter((item) =>
      matches(search, [
        item.user.first_name,
        item.user.last_name,
        item.user.phone_number,
        item.user.email,
      ]),
    )
    .filter(
      (item) =>
        uncalled === null || called('lead', item.id) !== (uncalled === 'true' || uncalled === '1'),
    )
    .filter((item) => !causes || causes.includes(item.cause))
    .filter((item) => !since || item.creation_date >= since)
    .filter(
      (item) =>
        !range ||
        (item.creation_date >= (range[0] ?? '') && item.creation_date <= (range[1] ?? '')),
    )
    .map((item) => ({ ...item, is_called: called('lead', item.id) }));
}

/** The reservation filters the panel sends: date range, type, logged or not, assigned staff. */
function reservationsFor(url: URL) {
  const query = url.searchParams;
  const me = meStaff();
  const range = query.get('date__range')?.split(',');
  const before = query.get('date__lt');
  const type = query.get('consultation_type');
  const unlogged = query.get('contact_history__isnull');
  const search = query.get('search');
  return data()
    .reservations.filter((item) => isManager() || item.assigned_staff?.id === me?.id)
    .filter((item) => {
      const user = data().users.get(item.user);
      return matches(search, [
        item.unique_code,
        user?.first_name,
        user?.last_name,
        user?.email,
        user?.phone_number,
      ]);
    })
    .filter((item) => !range || (item.date >= (range[0] ?? '') && item.date <= (range[1] ?? '')))
    .filter((item) => !before || item.date < before)
    .filter((item) => !type || item.consultation_type === Number(type))
    .filter(
      (item) =>
        unlogged === null ||
        called('reservation', item.id) !== (unlogged === 'true' || unlogged === '1'),
    )
    .map((item) => ({ ...item, is_called: called('reservation', item.id) }));
}

export function resetStaffMocks() {
  db = null;
}

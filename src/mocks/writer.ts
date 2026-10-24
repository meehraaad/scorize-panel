import { http, HttpResponse } from 'msw';
import type {
  OrderData,
  OrderRow,
  OrderState,
  OrderVersion,
  QueueData,
  QueueView,
} from '@/features/writer/api';
import type {
  MessagePage,
  TicketMessage,
  TicketsOverview,
  WritingDepartment,
} from '@/lib/tickets/api';
import { forbidden, notFound, storage } from './session';

/**
 * Fake writer API (docs/backend-changes.md WR1–WR6) for Maryam (09120000001), who also writes
 * SOPs, personal statements and CVs. Uploads and messages stay until the page reloads.
 */

const WRITER = 2;
const WRITER_NAME = 'مریم کاظمی';
const API = '/api/writer/v1';
const DAY = 86_400_000;
const MESSAGES_PAGE = 20;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const inDays = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() + n);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
};

let nextId = 70_000;
const newId = () => nextId++;

interface MockOrder {
  data: OrderData;
  messages: TicketMessage[];
  delivered_at: string | null;
  notes: number;
}

const SOP_FORM: OrderData['form']['sections'] = [
  {
    title: 'انگیزه و هدف',
    summary: '۳ پاسخ',
    answers: [
      {
        question: 'چرا این رشته را برای ادامه‌ی تحصیل انتخاب کرده‌اید؟',
        answer:
          'از پروژه‌ی پایانی کارشناسی روی تشخیص علائم راهنمایی، به بینایی ماشین علاقه‌مند شدم و می‌خواهم روی ایمنی خودروهای خودران کار کنم.',
      },
      {
        question: 'بعد از فارغ‌التحصیلی چه برنامه‌ای دارید؟',
        answer: 'چند سال کار در یک تیم پژوهشی صنعتی در کانادا، بعد احتمالاً دکترا.',
      },
      {
        question: 'چرا این دانشگاه یا استاد را انتخاب کردید؟',
        answer: 'Vector Institute و گروه Prof. Waslander روی درک صحنه کار می‌کنند.',
      },
    ],
  },
  {
    title: 'سوابق تحصیلی',
    summary: '۴ پاسخ',
    answers: [
      { question: 'رشته‌ی تحصیلی فعلی', answer: 'مهندسی کامپیوتر' },
      { question: 'دانشگاه کارشناسی', answer: 'صنعتی امیرکبیر' },
      { question: 'معدل کارشناسی', answer: '۱۷٫۸' },
      { question: 'پایان‌نامه یا پروژه‌ی پایانی', answer: 'تشخیص علائم راهنمایی در شرایط مه' },
    ],
  },
  {
    title: 'پروژه‌ها و پژوهش',
    summary: '۲ پروژه، ۱ مقاله',
    answers: [
      { question: 'درس‌ها و پروژه‌های موفق', answer: 'بینایی ماشین (۱۹٫۵)، پروژه‌ی ردیابی خودرو' },
      { question: 'مقاله‌ها و پروژه‌های پژوهشی', answer: 'مقاله‌ی کنفرانس ICCKE' },
    ],
  },
  {
    title: 'تجربه‌ی کاری',
    summary: '۱ کارآموزی',
    answers: [
      { question: 'سوابق کاری، TA، RA یا کارآموزی', answer: 'کارآموزی ۶ ماهه در کافه‌بازار' },
    ],
  },
];

function version(
  number: number,
  name: string,
  sentDaysAgo: number,
  revision: string[] | null,
): OrderVersion {
  return {
    id: newId(),
    number,
    final: false,
    file: { name, url: '/static/mock/version.docx', words: 1040 },
    sent_at: ago(sentDaysAgo * DAY),
    note: null,
    revision: revision ? { requested_at: ago((sentDaysAgo - 2) * DAY), notes: revision } : null,
  };
}

function message(mine: boolean, author: string, agoMs: number, text: string): TicketMessage {
  return {
    id: newId(),
    mine,
    author,
    role: mine ? 'writer' : null,
    sent_at: ago(agoMs),
    text,
    priority: 1,
    attachment: null,
    seen: !mine,
    rating: null,
    auto: false,
  };
}

interface Seed {
  id: number;
  name: string;
  applicant: number;
  type: WritingDepartment;
  program: string | null;
  state: OrderState;
  due: number | null;
  versions?: OrderVersion[];
  unread?: number;
  round?: [number, number];
  delivered?: number;
}

const SEEDS: Seed[] = [
  {
    id: 1240,
    name: 'سارا محمدی',
    applicant: 1240,
    type: 'sop',
    program: 'MSc Computer Science · University of Toronto',
    state: 'revision',
    due: 2,
    round: [1, 2],
    unread: 2,
    versions: [
      version(1, 'SOP-Sara-Mohammadi-v1.docx', 4, [
        'پروژه‌ی تشخیص علائم راهنمایی با یادگیری عمیق در پاراگراف دوم بیاید، نه آخر متن.',
        'نام گروه پژوهشی Vector Institute را اضافه کنید؛ دلیل اصلی انتخاب تورنتو است.',
        'پاراگراف کارآموزی کوتاه‌تر شود؛ الان از پروژه‌ها مهم‌تر به نظر می‌رسد.',
      ]),
    ],
  },
  {
    id: 1201,
    name: 'حسین طاهری',
    applicant: 1201,
    type: 'sop',
    program: 'PhD Informatics · University of Edinburgh',
    state: 'new',
    due: 3,
    unread: 1,
  },
  {
    id: 1231,
    name: 'نگار احمدی',
    applicant: 1231,
    type: 'ps',
    program: 'MSc Architecture · Politecnico di Milano',
    state: 'drafting',
    due: 6,
    versions: [version(1, 'PS-Negar-Ahmadi-v1.docx', 9, null)],
  },
  {
    id: 1238,
    name: 'امیرحسین رضایی',
    applicant: 1238,
    type: 'cv',
    program: 'PhD Mechanical Engineering',
    state: 'new',
    due: 9,
    unread: 1,
  },
  {
    id: 1227,
    name: 'محمد کریمی',
    applicant: 1227,
    type: 'sop',
    program: 'PhD Computer Science · University of Alberta',
    state: 'waiting_applicant',
    due: null,
    versions: [version(1, 'SOP-Mohammad-Karimi-v1.docx', 2, null)],
  },
  {
    id: 1224,
    name: 'زهرا موسوی',
    applicant: 1224,
    type: 'cv',
    program: null,
    state: 'waiting_applicant',
    due: null,
    versions: [version(1, 'CV-Zahra-Mousavi-v1.pdf', 1, null)],
  },
  {
    id: 1219,
    name: 'علی نوری',
    applicant: 1219,
    type: 'cv',
    program: null,
    state: 'delivered',
    due: null,
    delivered: 10,
    versions: [version(1, 'CV-Ali-Nouri-v1.pdf', 16, ['تاریخ کارآموزی را درست کنید.'])],
  },
];

function build(seed: Seed): MockOrder {
  const versions = seed.versions ?? [];
  const last = versions.at(-1);
  const messages =
    seed.id === 1240
      ? [
          message(true, WRITER_NAME, 3 * DAY, 'پیش‌نویس اول را فرستادم؛ نظرتان را بنویسید.'),
          message(
            false,
            seed.name,
            DAY,
            'نسخه‌ی اصلاح‌شده را تا دوشنبه می‌فرستید؟ ددلاین تورنتو ۱۸ روز دیگر است.',
          ),
          message(false, seed.name, 20 * 60_000, 'ممنون، فقط پاراگراف آخر هم کمی کوتاه‌تر شود.'),
        ]
      : (seed.unread ?? 0) > 0
        ? [message(false, seed.name, 5 * 3_600_000, 'سلام، فرم را کامل کردم.')]
        : [];
  return {
    notes: last?.revision?.notes.length ?? 0,
    delivered_at: seed.delivered ? ago(seed.delivered * DAY) : null,
    messages,
    data: {
      id: seed.id,
      file_number: seed.id,
      applicant: { id: seed.applicant, name: seed.name },
      type: seed.type,
      program: seed.program,
      words: seed.type === 'cv' ? null : { min: 900, max: 1100 },
      supervisor: 'مریم کاظمی',
      ordered_at: ago(14 * DAY),
      state: seed.state,
      round: seed.round ? { current: seed.round[0], max: seed.round[1] } : null,
      due_at: seed.due === null ? null : inDays(seed.due),
      unread: seed.unread ?? 0,
      form_pdf: '/static/mock/form.pdf',
      versions,
      can_finalize: seed.state === 'revision' && seed.round?.[0] === seed.round?.[1],
      form: {
        submitted_at: ago(16 * DAY),
        sections: seed.type === 'cv' ? SOP_FORM.slice(1) : SOP_FORM,
      },
      requirements:
        seed.type === 'cv'
          ? ['حداکثر ۲ صفحه', 'قالب آمریکای شمالی']
          : [
              '۹۰۰ تا ۱۱۰۰ کلمه، بدون عنوان',
              'اشاره به استاد یا گروه پژوهشی مورد علاقه',
              'فایل نهایی PDF، فونت ۱۱ یا ۱۲',
            ],
      program_url: seed.program ? 'https://www.example.edu/program' : null,
      documents: [
        { name: 'رزومه‌ی نهایی (تیم نگارش)', url: '/static/mock/cv.pdf' },
        { name: 'ریزنمرات کارشناسی', url: '/static/mock/transcript.pdf' },
      ],
      messages: [],
    },
  };
}

let orders: Map<number, MockOrder> | null = null;

function ordersOrError(): Map<number, MockOrder> | Response {
  if (storage.get() !== WRITER) return forbidden();
  orders ??= new Map(SEEDS.map((seed) => [seed.id, build(seed)]));
  return orders;
}

const VIEW_OF: Record<OrderState, QueueView> = {
  new: 'mine',
  drafting: 'mine',
  revision: 'mine',
  waiting_applicant: 'applicant',
  delivered: 'delivered',
};

function rowOf(order: MockOrder): OrderRow {
  const { data } = order;
  return {
    id: data.id,
    file_number: data.file_number,
    applicant: data.applicant.name,
    type: data.type,
    program: data.program,
    state: data.state,
    drafts: data.versions.length,
    round: data.round,
    notes: order.notes,
    due_at: data.due_at,
    delivered_at: order.delivered_at,
    unread: data.unread,
  };
}

function orderOr404(params: Record<string, unknown>) {
  const all = ordersOrError();
  if (all instanceof Response) return all;
  return all.get(Number(params['id'])) ?? notFound();
}

const detail = (order: MockOrder): OrderData => ({
  ...order.data,
  messages: order.messages.slice(-2).map((item) => ({
    id: item.id,
    author: item.author,
    mine: item.mine,
    at: item.sent_at,
    text: item.text,
  })),
});

export const writerHandlers = [
  http.get(`${API}/orders/`, ({ request }) => {
    const all = ordersOrError();
    if (all instanceof Response) return all;
    const param = new URL(request.url).searchParams.get('view');
    const view: QueueView = param === 'applicant' || param === 'delivered' ? param : 'mine';
    const list = [...all.values()];
    const counts = { mine: 0, applicant: 0, delivered: 0 };
    for (const order of list) counts[VIEW_OF[order.data.state]]++;
    const horizon = Date.now() + 7 * DAY;
    const week = list
      .filter(
        (order) =>
          order.data.due_at &&
          VIEW_OF[order.data.state] === 'mine' &&
          new Date(order.data.due_at).getTime() <= horizon,
      )
      .sort((a, b) => (a.data.due_at ?? '').localeCompare(b.data.due_at ?? ''))
      .map((order) => ({
        order: order.data.id,
        applicant: order.data.applicant.name,
        type: order.data.type,
        due_at: order.data.due_at ?? '',
        next: order.data.state === 'revision' ? ('revision' as const) : ('draft' as const),
        draft: order.data.versions.length + 1,
      }));
    return HttpResponse.json<QueueData>({
      counts,
      results: list
        .filter((order) => VIEW_OF[order.data.state] === view)
        .map(rowOf)
        .sort((a, b) =>
          view === 'delivered'
            ? (b.delivered_at ?? '').localeCompare(a.delivered_at ?? '')
            : (a.due_at ?? '~').localeCompare(b.due_at ?? '~'),
        ),
      week,
      capacity: { open: counts.mine + counts.applicant, max: 10 },
      guides: [
        { title: 'قالب و لحن انگیزه‌نامه‌ی اسکورایز', url: 'https://www.example.com/guides/sop' },
        {
          title: 'چک‌لیست رزومه‌ی آمریکای شمالی و اروپا',
          url: 'https://www.example.com/guides/cv',
        },
        { title: 'نوشتن توصیه‌نامه از زبان استاد', url: 'https://www.example.com/guides/lor' },
      ],
    });
  }),

  http.get(`${API}/orders/:id/`, ({ params }) => {
    const order = orderOr404(params);
    return order instanceof Response ? order : HttpResponse.json(detail(order));
  }),

  http.post(`${API}/orders/:id/versions/`, async ({ params, request }) => {
    const order = orderOr404(params);
    if (order instanceof Response) return order;
    const { data } = order;
    if (data.state === 'delivered')
      return HttpResponse.json({ detail: 'Delivered.' }, { status: 409 });
    const form = await request.formData();
    const file = form.get('file');
    const note = form.get('note');
    const final = form.get('final') === 'true';
    if (!(file instanceof File)) return HttpResponse.json({ file: ['required'] }, { status: 400 });
    if (final && !data.can_finalize)
      return HttpResponse.json({ detail: 'Not approved yet.' }, { status: 409 });
    const created: OrderVersion = {
      id: newId(),
      number: data.versions.length + 1,
      final,
      file: { name: file.name, url: '/static/mock/version.docx', words: null },
      sent_at: new Date().toISOString(),
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
      revision: null,
    };
    data.versions.push(created);
    data.state = final ? 'delivered' : 'waiting_applicant';
    data.due_at = null;
    order.notes = 0;
    if (final) order.delivered_at = created.sent_at;
    return HttpResponse.json(created, { status: 201 });
  }),

  // ── The order's conversation (SopResumeTicket), seen by the writer ──
  http.get(`${API}/orders/:id/tickets/`, ({ params }) => {
    const order = orderOr404(params);
    if (order instanceof Response) return order;
    return HttpResponse.json<TicketsOverview>({
      threads: [
        {
          id: `writing/${order.data.type}`,
          department: 'writing',
          writing: order.data.type,
          unread: order.data.unread,
          team: [{ name: WRITER_NAME, role: 'writer' }],
        },
      ],
      faqs: [],
    });
  }),

  http.get(`${API}/orders/:id/tickets/writing/:type/messages/`, ({ params, request }) => {
    const order = orderOr404(params);
    if (order instanceof Response) return order;
    const before = Number(new URL(request.url).searchParams.get('before')) || null;
    const older =
      before === null ? order.messages : order.messages.filter((item) => item.id < before);
    const page = older.slice(-MESSAGES_PAGE);
    return HttpResponse.json<MessagePage>({ messages: page, has_more: older.length > page.length });
  }),

  http.post(`${API}/orders/:id/tickets/writing/:type/messages/`, async ({ params, request }) => {
    const order = orderOr404(params);
    if (order instanceof Response) return order;
    const form = await request.formData();
    const raw = form.get('message');
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) return HttpResponse.json({ message: ['required'] }, { status: 400 });
    const file = form.get('attachment');
    const created: TicketMessage = {
      ...message(true, WRITER_NAME, 0, text),
      attachment: file instanceof File ? { name: file.name, url: '/static/mock/attachment' } : null,
    };
    order.messages.push(created);
    order.data.unread = 0;
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(`${API}/orders/:id/tickets/writing/:type/seen/`, ({ params }) => {
    const order = orderOr404(params);
    if (order instanceof Response) return order;
    order.data.unread = 0;
    return new HttpResponse(null, { status: 204 });
  }),
];

export function resetWriterMocks() {
  orders = null;
}

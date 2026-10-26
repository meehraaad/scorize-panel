import { http, HttpResponse } from 'msw';
import type {
  ApplicationInput,
  BoardItem,
  BotProblem,
  CaseActivity,
  CaseApplication,
  CaseApplications,
  CaseData,
  CaseDocument,
  CaseDocuments,
  CaseRow,
  CaseStage,
  CaseWriting,
  Credential,
  Inbox,
  ImportPreview,
  ImportRow,
  InboxItem,
  NewDocument,
  ProfessorEmailRow,
  ReportsData,
  StageFilter,
  TodayData,
  WaitingCase,
  WritingState,
} from '@/features/supervisor/api';
import type { Degree } from '@/lib/applicant/approval';
import { APPLICATION_RESULTS, type ApplicationResult } from '@/lib/applications';
import type { NewTask } from '@/lib/tasks/api';
import type { MessagePage, TicketMessage, TicketsOverview } from '@/lib/tickets/api';
import { forbidden, notFound, pageOf, storage } from './session';

/**
 * Fake supervisor API (docs/backend-changes.md SV1–SV14) for Maryam (09120000001), supervisor of
 * a dozen cases. Changes (stage, documents, applications, bot, messages) stay until the page reloads.
 */

export const SUPERVISOR = 2;
export const SUPERVISOR_NAME = 'مریم کاظمی';
const COLLEAGUE = 'علی رضایی';

const API = '/api/supervisor/v1';
const CASES_PAGE = 10;
const EMAILS_PAGE = 8;
const ACTIVITY_PAGE = 10;
const MESSAGES_PAGE = 20;
const INBOX_PAGE = 20;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const later = (ms: number) => new Date(Date.now() + ms).toISOString();
/** A day `n` days from today, at noon (deadlines are dates). */
const inDays = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() + n);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};

let nextId = 90_000;
const newId = () => nextId++;

interface MockCase {
  data: CaseData;
  cv: WritingState | null;
  sop: WritingState | null;
  todo: { text: string; urgent: boolean } | null;
  last_activity: string;
  applications: CaseApplication[];
  applies_total: number;
  documents: CaseDocument[];
  writing: CaseWriting[] | null;
  interests: string[];
  credentials: Credential[];
  emails: ProfessorEmailRow[];
  bot_today: number;
  account: string | null;
  history: CaseActivity[];
  messages: TicketMessage[];
  unread: number;
}

// ── Seed data ────────────────────────────────────────────────────────────────────────────────

type AppSeed = [
  university: string,
  program: string,
  deadlineDays: number | null,
  fee: [number, string] | null,
  payment: CaseApplication['payment'],
  result: CaseApplication['result'],
  approval: CaseApplication['approval'],
  note?: string,
];

const DOCUMENTS = [
  'پاسپورت',
  'ریزنمرات کارشناسی',
  'دانشنامه‌ی کارشناسی',
  'مدرک زبان (IELTS)',
  'توصیه‌نامه‌ی اول',
  'توصیه‌نامه‌ی دوم',
  'ترجمه‌ی رسمی ریزنمرات',
  'عکس پرسنلی',
  'گواهی اشتغال به کار',
  'ترجمه‌ی رسمی دانشنامه',
  'نمونه‌ی مقاله',
];

const PROFESSORS = [
  ['Prof. Anna Keller', 'University of Toronto'],
  ['Dr. Liam Chen', 'University of British Columbia'],
  ['Prof. Sofia Rossi', 'McGill University'],
  ['Dr. Jonas Weber', 'TU Munich'],
  ['Prof. Emily Clarke', 'University of Waterloo'],
  ['Dr. Hannah Schmidt', 'RWTH Aachen'],
  ['Prof. Omar Haddad', 'University of Alberta'],
  ['Dr. Mei Tanaka', 'Simon Fraser University'],
  ['Prof. Lukas Braun', 'KIT'],
  ['Dr. Clara Martin', 'University of Ottawa'],
] as const;
const EMAIL_STATUSES: ProfessorEmailRow['status'][] = [
  'sent',
  'reminded',
  'sent',
  'replied',
  'sent',
  'bounced',
];

interface CaseSeed {
  id: number;
  name: string;
  degree: Degree;
  countries: string[];
  stage: CaseStage;
  contract: string;
  cv: WritingState | null;
  sop: WritingState | null;
  bot: boolean;
  problems?: BotProblem[];
  docs: [uploaded: number, required: number];
  /** Index (within the uploaded ones) of a document waiting for review. */
  review?: number;
  last: number;
  todo?: { text: string; urgent: boolean };
  apps: AppSeed[];
  emails: [sent: number, queued: number];
  interests: string[];
  unread?: number;
  thread?: [
    from: 'applicant' | 'me' | 'colleague',
    agoMs: number,
    text: string,
    urgent?: boolean,
  ][];
}

const SEEDS: CaseSeed[] = [
  {
    id: 1240,
    name: 'سارا محمدی',
    degree: 2,
    countries: ['کانادا', 'آلمان'],
    stage: 'applying',
    contract: 'اپلای کامل',
    cv: 'final',
    sop: 'final',
    bot: true,
    docs: [8, 10],
    review: 5,
    last: 2 * HOUR,
    todo: { text: 'پیگیری تأیید ۲ اپلای از متقاضی', urgent: false },
    apps: [
      [
        'University of Toronto',
        'MSc Computer Science',
        18,
        [125, 'CAD'],
        'pending',
        'completed',
        'approved',
        'نیاز به ارسال توصیه‌نامه‌ی دوم تا ۲۵ آبان.',
      ],
      ['UBC', 'MDS Data Science', 14, [168, 'CAD'], 'paid', 'submitted', 'approved'],
      ['TU Munich', 'MSc Informatics', -40, null, null, 'accepted', 'approved'],
      ['RWTH Aachen', 'MSc Software Systems', -38, null, null, 'accepted', 'approved'],
      [
        'McGill University',
        'MSc Computer Science',
        32,
        [132, 'CAD'],
        'pending',
        'completed',
        'pending',
      ],
      [
        'University of Waterloo',
        'MMath Data Science',
        48,
        [125, 'CAD'],
        'pending',
        'completed',
        'pending',
      ],
      ['KIT', 'MSc Computer Science', -55, null, null, 'rejected', 'approved'],
      ['TU Berlin', 'MSc Computer Engineering', -20, [75, 'EUR'], 'paid', 'submitted', 'approved'],
    ],
    emails: [240, 70],
    interests: ['Machine Learning', 'Computer Vision', 'Robotics'],
    unread: 1,
    thread: [
      ['applicant', 3 * DAY, 'سلام، برای McGill باید ریزنمرات را دوباره ترجمه کنم؟'],
      [
        'colleague',
        3 * DAY - 2 * HOUR,
        'سلام سارا جان، نه؛ همان ترجمه‌ی قبلی کافی است. فقط نسخه‌ی اسکن رنگی را آپلود کنید.',
      ],
      [
        'me',
        DAY,
        'دو اپلای McGill و Waterloo آماده است. لطفاً در پنل تأییدشان کنید تا ارسال کنیم.',
      ],
      [
        'applicant',
        3 * HOUR,
        'ممنون. Waterloo را تأیید می‌کنم ولی درباره‌ی McGill یک سؤال دارم: هزینه‌ی فی را خودم بپردازم؟',
      ],
    ],
  },
  {
    id: 1238,
    name: 'امیرحسین رضایی',
    degree: 3,
    countries: ['آمریکا'],
    stage: 'documents',
    contract: 'اپلای + ویزا',
    cv: 'writing',
    sop: 'waiting_info',
    bot: false,
    problems: [{ kind: 'no_cv' }, { kind: 'no_interests' }],
    docs: [4, 11],
    review: 3,
    last: DAY,
    todo: { text: 'مدرک زبان را بررسی کنید', urgent: false },
    apps: [
      [
        'University of Michigan',
        'PhD Mechanical Engineering',
        41,
        [90, 'USD'],
        'pending',
        'pending',
        'approved',
      ],
      [
        'Purdue University',
        'PhD Mechanical Engineering',
        60,
        [75, 'USD'],
        'pending',
        'pending',
        'approved',
      ],
    ],
    emails: [0, 0],
    interests: [],
  },
  {
    id: 1231,
    name: 'نگار احمدی',
    degree: 2,
    countries: ['ایتالیا'],
    stage: 'writing',
    contract: 'اپلای کامل',
    cv: 'final',
    sop: 'writing',
    bot: false,
    problems: [{ kind: 'few_texts', have: 3, need: 5 }],
    docs: [9, 9],
    last: DAY + 4 * HOUR,
    todo: { text: 'نسخه‌ی دوم SOP را بررسی کنید', urgent: false },
    apps: [
      [
        'Politecnico di Milano',
        'MSc Architecture',
        70,
        [30, 'EUR'],
        'pending',
        'pending',
        'approved',
      ],
      ['Sapienza University of Rome', 'MSc Architecture', 85, null, null, 'pending', 'approved'],
    ],
    emails: [0, 0],
    interests: ['Sustainable Architecture', 'Urban Design'],
  },
  {
    id: 1227,
    name: 'محمد کریمی',
    degree: 3,
    countries: ['کانادا'],
    stage: 'applying',
    contract: 'سلف اپلای',
    cv: 'final',
    sop: 'final',
    bot: false,
    problems: [{ kind: 'few_texts', have: 3, need: 5 }],
    docs: [10, 10],
    last: 3 * DAY,
    todo: { text: '۲ متن ایمیل اضافه کنید تا ربات راه بیفتد', urgent: false },
    apps: [
      [
        'University of Alberta',
        'PhD Electrical Engineering',
        24,
        [100, 'CAD'],
        'paid',
        'completed',
        'approved',
      ],
      [
        'University of Calgary',
        'PhD Electrical Engineering',
        38,
        [145, 'CAD'],
        'pending',
        'pending',
        'approved',
      ],
    ],
    emails: [120, 0],
    interests: ['Power Electronics', 'Renewable Energy'],
  },
  {
    id: 1224,
    name: 'زهرا موسوی',
    degree: 2,
    countries: ['سوئد', 'آلمان'],
    stage: 'visa',
    contract: 'اپلای + ویزا',
    cv: 'final',
    sop: 'final',
    bot: false,
    docs: [10, 10],
    last: 4 * DAY,
    todo: { text: 'نتیجه‌ی وقت سفارت را ثبت کنید', urgent: false },
    apps: [
      [
        'Uppsala University',
        'MSc Bioinformatics',
        -60,
        [900, 'SEK'],
        'paid',
        'accepted',
        'approved',
      ],
      [
        'Heidelberg University',
        'MSc Molecular Biosciences',
        -50,
        null,
        null,
        'rejected',
        'approved',
      ],
    ],
    emails: [180, 0],
    interests: ['Bioinformatics', 'Genomics'],
  },
  {
    id: 1219,
    name: 'علی نوری',
    degree: 1,
    countries: ['آلمان'],
    stage: 'documents',
    contract: 'اپلای کامل',
    cv: 'waiting_info',
    sop: 'waiting_info',
    bot: false,
    problems: [{ kind: 'no_account' }],
    docs: [2, 8],
    last: 7 * DAY,
    todo: { text: 'به تیکت ۳ روز پیش پاسخ دهید', urgent: true },
    apps: [['TU Dresden', 'BSc Computer Science', 55, null, null, null, 'pending']],
    emails: [0, 0],
    interests: [],
    unread: 2,
    thread: [
      ['me', 6 * DAY, 'سلام علی، لطفاً ریزنمرات و دانشنامه را تا آخر هفته آپلود کنید.'],
      [
        'applicant',
        3 * DAY,
        'سلام. دانشنامه را هنوز از دانشگاه نگرفته‌ام. گواهی موقت کافی است؟',
        true,
      ],
      ['applicant', DAY, 'ببخشید، جواب سؤالم را ندادید. ددلاین درسدن نزدیک است.'],
    ],
  },
  {
    id: 1215,
    name: 'مهسا جعفری',
    degree: 3,
    countries: ['آمریکا'],
    stage: 'applying',
    contract: 'اپلای کامل',
    cv: 'final',
    sop: 'final',
    bot: true,
    docs: [11, 11],
    last: 6 * DAY,
    todo: { text: 'فی Stanford را پرداخت کنید', urgent: true },
    apps: [
      [
        'Stanford University',
        'PhD Computer Science',
        5,
        [125, 'USD'],
        'pending',
        'completed',
        'approved',
      ],
      ['University of Michigan', 'PhD EECS', 6, [90, 'USD'], 'paid', 'completed', 'approved'],
      [
        'Carnegie Mellon University',
        'PhD Robotics',
        20,
        [100, 'USD'],
        'paid',
        'pending',
        'approved',
      ],
    ],
    emails: [210, 40],
    interests: ['Reinforcement Learning', 'Robotics'],
  },
  {
    id: 1210,
    name: 'رضا حسینی',
    degree: 2,
    countries: ['فرانسه'],
    stage: 'on_hold',
    contract: 'سلف اپلای',
    cv: null,
    sop: null,
    bot: false,
    docs: [5, 9],
    last: 21 * DAY,
    apps: [],
    emails: [0, 0],
    interests: ['Finance'],
  },
  {
    id: 1206,
    name: 'فاطمه صادقی',
    degree: 2,
    countries: ['کانادا', 'سوئیس'],
    stage: 'applying',
    contract: 'اپلای کامل',
    cv: 'final',
    sop: 'final',
    bot: true,
    docs: [9, 10],
    last: 22 * DAY,
    apps: [
      ['ETH Zürich', 'MSc Data Science', 9, [150, 'CHF'], 'paid', 'completed', 'pending'],
      [
        'University of Ottawa',
        'MSc Computer Science',
        45,
        [110, 'CAD'],
        'pending',
        'pending',
        'approved',
      ],
    ],
    emails: [160, 90],
    interests: ['Data Science', 'Statistics'],
  },
  {
    id: 1201,
    name: 'حسین طاهری',
    degree: 3,
    countries: ['انگلستان'],
    stage: 'writing',
    contract: 'اپلای + ویزا',
    cv: 'writing',
    sop: 'writing',
    bot: false,
    docs: [7, 10],
    last: 30 * DAY,
    apps: [
      ['University of Edinburgh', 'PhD Informatics', 11, null, 'waived', 'pending', 'approved'],
    ],
    emails: [0, 0],
    interests: ['Natural Language Processing'],
  },
  {
    id: 1198,
    name: 'لیلا امینی',
    degree: 2,
    countries: ['هلند'],
    stage: 'documents',
    contract: 'اپلای کامل',
    cv: 'waiting_info',
    sop: 'waiting_info',
    bot: false,
    docs: [1, 9],
    last: 33 * DAY,
    apps: [],
    emails: [0, 0],
    interests: [],
  },
  {
    id: 1192,
    name: 'پرهام شریفی',
    degree: 2,
    countries: ['آلمان'],
    stage: 'closed',
    contract: 'اپلای کامل',
    cv: 'final',
    sop: 'final',
    bot: false,
    docs: [10, 10],
    last: 60 * DAY,
    apps: [
      ['University of Stuttgart', 'MSc Computer Science', -150, null, null, 'accepted', 'approved'],
    ],
    emails: [300, 0],
    interests: ['Embedded Systems'],
  },
];

const WRITERS = ['الهام رضوی', 'کاوه نادری'];
const toStep = (state: WritingState): CaseWriting['step'] =>
  state === 'final' ? 'ready' : state === 'writing' ? 'writing' : 'form';

function buildCase(seed: CaseSeed): MockCase {
  const applications: CaseApplication[] = seed.apps.map(
    ([university, program, deadline, fee, payment, result, approval, note]) => ({
      id: newId(),
      university,
      program,
      degree: seed.degree,
      deadline: deadline === null ? null : inDays(deadline),
      fee: fee ? { amount: fee[0], currency: fee[1] } : null,
      payment,
      result,
      approval,
      note: note ?? null,
    }),
  );
  const [uploaded, required] = seed.docs;
  const documents: CaseDocument[] = DOCUMENTS.slice(0, required).map((name, index) => {
    const has = index < uploaded;
    const inReview = has && index === seed.review;
    return {
      id: seed.id * 100 + index,
      name,
      deadline: has ? null : inDays(10 + index),
      state: has ? (inReview ? 'review' : 'approved') : 'missing',
      file: has
        ? {
            name: `${name}.pdf`,
            url: '/static/mock/document.pdf',
            ext: 'PDF',
            uploaded_at: ago((inReview ? 1 : 20 + index) * DAY),
          }
        : null,
      note: null,
    };
  });
  const writing: CaseWriting[] | null =
    seed.cv === null && seed.sop === null
      ? null
      : (
          [
            ['sop', seed.sop],
            ['cv', seed.cv],
          ] as const
        ).flatMap(([type, state], index) =>
          state === null
            ? []
            : [
                {
                  type,
                  step: toStep(state),
                  writer: state === 'waiting_info' ? null : (WRITERS[index] ?? null),
                  delivered_at: state === 'final' ? ago((30 + index) * DAY) : null,
                  file_url: state === 'final' ? '/static/mock/writing.pdf' : null,
                },
              ],
        );
  const [sent, queued] = seed.emails;
  const emails: ProfessorEmailRow[] = Array.from({ length: sent + queued }, (_, index) => {
    const professor = PROFESSORS[index % PROFESSORS.length] ?? PROFESSORS[0];
    const isQueued = index >= sent;
    return {
      id: seed.id * 1000 + index,
      professor: professor[0],
      university: professor[1],
      sent_at: isQueued ? null : ago((index % 40) * DAY + HOUR),
      status: isQueued ? 'queued' : (EMAIL_STATUSES[index % EMAIL_STATUSES.length] ?? 'sent'),
    };
  });
  const problems = seed.problems ?? [];
  const noAccount = problems.some((problem) => problem.kind === 'no_account');
  const account = noAccount
    ? null
    : `${seed.name === 'سارا محمدی' ? 'sara.m' : `case${String(seed.id)}`}.apply@gmail.com`;
  const credentials: Credential[] = account
    ? [
        { label: 'ایمیل', value: account, secret: false },
        { label: 'رمز عبور', value: `Sc0rize-${String(seed.id)}!`, secret: true },
        { label: 'شماره‌ی ریکاوری', value: '09123456789', secret: false },
      ]
    : [];

  const history: CaseActivity[] = [
    ...(seed.id === 1240
      ? [
          { text: `${COLLEAGUE} نتیجه‌ی TU Munich را «پذیرش» ثبت کرد`, at: 2 * HOUR },
          { text: 'متقاضی اپلای UBC را تأیید کرد', at: DAY },
          { text: 'متقاضی «مدرک زبان» را آپلود کرد', at: 2 * DAY },
          { text: `${SUPERVISOR_NAME} وضعیت پرونده را به «در حال اپلای» تغییر داد`, at: 5 * DAY },
        ]
      : [{ text: `${SUPERVISOR_NAME} پرونده را بررسی کرد`, at: seed.last }]),
    ...Array.from({ length: seed.id === 1240 ? 14 : 3 }, (_, index) => ({
      text: `ربات ${String(10 + index)} ایمیل برای استادها فرستاد`,
      at: (7 + index * 2) * DAY,
    })),
  ].map((item, index) => ({ id: seed.id * 10_000 + index, text: item.text, at: ago(item.at) }));

  const messages: TicketMessage[] = (seed.thread ?? []).map(([from, when, text, urgent]) => ({
    id: newId(),
    mine: from === 'me',
    author: from === 'applicant' ? seed.name : from === 'me' ? SUPERVISOR_NAME : COLLEAGUE,
    role: from === 'applicant' ? null : 'supervisor',
    sent_at: ago(when),
    text,
    priority: urgent ? 3 : 1,
    attachment: null,
    seen: from !== 'applicant',
    rating: from === 'colleague' ? 5 : null,
    auto: false,
  }));

  const data: CaseData = {
    id: seed.id,
    user: seed.id + 50_000,
    name: seed.name,
    file_number: seed.id,
    stage: seed.stage,
    phone: '09123456789',
    email: seed.id === 1240 ? 'sara.mohammadi@gmail.com' : `applicant${String(seed.id)}@gmail.com`,
    supervisors: [SUPERVISOR_NAME, COLLEAGUE],
    consultant: 'نیما احمدی',
    contract: {
      kind: seed.contract,
      degree: seed.degree,
      countries: seed.countries,
      started_at: ago(241 * DAY),
      ends_at: later(124 * DAY),
      total: { amount: 2400, currency: 'EUR' },
      files: [
        { name: 'قرارداد.pdf', url: '/static/mock/contract.pdf' },
        { name: 'شرایط متقاضی.pdf', url: '/static/mock/terms.pdf' },
      ],
    },
    bot: { active: seed.bot, problems },
    progress: {
      suggested: 0,
      applied: 0,
      accepted: 0,
      emails_sent: sent,
      emails_total: sent + queued,
    },
    installments: [
      {
        id: seed.id * 10 + 1,
        number: 1,
        amount: { amount: 800, currency: 'EUR' },
        due_date: ago(241 * DAY),
        condition: null,
        status: 'paid',
      },
      {
        id: seed.id * 10 + 2,
        number: 2,
        amount: { amount: 800, currency: 'EUR' },
        due_date: ago(120 * DAY),
        condition: null,
        status: seed.id === 1210 ? 'overdue' : 'paid',
      },
      {
        id: seed.id * 10 + 3,
        number: 3,
        amount: { amount: 800, currency: 'EUR' },
        due_date: null,
        condition: 'پس از پذیرش',
        status: seed.stage === 'admitted' || seed.stage === 'visa' ? 'due' : 'upcoming',
      },
    ],
    tasks:
      seed.id === 1240
        ? [
            { id: 601, text: 'بررسی SOP نسخه‌ی دوم', due_at: ago(2 * HOUR) },
            { id: 602, text: 'تماس برای مدرک زبان', due_at: later(3 * DAY) },
            { id: 603, text: 'پرداخت فی دانشگاه تورنتو', due_at: later(8 * DAY) },
          ]
        : [],
    activity: [],
    unread: seed.unread ?? 0,
    documents_waiting: 0,
    applications: 0,
  };

  return {
    data,
    cv: seed.cv,
    sop: seed.sop,
    todo: seed.todo ?? null,
    last_activity: ago(seed.last),
    applications,
    applies_total: 15,
    documents,
    writing,
    interests: seed.interests,
    credentials,
    emails,
    bot_today: seed.bot ? 12 : 0,
    account,
    history,
    messages,
    unread: seed.unread ?? 0,
  };
}

// ── State ────────────────────────────────────────────────────────────────────────────────────

let cases: Map<number, MockCase> | null = null;

function casesOrError(): Map<number, MockCase> | Response {
  if (storage.get() !== SUPERVISOR) return forbidden();
  cases ??= new Map(SEEDS.map((seed) => [seed.id, buildCase(seed)]));
  return cases;
}

const APPLIED = new Set(['submitted', 'accepted', 'rejected']);

/** The case as the API sends it, with its counts worked out from the rows. */
function caseData(item: MockCase): CaseData {
  return {
    ...item.data,
    progress: {
      ...item.data.progress,
      suggested: item.applications.length,
      applied: item.applications.filter((app) => app.result && APPLIED.has(app.result)).length,
      accepted: item.applications.filter((app) => app.result === 'accepted').length,
      emails_sent: item.emails.filter((email) => email.sent_at).length,
      emails_total: item.emails.length,
    },
    activity: item.history.slice(0, 4),
    unread: item.unread,
    documents_waiting: item.documents.filter((doc) => doc.state === 'review').length,
    applications: item.applications.length,
  };
}

const docCount = (item: MockCase) => ({
  uploaded: item.documents.filter((doc) => doc.state === 'approved' || doc.state === 'review')
    .length,
  required: item.documents.length,
});

function nextDeadline(item: MockCase) {
  const upcoming = item.applications
    .filter(
      (app) =>
        app.deadline &&
        new Date(app.deadline).getTime() > Date.now() &&
        !app.result?.match(/submitted|accepted|rejected/),
    )
    .map((app) => app.deadline ?? '')
    .sort();
  return upcoming[0] ?? null;
}

function rowOf(item: MockCase): CaseRow {
  const { data } = item;
  return {
    id: data.id,
    name: data.name,
    file_number: data.file_number,
    degree: data.contract.degree,
    countries: data.contract.countries,
    stage: data.stage,
    contract: data.contract.kind,
    cv: item.cv,
    sop: item.sop,
    bot: data.bot.active,
    docs: docCount(item),
    last_activity: item.last_activity,
  };
}

function boardStatus(app: CaseApplication, item: MockCase): BoardItem['status'] {
  if (app.result && APPLIED.has(app.result)) return 'submitted';
  if (app.approval === 'pending') return 'waiting_approval';
  if (app.fee && app.payment === 'pending') return 'fee_unpaid';
  if (item.sop !== null && item.sop !== 'final') return 'sop_missing';
  return 'ready';
}

function record(item: MockCase, text: string) {
  item.history.unshift({ id: newId(), text, at: new Date().toISOString() });
  item.last_activity = new Date().toISOString();
}

function caseOr404(params: Record<string, unknown>) {
  const all = casesOrError();
  if (all instanceof Response) return all;
  return all.get(Number(params['id'])) ?? notFound();
}

/** A task created from the case page shows under "open tasks" (called by the tasks mock). */
export function addCaseTask(task: NewTask) {
  if (!cases) return;
  for (const item of cases.values())
    if (item.data.user === task.user) {
      item.data.tasks.push({ id: newId(), text: task.text, due_at: task.due_at });
      record(item, `${SUPERVISOR_NAME} کار «${task.text}» را ساخت`);
    }
}

// ── Reports and CSV import ───────────────────────────────────────────────────────────────────

/** Applications sent per month before this one (oldest first): history the seeds don't hold. */
const MONTH_HISTORY: [submitted: number, accepted: number][] = [
  [6, 1],
  [9, 2],
  [11, 3],
  [8, 4],
  [13, 3],
];
const PERIOD_SCALE: Record<string, number> = { month: 1, last_month: 0.7, quarter: 2.4 };

function reportOf(list: MockCase[], period: string): ReportsData {
  const scale = PERIOD_SCALE[period] ?? 1;
  const apps = list.flatMap((item) => item.applications.map((app) => ({ item, app })));
  const now = new Date();
  const monthStart = (back: number) => new Date(now.getFullYear(), now.getMonth() - back, 1);
  const thisMonth = apps.filter(({ app }) => app.result && APPLIED.has(app.result)).length;
  const months = [
    // A day in each month (Django counts months in the user's calendar: Jalali in Persian).
    ...MONTH_HISTORY.map(([submitted, accepted], index) => ({
      month: ago((MONTH_HISTORY.length - index) * 30 * DAY),
      submitted,
      accepted,
    })),
    {
      month: now.toISOString(),
      submitted: thisMonth,
      accepted: apps.filter(({ app }) => app.result === 'accepted').length,
    },
  ];
  const byCountry = new Map<string, ReportsData['countries'][number]>();
  for (const { item, app } of apps) {
    if (!app.result || !APPLIED.has(app.result)) continue;
    const country = item.data.contract.countries[0] ?? '—';
    const row = byCountry.get(country) ?? {
      country,
      submitted: 0,
      accepted: 0,
      rejected: 0,
      waiting: 0,
    };
    row.submitted++;
    if (app.result === 'accepted') row.accepted++;
    else if (app.result === 'rejected') row.rejected++;
    else row.waiting++;
    byCountry.set(country, row);
  }
  const missed = apps
    .filter(
      ({ app }) =>
        app.deadline &&
        new Date(app.deadline).getTime() < Date.now() &&
        (!app.result || !APPLIED.has(app.result)),
    )
    .slice(0, 3)
    .map(({ item, app }, index) => ({
      application: app.id,
      applicant: { id: item.data.id, name: item.data.name },
      university: app.university,
      deadline: app.deadline ?? '',
      reason: index === 0 ? 'SOP به‌موقع آماده نشد؛ نسخه‌ی دوم ۴ روز در تیم نگارش ماند.' : null,
    }));
  const idle = list
    .filter((item) => item.data.stage !== 'closed')
    .map((item) => ({
      id: item.data.id,
      name: item.data.name,
      stage: item.data.stage,
      days: Math.floor((Date.now() - new Date(item.last_activity).getTime()) / DAY),
    }))
    .filter((item) => item.days > 14)
    .sort((a, b) => b.days - a.days);
  const emails = list.flatMap((item) => item.emails.filter((email) => email.sent_at));
  const waitingDocs = list.flatMap((item) =>
    item.documents.filter((doc) => doc.state === 'review'),
  );
  return {
    start: monthStart(period === 'quarter' ? 2 : period === 'last_month' ? 1 : 0).toISOString(),
    end: (period === 'last_month'
      ? new Date(now.getFullYear(), now.getMonth(), 0)
      : now
    ).toISOString(),
    submitted: { count: Math.round(thisMonth * scale), change: period === 'quarter' ? 9 : 5 },
    accepted: {
      count: Math.round((months.at(-1)?.accepted ?? 0) * scale),
      results: Math.round(11 * scale),
    },
    on_time: { percent: period === 'last_month' ? 86 : 92, goal: 90 },
    documents_waiting: {
      count: waitingDocs.length,
      oldest_at: waitingDocs.length ? ago(2 * DAY) : null,
    },
    months,
    countries: [...byCountry.values()].sort((a, b) => b.submitted - a.submitted),
    missed,
    replies: {
      median_minutes: 180,
      same_day: 84,
      goal: 90,
      slowest: { applicant: list[0]?.data.name ?? '', minutes: 3 * 24 * 60 },
      urgent_max_minutes: 110,
    },
    idle,
    bot: {
      sent: emails.length,
      replied: emails.filter((email) => email.status === 'replied').length,
      active: list.filter((item) => item.data.bot.active).length,
      applying: list.filter((item) => item.data.stage === 'applying').length,
      stopped: list.filter((item) => item.data.bot.problems.length > 0).length,
    },
  };
}

const isResult = (value: string): value is ApplicationResult =>
  APPLICATION_RESULTS.includes(value as ApplicationResult);

/** Checked files waiting for the supervisor's go-ahead, by token. */
const imports = new Map<string, ImportRow[]>();

function previewImport(
  all: Map<number, MockCase>,
  name: string,
  size: number,
  text: string,
): ImportPreview | null {
  const [header = '', ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(',').map((column) => column.trim().toLowerCase());
  const at = (column: string) => columns.indexOf(column);
  if (['file', 'university', 'result'].some((column) => at(column) === -1)) return null;
  const byFile = new Map([...all.values()].map((item) => [item.data.file_number, item]));
  const rows: ImportRow[] = lines
    .map((line, index) => ({ cells: line.split(',').map((cell) => cell.trim()), line: index + 2 }))
    .filter(({ cells }) => cells.some(Boolean))
    .map(({ cells, line }) => {
      const fileNumber = Number(cells[at('file')]) || null;
      const university = cells[at('university')] ?? '';
      const program = at('program') === -1 ? '' : (cells[at('program')] ?? '');
      const result = cells[at('result')] ?? '';
      const item = fileNumber === null ? undefined : byFile.get(fileNumber);
      const base = { line, file_number: fileNumber, university, program, old: null, new: null };
      if (!university || !result)
        return { ...base, applicant: null, change: 'skip', problem: 'missing_column' };
      if (!item) return { ...base, applicant: null, change: 'skip', problem: 'case_not_found' };
      const applicant = { id: item.data.id, name: item.data.name };
      if (!isResult(result)) return { ...base, applicant, change: 'skip', problem: 'bad_result' };
      const existing = item.applications.find(
        (app) => app.university.toLowerCase() === university.toLowerCase(),
      );
      if (!existing) return { ...base, applicant, new: result, change: 'add', problem: null };
      return {
        ...base,
        applicant,
        old: existing.result,
        new: result,
        change: existing.result === result ? 'same' : 'update',
        problem: null,
      };
    });
  const counts = { update: 0, add: 0, same: 0, skip: 0 };
  for (const row of rows) counts[row.change]++;
  return { token: String(newId()), file: { name, size, rows: rows.length }, counts, rows };
}

// ── Handlers ─────────────────────────────────────────────────────────────────────────────────

export const supervisorHandlers = [
  http.get(`${API}/today/:section?`, ({ request, params }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const list = [...all.values()];
    const horizon = Date.now() + 14 * DAY;
    const board: BoardItem[] = list
      .flatMap((item) =>
        item.applications
          .filter((app) => {
            if (!app.deadline) return false;
            const time = new Date(app.deadline).getTime();
            return time > Date.now() && time <= horizon;
          })
          .map((app) => ({
            application: app.id,
            applicant: { id: item.data.id, name: item.data.name },
            university: app.university,
            program: app.program,
            deadline: app.deadline ?? '',
            status: boardStatus(app, item),
          })),
      )
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    const waiting: WaitingCase[] = list
      .filter((item) => item.todo)
      .map((item) => ({
        id: item.data.id,
        name: item.data.name,
        file_number: item.data.file_number,
        degree: item.data.contract.degree,
        countries: item.data.contract.countries,
        todo: item.todo?.text ?? '',
        urgent: item.todo?.urgent ?? false,
        next_deadline: nextDeadline(item),
        docs: docCount(item),
      }))
      .sort(
        (a, b) =>
          Number(b.urgent) - Number(a.urgent) ||
          (a.next_deadline ?? '~').localeCompare(b.next_deadline ?? '~'),
      );
    const counts = Object.fromEntries(
      (['documents', 'writing', 'applying', 'admitted', 'visa', 'on_hold', 'closed'] as const).map(
        (stage) => [stage, list.filter((item) => item.data.stage === stage).length],
      ),
    ) as TodayData['counts'];
    if (params.section === 'board') return HttpResponse.json(pageOf(request, board, 20));
    if (params.section === 'waiting') return HttpResponse.json(pageOf(request, waiting, 20));
    if (params.section === 'counts') return HttpResponse.json(counts);
    return HttpResponse.json<TodayData>({ board, waiting, counts });
  }),

  http.get(`${API}/cases/export/`, ({ request }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').map(Number);
    const lines = ['file,applicant,university,program,deadline,result'];
    for (const id of ids) {
      const item = all.get(id);
      for (const app of item?.applications ?? [])
        lines.push(
          [
            id,
            item?.data.name,
            app.university,
            app.program,
            app.deadline?.slice(0, 10) ?? '',
            app.result ?? '',
          ].join(','),
        );
    }
    return new HttpResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="applications.csv"',
      },
    });
  }),

  http.get(`${API}/cases/`, ({ request }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const stage = params.get('stage');
    const bot = params.get('bot');
    const search = (params.get('search') ?? '').trim().toLowerCase();
    const rows = [...all.values()]
      .filter(
        (item) =>
          !search ||
          [item.data.name, String(item.data.file_number), item.data.email].some((value) =>
            value.toLowerCase().includes(search),
          ),
      )
      .filter((item) => bot === null || item.data.bot.active === (bot === 'on'))
      .map(rowOf);
    const counts = { all: rows.length } as Record<StageFilter, number>;
    for (const value of [
      'documents',
      'writing',
      'applying',
      'admitted',
      'visa',
      'on_hold',
      'closed',
    ] as const)
      counts[value] = rows.filter((row) => row.stage === value).length;
    const filtered = stage ? rows.filter((row) => row.stage === stage) : rows;
    return HttpResponse.json({
      count: filtered.length,
      page_size: CASES_PAGE,
      counts,
      results: filtered.slice((page - 1) * CASES_PAGE, page * CASES_PAGE),
    });
  }),

  http.get(`${API}/cases/:id/`, ({ params }) => {
    const item = caseOr404(params);
    return item instanceof Response ? item : HttpResponse.json(caseData(item));
  }),

  http.post(`${API}/cases/:id/stage/`, async ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const { stage, note } = (await request.json()) as { stage: CaseStage; note: string };
    item.data.stage = stage;
    record(item, `${SUPERVISOR_NAME} وضعیت پرونده را تغییر داد${note ? `: ${note}` : ''}`);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Documents ──
  http.get(`${API}/cases/:id/documents/`, ({ params }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    return HttpResponse.json<CaseDocuments>({
      documents: item.documents,
      writing: item.writing,
      interests: item.interests,
    });
  }),

  http.post(`${API}/cases/:id/documents/`, async ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const body = (await request.json()) as NewDocument;
    if (!body.name.trim()) return HttpResponse.json({ name: ['required'] }, { status: 400 });
    item.documents.push({
      id: newId(),
      name: body.name,
      deadline: body.deadline,
      state: 'missing',
      file: null,
      note: body.note || null,
    });
    record(item, `${SUPERVISOR_NAME} مدرک «${body.name}» را درخواست کرد`);
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(`${API}/cases/:id/documents/:doc/review/`, async ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const doc = item.documents.find((entry) => entry.id === Number(params['doc']));
    if (!doc) return notFound();
    const { approved, note } = (await request.json()) as { approved: boolean; note: string };
    if (!approved && !note.trim())
      return HttpResponse.json({ note: ['required'] }, { status: 400 });
    doc.state = approved ? 'approved' : 'returned';
    doc.note = approved ? null : note;
    record(item, `${SUPERVISOR_NAME} «${doc.name}» را ${approved ? 'تأیید کرد' : 'برگرداند'}`);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Applications and the email bot ──
  http.get(`${API}/cases/:id/applications/`, ({ params }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const sent = item.emails.filter((email) => email.sent_at).length;
    return HttpResponse.json<CaseApplications>({
      applies: {
        used: item.applications.filter((app) => app.result && APPLIED.has(app.result)).length,
        total: item.applies_total,
      },
      bot: {
        active: item.data.bot.active,
        sent_today: item.data.bot.active ? item.bot_today : 0,
        daily_limit: 20,
        account: item.account,
        problems: item.data.bot.problems,
      },
      applications: item.applications,
      emails: {
        sent,
        total: item.emails.length,
        replied: item.emails.filter((email) => email.status === 'replied').length,
      },
      credentials: item.credentials,
    });
  }),

  http.post(`${API}/cases/:id/applications/`, async ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const values = (await request.json()) as ApplicationInput;
    if (!values.university.trim())
      return HttpResponse.json({ university: ['required'] }, { status: 400 });
    item.applications.push({ ...values, id: newId(), approval: 'pending' });
    record(item, `${SUPERVISOR_NAME} اپلای ${values.university} را اضافه کرد`);
    return new HttpResponse(null, { status: 201 });
  }),

  http.patch(`${API}/cases/:id/applications/:app/`, async ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const app = item.applications.find((entry) => entry.id === Number(params['app']));
    if (!app) return notFound();
    const values = (await request.json()) as ApplicationInput;
    const resultChanged = values.result !== app.result;
    Object.assign(app, values);
    record(
      item,
      resultChanged && values.result
        ? `${SUPERVISOR_NAME} نتیجه‌ی ${app.university} را به‌روز کرد`
        : `${SUPERVISOR_NAME} اپلای ${app.university} را ویرایش کرد`,
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API}/cases/:id/applications/:app/`, ({ params }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const app = item.applications.find((entry) => entry.id === Number(params['app']));
    if (!app) return notFound();
    item.applications = item.applications.filter((entry) => entry !== app);
    record(item, `${SUPERVISOR_NAME} اپلای ${app.university} را حذف کرد`);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/cases/:id/bot/`, async ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const { active } = (await request.json()) as { active: boolean };
    if (active && item.data.bot.problems.length > 0)
      return HttpResponse.json({ detail: 'The bot has problems to fix first.' }, { status: 409 });
    item.data.bot.active = active;
    record(item, `${SUPERVISOR_NAME} ربات ایمیل را ${active ? 'راه انداخت' : 'متوقف کرد'}`);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/cases/:id/professor-emails/`, ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
    const sent = item.emails.filter((email) => email.sent_at);
    return HttpResponse.json({
      count: sent.length,
      page_size: EMAILS_PAGE,
      results: sent.slice((page - 1) * EMAILS_PAGE, page * EMAILS_PAGE),
    });
  }),

  http.get(`${API}/cases/:id/activity/`, ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
    return HttpResponse.json({
      count: item.history.length,
      page_size: ACTIVITY_PAGE,
      results: item.history.slice((page - 1) * ACTIVITY_PAGE, page * ACTIVITY_PAGE),
    });
  }),

  // ── Tickets (one case's supervisors' thread, seen by staff) ──
  http.get(`${API}/cases/:id/tickets/`, ({ params }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    return HttpResponse.json<TicketsOverview>({
      threads: [
        {
          id: 'supervisor',
          department: 'supervisor',
          writing: null,
          unread: item.unread,
          team: item.data.supervisors.map((name) => ({ name, role: 'supervisor' as const })),
        },
      ],
      faqs: [],
    });
  }),

  http.get(`${API}/cases/:id/tickets/supervisor/messages/`, ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const before = Number(new URL(request.url).searchParams.get('before')) || null;
    const older =
      before === null ? item.messages : item.messages.filter((message) => message.id < before);
    const page = older.slice(-MESSAGES_PAGE);
    return HttpResponse.json<MessagePage>({ messages: page, has_more: older.length > page.length });
  }),

  http.post(`${API}/cases/:id/tickets/supervisor/messages/`, async ({ params, request }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    const form = await request.formData();
    const raw = form.get('message');
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) return HttpResponse.json({ message: ['required'] }, { status: 400 });
    const file = form.get('attachment');
    const message: TicketMessage = {
      id: newId(),
      mine: true,
      author: SUPERVISOR_NAME,
      role: 'supervisor',
      sent_at: new Date().toISOString(),
      text,
      priority: 1,
      attachment: file instanceof File ? { name: file.name, url: '/static/mock/attachment' } : null,
      seen: false,
      rating: null,
      auto: false,
    };
    item.messages.push(message);
    item.unread = 0;
    if (item.todo?.text.includes('تیکت')) item.todo = null;
    return HttpResponse.json(message, { status: 201 });
  }),

  http.post(`${API}/cases/:id/tickets/supervisor/seen/`, ({ params }) => {
    const item = caseOr404(params);
    if (item instanceof Response) return item;
    item.unread = 0;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/tickets/`, ({ request }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const filter = new URL(request.url).searchParams.get('filter') === 'all' ? 'all' : 'waiting';
    const items: InboxItem[] = [...all.values()]
      .filter((item) => item.messages.length > 0)
      .map((item) => {
        const last = item.messages.at(-1);
        // The applicant's messages after the team's last answer.
        const lastStaff = item.messages.findLastIndex((message) => message.role !== null);
        const waitingMessages = item.messages.slice(lastStaff + 1);
        return {
          applicant: { id: item.data.id, name: item.data.name, file_number: item.data.file_number },
          last: {
            text: last?.text ?? '',
            at: last?.sent_at ?? '',
            author: last?.author ?? '',
            mine: last?.mine ?? false,
          },
          unread: item.unread,
          waiting_since: waitingMessages[0]?.sent_at ?? null,
          urgent: waitingMessages.some((message) => message.priority === 3),
        };
      })
      .sort(
        (a, b) =>
          (a.waiting_since ?? '~').localeCompare(b.waiting_since ?? '~') ||
          b.last.at.localeCompare(a.last.at),
      );
    const waiting = items.filter((item) => item.waiting_since);
    return HttpResponse.json<Inbox>({
      counts: { waiting: waiting.length, all: items.length },
      ...pageOf(request, filter === 'all' ? items : waiting, INBOX_PAGE),
    });
  }),

  // ── Reports (SV15) ──
  http.get(`${API}/reports/`, ({ request }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const period = new URL(request.url).searchParams.get('period') ?? 'month';
    return HttpResponse.json<ReportsData>(reportOf([...all.values()], period));
  }),

  http.get(`${API}/reports/export/`, ({ request }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const period = new URL(request.url).searchParams.get('period') ?? 'month';
    const report = reportOf([...all.values()], period);
    // Django answers an .xlsx; a CSV of the country table stands in for it here.
    const lines = ['country,submitted,accepted,rejected,waiting'];
    for (const row of report.countries)
      lines.push([row.country, row.submitted, row.accepted, row.rejected, row.waiting].join(','));
    return new HttpResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="report.csv"',
      },
    });
  }),

  // ── Import results from CSV (SV17) ──
  http.get(`${API}/cases/import/sample/`, () => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    return new HttpResponse(
      [
        'file,university,program,deadline,result',
        '1240,TU Munich,MSc Informatics,2026-12-01,accepted',
        '1240,McGill University,MSc Computer Science,2026-12-15,submitted',
      ].join('\n'),
      {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="results-sample.csv"',
        },
      },
    );
  }),

  http.post(`${API}/cases/import/preview/`, async ({ request }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return HttpResponse.json({ file: ['required'] }, { status: 400 });
    const text = await file.text();
    const preview = previewImport(all, file.name, file.size, text);
    if (!preview) return HttpResponse.json({ file: ['invalid'] }, { status: 400 });
    imports.set(preview.token, preview.rows);
    return HttpResponse.json<ImportPreview>(preview);
  }),

  http.post(`${API}/cases/import/`, async ({ request }) => {
    const all = casesOrError();
    if (all instanceof Response) return all;
    const { token } = (await request.json()) as { token: string; notify: boolean };
    const rows = imports.get(token);
    if (!rows) return HttpResponse.json({ token: ['expired'] }, { status: 400 });
    imports.delete(token);
    let applied = 0;
    for (const row of rows) {
      const item = row.applicant ? all.get(row.applicant.id) : undefined;
      if (!item || !row.new || (row.change !== 'update' && row.change !== 'add')) continue;
      const existing = item.applications.find(
        (app) => app.university.toLowerCase() === row.university.toLowerCase(),
      );
      if (existing) existing.result = row.new;
      else
        item.applications.push({
          id: newId(),
          university: row.university,
          program: row.program,
          degree: item.data.contract.degree ?? 2,
          deadline: null,
          fee: null,
          payment: null,
          result: row.new,
          approval: 'approved',
          note: null,
        });
      record(item, `${SUPERVISOR_NAME} نتیجه‌ی ${row.university} را از فایل ثبت کرد`);
      applied++;
    }
    return HttpResponse.json({ applied });
  }),
];

export function resetSupervisorMocks() {
  cases = null;
  imports.clear();
}

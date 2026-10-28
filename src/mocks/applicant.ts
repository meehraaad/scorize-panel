import { http, HttpResponse } from 'msw';
import type {
  Application,
  ApplicationsData,
  ProfessorEmail,
  ProfessorEmailPage,
  VisaResult,
} from '@/features/applications/api';
import type {
  CampaignData,
  ContractData,
  DiscountResult,
  OpenPayment,
  PaymentData,
  PaymentItem,
  ProfileField,
} from '@/features/contract/api';
import type { CaseFile, DocumentsData, RequiredDocument } from '@/features/documents/api';
import type { AccessState, ApplicantAccess, CallRequest } from '@/lib/applicant/access';
import type { Gates } from '@/lib/applicant/gates';
import type { ConsultationDetail } from '@/features/consultations/api';
import type { EventDetail, GpaCourse, PackageDetail, ServicesData } from '@/features/services/api';
import type { TurkeyAnswers, TurkeyCase, TurkeyDocument } from '@/features/turkey/api';
import type { ApplicantOverview, ApplicationSummary } from '@/features/home/api';
import type { WritingForm } from '@/features/writing/api';
import type {
  Faq,
  MessagePage,
  Priority,
  TicketMessage,
  TicketThread,
  TicketsOverview,
} from '@/lib/tickets/api';
import { cvForm } from '@/features/writing/cvForm';
import { dsForm } from '@/features/writing/dsForm';
import {
  isField,
  isFormType,
  missingInForm,
  type Answers,
  type FormSpec,
  type FormType,
} from '@/features/writing/formSpec';
import { plForm } from '@/features/writing/plForm';
import { psForm } from '@/features/writing/psForm';
import { recommendationForm } from '@/features/writing/recommendationForm';
import { sopForm } from '@/features/writing/sopForm';
import { estimateHandlers, resetEstimateMocks } from './estimate';
import { journeyHandlers, resetJourneyMocks } from './journey';
import { forbidden, notFound, storage } from './session';
import {
  ownTicketHandlers,
  resetWritingOfferMocks,
  writingOfferHandlers,
} from './writingOffers';

/**
 * Fake applicant-panel API (docs/backend-changes.md H1–H41). Only Sara (user 1) has a case; anyone
 * else gets 404, like Django for a user without an Applicant. Her applications and documents are
 * the one source for the home page's deadlines, progress and tasks too, so a change shows up on
 * every page.
 */

const SARA = 1;
const BASE = '/api/applicant/v1';

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const app = (
  id: number,
  university: string,
  program: string,
  deadlineInDays: number,
  approval: Application['approval'],
  result: Application['result'],
  fee: Application['fee'],
  payment: Application['payment'],
  extra: Partial<Application> = {},
): Application => ({
  id,
  university,
  degree: 2,
  program,
  deadline: daysFromNow(deadlineInDays),
  result,
  approval,
  fee,
  payment,
  supervisor_note: null,
  showcase: null,
  country: 'کانادا',
  sent_at: null,
  result_at: null,
  ...extra,
});

const cad = (amount: number) => ({ amount, currency: 'CAD' });

function saraApplications(): Application[] {
  return [
    app(
      102,
      'McGill University',
      'Computer Science',
      32,
      'pending',
      'completed',
      cad(120),
      'pending',
    ),
    app(
      104,
      'University of Waterloo',
      'Data Science',
      48,
      'pending',
      'completed',
      cad(125),
      'pending',
    ),
    app(105, 'TU Munich', 'Informatics', -21, 'approved', 'accepted', null, 'waived', {
      country: 'آلمان',
      sent_at: daysFromNow(-60),
      result_at: daysFromNow(-4),
      supervisor_note:
        'نامه‌ی پذیرش در ایمیل شما آمده. مهلت قبول پیشنهاد ۱۵ آذر است. برای قسط «بعد از پذیرش» هم پیامک دریافت می‌کنید.',
    }),
    app(
      101,
      'University of Toronto',
      'Computer Science',
      18,
      'approved',
      'completed',
      cad(125),
      'pending',
    ),
    app(103, 'UBC', 'Data Science', 32, 'approved', 'submitted', cad(168), 'paid', {
      sent_at: daysFromNow(-12),
    }),
    app(
      106,
      'RWTH Aachen',
      'Data Science',
      -21,
      'approved',
      'waiting_for_recommendation',
      { amount: 75, currency: 'EUR' },
      'paid',
      {
        country: 'آلمان',
        supervisor_note:
          'یکی از دو توصیه‌نامه هنوز ارسال نشده. لطفاً به استاد دومتان یادآوری کنید.',
      },
    ),
    app(
      107,
      'University of Edinburgh',
      'Artificial Intelligence',
      -11,
      'approved',
      'rejected',
      { amount: 90, currency: 'GBP' },
      'paid',
      { country: 'انگلستان', sent_at: daysFromNow(-40), result_at: daysFromNow(-6) },
    ),
    app(
      108,
      'University of Alberta',
      'Computing Science',
      60,
      'approved',
      'incomplete_documents',
      cad(125),
      'paid',
      {
        supervisor_note:
          'برای این اپلای ریز نمرات با ترجمه‌ی رسمی لازم است. بعد از آپلود، اپلای را ارسال می‌کنیم.',
      },
    ),
    app(109, 'TU Berlin', 'Computer Science', -30, 'approved', 'accepted', null, 'waived', {
      country: 'آلمان',
      sent_at: daysFromNow(-75),
      result_at: daysFromNow(-20),
      showcase: true,
    }),
    app(
      110,
      'Concordia University',
      'Computer Science',
      70,
      'approved',
      'waiting_for_portal',
      cad(100),
      'pending',
    ),
    app(
      111,
      'Simon Fraser University',
      'Computing Science',
      55,
      'approved',
      'pending',
      cad(125),
      'paid',
    ),
    app(112, 'University of Ottawa', 'Computer Science', 40, 'rejected', null, cad(110), null),
  ];
}

function saraVisa(): VisaResult[] {
  const appointment = new Date(Date.now() + 40 * 86_400_000);
  appointment.setHours(9, 30, 0, 0);
  return [
    {
      id: 1,
      title: 'ویزای تحصیلی آلمان',
      destination: 'آلمان',
      embassy: 'ترکیه (آنکارا)',
      status: 'pending_appointment',
      appointment_at: appointment.toISOString(),
      resolved_at: null,
      appointment_proof: '#',
      note: 'اصل پاسپورت، نامه‌ی پذیرش و مدرک Blocked Account را همراه داشته باشید. ۳۰ دقیقه زودتر برسید.',
    },
  ];
}

/** 86 emails, 9 replies, like the design. */
function saraProfessorEmails(): ProfessorEmail[] {
  const pool: Omit<ProfessorEmail, 'id' | 'status'>[] = [
    {
      university: 'University of Toronto',
      department: 'Computer Science',
      interests: ['Machine Learning', 'Computer Vision', 'Robotics'],
    },
    {
      university: 'McGill University',
      department: 'Electrical & Computer Eng.',
      interests: ['Deep Learning', 'Signal Processing'],
    },
    {
      university: 'TU Munich',
      department: 'Informatics',
      interests: ['Data Mining', 'Graph Learning', 'NLP'],
    },
    {
      university: 'University of Waterloo',
      department: 'Statistics',
      interests: ['Bayesian Methods', 'Causal Inference'],
    },
    {
      university: 'UBC',
      department: 'Computer Science',
      interests: ['Reinforcement Learning', 'Optimization'],
    },
  ];
  return Array.from({ length: 86 }, (_, index) => ({
    id: index + 1,
    ...(pool[index % pool.length] as (typeof pool)[number]),
    status: index % 10 === 0 ? 'replied' : index % 3 === 1 ? 'reminded' : 'sent',
  }));
}

function saraDocuments(): Omit<DocumentsData, 'progress'> {
  const file = (
    id: number,
    name: string,
    ext: string,
    daysAgo: number,
    source: CaseFile['source'] = 'me',
    canDelete = false,
  ): CaseFile => ({
    id,
    name,
    url: '#',
    ext,
    uploaded_at: daysFromNow(-daysAgo),
    source,
    can_delete: canDelete,
    // Django: own files wait for the supervisor (deletable until then); team files are approved.
    state: source === 'me' && canDelete ? 'review' : 'approved',
  });
  return {
    required: [
      { id: 21, name: 'ریز نمرات کارشناسی (ترجمه‌ی رسمی)', deadline: daysFromNow(3), note: null },
      {
        id: 22,
        name: 'توصیه‌نامه‌ی دوم',
        deadline: daysFromNow(18),
        note: 'نسخه‌ی قبلی امضا نداشت. لطفاً نسخه‌ی امضاشده روی سربرگ دانشگاه را بفرستید.',
      },
    ],
    files: [
      file(1, 'پاسپورت', 'PDF', 20, 'me', true),
      file(2, 'مدرک زبان IELTS', 'PDF', 1, 'me', true),
      file(3, 'عکس پرسنلی', 'JPG', 20, 'me', true),
      file(4, 'دانشنامه‌ی کارشناسی', 'PDF', 18),
      file(5, 'توصیه‌نامه‌ی اول', 'PDF', 14),
      file(6, 'سوابق کاری', 'PDF', 12),
      file(7, 'کارت ملی', 'JPG', 30),
      file(8, 'شناسنامه', 'PDF', 30),
      file(9, 'لیست دانشگاه‌های پیشنهادی', 'PDF', 10, 'team'),
      file(10, 'لیست اساتید', 'PDF', 7, 'team'),
    ],
    writing: [
      {
        type: 'sop',
        step: 'form',
        delivered_at: null,
        file_url: null,
        draft_waiting: false,
        due_at: null,
      },
      {
        type: 'cv',
        step: 'form',
        delivered_at: null,
        file_url: null,
        draft_waiting: false,
        due_at: null,
      },
      {
        type: 'recommendation',
        step: 'form',
        delivered_at: null,
        file_url: null,
        draft_waiting: false,
        due_at: null,
      },
      {
        type: 'pl',
        step: 'form',
        delivered_at: null,
        file_url: null,
        draft_waiting: false,
        due_at: null,
      },
    ],
    interests: ['Machine Learning', 'Computer Vision', 'Graph Neural Networks', 'Explainable AI'],
  };
}

/**
 * Sara's writing orders: SOP, CV, two recommendation letters, a personal and a diversity statement,
 * a professor list (in Django's order).
 */
const ORDERS = ['sop', 'cv', 'recommendation', 'ps', 'ds', 'pl'];

/** One recommender almost done (the qualities left), none for the second letter yet. */
function saraRecommendation(): WritingForm {
  return {
    is_final: false,
    final_at: null,
    updated_at: hoursAgo(5),
    contact_phone: '09120000000',
    orders: ORDERS,
    count: 2,
    answers: {
      recommenders: [
        {
          id: 1,
          kind: 'academic',
          full_name: 'علی صادقی',
          name_en: 'Ali Sadeghi',
          position: 'دانشیار دانشکده‌ی کامپیوتر',
          organization: 'دانشگاه صنعتی اصفهان',
          email: 'a.sadeghi@iut.ac.ir',
          relationship: 'استاد راهنمای پروژه‌ی پایانی؛ دو سال',
          courses: 'بینایی ماشین (۱۹٫۵)، هوش مصنوعی (۱۸)',
          work: 'پروژه‌ی پایانی: تشخیص پلاک با یادگیری عمیق؛ مقاله‌ی کنفرانس با همکاری او.',
          qualities: null,
          delivery: 'self_upload',
        },
      ],
    },
  };
}

/** The professor list form started: the target section, no professors of her own yet. */
function saraPl(): WritingForm {
  return {
    is_final: false,
    final_at: null,
    updated_at: hoursAgo(30),
    contact_phone: '09120000000',
    orders: ORDERS,
    // Every answer comes back, unanswered ones as null (research interests: the documents page's).
    answers: {
      degree: 'research_master',
      field: 'مهندسی کامپیوتر، هوش مصنوعی',
      start_term: null,
      funding: null,
      exclusions: null,
      countries: ['ca', 'de'],
      known_professors: [],
    },
  };
}

/** The personal and diversity statement forms, not opened yet: Django answers every question. */
function saraStatement(answers: Answers): WritingForm {
  return {
    is_final: false,
    final_at: null,
    updated_at: null,
    contact_phone: '09120000000',
    orders: ORDERS,
    answers,
  };
}
const saraPs = () =>
  saraStatement({
    personal_mentality: null,
    descriptive_character: null,
    educational_problems: null,
  });
// `is_minority` is a boolean column with a default: false until answered.
const saraDs = () =>
  saraStatement({
    interaction_experience: null,
    discrimination_experience: null,
    is_minority: false,
    diversity_of_religious_beliefs: null,
  });

function saraSop(): WritingForm {
  return {
    is_final: false,
    final_at: null,
    updated_at: hoursAgo(26),
    contact_phone: '09120000000',
    orders: ORDERS,
    answers: {
      grade: 1,
      field_of_study: 'مهندسی کامپیوتر',
      university_1: 'صنعتی اصفهان',
      Rate_1: '۱۷٫۲۵',
      field_of_study_for_apply: "Master's · Computer Science",
      university_for_apply: 'University of Toronto',
      city_for_apply: 'کانادا',
      general_sop: false,
      reason:
        'از ترم دوم با درس برنامه‌نویسی پیشرفته علاقه‌مند شدم. پروژه‌ی پایان ترم یک سیستم تشخیص پلاک بود که برای اولین بار نشان داد یادگیری ماشین چطور مسئله‌های واقعی را حل می‌کند.',
      interest:
        'درس‌های هوش مصنوعی (۱۹)، ساختمان داده (۱۸٫۵) و آمار و احتمال (۱۸). به Python و PyTorch مسلط هستم.',
    },
  };
}

/** The CV half filled in: personal details, one degree and one test; no photo yet. */
function saraCv(): WritingForm {
  return {
    is_final: false,
    final_at: null,
    updated_at: hoursAgo(3),
    contact_phone: '09120000000',
    orders: ORDERS,
    answers: {
      template: 'na',
      name: 'Sara Ahmadi',
      sex: 2,
      date_of_birth: '1999-04-12',
      phone_number: '+989120000000',
      email: 'sara.ahmadi@scorize.local',
      city: 'Isfahan, Iran',
      pass_photo: null,
      educations: [
        {
          id: 1,
          level: 3,
          name: 'Isfahan University of Technology',
          study_field: 'Computer Engineering',
          gpa: '17.25',
          start_date: '2017-09',
          end_date: '2021-07',
          city: 'Isfahan',
          thesis_title: 'License plate recognition with deep learning',
          thesis_supervisor: 'Dr. Karimi',
        },
      ],
      english_tests: [
        {
          id: 1,
          title: 'IELTS Academic',
          score: '6.5',
          date_of_receipt: '2026-09',
          description: 'L 7, R 7, W 6.5, S 6',
        },
      ],
      scientific_skills: 'Python, PyTorch, C++, Git, LaTeX',
    },
  };
}

const SPECS: Record<FormType, FormSpec> = {
  sop: sopForm,
  cv: cvForm,
  recommendation: recommendationForm,
  ps: psForm,
  ds: dsForm,
  pl: plForm,
};

/**
 * Answers Django would refuse: names the form doesn't have, text longer than its column, or a
 * list that isn't a list of entries. Read-only parts (photo, research interests) can't be sent.
 */
function invalidAnswers(spec: FormSpec, answers: Answers) {
  const parts = new Map(
    spec.sections.flatMap((section) => section.parts).map((part) => [part.name, part]),
  );
  return Object.entries(answers).filter(([name, value]) => {
    const part = parts.get(name);
    if (!part || part.kind === 'photo' || part.kind === 'interests') return true;
    if (part.kind === 'list') {
      if (!Array.isArray(value)) return true;
      return value.some((item) => {
        if (typeof item !== 'object') return true;
        return Object.entries(item).some(([field, entry]) => {
          if (field === 'id') return false;
          const spec = part.fields.find((candidate) => candidate.name === field);
          return (
            !spec || (typeof entry === 'string' && entry.length > (spec.maxLength ?? Infinity))
          );
        });
      });
    }
    return (
      isField(part) && typeof value === 'string' && value.length > (part.maxLength ?? Infinity)
    );
  });
}

/** List entries get ids once stored, like Django's related rows. */
let nextEntryId = 1000;
function storeLists(answers: Answers) {
  for (const value of Object.values(answers))
    if (Array.isArray(value))
      for (const item of value)
        if (typeof item === 'object' && item.id === undefined) item.id = nextEntryId++;
  return answers;
}

/** Required documents that get a task on the home page: due this soon. */
const UPLOAD_TODO_DAYS = 14;

/** What the applicant sees for one application on the home page (server-side mapping). */
function summary(item: Application): ApplicationSummary {
  const status: ApplicationSummary['status'] =
    item.approval === 'pending'
      ? 'awaiting_approval'
      : item.approval === 'rejected' || item.result === 'rejected'
        ? 'rejected'
        : item.result === 'accepted'
          ? 'accepted'
          : item.result === 'submitted'
            ? 'submitted'
            : item.result === 'completed'
              ? 'ready'
              : 'in_progress';
  return {
    id: item.id,
    university: item.university,
    degree: item.degree,
    program: item.program,
    deadline: item.deadline,
    status,
    fee: item.fee,
    fee_paid: item.payment === 'paid' || item.payment === 'waived',
  };
}

interface SaraState {
  applications: Application[];
  documents: Omit<DocumentsData, 'progress'>;
  writing: Record<FormType, WritingForm>;
  /** Uploaded file id → the required document it answers (asked for again if deleted). */
  answers: Map<number, RequiredDocument>;
  visa: VisaResult[];
  professors: ProfessorEmail[];
  /** One conversation per department (SupervisorTicket rows; SopResumeTicket rows per order). */
  threads: MockThread[];
  contract: ContractData;
  /** Invoices: the contract's instalments and purchases from "other services". */
  payments: PaymentData[];
  /** The one open campaign (PAY10). */
  campaign: CampaignData;
}

function saraState(): SaraState {
  return {
    applications: saraApplications(),
    documents: saraDocuments(),
    writing: {
      sop: saraSop(),
      cv: saraCv(),
      recommendation: saraRecommendation(),
      ps: saraPs(),
      ds: saraDs(),
      pl: saraPl(),
    },
    answers: new Map(),
    visa: saraVisa(),
    professors: saraProfessorEmails(),
    threads: saraThreads(),
    contract: saraContract(),
    payments: saraPayments(),
    campaign: saraCampaign(),
  };
}

function saraCampaign(): CampaignData {
  return {
    id: 4,
    slug: 'apply-week',
    title: 'هفته‌ی اپلای',
    description: 'یک هفته همراهی کارشناس برای انتخاب دانشگاه و آماده کردن مدارک.',
    price: 490_000,
    old_price: 690_000,
    form_stage: 'after',
    wizard: 'basic',
    seats_left: 12,
    form_complete: false,
    registration: null,
  };
}

// region Contract and payments (H22–H27)

const SARA_FILE = 1240;
const SELLER = 'نیلوفر شریفی';
/** Placeholders until the team gives the real account (docs/backend-changes.md, content). */
const BANK = {
  card: 'XXXX XXXX XXXX XXXX',
  iban: 'IR00 0000 0000 0000 0000 0000 00',
  holder: 'شرکت اسکورایز',
};

function saraContract(): ContractData {
  return {
    number: SARA_FILE,
    holder: 'سارا احمدی',
    kind: 'standard',
    status: 'active',
    features: ['admission', 'writing', 'visa'],
    countries: ['کانادا', 'آلمان'],
    degrees: [2],
    applies_total: 15,
    total_amount: 180_000_000,
    currency: 'IRT',
    start_date: daysFromNow(-241),
    end_date: daysFromNow(124),
    pledge_signed_at: null,
    installments: [
      {
        id: 1,
        number: 0,
        amount: 60_000_000,
        currency: 'IRT',
        status: 'paid',
        due_date: null,
        condition: 'پیش‌پرداخت',
        note: null,
        paid_at: daysFromNow(-241),
        payment_id: 505,
      },
      {
        id: 2,
        number: 1,
        amount: 30_000_000,
        currency: 'IRT',
        status: 'paid',
        due_date: daysFromNow(-150),
        condition: null,
        note: null,
        paid_at: daysFromNow(-151),
        payment_id: 506,
      },
      {
        id: 3,
        number: 2,
        amount: 45_000_000,
        currency: 'IRT',
        status: 'due',
        due_date: null,
        condition: 'بعد از پذیرش',
        note: 'پذیرش TU Munich ثبت شد',
        paid_at: null,
        payment_id: 501,
      },
      {
        id: 4,
        number: 3,
        amount: 45_000_000,
        currency: 'IRT',
        status: 'upcoming',
        due_date: null,
        condition: 'بعد از دریافت ویزا',
        note: null,
        paid_at: null,
        payment_id: null,
      },
    ],
    profile: {
      file_id: String(SARA_FILE),
      name: 'سارا احمدی',
      email: 'sara.ahmadi@scorize.local',
      phone: '09120000000',
      national_id: '1270000000',
      birth_date: '1998-04-12',
      passport_name: 'Sara Ahmadi',
      postal_code: null,
      home_phone: '03132000000',
      address_en: 'No. 12, Bahar St., Isfahan',
      relative_name: 'مریم احمدی',
      relative_phone: '09130000000',
      relative_email: null,
    },
    editable: [
      'phone',
      'national_id',
      'passport_name',
      'postal_code',
      'home_phone',
      'address_en',
      'relative_name',
      'relative_phone',
      'relative_email',
    ],
    files: [
      { id: 1, kind: 'contract', url: '#', ext: 'PDF', date: daysFromNow(-241) },
      { id: 2, kind: 'customer_form', url: '#', ext: 'PDF', date: daysFromNow(-241) },
      { id: 3, kind: 'terms', url: '#', ext: 'HTML', date: daysFromNow(-241) },
    ],
    consultant: SELLER,
  };
}

let lastItem = 9000;

/** One invoice item at its list price; `extra` gives its discounts. */
const item = (label: string, price: number, extra: Partial<PaymentItem> = {}): PaymentItem => ({
  id: (lastItem += 1),
  removable: false,
  label,
  note: null,
  kind: 'other',
  href: null,
  price,
  discounted_price: null,
  code_discount: 0,
  credit: 0,
  tax: 0,
  amount: price,
  ...extra,
});

const invoice = (id: number, extra: Partial<PaymentData>): PaymentData => {
  const items = extra.items ?? [];
  const total = items.reduce((sum, row) => sum + row.amount + row.credit, 0);
  return {
    id,
    status: 'unpaid',
    method: null,
    installment: null,
    items,
    total,
    original: items.reduce((sum, row) => sum + row.price, 0),
    admin_discount: items.reduce(
      (sum, row) => sum + row.price - (row.discounted_price ?? row.price),
      0,
    ),
    code: null,
    tax: 0,
    credit_used: 0,
    adjustment: 0,
    amount: total,
    currency: 'IRT',
    created_at: hoursAgo(26),
    expires_at: null,
    paid_at: null,
    ref_id: null,
    seller: SELLER,
    receipt: null,
    decline_reason: null,
    bank: BANK,
    editable: false,
    wallet: null,
    use_credit: false,
    reward: 0,
    renew: null,
    activities: [],
    token: `TOKEN${String(id)}`,
    ...extra,
  };
};

/** Django writes item labels in the user's language; the fake writes Persian. */
const fa = (value: number) => value.toLocaleString('fa-IR', { useGrouping: false });

const instalmentInvoice = (
  id: number,
  number: number,
  amount: number,
  extra: Partial<PaymentData> = {},
) =>
  invoice(id, {
    installment: number,
    items: [
      item(
        number === 0
          ? `پیش‌پرداخت قرارداد ${fa(SARA_FILE)}`
          : `قسط ${fa(number)} قرارداد ${fa(SARA_FILE)}`,
        amount,
        { kind: 'instalment', href: '/contract' },
      ),
    ],
    seller: null,
    ...extra,
  });

/** Sara's wallet credit, for the purchase page's switch. */
const SARA_WALLET = 50_000;

/** Two services bought together: a session (with the admin's discount) and a writing order. */
const services = () => [
  item('رزرو مشاوره', 900_000, {
    kind: 'consultation',
    note: daysFromNow(2),
    href: '/consultations/31',
    discounted_price: 800_000,
    amount: 800_000,
  }),
  item('سفارش نگارش', 405_000, { kind: 'writing', href: '/writing/sop' }),
];

/** The person's own purchase, before the bank: the code and the credit can change. */
const ownPurchase = (extra: Partial<PaymentData> = {}) => ({
  seller: null,
  editable: true,
  wallet: SARA_WALLET,
  expires_at: new Date(Date.now() + 18 * 60_000).toISOString(),
  created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  reward: 24_000,
  ...extra,
});

/**
 * 501: the due instalment. 502–504, 507–510: a services purchase in each other state, to see every
 * design state with `pnpm dev:mock` (/payments/502 to buy, 503 receipt in review, 504 receipt
 * declined, 507 expired, 508 failed, 509 being checked, 510 paid).
 */
function saraPayments(): PaymentData[] {
  return [
    instalmentInvoice(501, 2, 45_000_000),
    invoice(502, { items: services(), ...ownPurchase() }),
    invoice(503, {
      status: 'review',
      method: 'receipt',
      items: services(),
      receipt: { url: '#', uploaded_at: hoursAgo(3) },
    }),
    invoice(504, {
      status: 'declined',
      method: 'receipt',
      items: services(),
      receipt: { url: '#', uploaded_at: hoursAgo(30) },
      decline_reason: 'مبلغ رسید با فاکتور یکی نبود.',
    }),
    instalmentInvoice(505, 0, 60_000_000, {
      status: 'paid',
      method: 'online',
      paid_at: daysFromNow(-241),
      ref_id: '738201945',
    }),
    instalmentInvoice(506, 1, 30_000_000, {
      status: 'paid',
      method: 'receipt',
      paid_at: daysFromNow(-151),
    }),
    invoice(507, { status: 'expired', items: services(), seller: null, renew: 'self' }),
    invoice(508, {
      status: 'failed',
      method: 'online',
      items: services(),
      seller: null,
      renew: 'self',
    }),
    invoice(509, { status: 'checking', method: 'online', items: services(), seller: null }),
    invoice(510, {
      status: 'paid',
      method: 'online',
      items: services(),
      seller: null,
      paid_at: hoursAgo(1),
      ref_id: '512907733',
      reward: 24_000,
    }),
  ];
}

/** The fake's discount codes: 10% off everything, and one past its date. */
const CODES: Record<string, DiscountResult> = { SCORIZE10: 'ok', OLD: 'expired' };

/** Prices an editable invoice again after its code or credit changed (Django: `reprice_payment`). */
function reprice(payment: PaymentData, code: string | null, useCredit: boolean) {
  const items = payment.items.map((row) => {
    const base = row.discounted_price ?? row.price;
    return { ...row, code_discount: code ? Math.round(base / 10) : 0, credit: 0 };
  });
  let credit = useCredit
    ? Math.min(
        SARA_WALLET,
        items.reduce((sum, row) => sum + itemCost(row), 0),
      )
    : 0;
  const creditUsed = credit;
  for (const row of items) {
    const take = Math.min(credit, itemCost(row));
    row.credit = take;
    row.amount = itemCost(row) - take;
    credit -= take;
  }
  const amount = items.reduce((sum, row) => sum + row.amount, 0);
  Object.assign(payment, {
    items,
    code: code ? { code, discount: items.reduce((sum, row) => sum + row.code_discount, 0) } : null,
    use_credit: useCredit,
    credit_used: creditUsed,
    total: amount + creditUsed,
    amount,
  });
  // Credit that covers it all pays it at once.
  if (amount === 0)
    Object.assign(payment, { status: 'paid', method: null, paid_at: new Date().toISOString() });
}

const itemCost = (row: PaymentItem) => (row.discounted_price ?? row.price) - row.code_discount;

/** What Django sends for an invoice: each item of a cart can come out while there are several. */
const served = (payment: PaymentData): PaymentData => ({
  ...payment,
  items: payment.items.map((row) => ({
    ...row,
    removable: payment.editable && payment.status === 'unpaid' && payment.items.length > 1,
  })),
});

/** Sara's open cart: her own unpaid invoice before the bank, still in time. */
const openCart = (state: SaraState) =>
  state.payments.find(
    (row) =>
      row.editable &&
      row.status === 'unpaid' &&
      row.expires_at !== null &&
      new Date(row.expires_at).getTime() > Date.now(),
  );

/** PAY7: what the open payments list shows of one invoice. */
const openRow = (payment: PaymentData): OpenPayment => ({
  id: payment.id,
  status: payment.status,
  labels: payment.items.map((row) => row.label),
  installment: payment.installment !== null,
  amount: payment.amount,
  currency: payment.currency,
  created_at: payment.created_at,
  expires_at: payment.expires_at,
  due_date: payment.installment !== null ? daysFromNow(3).slice(0, 10) : null,
  seller: payment.seller,
});

/** Same checks as the panel's form; Django validates again with its own messages. */
const PROFILE_CHECKS: Partial<Record<ProfileField, RegExp>> = {
  phone: /^09\d{9}$/,
  relative_phone: /^09\d{9}$/,
  national_id: /^\d{10}$/,
  postal_code: /^\d{10}$/,
  home_phone: /^0\d{10}$/,
  relative_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

/** The instalment an invoice settles. */
const installmentOf = (state: SaraState, payment: PaymentData) =>
  state.contract.installments.find((item) => item.payment_id === payment.id);

// endregion

// region Tickets (H17–H21)

interface MockThread extends Omit<TicketThread, 'unread'> {
  messages: TicketMessage[];
}

/** Small on purpose, so "show earlier messages" appears with the sample data (Django: 20). */
const TICKET_PAGE = 5;

/** `days` ago (0 = today) at a clock time, so the conversation falls on known days. */
const at = (days: number, hour: number, minute: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const SARA_NAME = 'سارا احمدی';

function ticket(
  id: number,
  from: { name: string; role: TicketMessage['role'] } | 'me',
  sent_at: string,
  text: string,
  extra: Partial<TicketMessage> = {},
): TicketMessage {
  const mine = from === 'me';
  return {
    id,
    mine,
    author: mine ? SARA_NAME : from.name,
    role: mine ? null : from.role,
    sent_at,
    text,
    priority: 1,
    attachment: null,
    seen: true,
    rating: null,
    auto: false,
    ...extra,
  };
}

const MARYAM = { name: 'مریم کاظمی', role: 'supervisor' as const };
const HOSSEIN = { name: 'حسین رحیمی', role: 'supervisor' as const };
const ELHAM = { name: 'الهام رضوی', role: 'writer' as const };
const file = (name: string) => ({ name, url: '#' });

function saraThreads(): MockThread[] {
  return [
    {
      id: 'supervisor',
      department: 'supervisor',
      writing: null,
      team: [MARYAM, HOSSEIN],
      messages: [
        ticket(1, 'me', at(12, 11, 0), 'سلام. فرم اطلاعات انگیزه‌نامه را از کجا پر کنم؟'),
        ticket(
          2,
          MARYAM,
          at(12, 13, 20),
          'سلام سارا، از صفحه‌ی «مدارک و نگارش»، کارت انگیزه‌نامه. پیش‌نویس خودکار ذخیره می‌شود.',
          { rating: 4 },
        ),
        ticket(
          3,
          'me',
          at(3, 10, 12),
          'سلام. توصیه‌نامه‌ی دوم را از دکتر احمدی گرفتم. همین را آپلود کنم یا باید روی سربرگ باشد؟',
        ),
        ticket(
          4,
          MARYAM,
          at(3, 10, 12),
          'سلام، تا ساعت ۱۴ در جلسه هستم و بعد از آن پاسخ می‌دهم. برای موارد فوری، اولویت «خیلی ضروری» را انتخاب کنید.',
          { auto: true },
        ),
        ticket(
          5,
          MARYAM,
          at(3, 14, 30),
          'حتماً روی سربرگ دانشگاه و با امضا باشد. نمونه‌ی درست را پیوست کردم.',
          { attachment: file('recommendation-sample.pdf'), rating: 5 },
        ),
        ticket(
          6,
          'me',
          minutesAgo(40),
          'نمره‌ی آیلتس من ۶.۵ شد. کارنامه را پیوست کردم. برای تورنتو کافی است؟',
          { attachment: file('IELTS-result.pdf') },
        ),
        ticket(
          7,
          HOSSEIN,
          minutesAgo(20),
          'بله، برای تورنتو کافی است. برای McGill هم نمره‌ی Writing باید حداقل ۶.۵ باشد که هست. کارنامه را در پرونده ثبت کردم.',
          { seen: false },
        ),
      ],
    },
    // One thread per writing order of the contract. No writer on the SOP, letters or list yet.
    { id: 'writing/sop', department: 'writing', writing: 'sop', team: [], messages: [] },
    {
      id: 'writing/recommendation',
      department: 'writing',
      writing: 'recommendation',
      team: [],
      messages: [],
    },
    { id: 'writing/pl', department: 'writing', writing: 'pl', team: [], messages: [] },
    {
      id: 'writing/cv',
      department: 'writing',
      writing: 'cv',
      team: [ELHAM],
      messages: [
        ticket(
          101,
          ELHAM,
          at(4, 11, 5),
          'نسخه‌ی اول رزومه آماده شد و در بخش مدارک قرار گرفت. اگر ایرادی هست، موارد را مکتوب بنویسید.',
          { attachment: file('Sara-Ahmadi-CV-v1.pdf'), rating: 4 },
        ),
        ticket(
          102,
          'me',
          at(4, 18, 40),
          'در بخش مقاله‌ها، تاریخ انتشار مقاله‌ی دوم باید 2024 باشد. ایمیل دکتر احمدی هم اشتباه درج شده است.',
        ),
        ticket(103, ELHAM, minutesAgo(90), 'هر دو مورد اصلاح شد. نسخه‌ی نهایی برایتان آپلود شد.', {
          attachment: file('Sara-Ahmadi-CV-final.pdf'),
          seen: false,
        }),
      ],
    },
  ];
}

/** Placeholders: the real questions and answers come from the team (FAQ rows in Django). */
const FAQS: Faq[] = [
  {
    id: 1,
    department: 'supervisor',
    question: 'تا الان چند ایمیل برای استادها فرستاده شده؟',
    answer:
      'تعداد ایمیل‌ها و پاسخ استادها را در صفحه‌ی «اپلای‌ها و نتایج»، بخش ایمیل به استادها ببینید.',
  },
  {
    id: 2,
    department: 'supervisor',
    question: 'چه زمانی نتیجه‌ی اپلای مشخص می‌شود؟',
    answer: '[پاسخ: از تیم پشتیبانی]',
  },
  {
    id: 3,
    department: 'supervisor',
    question: 'اپلیکیشن فی را چطور پرداخت کنم؟',
    answer: '[پاسخ: از تیم پشتیبانی]',
  },
  {
    id: 4,
    department: 'supervisor',
    question: 'چطور مدرکی را که اشتباه آپلود کرده‌ام عوض کنم؟',
    answer: '[پاسخ: از تیم پشتیبانی]',
  },
  {
    id: 5,
    department: 'supervisor',
    question: 'پاسخ تیکت‌ها چقدر طول می‌کشد؟',
    answer: '[پاسخ: از تیم پشتیبانی]',
  },
  {
    id: 6,
    department: 'writing',
    question: 'تا چه مدت بعد از تحویل می‌توانم اصلاح بخواهم؟',
    answer: '[پاسخ: از تیم نگارش]',
  },
  {
    id: 7,
    department: 'writing',
    question: 'نسخه‌ی نهایی را از کجا دانلود کنم؟',
    answer: '[پاسخ: از تیم نگارش]',
  },
];

const unreadOf = (thread: MockThread) =>
  thread.messages.filter((message) => !message.mine && !message.seen).length;

const isPriority = (value: number): value is Priority => [0, 1, 2, 3].includes(value);

/** `:type` present → a writing thread, else the supervisors'. */
const threadIdOf = (params: Record<string, string | readonly string[] | undefined>) =>
  typeof params.type === 'string' ? `writing/${params.type}` : 'supervisor';

function threadOrError(params: Record<string, string | readonly string[] | undefined>) {
  const state = caseOrError();
  if (failed(state)) return state;
  return state.threads.find((thread) => thread.id === threadIdOf(params)) ?? notFound();
}

const THREADS = [`${BASE}/tickets/supervisor`, `${BASE}/tickets/writing/:type`];

const ticketHandlers = [
  http.get(`${BASE}/tickets/`, () => {
    const state = caseOrError();
    if (failed(state)) return state;
    const body: TicketsOverview = {
      threads: state.threads.map((thread) => {
        const { messages: _messages, ...rest } = thread;
        return { ...rest, unread: unreadOf(thread) };
      }),
      faqs: FAQS,
    };
    return HttpResponse.json(body);
  }),

  ...THREADS.flatMap((path) => [
    // Newest page first; `before` = the oldest message id already shown.
    http.get(`${path}/messages/`, ({ params, request }) => {
      const thread = threadOrError(params);
      if (thread instanceof Response) return thread;
      const before = Number(new URL(request.url).searchParams.get('before')) || Infinity;
      const older = thread.messages.filter((message) => message.id < before);
      const body: MessagePage = {
        messages: older.slice(-TICKET_PAGE),
        has_more: older.length > TICKET_PAGE,
      };
      return HttpResponse.json(body);
    }),

    http.post(`${path}/messages/`, async ({ params, request }) => {
      const thread = threadOrError(params);
      if (thread instanceof Response) return thread;
      const form = await request.formData();
      const text = form.get('message');
      const priority = Number(form.get('priority') ?? 1);
      const attachment = form.get('attachment');
      if (typeof text !== 'string' || !text.trim())
        return HttpResponse.json({ message: ['required'] }, { status: 400 });
      if (!isPriority(priority))
        return HttpResponse.json({ priority: ['invalid'] }, { status: 400 });
      if (attachment instanceof File && attachment.size > 10 * 1024 * 1024)
        return HttpResponse.json({ attachment: ['too_big'] }, { status: 400 });
      const ids = thread.messages.map((message) => message.id);
      const message = ticket(
        Math.max(thread.id === 'supervisor' ? 0 : 100, ...ids) + 1,
        'me',
        new Date().toISOString(),
        text.trim(),
        {
          priority,
          seen: false,
          attachment: attachment instanceof File ? file(attachment.name) : null,
        },
      );
      // Writing back means the sender read the thread.
      thread.messages.forEach((item) => {
        if (!item.mine) item.seen = true;
      });
      thread.messages.push(message);
      return HttpResponse.json(message, { status: 201 });
    }),

    http.post(`${path}/seen/`, ({ params }) => {
      const thread = threadOrError(params);
      if (thread instanceof Response) return thread;
      thread.messages.forEach((message) => {
        if (!message.mine) message.seen = true;
      });
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(`${path}/messages/:id/rating/`, async ({ params, request }) => {
      const thread = threadOrError(params);
      if (thread instanceof Response) return thread;
      const message = thread.messages.find((item) => item.id === Number(params.id));
      if (!message || message.mine || message.auto) return notFound();
      const { score } = (await request.json()) as { score: number };
      if (!(score >= 1 && score <= 5))
        return HttpResponse.json({ score: ['invalid'] }, { status: 400 });
      message.rating = score;
      return new HttpResponse(null, { status: 204 });
    }),
  ]),
];

// endregion

const WRITING_STEP = { form: 1, writing: 2, ready: 3 } as const;

/** Uploaded own files count as delivered required documents. */
const progressOf = (state: SaraState) => {
  const uploaded = state.documents.files.filter((item) => item.source === 'me').length;
  return { uploaded, required: uploaded + state.documents.required.length };
};

function overviewOf(state: SaraState): ApplicantOverview {
  const now = Date.now();
  const upcoming = state.applications
    .map(summary)
    .filter(
      (item) =>
        item.deadline !== null &&
        new Date(item.deadline).getTime() > now &&
        item.status !== 'rejected' &&
        item.status !== 'accepted',
    )
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
  return {
    file: {
      applicant_id: 1240,
      features: ['admission', 'writing', 'visa'],
      countries: ['کانادا', 'آلمان'],
      degrees: [2],
      applies_used: state.applications.length,
      applies_total: 15,
      start_date: daysFromNow(-241),
      end_date: daysFromNow(124),
      stage: 'apply',
    },
    stats: {
      submitted: state.applications.length,
      accepted: state.applications.filter((item) => item.result === 'accepted').length,
    },
    todos: [
      ...state.applications
        .filter((item) => item.approval === 'pending')
        .map((item) => ({
          kind: 'approve' as const,
          id: `approve-${String(item.id)}`,
          application: summary(item),
        })),
      ...state.documents.required
        .filter(
          (item) =>
            item.deadline !== null &&
            new Date(item.deadline).getTime() - now < UPLOAD_TODO_DAYS * 86_400_000,
        )
        .map((item) => ({
          kind: 'upload' as const,
          id: `upload-${String(item.id)}`,
          document: item.name,
          due_date: item.deadline,
        })),
      ...(state.documents.writing ?? [])
        .filter((item) => item.step === 'form')
        .map((item) => ({ kind: 'form' as const, id: `form-${item.type}`, writing: item.type })),
    ],
    ticket: (() => {
      const supervisor = state.threads.find((thread) => thread.id === 'supervisor');
      return supervisor
        ? { unread: unreadOf(supervisor), messages: supervisor.messages.slice(-2) }
        : null;
    })(),
    deadlines: upcoming.slice(0, 4),
    // The first instalment still to pay, from the same contract the contract page shows.
    installment: (() => {
      const all = state.contract.installments;
      const next = all.find((item) => item.status !== 'paid');
      if (!next) return null;
      return {
        number: next.number,
        count: all.length,
        paid_count: all.filter((item) => item.status === 'paid').length,
        amount: next.amount,
        currency: next.currency,
        is_due: next.status === 'due',
        condition:
          [next.condition, next.note && `(${next.note})`].filter(Boolean).join(' ') || null,
        payment_id: next.status === 'due' ? next.payment_id : null,
      };
    })(),
    documents: {
      ...progressOf(state),
      next_due:
        state.documents.required
          .map((item) => item.deadline)
          .filter((deadline) => deadline !== null)
          .sort()[0] ?? null,
    },
    writing: (state.documents.writing ?? []).map((item) => ({
      type: item.type,
      step: WRITING_STEP[item.step],
    })),
    team: [
      { name: 'مریم کاظمی', role: 'supervisor' },
      { name: 'حسین رحیمی', role: 'supervisor' },
      { name: 'نیلوفر شریفی', role: 'consultant' },
    ],
  };
}

let sara: SaraState | null = null;

/** The logged-in user's case, or a 403/404 response. Rebuilt per login so dates stay current. */
function caseOrError(): SaraState | Response {
  const user = storage.get();
  if (!user) return forbidden();
  if (user !== SARA) return notFound();
  sara ??= saraState();
  return sara;
}

const failed = (value: SaraState | Response): value is Response => value instanceof Response;

/**
 * Dev knob for the locked previews (canvas V7): `localStorage['scorize.mock.access']` set to
 * `pending`, `ended` or `guest` changes the logged-in user's state (`guest`: Sara's booked sessions
 * on the new-user home); `noservice` keeps Sara active without
 * admission services. Without it Sara is active and everyone else a guest.
 */
export const MOCK_ACCESS_KEY = 'scorize.mock.access';

function accessOf(user: number): ApplicantAccess {
  const knob = globalThis.localStorage.getItem(MOCK_ACCESS_KEY);
  const sara = user === SARA;
  const features: ApplicantAccess['features'] =
    knob === 'noservice' ? ['writing', 'visa'] : ['admission', 'writing', 'visa'];
  const state: AccessState =
    knob === 'pending' || knob === 'ended' || knob === 'guest' ? knob : sara ? 'active' : 'guest';
  // A registered contract (in review) already has its services and countries.
  const contract = state !== 'guest';
  return {
    state,
    features: !contract ? [] : state === 'pending' ? ['admission', 'writing'] : features,
    countries: contract ? ['کانادا', 'آلمان'] : [],
    phone: sara ? '09120000000' : null,
    turkey: (() => {
      const step = turkeyCases.get(user)?.step;
      return step === 'docs' || step === 'review' || step === 'sign' ? step : null;
    })(),
    // A case waiting to start: its prepayment (an invoice of the payment page's mock).
    prepayment:
      state === 'pending' ? { payment_id: 502, amount: 1_200_000, status: 'unpaid' } : null,
  };
}

// region Free Turkey application (H30–H35)

/** The code the fake "texts" for the pledge. */
export const MOCK_PLEDGE_CODE = '12345';

/** Each user's Turkey request (any account may start one). */
const turkeyCases = new Map<number, TurkeyCase>();

const TURKEY_DOCS: Record<TurkeyAnswers['degree'], [string, string, boolean][]> = {
  1: [
    ['پاسپورت', 'PDF یا عکس واضح صفحه‌ی اول', true],
    ['دیپلم و پیش‌دانشگاهی (ترجمه‌ی رسمی)', 'PDF', true],
    ['ریز نمرات دبیرستان (ترجمه‌ی رسمی)', 'PDF، همه‌ی صفحه‌ها در یک فایل', true],
    ['عکس پرسنلی', 'JPG یا PNG، زمینه‌ی روشن', true],
    ['مدرک زبان (اگر دارید)', 'IELTS، TOEFL، Duolingo', false],
  ],
  2: [
    ['پاسپورت', 'PDF یا عکس واضح صفحه‌ی اول', true],
    ['دانشنامه‌ی کارشناسی (ترجمه‌ی رسمی)', 'PDF', true],
    ['ریز نمرات کارشناسی (ترجمه‌ی رسمی)', 'PDF، همه‌ی صفحه‌ها در یک فایل', true],
    ['عکس پرسنلی', 'JPG یا PNG، زمینه‌ی روشن', true],
    ['مدرک زبان (اگر دارید)', 'IELTS، TOEFL، Duolingo', false],
  ],
  3: [
    ['پاسپورت', 'PDF یا عکس واضح صفحه‌ی اول', true],
    ['دانشنامه‌ی کارشناسی ارشد (ترجمه‌ی رسمی)', 'PDF', true],
    ['ریز نمرات کارشناسی ارشد (ترجمه‌ی رسمی)', 'PDF، همه‌ی صفحه‌ها در یک فایل', true],
    ['رزومه', 'PDF', true],
    ['عکس پرسنلی', 'JPG یا PNG، زمینه‌ی روشن', true],
    ['مدرک زبان (اگر دارید)', 'IELTS، TOEFL، Duolingo', false],
  ],
};

/** Placeholder clauses until the legal team writes the pledge (docs/backend-changes.md C8). */
const PLEDGE = {
  version: '1405-draft',
  clauses: [
    { title: '۱. موضوع قرارداد', text: '[متن بند از تیم حقوقی]' },
    { title: '۲. تعهدات اسکورایز', text: '[متن بند از تیم حقوقی]' },
    { title: '۳. تعهدات متقاضی: ثبت‌نام نهایی از طریق اسکورایز', text: '[متن بند از تیم حقوقی]' },
    { title: '۴. انصراف یا ثبت‌نام مستقیم', text: '[متن بند و پیامد آن از تیم حقوقی]' },
  ],
  code_length: MOCK_PLEDGE_CODE.length,
};

function turkeyOf(user: number): TurkeyCase {
  let found = turkeyCases.get(user);
  if (!found) {
    found = {
      step: 'start',
      answers: null,
      documents: [],
      pledge: null,
      phone: user === SARA ? '0912•••0000' : '0912•••0001',
    };
    turkeyCases.set(user, found);
  }
  return found;
}

/** Whether the fake team has sent the transcript back once (it approves the second upload). */
const transcriptReturned = new Set<number>();

/**
 * The fake team reviews at once: the first transcript is sent back with a note, everything else is
 * approved. Once all required documents are approved, the pledge opens.
 */
function reviewTurkey(user: number, found: TurkeyCase) {
  for (const doc of found.documents) {
    if (doc.status !== 'uploaded') continue;
    if (doc.name.startsWith('ریز نمرات') && !transcriptReturned.has(user)) {
      transcriptReturned.add(user);
      Object.assign(doc, {
        status: 'rejected',
        note: 'صفحه‌ی دوم ریز نمرات در فایل نبود. لطفاً همه‌ی صفحه‌ها را در یک PDF بفرستید.',
      });
    } else Object.assign(doc, { status: 'approved', note: null });
  }
  const done = found.documents.every((doc) => !doc.required || doc.status === 'approved');
  Object.assign(found, done ? { step: 'sign', pledge: PLEDGE } : { step: 'review' });
}

const turkeyHandlers = [
  http.get(`${BASE}/turkey/`, () => {
    const user = storage.get();
    return user ? HttpResponse.json(turkeyOf(user)) : forbidden();
  }),

  http.post(`${BASE}/turkey/start/`, async ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const found = turkeyOf(user);
    if (found.step !== 'start') return HttpResponse.json({ detail: 'Started.' }, { status: 409 });
    const answers = (await request.json()) as TurkeyAnswers;
    if (![1, 2, 3].includes(answers.degree) || !answers.field.trim() || !answers.start_term.trim())
      return HttpResponse.json({ detail: 'Invalid.' }, { status: 400 });
    found.answers = answers;
    found.documents = TURKEY_DOCS[answers.degree].map(
      ([name, hint, required], index): TurkeyDocument => ({
        id: index + 1,
        name,
        hint,
        required,
        status: 'missing',
        file_name: null,
        note: null,
      }),
    );
    found.step = 'docs';
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(`${BASE}/turkey/documents/:id/upload/`, async ({ params, request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const found = turkeyOf(user);
    const doc = found.documents.find((item) => item.id === Number(params.id));
    if (!doc) return notFound();
    if (doc.status === 'review' || doc.status === 'approved')
      return HttpResponse.json({ detail: 'Locked.' }, { status: 409 });
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
      return HttpResponse.json({ file: ['invalid'] }, { status: 400 });
    Object.assign(doc, { status: 'uploaded', file_name: file.name, note: null });
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(`${BASE}/turkey/submit/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    const found = turkeyOf(user);
    if (found.step !== 'docs' && found.step !== 'review')
      return HttpResponse.json({ detail: 'Not now.' }, { status: 409 });
    if (
      found.documents.some(
        (doc) => doc.required && (doc.status === 'missing' || doc.status === 'rejected'),
      )
    )
      return HttpResponse.json({ detail: 'Missing documents.' }, { status: 400 });
    reviewTurkey(user, found);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/turkey/pledge/send-code/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    if (turkeyOf(user).step !== 'sign')
      return HttpResponse.json({ detail: 'Not now.' }, { status: 409 });
    return HttpResponse.json({ resend_in: 120 });
  }),

  http.post(`${BASE}/turkey/pledge/sign/`, async ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const found = turkeyOf(user);
    if (found.step !== 'sign') return HttpResponse.json({ detail: 'Not now.' }, { status: 409 });
    const { code } = (await request.json()) as { code: string; version: string };
    if (code !== MOCK_PLEDGE_CODE) return HttpResponse.json({ code: ['invalid'] }, { status: 400 });
    // Django would create the applicant file and a free `turkey` contract here; the fake only
    // records the step (the rest of the panel keeps showing Sara's or a guest's data).
    Object.assign(found, { step: 'done', pledge: null });
    return new HttpResponse(null, { status: 204 });
  }),
];

// endregion

// region Other services (H36–H38)

/** Reviews written on packages (by package id). */
const packageReviews = new Map<number, { text: string; submitted_at: string }>();

/** Each user's services page (any account). Sara has bought things; others start empty. */
const servicesOf = new Map<number, ServicesData>();

function servicesFor(user: number): ServicesData {
  let found = servicesOf.get(user);
  if (found) return found;
  const sara = user === SARA;
  const at = (days: number, hour: number) => {
    const date = new Date(Date.now() + days * 86_400_000);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  found = {
    credit: sara ? 5_000 : 0,
    webinar: {
      id: 31,
      title: 'اپلای کارشناسی ارشد کانادا ۲۰۲۷',
      starts_at: at(5, 18),
      seats_left: 23,
      price: 0,
      discount_ends_at: new Date(
        Date.now() + (2 * 86_400 + 14 * 3600 + 36 * 60) * 1000,
      ).toISOString(),
      registered: false,
    },
    packages: sara
      ? [
          {
            id: 1,
            tag: 'TOEFL',
            name: 'آمادگی تافل ۱۲۰',
            meta: '۱۸ جلسه‌ی ویدئویی · ادامه از جلسه‌ی ۷',
            url: '#',
          },
          { id: 2, tag: 'WEB', name: 'فیلم وبینار اپلای کانادا', meta: 'خریداری ۱۲ مهر', url: '#' },
        ]
      : [],
    offer: {
      name: 'بسته‌ی آمادگی آیلتس ۷ قدم',
      price: 1_400_000,
      old_price: 2_000_000,
      label: 'پیشنهاد داغ · ۳۰٪ تخفیف تا ۱۰ آبان',
      url: '#',
    },
    consultations: sara
      ? {
          upcoming: [{ id: 41, title: 'مشاوره‌ی تخصصی اپلای دکترا', starts_at: at(19, 17) }],
          total: 4,
        }
      : { upcoming: [], total: 0 },
    events: sara
      ? [
          {
            id: 31,
            title: 'اپلای کارشناسی ارشد کانادا ۲۰۲۷',
            starts_at: at(5, 18),
            online: true,
            status: 'upcoming',
            join_url: '#',
            video_url: null,
            url: '#',
          },
          {
            id: 32,
            title: 'نوشتن SOP بدون اشتباه',
            starts_at: at(-3, 18),
            online: true,
            status: 'held',
            join_url: null,
            video_url: '#',
            url: '#',
          },
          {
            id: 33,
            title: 'بورسیه‌های آلمان',
            starts_at: at(-18, 18),
            online: true,
            status: 'held',
            join_url: null,
            video_url: null,
            url: '#',
          },
        ]
      : [],
    gpa: sara
      ? {
          courses: [
            { name: 'Advanced Programming', credits: 3, grade: 18.5 },
            { name: 'Artificial Intelligence', credits: 3, grade: 19 },
            { name: 'Linear Algebra', credits: 3, grade: 15.25 },
            { name: 'Technical English', credits: 2, grade: 17 },
          ],
          result: 3.5,
        }
      : { courses: [], result: null },
  };
  // Sara already signed up for it (it is in her events).
  if (sara && found.webinar) found.webinar.registered = true;
  servicesOf.set(user, found);
  return found;
}

/** The fake's GPA: the credit-weighted average out of 20, scaled to 4. Django uses its own method. */
/** Django's `compute_gpa`: each grade out of 20 on the 4-point table, weighted by credits. */
/** Wallet credit for a package review (Django's PANEL_REVIEW_CREDIT, set for these tests). */
const REVIEW_CREDIT = 50_000;

const gpaPoints = (grade: number) =>
  grade >= 16 ? 4 : grade >= 14 ? 3 : grade >= 12 ? 2 : grade >= 10 ? 1 : 0;
const gpaOf = (courses: GpaCourse[]) => {
  const credits = courses.reduce((sum, course) => sum + course.credits, 0);
  const points = courses.reduce((sum, course) => sum + course.credits * gpaPoints(course.grade), 0);
  return points ? Math.round((points / credits) * 100) / 100 : 0;
};

/** Each user's booked consultations (Sara: one ahead, three behind). */
const consultationsOf = new Map<number, ConsultationDetail[]>();

function consultationsFor(user: number): ConsultationDetail[] {
  let found = consultationsOf.get(user);
  if (found) return found;
  const at = (days: number, hour: number, minute = 0) => {
    const date = new Date(Date.now() + days * 86_400_000);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const empty = { university: '', major: '', degree: '', notes: '' };
  const session = (
    id: number,
    title: string,
    starts_at: string,
    mode: ConsultationDetail['mode'],
    summary: string,
    amount: number,
    extra: Partial<ConsultationDetail> = {},
  ): ConsultationDetail => ({
    id,
    title,
    starts_at,
    minutes: 45,
    mode,
    consultant: 'نیلوفر شریفی',
    summary,
    info_complete: true,
    feedback: null,
    info: {
      university: 'دانشگاه صنعتی اصفهان',
      major: 'مهندسی کامپیوتر',
      degree: 'کارشناسی',
      notes: 'می‌خواهم بدانم با این رزومه کدام کشور مناسب‌تر است.',
    },
    invoice: { amount, paid_at: amount ? at(-60, 10) : null, payment_id: null },
    ...extra,
  });
  found =
    user === SARA
      ? [
          session(
            41,
            'مشاوره‌ی تخصصی اپلای دکترا',
            at(19, 17),
            'online',
            'بررسی شانس پذیرش و فاند دکترا در کانادا و آمریکا.',
            800_000,
            {
              info_complete: false,
              info: empty,
              invoice: { amount: 800_000, paid_at: at(-2, 11), payment_id: null },
            },
          ),
          session(
            42,
            'مشاوره‌ی اپلای کارشناسی ارشد',
            at(-34, 11),
            'in_person',
            'انتخاب کشور و دانشگاه بر اساس رزومه.',
            600_000,
          ),
          session(
            43,
            'مشاوره‌ی آزمون زبان',
            at(-83, 18, 30),
            'online',
            'برنامه‌ریزی برای آیلتس آکادمیک.',
            400_000,
          ),
          session(
            44,
            'مشاوره‌ی رایگان اولیه',
            at(-101, 10),
            'online',
            'آشنایی با خدمات اسکورایز.',
            0,
          ),
        ]
      : [];
  consultationsOf.set(user, found);
  return found;
}

const summaryOf = ({ info: _info, invoice: _invoice, ...rest }: ConsultationDetail) => rest;

/** A session held `daysAgo` for `user` (tests of the survey after a session). */
export function addHeldConsultation(user: number, daysAgo = 1) {
  const sessions = consultationsFor(user);
  const starts = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  sessions.unshift({
    id: 90 + sessions.length,
    title: 'مشاوره‌ی اپلای کارشناسی ارشد',
    starts_at: starts,
    minutes: 45,
    mode: 'online',
    consultant: 'نیلوفر شریفی',
    summary: null,
    info_complete: true,
    feedback: null,
    info: { university: '', major: '', degree: '', notes: 'انتخاب کشور برای ارشد.' },
    invoice: { amount: 600_000, paid_at: starts, payment_id: null },
  });
}

/** Survey answers sent, for the tests. */
export const feedbackSent: { id: number; answer: unknown }[] = [];

const consultationHandlers = [
  http.post(`${BASE}/consultations/:id/feedback/`, async ({ params, request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const found = consultationsFor(user).find((item) => item.id === Number(params.id));
    if (!found) return notFound();
    if (new Date(found.starts_at).getTime() > Date.now())
      return HttpResponse.json({ detail: 'Not held yet.', code: 'not_held' }, { status: 409 });
    if (found.feedback)
      return HttpResponse.json({ detail: 'Answered.', code: 'answered' }, { status: 409 });
    const answer = (await request.json()) as Omit<
      NonNullable<ConsultationDetail['feedback']>,
      'created_at'
    >;
    if (answer.rating < 1 || answer.rating > 5)
      return HttpResponse.json({ rating: ['invalid'] }, { status: 400 });
    found.feedback = { ...answer, created_at: new Date().toISOString() };
    feedbackSent.push({ id: found.id, answer });
    return HttpResponse.json(found.feedback, { status: 201 });
  }),

  http.get(`${BASE}/consultations/`, () => {
    const user = storage.get();
    return user
      ? HttpResponse.json({ results: consultationsFor(user).map(summaryOf) })
      : forbidden();
  }),

  http.get(`${BASE}/consultations/:id/`, ({ params }) => {
    // Django's `<int:pk>`: `consultations/slots/` is another route.
    if (!/^\d+$/.test(String(params.id))) return undefined;
    const user = storage.get();
    if (!user) return forbidden();
    const found = consultationsFor(user).find((item) => item.id === Number(params.id));
    return found ? HttpResponse.json(found) : notFound();
  }),

  http.put(`${BASE}/consultations/:id/info/`, async ({ params, request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const found = consultationsFor(user).find((item) => item.id === Number(params.id));
    if (!found) return notFound();
    if (new Date(found.starts_at).getTime() <= Date.now())
      return HttpResponse.json({ detail: 'This session has already started.' }, { status: 409 });
    const sent = (await request.json()) as { notes: string };
    // Django: only what the session is about, required. The studies come from the background form.
    if (!sent.notes.trim())
      return HttpResponse.json({ notes: ['This field may not be blank.'] }, { status: 400 });
    const info = { ...found.info, notes: sent.notes };
    Object.assign(found, { info, info_complete: true });
    return HttpResponse.json(info);
  }),
];

const servicesHandlers = [
  http.get(`${BASE}/services/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    // The same sessions the consultations page lists.
    const sessions = consultationsFor(user);
    const now = Date.now();
    return HttpResponse.json({
      ...servicesFor(user),
      consultations: {
        upcoming: sessions
          .filter((item) => new Date(item.starts_at).getTime() >= now)
          .map(({ id, title, starts_at }) => ({ id, title, starts_at })),
        total: sessions.length,
      },
    });
  }),

  // Free in the fake: registered at once. A paid webinar answers the invoice to pay.
  http.post(`${BASE}/services/webinars/:id/register/`, ({ params }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const data = servicesFor(user);
    if (data.webinar?.id !== Number(params.id)) return notFound();
    if (data.webinar.registered)
      return HttpResponse.json({ detail: 'You are already registered.' }, { status: 409 });
    data.webinar.registered = true;
    if (!data.events.some((event) => event.id === data.webinar?.id))
      data.events.unshift({
        id: data.webinar.id,
        title: data.webinar.title,
        starts_at: data.webinar.starts_at,
        online: true,
        status: 'upcoming',
        join_url: '#',
        video_url: null,
        url: '#',
      });
    // Free (Sara's webinar): registered at once. A paid one answers the invoice's payment id.
    return HttpResponse.json({ payment_id: null }, { status: 201 });
  }),

  http.get(`${BASE}/services/packages/:id/`, ({ params }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const found = servicesFor(user).packages.find((item) => item.id === Number(params.id));
    if (!found) return notFound();
    const titles = [
      'Introduction & Test Format',
      'Reading: Skimming',
      'Reading: Inference',
      'Listening: Lectures',
      'Listening: Conversations',
      'Speaking Task 1',
      'Speaking Task 2',
      'Speaking Tasks 3–4',
      'Writing: Integrated',
      'Writing: Academic Discussion',
    ];
    const detail: PackageDetail = {
      id: found.id,
      tag: found.tag,
      name: found.name,
      description:
        found.id === 1 ? '۱۸ جلسه‌ی ویدئویی برای چهار مهارت آزمون تافل.' : 'فیلم کامل وبینار.',
      lessons: (found.id === 1 ? titles : ['Webinar recording']).map((title, index) => ({
        id: index + 1,
        title,
        minutes: 18 + ((index * 7) % 20),
        url: '#',
      })),
      current_lesson: found.id === 1 ? 7 : null,
      review: packageReviews.get(found.id) ?? null,
      // Django's PANEL_REVIEW_CREDIT (0 = no offer: null), as set for these tests; null once reviewed.
      review_credit: packageReviews.has(found.id) ? null : REVIEW_CREDIT,
    };
    return HttpResponse.json(detail);
  }),

  http.post(`${BASE}/services/packages/:id/review/`, async ({ params, request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    if (!servicesFor(user).packages.some((item) => item.id === Number(params.id)))
      return notFound();
    const { text } = (await request.json()) as { text: string };
    if (!text.trim())
      return HttpResponse.json({ text: ['This field may not be blank.'] }, { status: 400 });
    if (packageReviews.has(Number(params.id)))
      return HttpResponse.json({ detail: 'You already reviewed this package.' }, { status: 409 });
    packageReviews.set(Number(params.id), {
      text: text.trim(),
      submitted_at: new Date().toISOString(),
    });
    servicesFor(user).credit += REVIEW_CREDIT;
    return new HttpResponse(null, { status: 201 });
  }),

  http.get(`${BASE}/services/events/:id/`, ({ params }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const data = servicesFor(user);
    const found = data.events.find((item) => item.id === Number(params.id));
    if (!found) return notFound();
    const detail: EventDetail = {
      id: found.id,
      kind: 'webinar',
      title: found.title,
      starts_at: found.starts_at,
      online: found.online,
      location: null,
      description: '[توضیحات رویداد از پنل مدیریت]',
      registered: true,
      // The room isn't open yet in the fake (a real one opens shortly before it starts).
      join_url: null,
      video_url: found.video_url,
      invoice: { amount: found.id === 31 ? 290_000 : 0, paid_at: found.starts_at },
    };
    return HttpResponse.json(detail);
  }),

  http.put(`${BASE}/services/gpa/`, async ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const { courses } = (await request.json()) as { courses: GpaCourse[] };
    // Django's errors: the list's own, or one object per course (empty for a valid one).
    if (!courses.length)
      return HttpResponse.json(
        { courses: { non_field_errors: ['This list may not be empty.'] } },
        { status: 400 },
      );
    const errors = courses.map((course) => ({
      ...(course.name.trim() ? {} : { name: ['This field may not be blank.'] }),
      ...(course.credits >= 1 && course.credits <= 10 ? {} : { credits: ['invalid'] }),
      ...(course.grade >= 0 && course.grade <= 20 ? {} : { grade: ['invalid'] }),
    }));
    if (errors.some((error) => Object.keys(error).length))
      return HttpResponse.json({ courses: errors }, { status: 400 });
    const data = servicesFor(user);
    data.gpa = { courses, result: gpaOf(courses) };
    return HttpResponse.json({ result: data.gpa.result });
  }),
];

// endregion

/** Call requests sent from the panel (leads for the sales team), newest last. */

// region Gates (H45–H49)

/**
 * Dev knob for the gates (canvas V6 sections 8 and 14): `localStorage['scorize.mock.gate']` set
 * to `terms` (terms, then the profile step), `surveys`, `inactive` or `nps` puts that gate in
 * front of Sara's panel. Without it nothing stands in the way.
 */
export const MOCK_GATE_KEY = 'scorize.mock.gate';

interface GateState {
  terms: boolean;
  profile: boolean;
  surveys: Gates['surveys'];
  inactive: boolean;
  nps: boolean;
}

let gateState: GateState | null = null;

const TERMS: NonNullable<Gates['terms']> = {
  version: '1405-1',
  sections: [
    {
      title: '۱. موضوع قرارداد',
      text: 'اسکورایز مسیر اپلای شما را از انتخاب دانشگاه تا گرفتن پذیرش همراهی می‌کند: انتخاب دانشگاه و استاد، نگارش مدارک، ارسال درخواست‌ها و پیگیری نتیجه‌ها.',
    },
    {
      title: '۲. تعهدات متقاضی',
      text: 'اطلاعات و مدارک را درست و به‌موقع می‌فرستید و پیش از هر ارسال، فهرست دانشگاه‌ها را تأیید می‌کنید. پاسخ به تیکت‌ها در زمان مقرر، سرعت کار را حفظ می‌کند.',
    },
    {
      title: '۳. پرداخت',
      text: 'مبلغ قرارداد در قسط‌هایی که در صفحه‌ی قرارداد می‌بینید پرداخت می‌شود. با تأخیر در پرداخت، کار پرونده تا تسویه متوقف می‌شود.',
    },
    {
      title: '۴. فسخ قرارداد',
      text: 'شرایط فسخ و بازگشت وجه در متن کامل قرارداد آمده است. برای هر سؤال، از تیکت پشتیبانی بپرسید.',
    },
  ],
};

function gatesOf(): GateState {
  if (gateState) return gateState;
  const knob = globalThis.localStorage.getItem(MOCK_GATE_KEY);
  gateState = {
    terms: knob === 'terms',
    profile: knob === 'terms',
    surveys:
      knob === 'surveys'
        ? [
            { id: 1, supervisor: 'نیلوفر شریفی' },
            { id: 2, supervisor: 'امیر کاظمی' },
          ]
        : [],
    inactive: knob === 'inactive',
    nps: knob === 'nps',
  };
  return gateState;
}

const NO_GATES: Gates = { terms: null, profile: null, surveys: [], inactive: null, nps: null };

/** The profile step clears once its fields are saved (PATCH /profile/). */
function profileSaved(fields: string[]) {
  if (
    gateState?.profile &&
    ['passport_name', 'relative_name', 'relative_phone'].every((f) => fields.includes(f))
  )
    gateState.profile = false;
}

const gateHandlers = [
  http.get(`${BASE}/gates/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    if (user !== SARA) return HttpResponse.json(NO_GATES);
    const gates = gatesOf();
    return HttpResponse.json<Gates>({
      terms: gates.terms ? TERMS : null,
      profile:
        !gates.terms && gates.profile
          ? { fields: ['passport_name', 'relative_name', 'relative_phone'] }
          : null,
      surveys: gates.surveys,
      inactive: gates.inactive
        ? {
            file_number: SARA_FILE,
            credentials: [
              { label: 'ایمیل اپلای', value: 'sara.ahmadi.apply@gmail.com', secret: false },
              { label: 'رمز ایمیل', value: 'Sc0rize-1240!', secret: true },
            ],
            support_email: 'support@scorize.com',
          }
        : null,
      nps: gates.nps ? { credit: 5_000 } : null,
    });
  }),

  http.post(`${BASE}/gates/terms/`, async ({ request }) => {
    const { version } = (await request.json()) as { version?: unknown };
    if (version !== TERMS.version)
      return HttpResponse.json({ version: ['stale'] }, { status: 400 });
    gatesOf().terms = false;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/gates/surveys/:id/`, async ({ params, request }) => {
    const { answer } = (await request.json()) as { answer?: unknown };
    const gates = gatesOf();
    const id = Number(params.id);
    if (!gates.surveys.some((survey) => survey.id === id)) return notFound();
    if (typeof answer !== 'string')
      return HttpResponse.json({ answer: ['required'] }, { status: 400 });
    gates.surveys = gates.surveys.filter((survey) => survey.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/gates/nps/`, () => {
    gatesOf().nps = false;
    return new HttpResponse(null, { status: 204 });
  }),
];

export const callRequests: CallRequest[] = [];

export const applicantHandlers = [
  // Before the case's writing forms: a person's own (bought) orders answer there first.
  ...writingOfferHandlers,
  ...ownTicketHandlers,
  // Any logged-in user: guests get the panel too (locked previews).
  http.get(`${BASE}/access/`, () => {
    const user = storage.get();
    return user ? HttpResponse.json(accessOf(user)) : forbidden();
  }),

  http.post(`${BASE}/call-request/`, async ({ request }) => {
    if (!storage.get()) return forbidden();
    const body = (await request.json()) as CallRequest;
    if (!/^09\d{9}$/.test(body.phone))
      return HttpResponse.json(
        { phone: ['Enter a mobile number like 09121234567.'] },
        { status: 400 },
      );
    callRequests.push(body);
    return new HttpResponse(null, { status: 201 });
  }),

  http.get(`${BASE}/overview/`, () => {
    const state = caseOrError();
    return failed(state) ? state : HttpResponse.json(overviewOf(state));
  }),

  http.get(`${BASE}/applications/`, () => {
    const state = caseOrError();
    if (failed(state)) return state;
    const data: ApplicationsData = {
      stage: 'apply',
      applies: { used: state.applications.length, total: 15 },
      results: state.applications,
      visa: state.visa,
    };
    return HttpResponse.json(data);
  }),

  http.post(`${BASE}/applications/:id/approval/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const item = state.applications.find((candidate) => candidate.id === Number(params.id));
    if (!item) return notFound();
    if (item.approval !== 'pending')
      return HttpResponse.json({ detail: 'Already decided.' }, { status: 409 });
    const { approved } = (await request.json()) as { approved: boolean };
    item.approval = approved ? 'approved' : 'rejected';
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/applications/:id/showcase/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const item = state.applications.find((candidate) => candidate.id === Number(params.id));
    if (item?.result !== 'accepted') return notFound();
    const { allowed } = (await request.json()) as { allowed: boolean };
    item.showcase = allowed;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/professor-emails/`, ({ request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const params = new URL(request.url).searchParams;
    const page = Number(params.get('page') ?? 1);
    const size = Math.min(50, Number(params.get('page_size') ?? 15));
    const pages = Math.max(1, Math.ceil(state.professors.length / size));
    if (!(page >= 1 && page <= pages))
      return HttpResponse.json({ detail: 'Invalid page.' }, { status: 404 });
    // Django's links are absolute.
    const link = (target: number) =>
      target >= 1 && target <= pages
        ? new URL(
            `${BASE}/professor-emails/?page=${String(target)}&page_size=${String(size)}`,
            request.url,
          ).href
        : null;
    const data: ProfessorEmailPage = {
      count: state.professors.length,
      replied: state.professors.filter((item) => item.status === 'replied').length,
      next: link(page + 1),
      previous: link(page - 1),
      results: state.professors.slice((page - 1) * size, page * size),
    };
    return HttpResponse.json(data);
  }),

  http.get(`${BASE}/documents/`, () => {
    const state = caseOrError();
    if (failed(state)) return state;
    const data: DocumentsData = { progress: progressOf(state), ...state.documents };
    return HttpResponse.json(data);
  }),

  http.post(`${BASE}/documents/:id/upload/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const required = state.documents.required.find((item) => item.id === Number(params.id));
    if (!required) return notFound();
    const upload = (await request.formData()).get('file');
    if (!(upload instanceof File) || upload.size > 10 * 1024 * 1024)
      return HttpResponse.json({ file: ['invalid'] }, { status: 400 });
    state.documents.required = state.documents.required.filter((item) => item !== required);
    const id = Math.max(0, ...state.documents.files.map((item) => item.id)) + 1;
    state.documents.files.unshift({
      id,
      name: required.name,
      url: '#',
      ext: (upload.name.split('.').pop() ?? 'pdf').toUpperCase(),
      uploaded_at: new Date().toISOString(),
      source: 'me',
      can_delete: true,
      state: 'review',
    });
    state.answers.set(id, { ...required, note: null });
    return new HttpResponse(null, { status: 201 });
  }),

  http.delete(`${BASE}/documents/files/:id/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const target = state.documents.files.find((item) => item.id === Number(params.id));
    if (!target) return notFound();
    if (!target.can_delete) return HttpResponse.json({ detail: 'Reviewed.' }, { status: 403 });
    state.documents.files = state.documents.files.filter((item) => item !== target);
    // Removing the file of a required document asks for it again, like Django clearing the field.
    state.documents.required.push(
      state.answers.get(target.id) ?? {
        id: 100 + target.id,
        name: target.name,
        deadline: null,
        note: null,
      },
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.put(`${BASE}/research-interests/`, async ({ request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const { interests } = (await request.json()) as { interests?: unknown };
    if (
      !Array.isArray(interests) ||
      interests.length > 20 ||
      !interests.every((item) => typeof item === 'string' && item.trim() && item.length <= 64)
    )
      return HttpResponse.json({ interests: ['invalid'] }, { status: 400 });
    state.documents.interests = interests as string[];
    return new HttpResponse(null, { status: 204 });
  }),

  // An account's interests before a case (H70, H71): any logged-in user; a toy professor count.
  http.get(`${BASE}/research-interests/profile/`, () => HttpResponse.json(guestInterestsOf())),

  // Suggestions while typing: the existing interests containing `q`, most professors first.
  http.get(`${BASE}/research-interests/search/`, ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase();
    const results =
      q.length < 2
        ? []
        : KNOWN_INTERESTS.filter(({ name }) => name.toLowerCase().includes(q)).slice(0, 8);
    return HttpResponse.json({ results });
  }),

  http.put(`${BASE}/research-interests/profile/`, async ({ request }) => {
    const { interests } = (await request.json()) as { interests?: unknown };
    if (
      !Array.isArray(interests) ||
      interests.length > 20 ||
      !interests.every((item) => typeof item === 'string' && item.trim() && item.length <= 64)
    )
      return HttpResponse.json({ interests: ['invalid'] }, { status: 400 });
    guestInterests = interests as string[];
    return HttpResponse.json(guestInterestsOf());
  }),

  // Writing information forms: H12–H16, H50, H51. 404 for a type the contract doesn't include.
  http.get(`${BASE}/writing/:type/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    if (!isFormType(params.type)) return notFound();
    const form = state.writing[params.type];
    if (!form.orders.includes(params.type)) return notFound();
    // The CV (read-only) and the professor list (editable) show the documents page's interests.
    const extra =
      params.type === 'cv' || params.type === 'pl'
        ? { research_interests: state.documents.interests }
        : {};
    return HttpResponse.json({ ...form, answers: { ...form.answers, ...extra } });
  }),

  http.patch(`${BASE}/writing/:type/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    if (!isFormType(params.type)) return notFound();
    const form = state.writing[params.type];
    if (form.is_final) return HttpResponse.json({ detail: 'Final.' }, { status: 409 });
    const body = (await request.json()) as { answers?: Answers; contact_phone?: string };
    const invalid = invalidAnswers(SPECS[params.type], body.answers ?? {});
    if (invalid.length)
      return HttpResponse.json(
        { answers: Object.fromEntries(invalid.map(([name]) => [name, ['invalid']])) },
        { status: 400 },
      );
    if (body.contact_phone !== undefined && !/^09\d{9}$/.test(body.contact_phone))
      return HttpResponse.json({ contact_phone: ['invalid'] }, { status: 400 });
    const { research_interests: interests, ...answers } = body.answers ?? {};
    // The professor list edits the applicant's research interests themselves (H11).
    if (params.type === 'pl' && Array.isArray(interests))
      state.documents.interests = interests as string[];
    form.answers = { ...form.answers, ...storeLists(answers) };
    // One number per order in Django: both forms show it.
    if (body.contact_phone !== undefined)
      for (const other of Object.values(state.writing)) other.contact_phone = body.contact_phone;
    form.updated_at = new Date().toISOString();
    return HttpResponse.json({ updated_at: form.updated_at });
  }),

  http.post(`${BASE}/writing/cv/pass_photo/`, async ({ request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const form = state.writing.cv;
    if (form.is_final) return HttpResponse.json({ detail: 'Final.' }, { status: 409 });
    const photo = (await request.formData()).get('pass_photo');
    if (!(photo instanceof File) || !['image/jpeg', 'image/png'].includes(photo.type))
      return HttpResponse.json({ pass_photo: ['invalid'] }, { status: 400 });
    // A small placeholder picture stands for the stored file.
    const url =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 110"><rect width="88" height="110" fill="#efeaf1"/><circle cx="44" cy="42" r="18" fill="#a69fad"/><rect x="18" y="68" width="52" height="34" rx="17" fill="#a69fad"/></svg>',
      );
    form.answers = { ...form.answers, pass_photo: url };
    form.updated_at = new Date().toISOString();
    return HttpResponse.json({ url, updated_at: form.updated_at }, { status: 201 });
  }),

  http.post(`${BASE}/writing/:type/final/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    if (!isFormType(params.type)) return notFound();
    const type = params.type;
    const form = state.writing[type];
    if (form.is_final) return HttpResponse.json({ detail: 'Final.' }, { status: 409 });
    const { answers = {} } = (await request.json()) as { answers?: Answers };
    // The page sends every answer, read-only ones included: Django ignores those.
    const { pass_photo: _photo, research_interests: interests, ...editable } = answers;
    if (invalidAnswers(SPECS[type], editable).length)
      return HttpResponse.json({ detail: 'Invalid answers.' }, { status: 400 });
    // The professor list's interests are the applicant's own (H11), kept on the documents page.
    if (type === 'pl' && Array.isArray(interests))
      state.documents.interests = interests as string[];
    const merged = {
      ...form.answers,
      ...storeLists(editable),
      ...(type === 'pl' ? { research_interests: state.documents.interests } : {}),
    };
    const missing = missingInForm(SPECS[type], merged).map((item) => item.key);
    if (missing.length) return HttpResponse.json({ missing }, { status: 400 });
    const now = new Date().toISOString();
    state.writing[type] = {
      ...form,
      answers: merged,
      is_final: true,
      final_at: now,
      updated_at: now,
    };
    state.documents.writing = (state.documents.writing ?? []).map((item) =>
      item.type === type ? { ...item, step: 'writing' } : item,
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/contract/`, () => {
    const state = caseOrError();
    return failed(state) ? state : HttpResponse.json(state.contract);
  }),

  http.patch(`${BASE}/profile/`, async ({ request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const body = (await request.json()) as Partial<Record<ProfileField, unknown>>;
    const errors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(body)) {
      const field = key as ProfileField;
      const check = PROFILE_CHECKS[field];
      if (
        !state.contract.editable.includes(field) ||
        typeof value !== 'string' ||
        !value.trim() ||
        (check && !check.test(value))
      )
        errors[key] = ['invalid'];
    }
    if (Object.keys(errors).length) return HttpResponse.json(errors, { status: 400 });
    Object.assign(state.contract.profile, body);
    profileSaved(Object.keys(body));
    return HttpResponse.json(body);
  }),

  http.get(`${BASE}/payments/:id/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const payment = state.payments.find((item) => item.id === Number(params.id));
    return payment ? HttpResponse.json(served(payment)) : notFound();
  }),

  http.get(`${BASE}/payments/`, () => {
    const state = caseOrError();
    if (failed(state)) return state;
    return HttpResponse.json(
      state.payments
        .filter((row) => ['unpaid', 'review', 'declined'].includes(row.status))
        .sort((a, b) => b.id - a.id)
        .map(openRow),
    );
  }),

  http.patch(`${BASE}/payments/:id/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const payment = state.payments.find((row) => row.id === Number(params.id));
    if (!payment) return notFound();
    if (!payment.editable || payment.status !== 'unpaid')
      return HttpResponse.json({ detail: 'Not editable.' }, { status: 409 });
    const { use_credit } = (await request.json()) as { use_credit: boolean };
    reprice(payment, payment.code?.code ?? null, use_credit);
    return HttpResponse.json(served(payment));
  }),

  http.post(`${BASE}/payments/:id/discount/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const payment = state.payments.find((row) => row.id === Number(params.id));
    if (!payment) return notFound();
    if (!payment.editable || payment.status !== 'unpaid')
      return HttpResponse.json({ detail: 'Not editable.' }, { status: 409 });
    const code = ((await request.json()) as { code: string }).code.trim().toUpperCase();
    const result: DiscountResult = code ? (CODES[code] ?? 'invalid') : 'ok';
    if (result === 'ok') reprice(payment, code || null, payment.use_credit);
    return HttpResponse.json({ result, payment: served(payment) });
  }),

  // Takes an item out of the cart: it ends on its own and the rest is priced again.
  http.delete(`${BASE}/payments/:id/items/:item/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const payment = state.payments.find((row) => row.id === Number(params.id));
    if (!payment) return notFound();
    if (!payment.editable || payment.status !== 'unpaid')
      return HttpResponse.json({ detail: 'locked' }, { status: 409 });
    if (!payment.items.some((row) => row.id === Number(params.item))) return notFound();
    if (payment.items.length === 1) return HttpResponse.json({ detail: 'last' }, { status: 409 });
    payment.items = payment.items.filter((row) => row.id !== Number(params.item));
    reprice(payment, payment.code?.code ?? null, payment.use_credit);
    return HttpResponse.json(served(payment));
  }),

  // A new invoice at today's price; the old one stays as it was.
  http.post(`${BASE}/payments/:id/renew/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const payment = state.payments.find((row) => row.id === Number(params.id));
    if (!payment) return notFound();
    if (payment.renew === 'seller') return HttpResponse.json({ payment_id: null }, { status: 202 });
    if (payment.renew !== 'self')
      return HttpResponse.json({ detail: payment.renew ?? 'not_renewable' }, { status: 409 });
    const id = Math.max(...state.payments.map((row) => row.id)) + 1;
    state.payments.push(invoice(id, { items: services(), ...ownPurchase() }));
    return HttpResponse.json({ payment_id: id }, { status: 201 });
  }),

  // Django would answer the gateway's address; the fake pays at once and sends the browser back
  // to the payment page, like the gateway's callback does.
  http.post(`${BASE}/payments/:id/online/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const payment = state.payments.find((item) => item.id === Number(params.id));
    if (!payment) return notFound();
    if (!['unpaid', 'declined'].includes(payment.status))
      return HttpResponse.json({ detail: 'Not payable.' }, { status: 409 });
    const now = new Date().toISOString();
    Object.assign(payment, {
      status: 'paid',
      method: 'online',
      paid_at: now,
      receipt: null,
      ref_id: '600400300',
    });
    const installment = installmentOf(state, payment);
    if (installment) Object.assign(installment, { status: 'paid', paid_at: now });
    return HttpResponse.json({
      redirect_url: `${import.meta.env.BASE_URL}payments/${String(payment.id)}`,
      outside_iran: false,
    });
  }),

  // PAY3: an invoice by its public link, signed out too.
  http.get(`${BASE}/invoices/:token/`, ({ params }) => {
    sara ??= saraState();
    const payment = sara.payments.find((row) => row.token === params.token);
    if (!payment) return notFound();
    const user = storage.get();
    return HttpResponse.json({
      status: payment.status,
      items: payment.items.map((row) => ({ label: row.label, amount: row.amount + row.credit })),
      total: payment.total,
      credit_used: payment.credit_used,
      amount: payment.amount,
      currency: payment.currency,
      created_at: payment.created_at,
      paid_at: payment.paid_at,
      ref_id: payment.ref_id,
      seller: payment.seller,
      customer: 'سارا احمدی',
      phone: user ? null : '0912●●●6789',
      payment_id: user === SARA ? payment.id : null,
      other_account: user !== null && user !== SARA,
    });
  }),

  http.get(`${BASE}/campaigns/:slug/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    return state.campaign.slug === params.slug ? HttpResponse.json(state.campaign) : notFound();
  }),

  // PAY10: registers and makes its invoice, paid on the purchase page.
  http.post(`${BASE}/campaigns/:slug/register/`, ({ params }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const { campaign } = state;
    if (campaign.slug !== params.slug) return notFound();
    if (campaign.form_stage === 'before' && !campaign.form_complete)
      return HttpResponse.json({ detail: 'form' }, { status: 409 });
    if (campaign.registration) return HttpResponse.json({ detail: 'registered' }, { status: 409 });
    if (campaign.seats_left === 0) return HttpResponse.json({ detail: 'full' }, { status: 409 });
    const bought = item(campaign.title, campaign.old_price ?? campaign.price, {
      kind: 'campaign',
      href: `/campaigns/${campaign.slug}`,
      discounted_price: campaign.old_price ? campaign.price : null,
      amount: campaign.price,
    });
    // Into her open cart, its time counted again; else a new one.
    const cart = openCart(state);
    let id: number;
    if (cart) {
      id = cart.id;
      cart.items.push(bought);
      cart.expires_at = new Date(Date.now() + 20 * 60_000).toISOString();
      reprice(cart, cart.code?.code ?? null, cart.use_credit);
    } else {
      id = Math.max(...state.payments.map((row) => row.id)) + 1;
      const fresh = invoice(id, { items: [bought], ...ownPurchase() });
      state.payments.push(fresh);
      if (campaign.price === 0) reprice(fresh, null, false);
    }
    const paid = state.payments.find((row) => row.id === id)?.status === 'paid';
    campaign.registration = { id: 40, status: paid ? 'paid' : 'unpaid', payment_id: id };
    if (campaign.seats_left !== null) campaign.seats_left -= 1;
    return HttpResponse.json({ payment_id: id, paid }, { status: 201 });
  }),

  http.post(`${BASE}/payments/:id/receipt/`, async ({ params, request }) => {
    const state = caseOrError();
    if (failed(state)) return state;
    const payment = state.payments.find((item) => item.id === Number(params.id));
    if (!payment) return notFound();
    if (payment.status === 'paid' || payment.status === 'review')
      return HttpResponse.json({ detail: 'Not payable.' }, { status: 409 });
    const receipt = (await request.formData()).get('receipt');
    if (
      !(receipt instanceof File) ||
      receipt.size > 10 * 1024 * 1024 ||
      !['application/pdf', 'image/jpeg', 'image/png'].includes(receipt.type)
    )
      return HttpResponse.json({ receipt: ['invalid'] }, { status: 400 });
    Object.assign(payment, {
      status: 'review',
      method: 'receipt',
      decline_reason: null,
      receipt: { url: '#', uploaded_at: new Date().toISOString() },
    });
    const installment = installmentOf(state, payment);
    if (installment) installment.status = 'review';
    return new HttpResponse(null, { status: 201 });
  }),

  ...ticketHandlers,
  ...turkeyHandlers,
  ...servicesHandlers,
  ...consultationHandlers,
  ...gateHandlers,
  ...estimateHandlers,
  ...journeyHandlers,
];

/** Forget Sara's changes (tests, logout). */
/** The account's research interests before a case (H70). */
let guestInterests: string[] = [];

/** The `ResearchInterest` rows Django has, with their professors, most first. */
const KNOWN_INTERESTS = [
  { name: 'Machine Learning', professors: 212 },
  { name: 'Robotics', professors: 96 },
  { name: 'Computer Vision', professors: 88 },
  { name: 'Soft Robotics', professors: 14 },
  { name: 'Robot Ethics', professors: 0 },
];

/** H70 `research-interests/profile/` (GET, and PUT's answer): 74 professors in 9 universities per interest, as a toy. */
function guestInterestsOf() {
  const countries = ['ایتالیا', 'آلمان', 'کانادا'];
  return {
    interests: guestInterests,
    professors: guestInterests.length * 74,
    universities: guestInterests.length * 9,
    sample: guestInterests
      .slice(0, 3)
      .map((interest, index) => ({ country: countries[index % countries.length], interest })),
  };
}

export function resetApplicantMocks() {
  guestInterests = [];
  sara = null;
  resetWritingOfferMocks();
  callRequests.length = 0;
  turkeyCases.clear();
  servicesOf.clear();
  packageReviews.clear();
  consultationsOf.clear();
  feedbackSent.length = 0;
  transcriptReturned.clear();
  gateState = null;
  resetEstimateMocks();
  resetJourneyMocks();
}

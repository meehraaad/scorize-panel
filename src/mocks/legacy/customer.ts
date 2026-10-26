import { api } from '@/lib/api/client';
import { joinNames, localName } from '@/lib/i18n/names';
import {
  SALES_KEY,
  type Channel,
  type Degree,
  type LeadSource,
  type LeadStage,
  type LostReason,
} from '@/lib/sales/api';
import {
  CONTACT_TYPE,
  LEAD_CAUSE,
  STAFF_API,
  TODO_TYPE,
  djangoDate,
  fullName,
  MAX_PAGE_SIZE,
  myStaffId,
  nextPage,
  type DjangoContact,
  type DjangoContactWrite,
  type DjangoTodoWrite,
  type DjangoEducation,
  type DjangoExamScore,
  type DjangoExperience,
  type DjangoHistoryItem,
  type DjangoLead,
  type DjangoPersonal,
  type DjangoUserDetail,
  type DjangoUserInfo,
  type DjangoUserInvoice,
  type Page,
} from '../djangoStaff';
import { colleagues, personTasks } from './django';
import type { Colleague, TaskSummary } from '@/lib/tasks/api';
import { invoiceTitle, PAYMENT_STATUSES } from './payments';

export type ProfileKey =
  | 'current_degree'
  | 'wanted_degree'
  | 'gpa'
  | 'language'
  | 'countries'
  | 'budget'
  | 'city'
  | 'military'
  | 'referral';

/** A profile row: codes are labelled by the page (degrees, model choices), text is shown as is. */
export type ProfileItem =
  | { key: 'current_degree' | 'wanted_degree'; degree: Degree }
  | { key: 'budget'; budget: 1 | 2 | 3 }
  | { key: 'military'; military: 1 | 2 | 3 | 4 }
  | {
      key: Exclude<ProfileKey, 'current_degree' | 'wanted_degree' | 'budget' | 'military'>;
      text: string;
    };

export interface CustomerData {
  /** User id. */
  id: number;
  name: string;
  phone: string;
  email: string | null;
  /** The open lead (the newest one); null for a customer with no lead. */
  lead: {
    id: number;
    source: LeadSource;
    stage: LeadStage;
    /** 0–100; null while unknown (the automatic score is S5). */
    score: number | null;
    follow_up_at: string | null;
    /** The follow-up is a StaffToDo deadline: a day, no time. */
    follow_up_date_only?: boolean;
    lost_reason: LostReason | null;
    seller: string | null;
  } | null;
  /** The line under the name. */
  headline: {
    degree: Degree | null;
    field: string | null;
    countries: string[];
    /** UserPersonalInformation.Budget. */
    budget: 1 | 2 | 3 | null;
  };
  /** Why the score is what it is, localized labels. */
  score_factors: { label: string; points: number }[];
  /**
   * Admissions of Scorize applicants with a similar background (ExperienceViewSet, as on the crm
   * user page): `count` successful ones, `universities` the first few, `background` the customer's
   * highest education degree they were matched on.
   */
  similar: {
    background: { degree: Degree; field: string | null; gpa: number };
    count: number;
    universities: string[];
  } | null;
  profile: ProfileItem[];
  purchases: { label: string; status: 'paid' | 'pending' | 'failed' }[];
  /** Wallet credit, toman. */
  credit: number;
  counts: { purchases: number; payments: number };
  tasks: TaskSummary[];
  /** Ready messages with the customer's and seller's names filled in (S7). */
  templates: { id: number; title: string; text: string }[];
  /** For "ask a colleague". */
  colleagues: Colleague[];
  review_files: { id: number; kind: string; url: string; uploaded_at: string }[];
  /** What the server does with a logged contact: store stage moves (S3), text "no answer" (S16). */
  supports: { stages: boolean; no_answer_sms: boolean };
}

export const customerKey = (id: number) => [...SALES_KEY, 'customer', id] as const;

const userApi = (id: number) => `${STAFF_API}/users/${String(id)}`;

/** SaleLead.Cause grouped the panel's way (S2): failed purchases and campaigns exist today. */
const sourceOf = (cause: number): LeadSource =>
  cause === LEAD_CAUSE.campaign ? 'campaign' : 'failed_purchase';

/** The newest lead of a user: sale-leads/ has no user filter, so search by phone and match. */
export async function newestLead(user: DjangoUserDetail, signal?: AbortSignal) {
  if (!user.phone_number) return null;
  const page = await api<Page<DjangoLead>>(
    `${STAFF_API}/sale-leads/?search=${encodeURIComponent(user.phone_number)}&ordering=-id`,
    { signal },
  );
  return page.results.find((lead) => lead.user.id === user.id) ?? null;
}

const asBudget = (value: number | null) =>
  value === 1 || value === 2 || value === 3 ? value : null;
const asMilitary = (value: number | null) =>
  value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
const asDegree = (value: number | null) =>
  value !== null && value >= 0 && value <= 6 ? (value as Degree) : null;

/** Distinct universities shown under "similar admissions". */
const SIMILAR_UNIVERSITIES = 6;

function similarOf(
  education: DjangoEducation[],
  experiences: Page<DjangoExperience>,
): CustomerData['similar'] {
  const top = education.reduce<DjangoEducation | null>(
    (best, item) => (best === null || item.degree > best.degree ? item : best),
    null,
  );
  const degree = asDegree(top?.degree ?? null);
  if (!top || degree === null || experiences.count === 0) return null;
  const universities = [...new Set(experiences.results.map((item) => item.university_name.trim()))];
  return {
    background: {
      degree,
      field: top.study_field ? localName(top.study_field.name, top.study_field.name_persian) : null,
      gpa: top.gpa,
    },
    count: experiences.count,
    universities: universities.filter(Boolean).slice(0, SIMILAR_UNIVERSITIES),
  };
}

function profileOf(
  personal: DjangoPersonal | null,
  info: DjangoUserInfo | null,
  exams: DjangoExamScore[],
): ProfileItem[] {
  const items: (ProfileItem | null)[] = [
    asDegree(personal?.new_current_degree ?? null) !== null
      ? { key: 'current_degree', degree: asDegree(personal?.new_current_degree ?? null) as Degree }
      : null,
    asDegree(personal?.desired_degree ?? null) !== null
      ? { key: 'wanted_degree', degree: asDegree(personal?.desired_degree ?? null) as Degree }
      : null,
    personal?.current_gpa != null ? { key: 'gpa', text: String(personal.current_gpa) } : null,
    exams.length || personal?.current_lang_level
      ? {
          key: 'language',
          text:
            joinNames(exams.map((exam) => `${exam.exam.name} ${String(exam.score)}`)) ||
            (personal?.current_lang_level ?? ''),
        }
      : null,
    personal?.desired_countries.length
      ? {
          key: 'countries',
          text: joinNames(
            personal.desired_countries.map((country) =>
              localName(country.country, country.persian_name),
            ),
          ),
        }
      : null,
    asBudget(personal?.budget ?? null)
      ? { key: 'budget', budget: asBudget(personal?.budget ?? null) as 1 | 2 | 3 }
      : null,
    personal?.city_of_residence ? { key: 'city', text: personal.city_of_residence } : null,
    asMilitary(personal?.military_service_status ?? null)
      ? {
          key: 'military',
          military: asMilitary(personal?.military_service_status ?? null) as 1 | 2 | 3 | 4,
        }
      : null,
    info?.referred_from_display ? { key: 'referral', text: info.referred_from_display } : null,
  ];
  return items.filter((item): item is ProfileItem => item !== null);
}

const PURCHASE_STATUS = {
  pending: 'pending',
  pending_receipt: 'pending',
  paid: 'paid',
  paid_by_receipt: 'paid',
  expired: 'failed',
  failed: 'failed',
  receipt_declined: 'failed',
} as const;

/**
 * The customer page from Django's existing staff endpoints (the user, their details, newest lead,
 * invoices, payments, open tasks and colleagues) until `customers/<id>/` ships (S15). Not there
 * yet: the lead's stage beyond "new / contacted" (S3), the automatic score and its factors (S5),
 * and ready messages (S7).
 */
export async function fetchCustomer(id: number, signal?: AbortSignal): Promise<CustomerData> {
  const [user, personal, info, exams, education, similar, invoices, payments, tasks, peers] =
    await Promise.all([
      api<DjangoUserDetail>(`${userApi(id)}/`, { signal }),
      api<DjangoPersonal[]>(`${userApi(id)}/personal-information/`, { signal }),
      api<DjangoUserInfo[]>(`${userApi(id)}/info/`, { signal }),
      api<DjangoExamScore[]>(`${userApi(id)}/exam-scores/`, { signal }),
      api<DjangoEducation[]>(`${userApi(id)}/education-degrees/`, { signal }),
      api<Page<DjangoExperience>>(
        `${userApi(id)}/experiences/?is_successful=True&ordering=-id&page_size=${String(MAX_PAGE_SIZE)}`,
        { signal },
      ),
      api<Page<DjangoUserInvoice>>(`${userApi(id)}/invoices/?ordering=-id&page_size=5`, { signal }),
      api<Page<unknown>>(`${userApi(id)}/payments/?page_size=1`, { signal }),
      personTasks(id, signal),
      colleagues(signal),
    ]);
  const lead = await newestLead(user, signal);
  const details = personal[0] ?? null;
  const userInfo = info[0] ?? null;
  const me = await myStaffId();
  const followUp = tasks.find((task) => task.kind === 'mine' && task.status !== 'done');
  return {
    id: user.id,
    name: fullName(user),
    phone: user.phone_number ?? '',
    email: user.email || null,
    lead: lead && {
      id: lead.id,
      source: sourceOf(lead.cause),
      stage: lead.is_called ? 'contacted' : 'new',
      score: userInfo?.probability_of_signing_contract ?? null,
      follow_up_at: followUp?.due_at ?? null,
      follow_up_date_only: true,
      lost_reason: null,
      seller: lead.assigned_staff?.full_name ?? null,
    },
    headline: {
      degree: asDegree(details?.desired_degree ?? null),
      field: null,
      countries: (details?.desired_countries ?? []).map((country) =>
        localName(country.country, country.persian_name),
      ),
      budget: asBudget(details?.budget ?? null),
    },
    score_factors: [],
    similar: similarOf(education, similar),
    profile: profileOf(details, userInfo, exams),
    purchases: invoices.results.map((item) => ({
      label: invoiceTitle(item, item.payment),
      status: PURCHASE_STATUS[PAYMENT_STATUSES[item.payment.status] ?? 'pending'],
    })),
    credit: user.credit,
    counts: { purchases: invoices.count, payments: payments.count },
    tasks,
    templates: [],
    // The seller themself isn't someone to ask.
    colleagues: peers.filter((peer) => peer.id !== me),
    // The old staff endpoints have no review files.
    review_files: [],
    supports: { stages: false, no_answer_sms: false },
  };
}

export type HistoryKind =
  'call' | 'no_answer' | 'message' | 'meeting' | 'note' | 'payment' | 'payment_failed' | 'lead';

export interface HistoryEvent {
  /** Unique across kinds ("contact-12", "payment-4"), like contact_history_list_generator. */
  id: string;
  kind: HistoryKind;
  at: string;
  /** The staff member; null for system events. */
  author: string | null;
  /** `message`: which app. */
  channel: Channel | null;
  /** Payments and leads: what it was, localized ("Master's application consultation"). */
  title: string | null;
  text: string;
  /** The stage the contact moved the lead to. */
  stage: LeadStage | null;
}

export interface HistoryPage {
  results: HistoryEvent[];
  next: number | null;
}

/** ContactHistory.Type labels as `HistorySerializer.type` words them (classes.ContactHistory). */
const CONTACT_KIND: [string, HistoryKind][] = [
  ['تماس بی پاسخ', 'no_answer'],
  ['پیام رسان', 'message'],
  ['ایمیل', 'message'],
  ['تیکت', 'message'],
  ['جلسه مشاوره', 'meeting'],
];

/** Text after the server's "لید: " / "مشاوره: " prefix. */
const afterPrefix = (text: string) => text.slice(text.indexOf(':') + 1).trim();

function historyEvent(item: DjangoHistoryItem): HistoryEvent {
  const author = item.staff && item.staff !== '-' ? item.staff : null;
  const base = { id: item.unique_id, at: item.time, author, channel: null, stage: null };
  if (item.contact_type === '2') {
    const title = afterPrefix(item.type);
    return { ...base, kind: 'lead', title, text: [title, item.notes].filter(Boolean).join(' · ') };
  }
  if (item.contact_type === '1') {
    // ContactHistoryReservation.notes ends with "مشاور: <name>" (or "-").
    const consultant = item.notes?.split('\n').pop()?.split(':')[1]?.trim();
    return {
      ...base,
      author: consultant && consultant !== '-' ? consultant : null,
      kind: 'meeting',
      title: afterPrefix(item.type),
      text: afterPrefix(item.type),
    };
  }
  const kind = item.is_not_answered
    ? 'no_answer'
    : (CONTACT_KIND.find(([label]) => item.type.endsWith(label))?.[1] ?? 'call');
  return { ...base, kind, title: null, text: item.notes ?? '' };
}

export type CallOutcome = 'talked' | 'no_answer' | 'call_later' | 'wrong_number';

export interface ContactLog {
  channel: Channel;
  /** Calls only. */
  outcome?: CallOutcome;
  stage?: LeadStage;
  lost_reason?: LostReason;
  notes: string;
  /** Creates "my follow-up" at this time; null: none (a lost lead). */
  follow_up_at: string | null;
  email_summary: boolean;
  /** Messages: the template sent. */
  template?: number;
  /** Logging a consultation session. */
  reservation?: number;
  /** The follow-up task's text (a StaffToDo needs one). */
  follow_up_text: string;
}

const contactType = (log: ContactLog) =>
  log.channel === 'meeting'
    ? CONTACT_TYPE.consultation
    : log.channel !== 'call'
      ? CONTACT_TYPE.messenger
      : log.outcome === 'no_answer'
        ? CONTACT_TYPE.not_answered
        : CONTACT_TYPE.call;

/**
 * Logs a call, message or session as Django's ContactHistory (on the newest lead, or the session),
 * makes "my follow-up" a StaffToDo, and emails the summary (send-summery), until S16 ships. The
 * lead's stage, lost reason and the message channel aren't stored yet (S3, S7).
 */
export async function logContact(customer: number, log: ContactLog) {
  const me = await myStaffId();
  const user = await api<DjangoUserDetail>(`${userApi(customer)}/`);
  const lead = log.reservation ? null : await newestLead(user);
  const body: DjangoContactWrite = {
    user: customer,
    type: contactType(log),
    notes: log.notes,
    support_staves: [me],
    ...(log.reservation
      ? { parent_unique_id: `reservation-${String(log.reservation)}` }
      : lead
        ? { parent_unique_id: `lead-${String(lead.id)}` }
        : {}),
  };
  const contact = await api<DjangoContact>(`${userApi(customer)}/contact-history/`, {
    method: 'POST',
    body,
  });
  if (log.email_summary)
    await api(`${userApi(customer)}/contact-history/${String(contact.id)}/send-summery/`, {
      method: 'PATCH',
    });
  // No answer: try again tomorrow (S16), as the dialog says.
  const followUp =
    body.type === CONTACT_TYPE.not_answered
      ? new Date(Date.now() + 86_400_000).toISOString()
      : log.follow_up_at;
  if (followUp)
    await api(`${STAFF_API}/todos/`, {
      method: 'POST',
      body: {
        type: TODO_TYPE.lead_follow_up,
        user: customer,
        support_staves: [me],
        description: log.follow_up_text,
        deadline: djangoDate(followUp),
      } satisfies DjangoTodoWrite,
    });
}

export async function fetchHistory(id: number, pageParam: number): Promise<HistoryPage> {
  const page = await api<Page<DjangoHistoryItem>>(
    `${userApi(id)}/contact-history/history/?page=${String(pageParam)}`,
  );
  const now = new Date().toISOString();
  const events = page.results
    .flatMap((item) => [item, ...(item.subs ?? [])])
    .map(historyEvent)
    // A paid session still ahead is on the purchases tab, not in what happened.
    .filter((event) => event.at <= now);
  return { results: events.sort((a, b) => b.at.localeCompare(a.at)), next: nextPage(page.next) };
}

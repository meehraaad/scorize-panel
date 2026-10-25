import { api } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { sessionQuery } from '@/lib/auth/session';

/**
 * Django's existing staff REST API (api/user_profile/staff, the old React staff dashboard's API):
 * the panel reads and writes through it until the panel endpoints of docs/backend-changes.md ship.
 * Types are the serializers' JSON, field for field; pages map them to their own shapes.
 */

export const STAFF_API = '/profile/staff/v1';

/** DRF PageNumberPagination (api/pagination.py BaseAPIPagination: 15 per page, at most 50). */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const MAX_PAGE_SIZE = 50;

/** The `page` number in a DRF `next` link, or null on the last page. */
export function nextPage(link: string | null): number | null {
  if (!link) return null;
  const page = Number(new URL(link, 'http://x').searchParams.get('page'));
  return Number.isInteger(page) && page > 0 ? page : null;
}

/** Every page of a list endpoint (lookups: countries, exams, staff), up to `limit` pages. */
export async function allPages<T>(path: string, signal?: AbortSignal, limit = 10): Promise<T[]> {
  const join = path.includes('?') ? '&' : '?';
  const items: T[] = [];
  for (let page = 1; page <= limit; page += 1) {
    const data = await api<Page<T>>(
      `${path}${join}page=${String(page)}&page_size=${String(MAX_PAGE_SIZE)}`,
      { signal },
    );
    items.push(...data.results);
    if (!data.next) break;
  }
  return items;
}

/** The logged-in user's SupportStaff id (whoami `staff.id`). */
export async function myStaffId(): Promise<number> {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  if (!user?.staff) throw new Error('Not a staff member');
  return user.staff.id;
}

// ── Serializer shapes ────────────────────────────────────────────────────────────────────────

/** UserSerializer. */
export interface DjangoUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
}

/** DEUserSerializer (users/<id>/). */
export interface DjangoUserDetail extends DjangoUser {
  date_joined: string;
  last_login: string | null;
  /** Wallet credit, toman. */
  credit: number;
  user_referrer: DjangoUser | null;
}

/** apply.types.TeamType. */
export const TEAM = {
  sales: 0,
  executive: 1,
  marketing: 2,
  management: 3,
  support: 4,
  technical: 5,
  writing: 6,
  search: 7,
  language: 8,
} as const;

/** DSupportStaffSerializer (staves/, and nested in todos, payments, leads). */
export interface DjangoStaff {
  id: number;
  full_name: string;
  picture: string | null;
  team: number | null;
  team_display: string | null;
  user?: DjangoUser;
}

export const fullName = (user: Pick<DjangoUser, 'first_name' | 'last_name'>) =>
  `${user.first_name} ${user.last_name}`.trim();

/** StaffToDo.Type. */
export const TODO_TYPE = {
  normal: 1,
  lead_follow_up: 2,
  writing_follow_up: 3,
  payment_follow_up: 4,
  language_follow_up: 5,
  applicant_contact: 6,
} as const;

/** DStaffToDoSerializer (todos/ list); DEStaffToDoSerializer adds `views` (todos/<id>/). */
export interface DjangoTodo {
  id: number;
  type: number;
  creator: DjangoStaff | null;
  user: DjangoUser | null;
  support_staves: DjangoStaff[];
  description: string;
  creation_date: string;
  /** A date: StaffToDo has no time (backend-changes T1). */
  deadline: string;
  is_done: boolean;
  comments_count?: number;
  views?: DjangoStaff[];
}

/** StaffToDoSerializer (POST todos/, PATCH todos/<id>/). */
export interface DjangoTodoWrite {
  type: number;
  user: number | null;
  support_staves: number[];
  description: string;
  deadline: string;
}

/** DToDoCommentSerializer (todos/<id>/comments/). */
export interface DjangoTodoComment {
  id: number;
  todo: number;
  creator: DjangoStaff;
  text: string;
  creation_datetime: string;
}

/** finance.Payment.Status. */
export const PAYMENT_STATUS = [
  'pending',
  'paid',
  'paid_by_receipt',
  'expired',
  'failed',
  'pending_receipt',
  'receipt_declined',
] as const;

/** finance.FinanceType (Invoice.type). */
export const FINANCE_TYPE = {
  general: 0,
  consultation: 1,
  writing: 2,
  lottery: 3,
  campaign: 4,
  product: 5,
  service: 6,
  event: 7,
} as const;

/** PurchasableSerializer (DConsultationTypeSerializer for consultations). */
export interface DjangoPurchasable {
  id: number;
  title: string;
  price: number;
  discounted_price: number;
  is_taxed: boolean;
  /** Consultations: ConsultationType.Type (1 in person, 2 online). */
  type?: number;
}

/** DRInvoiceSerializer, nested in payments. */
export interface DjangoInvoice {
  id: number;
  type: number;
  type_display: string;
  amount: number;
  real_amount: number | null;
  amount_without_discount: number | null;
  used_credit: number | null;
  discount_code: { code: string } | null;
  purchasable: DjangoPurchasable | null;
  /** Consultations: the reservation (ConsultationReservationSerializer). */
  related: DjangoReservationRef | null;
}

/** SUDEPaymentSerializer (users/<id>/payments/). */
export interface DjangoPayment {
  id: number;
  wallet: number;
  assigned_wallet: number | null;
  handler: DjangoStaff | null;
  amount: number;
  receipt_file: string | null;
  creation_datetime: string;
  payment_date: string | null;
  description: string | null;
  status: number;
  status_display: string;
  /** Set while it waits for the online gateway. */
  authority: string | null;
  /** Written by the seller when declining a receipt; the applicant sees it. */
  decline_reason: string | null;
  used_credit: number | null;
  invoices: DjangoInvoice[];
}

/** SUDERInvoiceSerializer (users/<id>/invoices/): an invoice with its payment. */
export interface DjangoUserInvoice extends DjangoInvoice {
  payment: Omit<DjangoPayment, 'invoices'>;
}

/** ConsultationReservationSerializer. */
export interface DjangoReservationRef {
  unique_code: string;
  consultation_type: number;
  date: string;
  sent_reminder: boolean;
  sent_survey: boolean;
  meeting: number;
}

/** SDIRConsultationReservationSerializer (consultation-reservations/). */
export interface DjangoReservation extends DjangoReservationRef {
  id: number;
  assigned_staff: DjangoStaff | null;
  /** A ContactHistory exists for it. */
  is_called: boolean;
  invoice: { id: number; payment: { user: DjangoUser | null; status: number } };
}

/** DConsultationTypeSerializer (/api/consultation/v1/consultation-types/). */
export interface DjangoConsultationType extends DjangoPurchasable {
  type: number;
  type_display: string;
  is_active: boolean;
}

/** user_profile.SaleLead.Cause. */
export const LEAD_CAUSE = {
  failed_product: 1,
  failed_writing: 2,
  failed_consultation: 3,
  failed_event: 4,
  campaign: 11,
} as const;

/** DSaleLeadSerializer (sale-leads/). */
export interface DjangoLead {
  id: number;
  assigned_staff: DjangoStaff | null;
  is_called: boolean;
  user: DjangoUser;
  cause: number;
  cause_display: string;
  creation_date: string;
  description: string | null;
  campaign_registration: { campaign: { title: string } | number } | null;
}

/** user_profile.ContactHistory.Type. */
export const CONTACT_TYPE = {
  call: 0,
  consultation: 1,
  messenger: 2,
  email: 3,
  ticket: 4,
  not_answered: 5,
} as const;

/** ContactHistorySerializer (POST users/<id>/contact-history/): `user` is a body field too. */
export interface DjangoContactWrite {
  user: number;
  type: number;
  notes: string;
  support_staves: number[];
  /** "lead-<id>" or "reservation-<id>": the contact belongs to that lead or session. */
  parent_unique_id?: string;
}

/** DContactHistorySerializer. */
export interface DjangoContact {
  id: number;
  user: number;
  support_staves: DjangoStaff[];
  datetime: string;
  type: number;
  type_display: string;
  notes: string | null;
}

/**
 * HistorySerializer (users/<id>/contact-history/history/): contacts, leads and sessions, with the
 * contacts of a lead or session in `subs`. `contact_type`: '0' contact, '1' session, '2' lead.
 */
export interface DjangoHistoryItem {
  unique_id: string;
  /** Server-written, Persian ("تماس: پیام رسان", "لید: کمپین - …"). */
  type: string;
  staff: string;
  notes: string | null;
  time: string;
  id_: number;
  contact_type: '0' | '1' | '2';
  is_called: boolean;
  is_not_answered: boolean | null;
  subs?: DjangoHistoryItem[];
}

/** DUserPersonalInformationSerializer (users/<id>/personal-information/). */
export interface DjangoPersonal {
  id: number;
  first_name: string;
  last_name: string;
  father_name: string | null;
  birth_date: string | null;
  marital_status: number | null;
  gender: number | null;
  military_service_status: number | null;
  city_of_residence: string | null;
  years_of_work_experience: number;
  desired_degree: number | null;
  desired_countries: DjangoCountry[];
  new_current_degree: number | null;
  current_gpa: number | null;
  current_lang_level: string | null;
  budget: number | null;
}

/** DUserInfoSerializer (users/<id>/info/). */
export interface DjangoUserInfo {
  id: number;
  category: { id: number; name: string } | null;
  probability_of_signing_contract: number | null;
  notes: string | null;
  referred_from: string | null;
  referred_from_display: string | null;
}

/** DEducationDegreeSerializer (users/<id>/education-degrees/). */
export interface DjangoEducation {
  id: number;
  degree: number;
  degree_display: string;
  study_field: DjangoStudyField | null;
  name_of_university_or_school: string;
  year_of_graduation: number | null;
  gpa: number;
}

/**
 * DExperienceSerializer (users/<id>/experiences/): a past admission of a Scorize applicant whose
 * origin degree, field (or a sub-field) and GPA (±EXPERIENCE_GAP_TOLERANCE, 3) match one of the
 * user's education degrees, for the degree the user wants. Empty without personal information or
 * education degrees. Only the fields the panel reads.
 */
export interface DjangoExperience {
  id: number;
  university_name: string;
  country: DjangoCountry;
  degree: number;
  is_successful: boolean;
  origin_degree: number;
  origin_gpa: number;
  origin_study_field: DjangoStudyField;
}

/** DExamScoreSerializer (users/<id>/exam-scores/). */
export interface DjangoExamScore {
  id: number;
  exam: DjangoExam;
  score: number;
  is_verified: boolean;
  date_of_receipt: string | null;
  description: string | null;
}

/** ExamSerializer (/api/profile/user/v1/exams/). */
export interface DjangoExam {
  id: number;
  name: string;
  min: number;
  max: number;
}

/** DCountrySerializer (/api/apply/v1/countries/). */
export interface DjangoCountry {
  id: number;
  country: string;
  persian_name: string | null;
}

/** DStudyFieldSerializer (/api/apply/v1/study-fields/). */
export interface DjangoStudyField {
  id: number;
  name: string;
  name_persian: string | null;
}

export const COUNTRIES_API = '/apply/v1/countries';
export const STUDY_FIELDS_API = '/apply/v1/study-fields';
export const EXAMS_API = '/profile/user/v1/exams';
export const CONSULTATION_TYPES_API = '/consultation/v1/consultation-types';

/** Model choices (user_profile/enums.py, UserPersonalInformation.Budget); labels: sales `choice.*`. */
export const CHOICES = {
  gender: [1, 2],
  marital: [1, 2],
  military: [1, 2, 3, 4],
  budget: [1, 2, 3],
  /** DegreeChoices / UniversityDegreeChoices (labels: common `degree.<n>`). */
  degree: [0, 1, 2, 3],
} as const;

// ── Dates ────────────────────────────────────────────────────────────────────────────────────

const pad = (value: number) => String(value).padStart(2, '0');

/** A DateField value (YYYY-MM-DD) for the local day of `iso`. */
export function djangoDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last moment of a DateField's local day, so a date-only deadline is late only after it. */
export function endOfDay(day: string): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 23, 59, 59, 999).toISOString();
}

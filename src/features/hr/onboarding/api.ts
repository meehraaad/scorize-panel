import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { HR_KEY, type Named, staffPath } from '../api';
import { orNull } from './me';

/**
 * The new-hire form (replaces the Porsline «ثبت اطلاعات فردی» link): the hire fills it after
 * logging in, HR approves it into the staff file or returns it with a note. Django: `api/hr/v1/`
 * `me/onboarding/…` (the hire) and `staff/<id>/onboarding/…` (HR), docs/backend-changes.md OB1–OB8.
 * Off until lang ships it: `ON_SERVER.hrOnboarding`. The hire's own query is in `./me` (route data,
 * kept small for the first load).
 */

/** Open: `draft`, `returned` (the hire can edit), `submitted` (HR reviews). */
export type OnboardingStatus = 'draft' | 'submitted' | 'returned' | 'approved' | 'cancelled';
export type Gender = 'male' | 'female';
export type Education =
  'below_diploma' | 'diploma' | 'associate' | 'bachelor' | 'master' | 'doctorate';
export type MilitaryStatus =
  'not_applicable' | 'not_served' | 'student_exempt' | 'permanent_exempt' | 'completed';
export type MaritalStatus = 'single' | 'married';
export type OnboardingFileKind = 'birth_certificate' | 'national_card';

/** What the hire types. Dates are `YYYY-MM-DD`; the IBAN is `IR` + 24 digits. */
export interface OnboardingAnswers {
  first_name: string;
  last_name: string;
  preferred_name: string;
  first_name_en: string;
  last_name_en: string;
  fathers_name: string;
  national_code: string;
  /** شماره شناسنامه: 1–10 digits (newer cards carry the national code). */
  id_number: string;
  gender: Gender | null;
  /** As on the national card. */
  birth_date: string | null;
  birth_place: string;
  id_issue_place: string;
  education: Education | null;
  field_of_study: string;
  university: string;
  marital_status: MaritalStatus | null;
  number_of_children: number | null;
  military_status: MilitaryStatus | null;
  iban: string;
  bank_name: string;
  email: string;
  address: string;
  emergency_name: string;
  emergency_relation: string;
  emergency_phone: string;
}

export interface OnboardingFile {
  id: number;
  kind: OnboardingFileKind;
  name: string;
  url: string | null;
}

export interface Onboarding {
  id: number;
  status: OnboardingStatus;
  /** HR's note when it was returned. */
  note: string;
  /** When HR wants it by (the checklist step's day); null when sent on demand. */
  due: string | null;
  answers: OnboardingAnswers;
  /** Private profile suggestions for blank fields in the hire's editable form. */
  suggested_answers?: Partial<OnboardingAnswers>;
  files: OnboardingFile[];
  /** Set by HR on the file (the hire's login); shown, not edited. */
  fixed: { phone_number: string };
}

/** HR's view of a form: the same, with who and when. */
export interface OnboardingReview extends Onboarding {
  staff: Named;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** On the staff file: the latest form. */
export interface OnboardingBrief {
  id: number;
  status: OnboardingStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  note: string;
}

/** The approved details the staff file had no place for (`personal` on the file). */
export type PersonalInfo = Pick<
  OnboardingAnswers,
  | 'gender'
  | 'preferred_name'
  | 'first_name_en'
  | 'last_name_en'
  | 'id_issue_place'
  | 'education'
  | 'field_of_study'
  | 'university'
  | 'military_status'
  | 'iban'
  | 'bank_name'
  | 'emergency_name'
  | 'emergency_relation'
  | 'emergency_phone'
>;

export const onboardingPath = (staffId: number, action = '') =>
  staffPath(staffId, `onboarding/${action ? `${action}/` : ''}`);

/** A staff member's latest form, for HR. */
export const onboardingQuery = (staffId: number) =>
  queryOptions({
    queryKey: [...HR_KEY, 'onboarding', staffId],
    queryFn: ({ signal }) => orNull(api<OnboardingReview>(onboardingPath(staffId), { signal })),
  });

/** A study field (`apply/v1/study-fields/`): the majors the site knows, with their sub-fields. */
interface StudyFieldRow {
  id: number;
  name: string;
  name_persian: string | null;
  parent?: { id: number } | null;
}

/**
 * Majors matching what the hire typed, for suggestions only: top-level ones (`?top=1`, OB15; the
 * `parent` filter stays for an older server), by their Persian name. Nothing is ever created here:
 * the answer stays the typed text.
 */
export const majorsQuery = (search: string) =>
  queryOptions({
    queryKey: ['study-fields', 'top', search],
    queryFn: ({ signal }) =>
      api<Page<StudyFieldRow>>(
        `/apply/v1/study-fields/?top=1&search=${encodeURIComponent(search)}`,
        {
          signal,
        },
      ),
    select: (page) => [
      ...new Set(
        page.results
          .filter((row) => !row.parent)
          .map((row) => (row.name_persian ?? row.name).trim())
          .filter(Boolean),
      ),
    ],
    staleTime: 5 * 60_000,
  });

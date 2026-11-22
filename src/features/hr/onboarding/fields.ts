import { isLatinName, isPersianText, normalizeIban, normalizeNationalCode } from '@/lib/identity';
import { normalizePhone, toLatinDigits } from '@/lib/text';
import type {
  Education,
  Gender,
  MaritalStatus,
  MilitaryStatus,
  OnboardingAnswers,
  OnboardingFile,
  OnboardingFileKind,
} from './api';

/** The choices, in the order the form offers them. */

export const GENDERS: readonly Gender[] = ['male', 'female', 'unspecified'];
export const EDUCATIONS: readonly Education[] = [
  'below_diploma',
  'diploma',
  'associate',
  'bachelor',
  'master',
  'doctorate',
];
export const MILITARY: readonly MilitaryStatus[] = [
  'not_applicable',
  'not_served',
  'student_exempt',
  'permanent_exempt',
  'completed',
];
export const MARITAL: readonly MaritalStatus[] = ['single', 'married'];
export const FILE_KINDS: readonly OnboardingFileKind[] = ['birth_certificate', 'national_card'];

/**
 * The new-hire form, field by field: its section, how it is typed and checked. The page draws from
 * this table and the same rules run before sending (Django checks them again: OB7).
 */
export type Section = 'identity' | 'education' | 'bank' | 'contact' | 'emergency' | 'documents';
export const SECTIONS: readonly Section[] = [
  'identity',
  'education',
  'bank',
  'contact',
  'emergency',
  'documents',
];

export type FieldKey = keyof OnboardingAnswers;
export type Rule = 'persian' | 'latin' | 'nationalCode' | 'iban' | 'mobile' | 'email' | 'text';
export type Problem =
  | 'required'
  | 'persian'
  | 'latin'
  | 'nationalCode'
  | 'iban'
  | 'mobile'
  | 'email'
  | 'future'
  | 'files';

export interface FieldSpec {
  key: FieldKey;
  section: Section;
  kind: 'text' | 'longtext' | 'date' | 'choice' | 'number';
  rule?: Rule;
  /** Typed left to right (Latin names, digits, email). */
  ltr?: boolean;
  max?: number;
}

export const FIELDS: readonly FieldSpec[] = [
  { key: 'first_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'last_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'preferred_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'first_name_en', section: 'identity', kind: 'text', rule: 'latin', ltr: true, max: 100 },
  { key: 'last_name_en', section: 'identity', kind: 'text', rule: 'latin', ltr: true, max: 100 },
  { key: 'fathers_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'national_code', section: 'identity', kind: 'text', rule: 'nationalCode', ltr: true },
  { key: 'gender', section: 'identity', kind: 'choice' },
  { key: 'birth_date', section: 'identity', kind: 'date' },
  { key: 'real_birth_date', section: 'identity', kind: 'date' },
  { key: 'birth_place', section: 'identity', kind: 'text', rule: 'persian', max: 64 },
  { key: 'id_issue_place', section: 'identity', kind: 'text', rule: 'persian', max: 64 },
  { key: 'education', section: 'education', kind: 'choice' },
  { key: 'field_of_study', section: 'education', kind: 'text', rule: 'text', max: 100 },
  { key: 'university', section: 'education', kind: 'text', rule: 'text', max: 100 },
  { key: 'marital_status', section: 'education', kind: 'choice' },
  { key: 'number_of_children', section: 'education', kind: 'number' },
  { key: 'military_status', section: 'education', kind: 'choice' },
  { key: 'iban', section: 'bank', kind: 'text', rule: 'iban', ltr: true },
  { key: 'bank_name', section: 'bank', kind: 'text', rule: 'persian', max: 64 },
  { key: 'email', section: 'contact', kind: 'text', rule: 'email', ltr: true, max: 254 },
  { key: 'address', section: 'contact', kind: 'longtext', rule: 'text', max: 1000 },
  { key: 'emergency_name', section: 'emergency', kind: 'text', rule: 'persian', max: 100 },
  { key: 'emergency_relation', section: 'emergency', kind: 'text', rule: 'persian', max: 64 },
  { key: 'emergency_phone', section: 'emergency', kind: 'text', rule: 'mobile', ltr: true },
];

export const MAX_CHILDREN = 20;
const OPTIONAL = new Set<FieldKey>(['preferred_name', 'real_birth_date']);
/** No field of study or university below a diploma. */
const NO_STUDIES = new Set<Education | null>(['below_diploma', null]);

/** Whether the field is asked at all with these answers. */
export const isAsked = (key: FieldKey, answers: OnboardingAnswers) =>
  !((key === 'field_of_study' || key === 'university') && NO_STUDIES.has(answers.education));

export const isRequired = (key: FieldKey, answers: OnboardingAnswers) =>
  isAsked(key, answers) && !OPTIONAL.has(key);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A typed value checked by its rule: the value to send (digits made Latin) or what is wrong. */
function checkText(rule: Rule, raw: string): { value: string } | { problem: Problem } {
  const value = raw.trim();
  switch (rule) {
    case 'persian':
      return isPersianText(value) ? { value } : { problem: 'persian' };
    case 'latin':
      return isLatinName(value) ? { value } : { problem: 'latin' };
    case 'nationalCode': {
      const code = normalizeNationalCode(value);
      return code ? { value: code } : { problem: 'nationalCode' };
    }
    case 'iban': {
      const iban = normalizeIban(value);
      return iban ? { value: iban } : { problem: 'iban' };
    }
    case 'mobile': {
      const phone = normalizePhone(value);
      return phone ? { value: phone } : { problem: 'mobile' };
    }
    case 'email':
      return EMAIL.test(value) ? { value: value.toLowerCase() } : { problem: 'email' };
    case 'text':
      return { value: toLatinDigits(value) };
  }
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && !value.trim());

/** Today as `YYYY-MM-DD` (local). */
function today() {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface Checked {
  /** The answers as they are sent: trimmed, Latin digits, not-asked fields emptied. */
  answers: OnboardingAnswers;
  problems: Partial<Record<FieldKey | 'files', Problem>>;
}

/**
 * Every rule of the form. `complete`: also what is required (on submit); without it only what was
 * typed is checked (a draft keeps half-filled fields).
 */
export function checkAnswers(
  answers: OnboardingAnswers,
  files: readonly OnboardingFile[],
  complete: boolean,
): Checked {
  const clean: OnboardingAnswers = { ...answers };
  const problems: Checked['problems'] = {};
  const set = (key: FieldKey, value: string) => {
    (clean as unknown as Record<FieldKey, unknown>)[key] = value;
  };
  for (const field of FIELDS) {
    const { key } = field;
    const value = answers[key];
    if (!isAsked(key, answers)) {
      if (field.kind === 'text') set(key, '');
      continue;
    }
    if (isEmpty(value)) {
      if (complete && isRequired(key, answers)) problems[key] = 'required';
      continue;
    }
    if (typeof value === 'string' && field.rule) {
      const result = checkText(field.rule, value);
      if ('problem' in result) problems[key] = result.problem;
      else set(key, result.value);
    }
    if (field.kind === 'date' && typeof value === 'string' && value > today())
      problems[key] = 'future';
    if (field.kind === 'number' && typeof value === 'number' && (value < 0 || value > MAX_CHILDREN))
      problems[key] = 'required';
  }
  if (complete && FILE_KINDS.some((kind) => !files.some((file) => file.kind === kind)))
    problems.files = 'files';
  return { answers: clean, problems };
}

/** How many of a section's asked fields are filled (documents: kinds with a file), for progress. */
export function sectionProgress(
  section: Section,
  answers: OnboardingAnswers,
  files: readonly OnboardingFile[],
) {
  if (section === 'documents') {
    const done = FILE_KINDS.filter((kind) => files.some((file) => file.kind === kind)).length;
    return { done, total: FILE_KINDS.length };
  }
  const asked = FIELDS.filter(
    (field) => field.section === section && isRequired(field.key, answers),
  );
  return {
    done: asked.filter((field) => !isEmpty(answers[field.key])).length,
    total: asked.length,
  };
}

/** The empty form, before Django's prefill. */
export const EMPTY_ANSWERS: OnboardingAnswers = {
  first_name: '',
  last_name: '',
  preferred_name: '',
  first_name_en: '',
  last_name_en: '',
  fathers_name: '',
  national_code: '',
  gender: null,
  birth_date: null,
  real_birth_date: null,
  birth_place: '',
  id_issue_place: '',
  education: null,
  field_of_study: '',
  university: '',
  marital_status: null,
  number_of_children: null,
  military_status: null,
  iban: '',
  bank_name: '',
  email: '',
  address: '',
  emergency_name: '',
  emergency_relation: '',
  emergency_phone: '',
};

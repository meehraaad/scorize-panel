import {
  isLatinName,
  isPersianText,
  normalizeIban,
  normalizeIdNumber,
  normalizeNationalCode,
} from '@/lib/identity';
import { normalizePhone } from '@/lib/text';
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

export const GENDERS: readonly Gender[] = ['male', 'female'];
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
export type Rule =
  'persian' | 'latin' | 'nationalCode' | 'idNumber' | 'iban' | 'mobile' | 'email' | 'text';
export type Problem =
  | 'required'
  | 'persian'
  | 'latin'
  | 'nationalCode'
  | 'idNumber'
  | 'iban'
  | 'mobile'
  | 'email'
  | 'future'
  | 'age'
  | 'special'
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
  // Two to a row on wide screens: names, then preferred and father's name, the English names,
  // the two numbers, gender and birth date, the two places.
  { key: 'first_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'last_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'preferred_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'fathers_name', section: 'identity', kind: 'text', rule: 'persian', max: 100 },
  { key: 'first_name_en', section: 'identity', kind: 'text', rule: 'latin', ltr: true, max: 100 },
  { key: 'last_name_en', section: 'identity', kind: 'text', rule: 'latin', ltr: true, max: 100 },
  {
    key: 'national_code',
    section: 'identity',
    kind: 'text',
    rule: 'nationalCode',
    ltr: true,
    max: 20,
  },
  { key: 'id_number', section: 'identity', kind: 'text', rule: 'idNumber', ltr: true, max: 20 },
  { key: 'gender', section: 'identity', kind: 'choice' },
  { key: 'birth_date', section: 'identity', kind: 'date' },
  { key: 'birth_place', section: 'identity', kind: 'text', rule: 'persian', max: 64 },
  { key: 'id_issue_place', section: 'identity', kind: 'text', rule: 'persian', max: 64 },
  { key: 'education', section: 'education', kind: 'choice' },
  { key: 'field_of_study', section: 'education', kind: 'text', rule: 'text', max: 100 },
  { key: 'university', section: 'education', kind: 'text', rule: 'text', max: 100 },
  { key: 'marital_status', section: 'education', kind: 'choice' },
  { key: 'number_of_children', section: 'education', kind: 'number' },
  { key: 'military_status', section: 'education', kind: 'choice' },
  { key: 'iban', section: 'bank', kind: 'text', rule: 'iban', ltr: true, max: 40 },
  { key: 'bank_name', section: 'bank', kind: 'text', rule: 'persian', max: 64 },
  { key: 'email', section: 'contact', kind: 'text', rule: 'email', ltr: true, max: 254 },
  { key: 'address', section: 'contact', kind: 'longtext', rule: 'text', max: 1000 },
  { key: 'emergency_name', section: 'emergency', kind: 'text', rule: 'persian', max: 100 },
  { key: 'emergency_relation', section: 'emergency', kind: 'text', rule: 'persian', max: 64 },
  {
    key: 'emergency_phone',
    section: 'emergency',
    kind: 'text',
    rule: 'mobile',
    ltr: true,
    max: 20,
  },
];

export const MAX_CHILDREN = 20;
/** Files on one form at most (Django refuses the next upload). */
export const MAX_FILES = 10;
/** The ages a birth date may give (Django: `MIN_AGE`, `MAX_AGE`). */
export const MIN_AGE = 15;
export const MAX_AGE = 100;
const OPTIONAL = new Set<FieldKey>(['preferred_name']);
/** No field of study or university below a diploma. */
const NO_STUDIES = new Set<Education | null>(['below_diploma', null]);

/** Whether the field is asked at all with these answers. */
export const isAsked = (key: FieldKey, answers: OnboardingAnswers) =>
  !((key === 'field_of_study' || key === 'university') && NO_STUDIES.has(answers.education));

export const isRequired = (key: FieldKey, answers: OnboardingAnswers) =>
  isAsked(key, answers) && !OPTIONAL.has(key);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// eslint-disable-next-line no-control-regex -- what no typed answer has (Django: `CONTROL`)
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Whether the answer has characters nobody types (a newline is fine only in the address). */
const hasControl = (key: FieldKey, value: string) =>
  CONTROL.test(key === 'address' ? value.replace(/\n/g, '') : value);

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
    case 'idNumber': {
      const number = normalizeIdNumber(value);
      return number ? { value: number } : { problem: 'idNumber' };
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
      // Free text (address, university) is kept as typed, Persian digits too: Django only
      // normalises the numbers (national code, ID card number, IBAN, phone).
      return { value };
  }
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && !value.trim());

const dayValue = (year: number, month: number, day: number) =>
  `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Today as `YYYY-MM-DD` (local). */
const today = () => yearsAgo(0);

/** `YYYY-MM-DD` the given number of years before today; 29 February falls on the 28th. */
export function yearsAgo(years: number) {
  const now = new Date();
  const year = now.getFullYear() - years;
  const month = now.getMonth() + 1;
  const leap = new Date(year, 1, 29).getMonth() === 1;
  const day = month === 2 && now.getDate() === 29 && !leap ? 28 : now.getDate();
  return dayValue(year, month, day);
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
    if (typeof value === 'string' && field.kind !== 'date' && hasControl(key, value)) {
      problems[key] = 'special';
      continue;
    }
    if (typeof value === 'string' && field.rule) {
      const result = checkText(field.rule, value);
      if ('problem' in result) problems[key] = result.problem;
      else set(key, result.value);
    }
    if (field.kind === 'date' && typeof value === 'string') {
      if (value > today()) problems[key] = 'future';
      else if (value > yearsAgo(MIN_AGE) || value < yearsAgo(MAX_AGE)) problems[key] = 'age';
    }
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
  id_number: '',
  gender: null,
  birth_date: null,
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

import { normalizePhone, toLatinDigits } from '@/lib/text';
import { PROFILE_FIELDS, type ContractData, type ProfileField } from '../api';

export type Problem = 'required' | 'email' | 'mobile' | 'phone' | 'tenDigits' | 'latin';

export interface FieldRule {
  /** Written left to right (Latin letters, numbers). */
  ltr: boolean;
  input: 'text' | 'email' | 'tel' | 'numeric';
  autoComplete?: string;
  /** The value to send, or why it can't be sent. */
  check: (value: string) => { value: string } | { problem: Problem };
}

const digitsOnly = (value: string) => toLatinDigits(value).replace(/[\s\-()]/g, '');

const required =
  (next: FieldRule['check']): FieldRule['check'] =>
  (value) =>
    value.trim() ? next(value.trim()) : { problem: 'required' };

export const RULES: Partial<Record<ProfileField, FieldRule>> = {
  phone: {
    ltr: true,
    input: 'tel',
    autoComplete: 'tel',
    check: required((value) => {
      const phone = normalizePhone(value);
      return phone ? { value: phone } : { problem: 'mobile' };
    }),
  },
  national_id: {
    ltr: true,
    input: 'numeric',
    check: required((value) =>
      /^\d{10}$/.test(digitsOnly(value)) ? { value: digitsOnly(value) } : { problem: 'tenDigits' },
    ),
  },
  passport_name: {
    ltr: true,
    input: 'text',
    check: required((value) =>
      /^[A-Za-z][A-Za-z .'-]*$/.test(value) ? { value } : { problem: 'latin' },
    ),
  },
  postal_code: {
    ltr: true,
    input: 'numeric',
    autoComplete: 'postal-code',
    check: required((value) =>
      /^\d{10}$/.test(digitsOnly(value)) ? { value: digitsOnly(value) } : { problem: 'tenDigits' },
    ),
  },
  home_phone: {
    ltr: true,
    input: 'tel',
    check: required((value) =>
      /^0\d{10}$/.test(digitsOnly(value)) ? { value: digitsOnly(value) } : { problem: 'phone' },
    ),
  },
  address_en: {
    ltr: true,
    input: 'text',
    check: required((value) => (/^[\x20-\x7E\n]+$/.test(value) ? { value } : { problem: 'latin' })),
  },
  relative_name: { ltr: false, input: 'text', check: required((value) => ({ value })) },
  relative_phone: {
    ltr: true,
    input: 'tel',
    check: required((value) => {
      const phone = normalizePhone(value);
      return phone ? { value: phone } : { problem: 'mobile' };
    }),
  },
  relative_email: {
    ltr: true,
    input: 'email',
    check: required((value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { value } : { problem: 'email' },
    ),
  },
};

/** Details the applicant can fill and hasn't yet (the team asks for them). */
export function missingDetails(contract: ContractData): ProfileField[] {
  const editable = new Set(contract.editable);
  return PROFILE_FIELDS.filter(
    (field) => editable.has(field) && RULES[field] && !contract.profile[field],
  );
}

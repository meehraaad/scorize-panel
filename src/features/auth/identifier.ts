import { normalizePhone, toLatinDigits } from '@/lib/text';
import type { Identifier } from './api';

// Shared with the rest of the panel; re-exported for the login flow and its tests.
export { normalizePhone, toLatinDigits };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string | null {
  const email = toLatinDigits(input).trim();
  return EMAIL.test(email) ? email : null;
}

/** One field accepts a mobile number or an email address. */
export function parseIdentifier(input: string): Identifier | null {
  if (input.includes('@')) {
    const email = normalizeEmail(input);
    return email ? { type: 'email', value: email } : null;
  }
  const phone = normalizePhone(input);
  return phone ? { type: 'phone', value: phone } : null;
}

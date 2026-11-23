import { toLatinDigits } from './text';

/**
 * Checks for identity and bank details (the new-hire form). Apart from `./text`, which the first
 * load carries: these come only with the pages that use them.
 */
/** Persian letters, spaces and half-spaces only (names, places): the same set Django checks. */
export const isPersianText = (value: string) => /^[‌ ء-ی]+$/.test(value.trim());

/** Latin letters, spaces and the marks names use (O'Neil, Anne-Marie). */
export const isLatinName = (value: string) => /^[A-Za-z][A-Za-z .'-]*$/.test(value.trim());

/**
 * An Iranian national code (کد ملی) typed with any digits: its 10 Latin digits when the check digit
 * is right, else null. Ten equal digits pass the sum but are never issued.
 */
export function normalizeNationalCode(input: string): string | null {
  const code = toLatinDigits(input).replace(/[\s\-()]/g, '');
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return null;
  const digits = Array.from({ length: 10 }, (_, index) => Number(code.charAt(index)));
  const sum = digits.slice(0, 9).reduce((total, digit, index) => total + digit * (10 - index), 0);
  const rest = sum % 11;
  const check = rest < 2 ? rest : 11 - rest;
  return digits[9] === check ? code : null;
}

/**
 * An Iranian IBAN (شبا) typed with or without `IR`, spaces or Persian digits: `IR` + 24 digits when
 * its check (ISO 13616, mod 97) is right, else null.
 */
export function normalizeIban(input: string): string | null {
  const compact = toLatinDigits(input)
    .replace(/[\s\-()]/g, '')
    .toUpperCase();
  const digits = compact.startsWith('IR') ? compact.slice(2) : compact;
  if (!/^\d{24}$/.test(digits)) return null;
  // IR + check digits move to the end; I = 18, R = 27.
  const rearranged = `${digits.slice(2)}1827${digits.slice(0, 2)}`;
  let rest = 0;
  for (const digit of rearranged) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1 ? `IR${digits}` : null;
}

/**
 * An ID card number (شماره شناسنامه) typed with any digits: 1 to 10 Latin digits (newer cards carry
 * the national code), else null.
 */
export function normalizeIdNumber(input: string): string | null {
  const number = toLatinDigits(input).replace(/[\s\-()]/g, '');
  return /^\d{1,10}$/.test(number) ? number : null;
}

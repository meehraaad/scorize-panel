const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Persian and Arabic-Indic digits → ASCII, so "۰۹۱۲…" typed on a Persian keyboard works. */
export function toLatinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    return String(persian >= 0 ? persian : ARABIC_DIGITS.indexOf(digit));
  });
}

/** A typed number as ASCII: Persian digits and the Persian or Arabic decimal sign ("۱۷٫۲۵" → "17.25"). */
export function toLatinNumber(value: string) {
  return toLatinDigits(value).replace(/[٫,]/g, '.');
}

/** Same pattern as Django's PHONE_NUMBER_PATTERN. */
const IRAN_MOBILE = /^09\d{9}$/;

/** Accepts 09…, 9…, +98 9…, 0098 9… with spaces or dashes; returns 09xxxxxxxxx or null. */
export function normalizePhone(input: string): string | null {
  let digits = toLatinDigits(input).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+98')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('0098')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('98') && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith('9') && digits.length === 10) digits = `0${digits}`;
  return IRAN_MOBILE.test(digits) ? digits : null;
}

/** The first letter of a name, for avatars. */
export const initialOf = (name: string) => Array.from(name.trim())[0] ?? '';

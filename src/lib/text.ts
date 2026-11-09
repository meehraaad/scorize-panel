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

/**
 * Text folded for searching on the device: Arabic ي/ك as Persian ی/ک, no half-spaces or
 * diacritics, ASCII digits, lower case and single spaces. Both the query and the text go through it.
 */
export function searchKey(value: string) {
  return toLatinDigits(value)
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ً-ْٰ‌‏‎]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Whether every word of `query` is in one of `fields` (folded with `searchKey`). */
export function matchesSearch(query: string, ...fields: string[]) {
  const words = searchKey(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const text = searchKey(fields.join(' '));
  return words.every((word) => text.includes(word));
}

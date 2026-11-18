import { toLatinDigits } from '@/lib/text';

/** A number of 0 or more typed in any digits (with «٫» or «,» as the point), or null. */
export const parseNumber = (value: string) => {
  const text = toLatinDigits(value).trim().replace(/[٫,]/g, '.');
  const parsed = Number(text);
  return text && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/** The same, below zero too («−5» or «-5»). */
export function parseSigned(value: string) {
  const negative = /^\s*[-−]/.test(value);
  const parsed = parseNumber(value.trim().replace(/^[-−]/, ''));
  return parsed === null ? null : negative ? -parsed : parsed;
}

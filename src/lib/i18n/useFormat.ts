import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALES, isLocale } from './config';

/**
 * Locale-aware formatting built on Intl (no date library in the bundle).
 * Persian gets the Jalali calendar and Persian digits automatically.
 */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const tag = LOCALES[locale].intl;

  return useMemo(() => {
    const date = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' });
    const dateShort = new Intl.DateTimeFormat(tag, { month: 'long', day: 'numeric' });
    const number = new Intl.NumberFormat(tag);
    const relative = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });

    return {
      date: (value: Date | string) => date.format(new Date(value)),
      dateShort: (value: Date | string) => dateShort.format(new Date(value)),
      number: (value: number) => number.format(value),
      money: (value: number, currency: string) =>
        new Intl.NumberFormat(tag, {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(value),
      relativeDays: (days: number) => relative.format(days, 'day'),
      /** Digits inside a string (phone numbers, codes) in the locale's numerals. */
      digits: (value: string) => value.replace(/\d/g, (digit) => number.format(Number(digit))),
    };
  }, [tag]);
}

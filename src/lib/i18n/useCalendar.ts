import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarKind } from '@/lib/calendar';
import { DEFAULT_LOCALE, LOCALES, isLocale } from './config';

/**
 * The calendar of the current language for drawing a month (date and time pickers): Persian
 * (Jalali) for Persian, else Gregorian, with its direction and the formatters a month grid needs.
 */
export function useCalendar() {
  const { i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const { intl, dir } = LOCALES[locale];
  const kind = calendarKind(locale);
  return useMemo(
    () => ({
      kind,
      rtl: dir === 'rtl',
      month: new Intl.DateTimeFormat(intl, { month: 'long' }),
      year: new Intl.DateTimeFormat(intl, { year: 'numeric' }),
      weekday: new Intl.DateTimeFormat(intl, { weekday: 'narrow' }),
      weekdayLong: new Intl.DateTimeFormat(intl, { weekday: 'long' }),
      number: new Intl.NumberFormat(intl, { useGrouping: false }),
      twoDigits: new Intl.NumberFormat(intl, { minimumIntegerDigits: 2, useGrouping: false }),
    }),
    [kind, dir, intl],
  );
}

/** The calendar a language uses (outside components: route data). */
export function calendarKind(language: string): CalendarKind {
  const locale = isLocale(language) ? language : DEFAULT_LOCALE;
  return LOCALES[locale].intl.includes('ca-persian') ? 'persian' : 'gregorian';
}

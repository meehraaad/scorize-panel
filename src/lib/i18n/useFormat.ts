import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from './config';

/**
 * Locale-aware formatting built on Intl (no date library in the bundle).
 * Persian gets the Jalali calendar and Persian digits automatically.
 */
/** Django's code for the toman (not in ISO 4217). */
export const TOMAN = 'IRT';

export function useFormat() {
  const { i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  return formatFor(locale);
}

type Format = ReturnType<typeof makeFormat>;

/*
 * Building Intl formatters is slow (about 1 ms for the set below, more on phones), and useFormat
 * runs in every row of a list: build each locale's set once and share it.
 */
const formats = new Map<Locale, Format>();

function formatFor(locale: Locale) {
  let format = formats.get(locale);
  if (!format) {
    format = makeFormat(locale);
    formats.set(locale, format);
  }
  return format;
}

function makeFormat(locale: Locale) {
  const tag = LOCALES[locale].intl;
  // Formatters that depend on a currency or unit, built on first use.
  const extra = new Map<string, Intl.NumberFormat>();
  const numberFormat = (key: string, options: Intl.NumberFormatOptions) => {
    let format = extra.get(key);
    if (!format) {
      format = new Intl.NumberFormat(tag, options);
      extra.set(key, format);
    }
    return format;
  };
  const date = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' });
  const dateShort = new Intl.DateTimeFormat(tag, { month: 'long', day: 'numeric' });
  const monthOnly = new Intl.DateTimeFormat(tag, { month: 'long' });
  const yearOnly = new Intl.DateTimeFormat(tag, { year: 'numeric' });
  const number = new Intl.NumberFormat(tag);
  const relative = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
  const time = new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' });
  const weekday = new Intl.DateTimeFormat(tag, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const weekdayName = new Intl.DateTimeFormat(tag, { weekday: 'long' });
  const list = new Intl.ListFormat(tag, { type: 'conjunction' });
  const gregorian = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return {
    date: (value: Date | string) => date.format(new Date(value)),
    dateShort: (value: Date | string) => dateShort.format(new Date(value)),
    /** "Monday". */
    weekdayName: (value: Date | string) => weekdayName.format(new Date(value)),
    /** The day and the month name apart, for a calendar tile ("12" over "Aban"). */
    dayMonth: (value: Date | string) => {
      const parts = dateShort.formatToParts(new Date(value));
      return {
        day: parts.find((part) => part.type === 'day')?.value ?? '',
        month: parts.find((part) => part.type === 'month')?.value ?? '',
      };
    },
    /** "Aban": a month's name alone (chart axes). */
    month: (value: Date | string) => monthOnly.format(new Date(value)),
    /** "Aban 1405" (month first: CLDR puts the year first in Persian). */
    monthYear: (value: Date | string) =>
      `${monthOnly.format(new Date(value))} ${yearOnly.format(new Date(value))}`,
    /**
     * The same date as universities publish it ("23 Nov 2026"), for locales whose calendar
     * isn't Gregorian; null where `date` already is.
     */
    gregorian: (value: Date | string) =>
      tag.includes('-ca-') ? gregorian.format(new Date(value)) : null,
    /** "12 Azar 1405, 09:30". */
    dateTime: (value: Date | string) =>
      `${date.format(new Date(value))} · ${time.format(new Date(value))}`,
    /** "Monday 28 Mehr" (day separators in a conversation). */
    weekday: (value: Date | string) => weekday.format(new Date(value)),
    /** "16:48". */
    time: (value: Date | string) => time.format(new Date(value)),
    number: (value: number) => number.format(value),
    /**
     * "Canada and Germany". Persian is joined by hand: CLDR puts a comma before «و»
     * («الف، ب، و ج»), which Persian writing doesn't use («الف، ب و ج»).
     */
    list: (values: string[]) =>
      locale === 'fa' && values.length > 1
        ? `${values.slice(0, -1).join('، ')} و ${values.at(-1) ?? ''}`
        : list.format(values),
    /** "125 Canadian dollars": the currency spelled out, as people say it. */
    moneyName: (value: number, currency: string) =>
      numberFormat(`name-${currency}`, {
        style: 'currency',
        currency,
        currencyDisplay: 'name',
        maximumFractionDigits: 0,
      }).format(value),
    /** "2 hours ago" within a day, else "yesterday, 18:20" / "3 days ago, 18:20". */
    timeAgo: (value: Date | string) => {
      const then = new Date(value);
      const minutes = Math.round((then.getTime() - Date.now()) / 60_000);
      if (minutes > -1) return relative.format(0, 'second');
      if (minutes > -60) return relative.format(minutes, 'minute');
      if (minutes > -24 * 60) return relative.format(Math.round(minutes / 60), 'hour');
      const days = Math.round(minutes / (24 * 60));
      return `${relative.format(days, 'day')} ${time.format(then)}`;
    },
    money: (value: number, currency: string) =>
      numberFormat(currency, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
        value,
      ),
    /**
     * An amount in its own currency: the toman (Django's `IRT`, or none given) through the
     * page's own "{{amount}} toman" text, anything else (EUR, CAD…) as Intl formats it.
     */
    price: (value: number, currency: string | null, toman: (amount: string) => string) =>
      currency && currency !== TOMAN
        ? numberFormat(currency, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
            value,
          )
        : toman(number.format(value)),
    relativeDays: (days: number) => relative.format(days, 'day'),
    /** "2.4 megabytes", "350 kilobytes". */
    fileSize: (bytes: number) => {
      const megabytes = bytes / (1024 * 1024);
      const [value, unit] = megabytes >= 0.1 ? [megabytes, 'megabyte'] : [bytes / 1024, 'kilobyte'];
      return numberFormat(`unit-${unit}`, {
        style: 'unit',
        unit,
        unitDisplay: 'long',
        maximumFractionDigits: 1,
      }).format(value);
    },
    /** Digits inside a string (phone numbers, codes) in the locale's numerals. */
    digits: (value: string) => value.replace(/\d/g, (digit) => number.format(Number(digit))),
  };
}

/**
 * Wraps text the user typed (or any text of unknown direction) in Unicode isolates before it goes
 * into a translated sentence, so "«Machine Learning» …" keeps its order inside Persian.
 */
export function isolate(text: string) {
  return `⁨${text}⁩`;
}

import i18n from './index';
import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

/**
 * Text built outside React (the API mappers), in the current language. Cached queries are
 * refetched when the language changes (lib/api/queryClient.ts), so these stay in step.
 */
const currentLocale = (): Locale => (isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE);

/** "A، B" in Persian, "A, B" otherwise. */
export const joinNames = (values: string[]) => values.join(currentLocale() === 'fa' ? '، ' : ', ');

/** Django's Persian name in Persian, its English name otherwise; either falls back to the other. */
export const localName = (english: string, persian: string | null) =>
  (currentLocale() === 'fa' ? persian || english : english || persian) ?? '';

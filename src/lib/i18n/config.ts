export const LOCALES = {
  fa: { dir: 'rtl', intl: 'fa-IR-u-ca-persian', nativeName: 'فارسی' },
  en: { dir: 'ltr', intl: 'en-GB', nativeName: 'English' },
} as const;

export type Locale = keyof typeof LOCALES;

export const DEFAULT_LOCALE: Locale = 'fa';
// Same key the pre-paint script in index.html reads.
export const LOCALE_STORAGE_KEY = 'scorize.lang';
// Django's LANGUAGE_COOKIE_NAME, so the backend answers (emails, API errors) in the same language.
export const DJANGO_LANGUAGE_COOKIE = 'django_language';

/**
 * `common` ships with the app; every other namespace belongs to one feature and is loaded with that
 * feature's route (see `page()` in src/app/router.tsx).
 */
export const NAMESPACES = [
  'common',
  'auth',
  'home',
  'applications',
  'documents',
  'writing',
  'tickets',
  'contract',
  'turkey',
  'sales',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && value in LOCALES;
}

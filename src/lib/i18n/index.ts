import i18n, { type BackendModule, type ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import faCommon from '@/locales/fa/common.json';
import {
  DEFAULT_LOCALE,
  DJANGO_LANGUAGE_COOKIE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  isLocale,
  type Locale,
} from './config';

// The default language ships in the main bundle (no extra request on first paint);
// every other language/namespace is its own chunk, fetched on demand.
const lazyDictionaries = import.meta.glob<{ default: ResourceKey }>([
  '../../locales/*/*.json',
  '!../../locales/fa/common.json',
]);

const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = lazyDictionaries[`../../locales/${language}/${namespace}.json`];
    if (!load) {
      callback(new Error(`Missing dictionary: ${language}/${namespace}`), false);
      return;
    }
    load().then(
      (module) => callback(null, module.default),
      (error: unknown) => callback(error as Error, false),
    );
  },
};

function readStoredLocale(): Locale {
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function applyLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = LOCALES[locale].dir;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  document.cookie = `${DJANGO_LANGUAGE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

i18n.on('languageChanged', (language) => {
  if (isLocale(language)) applyLocale(language);
});

void i18n
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
    lng: readStoredLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: Object.keys(LOCALES),
    ns: ['common'], // feature namespaces load with their route
    defaultNS: 'common',
    resources: { fa: { common: faCommon } },
    partialBundledLanguages: true,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
    react: { useSuspense: true },
  });

export default i18n;

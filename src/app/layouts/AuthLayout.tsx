import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { LOCALES, type Locale } from '@/lib/i18n/config';

/**
 * Frame for pages outside the panels: login, sign-up, password reset, and later the
 * "accept terms" / "panel inactive" screens. Brand on top, a narrow column, language switch below.
 */
export function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-10 pb-6 sm:justify-center sm:pt-6">
      <main className="flex w-full max-w-[440px] flex-col gap-6">
        <a href="/" className="flex items-center gap-2.5 self-center text-text">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-on-primary">
            S
          </span>
          <span dir="ltr" className="text-xl font-bold tracking-tight">
            {t('app.name')}
          </span>
        </a>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <LanguageSwitch />
    </div>
  );
}

function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <footer className="mt-auto flex justify-center pt-8 text-sm text-text-2 sm:mt-8">
      <nav aria-label={t('settings.language')} className="flex gap-1">
        {(Object.keys(LOCALES) as Locale[]).map((locale) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={i18n.language === locale}
            onClick={() => void i18n.changeLanguage(locale)}
            className="min-h-11 rounded-full px-3 aria-pressed:font-semibold aria-pressed:text-text"
          >
            {LOCALES[locale].nativeName}
          </button>
        ))}
      </nav>
    </footer>
  );
}

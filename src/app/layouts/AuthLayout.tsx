import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE, SUPPORT_PHONE, formatPhone } from '@/lib/site';
import { TrustHeader, TrustWall } from './TrustWall';

/**
 * Frame for pages outside the panels: login, sign-up, password reset, and later the
 * "accept terms" / "panel inactive" screens.
 * Desktop: the form column beside the trust wall. Mobile: a dark trust header, the form on a
 * sheet that overlaps it, support below.
 */
export function AuthLayout() {
  const { t } = useTranslation();
  const format = useFormat();
  const phone = (
    <a href={`tel:${SUPPORT_PHONE}`} dir="ltr" className="font-semibold text-text">
      {format.digits(formatPhone(SUPPORT_PHONE))}
    </a>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <TrustHeader />
      <div className="relative -mt-7 flex flex-1 flex-col gap-8 rounded-t-[28px] bg-canvas px-5 pt-7 pb-6 lg:mt-0 lg:rounded-none lg:px-14 lg:py-9">
        <header className="hidden items-center justify-between lg:flex">
          <a
            href={SITE.home}
            aria-label={t('auth.homeLink')}
            className="flex min-h-11 items-center"
          >
            <Logo className="text-[22px]" />
          </a>
          <a
            href={SITE.home}
            className="inline-flex min-h-11 items-center text-sm text-text-2 hover:text-text"
          >
            {t('auth.backToSite')}
          </a>
        </header>

        <main className="flex flex-1 justify-center lg:items-center lg:py-6">
          <div className="w-full max-w-[420px]">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="flex flex-col items-center gap-3 text-[13px] text-text-2 lg:flex-row lg:flex-wrap lg:justify-between">
          <span className="hidden lg:inline">
            {t('auth.support')} {phone}
          </span>
          <span className="lg:hidden">
            {t('auth.troubleLoggingIn')} {phone}
          </span>
          <div className="flex items-center gap-3">
            <LanguageSwitch />
            <span className="hidden lg:inline">{t('auth.copyright')}</span>
          </div>
        </footer>
      </div>
      <TrustWall />
    </div>
  );
}

function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <nav aria-label={t('settings.language')} className="flex gap-1">
      {(Object.keys(LOCALES) as Locale[]).map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={i18n.language === locale}
          onClick={() => void i18n.changeLanguage(locale)}
          className="min-h-11 rounded-full px-3 hover:text-text aria-pressed:font-semibold aria-pressed:text-text"
        >
          {LOCALES[locale].nativeName}
        </button>
      ))}
    </nav>
  );
}

import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from '@/lib/i18n/config';
import { useTheme } from '@/lib/theme/ThemeProvider';

// Tiny to the eye, still a 44px touch target: the ::after layer widens the hit area without
// taking room in the layout.
const toggleClass =
  "relative inline-flex items-center text-text-3 transition-colors hover:text-text-2 after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-['']";

/**
 * Quiet footer of every panel: copyright, a language toggle and a light/dark toggle (the settings
 * page keeps the full choice, including "match device"). PanelLayout keeps it at the bottom of the
 * screen on short pages and after the content on long ones. Hidden on phones while a PageFill page
 * (the tickets chat) fills the screen.
 */
export function PanelFooter() {
  const { t, i18n } = useTranslation();
  const { theme, setMode } = useTheme();

  const locales = Object.keys(LOCALES) as Locale[];
  const current = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const otherLocale = locales.find((locale) => locale !== current) ?? current;
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <footer className="max-lg:group-has-[[data-page-fill]]/panel:hidden">
      <div className="mx-auto flex w-full max-w-page items-center justify-between px-4 py-3 text-[11px] text-text-3 lg:px-8">
        <span>{t('auth.copyright')}</span>

        <div className="flex items-center gap-4">
          <button
            type="button"
            lang={otherLocale}
            onClick={() => void i18n.changeLanguage(otherLocale)}
            className={toggleClass}
          >
            {LOCALES[otherLocale].nativeName}
          </button>
          <button
            type="button"
            aria-label={t(nextTheme === 'dark' ? 'theme.toDark' : 'theme.toLight')}
            title={t(nextTheme === 'dark' ? 'theme.toDark' : 'theme.toLight')}
            onClick={() => setMode(nextTheme)}
            className={toggleClass}
          >
            <Icon name={nextTheme === 'dark' ? 'moon' : 'sun'} size={12} />
          </button>
        </div>
      </div>
    </footer>
  );
}

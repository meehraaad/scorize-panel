import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { THEME_MODES } from '@/lib/theme/theme';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { buttonClass } from '@/components/ui/buttonStyles';
import { logout } from '@/lib/auth/logout';

const optionClass =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-[15px] font-medium text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-tint has-checked:text-primary-text has-checked:shadow-none has-focus-visible:outline-2 has-focus-visible:outline-focus';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('settings.title')} />

      <Card className="flex flex-col gap-8 p-6 lg:p-8">
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 font-display text-lg font-bold">{t('settings.theme')}</legend>
          <div className="flex flex-wrap gap-2">
            {THEME_MODES.map((value) => (
              <label key={value} className={optionClass}>
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                {t(`theme.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 font-display text-lg font-bold">{t('settings.language')}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LOCALES) as Locale[]).map((locale) => (
              <label key={locale} className={optionClass} lang={locale}>
                <input
                  type="radio"
                  name="language"
                  value={locale}
                  checked={i18n.language === locale}
                  onChange={() => void i18n.changeLanguage(locale)}
                  className="sr-only"
                />
                {LOCALES[locale].nativeName}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <div>
        <button type="button" onClick={logout} className={buttonClass('danger')}>
          {t('account.logout')}
        </button>
      </div>
    </div>
  );
}

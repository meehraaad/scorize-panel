import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { logout } from '@/lib/auth/logout';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { applicantPanel } from '@/panels/applicant';
import { panelsFor, setStartPreference } from '@/panels/registry';
import { panelHref } from '@/panels/types';
import { PanelTile } from './layouts/PanelTile';

/**
 * After login, for people with several work panels: first login on this device, or "always ask"
 * (design: canvas "Scorize Seller Panel", section 6, "choose a panel after login").
 * Each card opens its panel. Below, a quiet link to the panel as a regular customer.
 */
export default function ChoosePanelPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const user = useUser();
  const panels = panelsFor(user);
  const work = panels.filter((panel) => panel.id !== applicantPanel.id);
  const hasOwnFile = panels.length > work.length;
  const [skipNextTime, setSkipNextTime] = useState(true);
  const title = user.first_name
    ? t('chooser.title', { name: user.first_name })
    : t('chooser.titleNoName');
  useDocumentTitle(title);

  const remember = () => {
    setStartPreference(skipNextTime ? 'last' : 'ask');
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-4 lg:px-8 lg:py-6">
        <a href={SITE.home} aria-label={t('auth.homeLink')} className="flex min-h-11 items-center">
          <Logo className="text-xl" />
        </a>
        <button
          type="button"
          onClick={() => void logout()}
          className="min-h-11 px-2 text-sm text-text-2 hover:text-text"
        >
          {t('account.logout')}
        </button>
      </header>

      <main className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 pt-6 pb-16 lg:px-8 lg:pt-10 lg:pb-20">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-[22px] bg-tint text-[26px] font-bold text-primary-text">
            {(user.first_name || user.email || '?').charAt(0).toUpperCase()}
          </span>
          <h1 className="m-0 font-display text-2xl leading-[1.4] font-bold lg:text-[32px]">
            {title}
          </h1>
          <p className="m-0 max-w-[620px] text-base leading-[1.8] text-text-2 lg:text-[17px]">
            {t('chooser.subtitle', { count: format.number(work.length) })}
          </p>
        </div>

        <nav aria-label={t('chooser.legend')}>
          {/* Up to three cards a row, centred, so two panels don't leave an empty column. */}
          <ul
            className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-[repeat(var(--cards),minmax(0,340px))] lg:justify-center lg:gap-5"
            style={{ '--cards': Math.min(work.length, 3) } as CSSProperties}
          >
            {work.map((panel) => (
              <li key={panel.id} className="flex">
                <Link
                  to={panelHref(panel)}
                  onClick={remember}
                  className="group flex flex-1 flex-col gap-4 rounded-card bg-surface p-[26px] text-text shadow-panel transition-shadow hover:shadow-[0_0_0_2px_var(--primary)]"
                >
                  <span className="flex items-center justify-between">
                    <PanelTile panel={panel} size="lg" />
                    <Icon
                      name="chevronEnd"
                      size={20}
                      className="text-text-2 transition-colors group-hover:text-primary-text"
                    />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-xl font-bold">{t(panel.name)}</span>
                    <span className="text-sm text-text-2">{t(panel.description)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col items-center gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
            <input
              type="checkbox"
              checked={skipNextTime}
              onChange={(event) => setSkipNextTime(event.target.checked)}
              className="size-[18px] accent-primary"
            />
            {t('chooser.skipNextTime')}
          </label>
          <Link
            to={panelHref(applicantPanel)}
            className="inline-flex min-h-11 items-center text-sm text-text-2 hover:text-primary-text hover:underline"
          >
            {t(hasOwnFile ? 'chooser.ownFile' : 'chooser.asCustomer')}
          </Link>
        </div>
      </main>
    </div>
  );
}

import { Logo } from '@/components/ui/Logo';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { PageLoader } from '@/components/ui/PageLoader';
import { loginHref, useSession } from '@/lib/auth/session';
import { applicantPanel } from '@/panels/applicant';
import { panelsFor, rememberPanel } from '@/panels/registry';
import { panelHref, type PanelDefinition } from '@/panels/types';
import { AccountMenu } from './AccountMenu';
import { BottomTabs } from './BottomTabs';
import { PanelSwitcher } from './PanelSwitcher';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors ${
    isActive ? 'bg-tint text-primary-text' : 'text-text-2 hover:text-text'
  }`;

/**
 * Shared frame of every panel: header with the panel switcher (several panels only), the panel's
 * own menu and the account menu, page area, and mobile bottom tabs. Only the navigation differs between panels.
 */
export function PanelLayout({ panel }: { panel: PanelDefinition }) {
  const { t } = useTranslation();
  const user = useSession();
  const location = useLocation();

  useEffect(() => {
    rememberPanel(panel);
  }, [panel]);

  // The session expired while the app was open (see queryClient): log in, then come back here.
  if (!user) {
    const here = import.meta.env.BASE_URL.slice(0, -1) + location.pathname + location.search;
    return <Navigate to={loginHref(here)} replace />;
  }

  const panels = panelsFor(user);
  // Staff viewing the panel as a regular customer: it isn't one of their panels, so list it too
  // (as the current one) and the switcher is their way back to work.
  const listed = panels.includes(panel) ? panels : [...panels, panel];
  const customerLink = !panels.includes(applicantPanel) && panel !== applicantPanel;

  return (
    <div className="min-h-dvh pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      <header className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-4 lg:px-8 lg:py-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={panelHref(panel)}
            aria-label={t('app.homeLink')}
            className="flex min-h-11 items-center"
          >
            <Logo className="text-base sm:text-xl" />
          </Link>
          {/* Several panels: which one this is, and the way to the others. */}
          <PanelSwitcher user={user} panel={panel} panels={listed} />
        </div>

        <nav aria-label={t(panel.navLabel)} className="hidden gap-1 lg:flex">
          {panel.navigation.map((item) => (
            <NavLink
              key={item.id}
              to={panelHref(panel, item.to)}
              end={item.to === ''}
              className={navLink}
            >
              {t(item.label)}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="relative inline-flex size-11 items-center justify-center rounded-full bg-surface text-text shadow-[inset_0_0_0_1px_var(--line-2)]"
            aria-label={t('header.notifications')}
          >
            <Icon name="bell" />
          </button>
          <AccountMenu user={user} customerLink={customerLink} />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-page px-4 pb-10 lg:px-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <BottomTabs panel={panel} />
    </div>
  );
}

import { Logo } from '@/components/ui/Logo';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { PageLoader } from '@/components/ui/PageLoader';
import { unreadQuery } from '@/lib/account/api';
import { useFormat } from '@/lib/i18n/useFormat';
import { hasPermission } from '@/lib/auth/roles';
import { loginHref, useSession } from '@/lib/auth/session';
import { applicantPanel } from '@/panels/applicant';
import { panelsFor, rememberPanel } from '@/panels/registry';
import { panelHref, useNoLockedNav, type PanelDefinition } from '@/panels/types';
import { AccountMenu } from './AccountMenu';
import { BottomTabs } from './BottomTabs';
import { PanelFooter } from './PanelFooter';
import { PanelSwitcher } from './PanelSwitcher';

// Inactive items are quiet text; the current page is a dark pill with a small accent dot.
const navLink = ({ isActive }: { isActive: boolean }) =>
  `group/nav relative inline-flex h-10 flex-none items-center gap-2 rounded-full px-2.5 text-[14px] font-medium tracking-[0.01em] whitespace-nowrap transition-colors duration-300 xl:px-4 ${
    isActive ? 'bg-hero text-on-hero dark:bg-tint' : 'text-text-2 hover:bg-canvas hover:text-text'
  }`;

/**
 * Shared frame of every panel: header with the panel switcher (several panels only), the panel's
 * own menu and the account menu, page area, a small footer (language, theme) and mobile bottom tabs.
 * Only the navigation differs between panels. The footer sits at the bottom of the screen when the page is
 * short and after the content when it scrolls (the frame is a column and the page area grows).
 */
export function PanelLayout({ panel }: { panel: PanelDefinition }) {
  const { t } = useTranslation();
  const user = useSession();
  const location = useLocation();
  const format = useFormat();
  const { data: unread = 0 } = useQuery({ ...unreadQuery, enabled: Boolean(user) });
  const useLocked = panel.useLockedNav ?? useNoLockedNav;
  const locked = useLocked();

  useEffect(() => {
    rememberPanel(panel);
  }, [panel]);

  // The session expired while the app was open (see queryClient): log in, then come back here.
  if (!user) {
    const here = import.meta.env.BASE_URL.slice(0, -1) + location.pathname + location.search;
    return <Navigate to={loginHref(here)} replace />;
  }

  // Sections the user's permissions allow (the manager's section only for managers).
  const visible = {
    ...panel,
    navigation: panel.navigation.filter(
      (item) => !item.permission || hasPermission(user, item.permission),
    ),
  };
  const panels = panelsFor(user);
  // Staff viewing the panel as a regular customer: it isn't one of their panels, so list it too
  // (as the current one) and the switcher is their way back to work.
  // Compared by id, not identity: a hot reload in development can recreate panel objects.
  const has = (target: PanelDefinition) => panels.some((item) => item.id === target.id);
  const listed = has(panel) ? panels : [...panels, panel];
  const customerLink = !has(applicantPanel) && panel.id !== applicantPanel.id;

  return (
    // --panel-top / --panel-bottom: the header's height and the room kept for the bottom tabs, so a
    // page can fill the screen between them (PageFill: the tickets chat on phones).
    <div className="group/panel flex min-h-dvh flex-col pb-(--panel-bottom) [--panel-bottom:calc(72px+env(safe-area-inset-bottom))] [--panel-top:76px] lg:[--panel-bottom:0px] lg:[--panel-top:92px]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      <header className="mx-auto flex h-(--panel-top) w-full max-w-page items-center px-4 lg:px-8">
        {/* One floating capsule holds the whole bar: brand, menu and account. */}
        <div className="flex h-14 w-full items-center justify-between gap-3 rounded-full bg-surface ps-5 pe-2 shadow-panel lg:h-16 lg:gap-3 lg:ps-6 xl:gap-4">
          <div className="flex min-w-0 items-center gap-3 xl:gap-4">
            <Link
              to={panelHref(panel)}
              aria-label={t('app.homeLink')}
              className="flex min-h-11 flex-none items-center"
            >
              <Logo className="text-base sm:text-xl" />
            </Link>
            {/* Several panels: which one this is, and the way to the others. */}
            <PanelSwitcher user={user} panel={panel} panels={listed} />
          </div>

          <nav aria-label={t(panel.navLabel)} className="hidden items-center gap-0.5 lg:flex">
            {visible.navigation.map((item) => (
              <NavLink
                key={item.id}
                to={panelHref(panel, item.to)}
                end={item.to === ''}
                className={navLink}
                aria-label={
                  locked.has(item.id) ? t('lock.navItem', { name: t(item.label) }) : undefined
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="size-1.5 flex-none rounded-full bg-hero-accent"
                      />
                    )}
                    {t(item.label)}
                    {locked.has(item.id) && <NavLock />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-none items-center gap-1.5">
            <span aria-hidden="true" className="me-1 hidden h-6 w-px bg-hair xl:block" />
            <Link
              to="/account#notifications"
              className="relative inline-flex size-11 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-canvas hover:text-text"
              aria-label={
                unread
                  ? t('header.notificationsUnread', { n: format.number(unread) })
                  : t('header.notifications')
              }
            >
              <Icon name="bell" />
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute end-2.5 top-2.5 size-2.5 rounded-full bg-primary shadow-[0_0_0_2px_var(--surface)]"
                />
              )}
            </Link>
            <AccountMenu user={user} customerLink={customerLink} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-page flex-1 px-4 pb-10 lg:px-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <PanelFooter />

      <BottomTabs panel={visible} locked={locked} />
    </div>
  );
}

/** Lock beside a section that opens once there is a contract (the link's name says so). */
function NavLock() {
  return (
    <span className="inline-flex flex-none text-text-3">
      <Icon name="lock" size={14} />
    </span>
  );
}

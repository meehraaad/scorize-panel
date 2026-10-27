import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { logout } from '@/lib/auth/logout';
import { panelHref, type PanelDefinition } from '@/panels/types';
import { usePinToScreenBottom } from './usePinToScreenBottom';

const MAX_TABS = 4; // + "More" = 5, the most a phone bar fits with readable labels

const tabClass =
  'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium';
const sheetItemClass = 'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-base font-medium';

interface Props {
  panel: PanelDefinition;
  /** Ids of nav items shown with a lock (PanelDefinition.useLockedNav). */
  locked: ReadonlySet<string>;
}

/** Mobile/tablet navigation (< lg). The "More" sheet is a native <dialog>: focus trap and Esc for free. */
export function BottomTabs({ panel, locked }: Props) {
  const { t } = useTranslation();
  const sheet = useRef<HTMLDialogElement>(null);
  const bar = useRef<HTMLElement>(null);
  usePinToScreenBottom(bar);
  const { pathname } = useLocation();
  const close = () => sheet.current?.close();

  const tabs = panel.navigation.filter((item) => item.tab).slice(0, MAX_TABS);
  const rest = panel.navigation.filter((item) => !tabs.includes(item));
  const moreActive =
    rest.some((item) => pathname === panelHref(panel, item.to)) ||
    pathname === '/account' ||
    pathname === '/settings';

  return (
    <>
      {/* Pinned while the browser's own toolbar slides in and out on scroll (iOS Safari, Android
          Chrome): usePinToScreenBottom moves the bar down to the screen's edge when the browser
          leaves it short, and the ::after strip below it paints over any gap the toolbar animation
          or an overscroll bounce opens under the bar. */}
      <nav
        ref={bar}
        aria-label={t(panel.navLabel)}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hair bg-surface pb-[env(safe-area-inset-bottom)] group-has-[[data-workspace-fullscreen]]/panel:hidden after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-24 after:bg-surface lg:hidden"
      >
        {tabs.map((item) => (
          <NavLink
            key={item.id}
            to={panelHref(panel, item.to)}
            end={item.to === ''}
            className={({ isActive }) =>
              `${tabClass} ${isActive ? 'text-primary-text' : 'text-text-2'}`
            }
            aria-label={
              locked.has(item.id) && item.tab ? t('lock.navItem', { name: t(item.tab) }) : undefined
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`relative flex h-8 w-14 items-center justify-center rounded-full ${isActive ? 'bg-tint' : ''}`}
                >
                  <Icon name={item.icon} />
                  {locked.has(item.id) && (
                    <span className="absolute end-2 -top-1 flex size-[18px] items-center justify-center rounded-full bg-surface text-text-2 shadow-[0_0_0_1px_var(--line-2)]">
                      <Icon name="lock" size={10} />
                    </span>
                  )}
                </span>
                {item.tab && t(item.tab)}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => sheet.current?.showModal()}
          aria-haspopup="dialog"
          className={`${tabClass} ${moreActive ? 'text-primary-text' : 'text-text-2'}`}
        >
          <span
            className={`flex h-8 w-14 items-center justify-center rounded-full ${moreActive ? 'bg-tint' : ''}`}
          >
            <Icon name="more" />
          </span>
          {t('tabs.more')}
        </button>
      </nav>

      <dialog
        ref={sheet}
        aria-labelledby="more-title"
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-card bg-surface p-0 text-text backdrop:bg-black/40 lg:hidden"
      >
        <div className="flex flex-col gap-2 p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <h2 id="more-title" className="m-0 font-display text-lg font-bold">
              {t('more.title')}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t('more.close')}
              className="inline-flex size-11 items-center justify-center rounded-full text-text-2"
            >
              <Icon name="close" />
            </button>
          </div>

          {rest.map((item) => (
            <NavLink
              key={item.id}
              to={panelHref(panel, item.to)}
              end={item.to === ''}
              onClick={close}
              className={({ isActive }) =>
                `${sheetItemClass} ${isActive ? 'bg-tint text-primary-text' : 'text-text'}`
              }
              aria-label={
                locked.has(item.id) ? t('lock.navItem', { name: t(item.label) }) : undefined
              }
            >
              <Icon name={item.icon} />
              {t(item.label)}
              {locked.has(item.id) && (
                <span className="ms-auto inline-flex text-text-3">
                  <Icon name="lock" size={16} />
                </span>
              )}
            </NavLink>
          ))}

          <div className="flex flex-col gap-1 border-t border-hair pt-2">
            <NavLink
              to="/account"
              onClick={close}
              className={({ isActive }) =>
                `${sheetItemClass} ${isActive ? 'bg-tint text-primary-text' : 'text-text'}`
              }
            >
              <Icon name="user" />
              {t('account.profile')}
            </NavLink>
            <NavLink
              to="/settings"
              onClick={close}
              className={({ isActive }) =>
                `${sheetItemClass} ${isActive ? 'bg-tint text-primary-text' : 'text-text'}`
              }
            >
              <Icon name="settings" />
              {t('account.settings')}
            </NavLink>
            <button
              type="button"
              onClick={() => void logout()}
              className={`${sheetItemClass} text-danger`}
            >
              <Icon name="logout" />
              {t('account.logout')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

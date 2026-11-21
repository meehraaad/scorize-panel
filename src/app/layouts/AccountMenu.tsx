import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { logout } from '@/lib/auth/logout';
import { applicantPanel } from '@/panels/applicant';
import { panelHref } from '@/panels/types';
import type { SessionUser } from '@/lib/auth/session';
import type { PanelDefinition } from '@/panels/types';
import { PanelChoices } from './PanelChoices';

interface Props {
  user: SessionUser;
  /** Staff: a quiet link to the panel as a regular customer (it isn't one of their panels). */
  customerLink: boolean;
  /** The panel's own state and menu block (sales: phone break). */
  extra?: PanelDefinition['account'];
  /** The open panel and the ones to switch to: listed here on phones, where the header has no switcher. */
  panel: PanelDefinition;
  panels: PanelDefinition[];
}

// Thinner on phones, where the avatar is smaller.
const RINGS = {
  queue:
    'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--hue-green)] lg:shadow-[0_0_0_2px_var(--surface),0_0_0_5px_var(--hue-green)]',
  rest: 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--hue-orange)] lg:shadow-[0_0_0_2px_var(--surface),0_0_0_5px_var(--hue-orange)]',
} as const;

const NO_STATUS = () => null;

const itemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm text-text hover:bg-canvas lg:text-[15px]';

/**
 * Account button + dropdown (desktop and mobile header): who is logged in, settings, logout.
 * Switching panels is the PanelSwitcher beside the logo on desktop, and a section of this menu on
 * phones. Disclosure pattern: Esc and outside click close it.
 */
export function AccountMenu({ user, customerLink, extra, panel, panels }: Props) {
  const { t } = useTranslation();
  const status = (extra?.useStatus ?? NO_STATUS)();
  const Extra = extra?.Menu;
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  const name = `${user.first_name} ${user.last_name}`.trim() || user.email || user.phone_number;
  const switching = panels.length > 1;
  const initial = (user.first_name || user.email || '?').charAt(0).toUpperCase();

  // Close after navigating.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={
          status
            ? `${t('account.menu')}: ${t(status === 'queue' ? 'account.inQueue' : 'account.onBreak')}`
            : t('account.menu')
        }
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="group/avatar inline-flex size-11 items-center justify-center rounded-full"
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-8 items-center justify-center rounded-full bg-hero font-display text-[13px] font-bold text-hero-accent transition-shadow lg:size-11 lg:text-[15px] ${
            status
              ? RINGS[status]
              : 'shadow-[0_0_0_2px_var(--surface),0_0_0_3px_var(--line-2)] group-hover/avatar:shadow-[0_0_0_2px_var(--surface),0_0_0_3px_var(--primary)]'
          }`}
        >
          {initial}
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute end-0 top-full z-40 mt-2 flex max-h-[calc(100dvh-var(--panel-top)-var(--panel-bottom)-1rem)] w-[min(18rem,calc(100vw-2rem))] flex-col gap-1 overflow-y-auto rounded-card-sm bg-surface p-2 shadow-panel lg:max-h-none lg:w-72"
        >
          <div className="flex flex-col px-3 py-2">
            <span className="truncate text-sm font-semibold lg:text-base">{name}</span>
            {user.email && (
              <span dir="ltr" className="truncate text-start text-[13px] text-text-2 lg:text-sm">
                {user.email}
              </span>
            )}
          </div>

          {Extra && (
            <Suspense fallback={null}>
              <Extra />
            </Suspense>
          )}

          {/* Phones: the header has no room for the panel switcher, so the panels are here. */}
          {switching && (
            <div className="flex flex-col gap-1 border-t border-hair pt-2 pb-1 lg:hidden">
              <span className="px-2 pb-1 text-xs font-semibold text-text-2">
                {t('switcher.title')}
              </span>
              <PanelChoices
                user={user}
                panel={panel}
                panels={panels}
                onPick={() => setOpen(false)}
                compact
              />
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-hair pt-1">
            <Link to="/account" className={itemClass}>
              <Icon name="user" />
              {t('account.profile')}
            </Link>
            {user.staff?.is_active && (
              <Link to="/me" className={itemClass}>
                <Icon name="chart" />
                {t('account.myPay')}
              </Link>
            )}
            <Link to="/settings" className={itemClass}>
              <Icon name="settings" />
              {t('account.settings')}
            </Link>
            {customerLink && (
              <Link
                to={panelHref(applicantPanel)}
                // Phones list the applicant panel among the panels above.
                className={`${itemClass} text-text-2 ${switching ? 'max-lg:hidden' : ''}`}
              >
                <Icon name="home" />
                {t('account.asCustomer')}
              </Link>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className={`${itemClass} text-danger`}
            >
              <Icon name="logout" />
              {t('account.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

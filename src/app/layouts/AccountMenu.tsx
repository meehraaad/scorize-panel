import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { logout } from '@/lib/auth/logout';
import { applicantPanel } from '@/panels/applicant';
import { panelHref } from '@/panels/types';
import type { SessionUser } from '@/lib/auth/session';

interface Props {
  user: SessionUser;
  /** Staff: a quiet link to the panel as a regular customer (it isn't one of their panels). */
  customerLink: boolean;
}

const itemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[15px] text-text hover:bg-canvas';

/**
 * Account button + dropdown (desktop and mobile header): who is logged in, settings, logout.
 * Switching panels is the PanelSwitcher beside the logo. Disclosure pattern: Esc and outside click close it.
 */
export function AccountMenu({ user, customerLink }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  const name = `${user.first_name} ${user.last_name}`.trim() || user.email || user.phone_number;
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
        aria-label={t('account.menu')}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-full bg-hero font-display text-[15px] font-bold text-hero-accent shadow-[0_0_0_2px_var(--surface),0_0_0_3px_var(--line-2)] transition-shadow hover:shadow-[0_0_0_2px_var(--surface),0_0_0_3px_var(--primary)]"
      >
        {initial}
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute end-0 top-full z-40 mt-2 flex w-72 flex-col gap-1 rounded-card-sm bg-surface p-2 shadow-panel"
        >
          <div className="flex flex-col px-3 py-2">
            <span className="truncate font-semibold">{name}</span>
            {user.email && (
              <span dir="ltr" className="truncate text-start text-sm text-text-2">
                {user.email}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1 border-t border-hair pt-1">
            <Link to="/account" className={itemClass}>
              <Icon name="user" />
              {t('account.profile')}
            </Link>
            <Link to="/settings" className={itemClass}>
              <Icon name="settings" />
              {t('account.settings')}
            </Link>
            {customerLink && (
              <Link to={panelHref(applicantPanel)} className={`${itemClass} text-text-2`}>
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

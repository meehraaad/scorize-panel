import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { logout } from '@/lib/auth/logout';
import type { SessionUser } from '@/lib/auth/session';
import { panelHref, type PanelDefinition } from '@/panels/types';

interface Props {
  user: SessionUser;
  panel: PanelDefinition;
  panels: PanelDefinition[];
}

const itemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[15px] text-text hover:bg-canvas';

/**
 * Account button + dropdown (desktop and mobile header): who is logged in, panel switcher for
 * people with several roles, settings, logout. Disclosure pattern: Esc and outside click close it.
 */
export function AccountMenu({ user, panel, panels }: Props) {
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
        className="inline-flex size-11 items-center justify-center rounded-full bg-tint text-base font-bold text-primary-text"
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

          {panels.length > 1 && (
            <nav
              aria-label={t('account.panels')}
              className="flex flex-col gap-1 border-t border-hair pt-1"
            >
              <span className="px-3 pt-2 pb-1 text-xs font-medium text-text-2">
                {t('account.panels')}
              </span>
              {panels.map((item) => {
                const current = item.id === panel.id;
                return (
                  <Link
                    key={item.id}
                    to={panelHref(item)}
                    aria-current={current ? 'page' : undefined}
                    className={`${itemClass} ${current ? 'font-semibold text-primary-text' : ''}`}
                  >
                    <span className="flex-1">{t(item.name)}</span>
                    {current && <Icon name="check" size={18} />}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex flex-col gap-1 border-t border-hair pt-1">
            <Link to="/account" className={itemClass}>
              <Icon name="user" />
              {t('account.profile')}
            </Link>
            <Link to="/settings" className={itemClass}>
              <Icon name="settings" />
              {t('account.settings')}
            </Link>
            <button type="button" onClick={logout} className={`${itemClass} text-danger`}>
              <Icon name="logout" />
              {t('account.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

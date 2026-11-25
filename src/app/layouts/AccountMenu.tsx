import { Suspense, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { ONBOARDING_PATH } from '@/features/hr/paths';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { logout } from '@/lib/auth/logout';
import { useDismiss } from '@/lib/useDismiss';
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

const RINGS = {
  queue: 'shadow-[0_0_0_2px_var(--surface),0_0_0_5px_var(--hue-green)]',
  rest: 'shadow-[0_0_0_2px_var(--surface),0_0_0_5px_var(--hue-orange)]',
} as const;

const NO_STATUS = () => null;

const itemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm text-text hover:bg-canvas';

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

  const name = `${user.first_name} ${user.last_name}`.trim() || user.email || user.phone_number;
  const switching = panels.length > 1;
  const initial = (user.first_name || user.email || '?').charAt(0).toUpperCase();
  // A new hire's form still theirs to fill: a dot on the button, a badge on its line.
  const formWaiting =
    ON_SERVER.hrOnboarding &&
    (user.staff?.onboarding === 'draft' || user.staff?.onboarding === 'returned');

  useDismiss(open, root, (how) => {
    setOpen(false);
    if (how === 'escape') button.current?.focus();
  });

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={[
          status
            ? `${t('account.menu')}: ${t(status === 'queue' ? 'account.inQueue' : 'account.onBreak')}`
            : t('account.menu'),
          formWaiting && t('account.onboardingWaiting'),
        ]
          .filter(Boolean)
          .join(' · ')}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="group/avatar relative inline-flex size-11 items-center justify-center rounded-full"
      >
        {formWaiting && (
          <span
            aria-hidden="true"
            className="absolute end-0.5 top-0.5 size-3 rounded-full bg-warn shadow-[0_0_0_2px_var(--surface)]"
          />
        )}
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
          className="absolute end-0 top-full z-40 mt-2 flex w-72 flex-col gap-1 rounded-card-sm bg-surface p-2 shadow-panel"
        >
          <div className="flex flex-col px-3 py-2">
            <span className="truncate font-semibold">{name}</span>
            {user.email && (
              <span dir="ltr" className="truncate text-start text-[13px] text-text-2">
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
            // Collapsed at first: the menu opens on the account, the panels are one tap away.
            <details className="group/panels flex flex-col border-t border-hair pt-1 lg:hidden">
              <summary
                className={`${itemClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
              >
                <Icon name="grid" />
                <span className="flex-1">{t('switcher.title')}</span>
                <span className="truncate text-[13px] text-text-2">{t(panel.name)}</span>
                <Icon
                  name="chevronDown"
                  size={16}
                  className="flex-none opacity-60 transition-transform group-open/panels:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-1 pt-1 pb-1">
                <PanelChoices
                  user={user}
                  panel={panel}
                  panels={panels}
                  onPick={() => setOpen(false)}
                  compact
                />
              </div>
            </details>
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
            {ON_SERVER.hrOnboarding && user.staff?.onboarding && (
              <Link to={ONBOARDING_PATH} className={itemClass}>
                <Icon name="document" />
                <span className="flex-1">{t('account.onboarding')}</span>
                {formWaiting && (
                  <span className="rounded-full bg-warn-tint px-2 py-0.5 text-xs font-semibold text-warn">
                    {t('account.onboardingBadge')}
                  </span>
                )}
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

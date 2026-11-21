import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import type { SessionUser } from '@/lib/auth/session';
import { toast } from '@/lib/toast';
import {
  panelsFor,
  setStartPreference,
  startPreference,
  type StartPreference,
} from '@/panels/registry';
import { panelHref, type PanelDefinition } from '@/panels/types';
import { PanelTile } from './PanelTile';

interface Props {
  user: SessionUser;
  panel: PanelDefinition;
  panels: PanelDefinition[];
  /** Called after a panel is picked (closes the surrounding sheet or menu). */
  onPick?: () => void;
  /** Phones' account menu: small tiles, one line per panel, no description. */
  compact?: boolean;
}

/**
 * The user's panels and where to land after login: the body of the desktop PanelSwitcher and the
 * panel section of the account menu on phones.
 */
export function PanelChoices({ user, panel, panels, onPick, compact = false }: Props) {
  const { t } = useTranslation();
  const [preference, setPreference] = useState<StartPreference>(() => startPreference(user));
  // "Open after login" chooses among the user's own panels: with one, there is nothing to choose.
  const own = panelsFor(user);

  return (
    <>
      <nav aria-label={t('switcher.title')} className="flex flex-col gap-1">
        {panels.map((item) => {
          const current = item.id === panel.id;
          return (
            <Link
              key={item.id}
              to={panelHref(item)}
              aria-current={current ? 'page' : undefined}
              onClick={onPick}
              className={`flex items-center text-start ${
                compact
                  ? 'min-h-11 gap-3 rounded-xl px-2'
                  : 'min-h-16 gap-3.5 rounded-[18px] px-3.5 py-2.5'
              } ${current ? 'bg-tint' : 'hover:bg-canvas'}`}
            >
              <PanelTile panel={item} size={compact ? 'sm' : 'md'} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={`truncate font-semibold text-text ${compact ? 'text-sm' : 'text-[15px]'}`}
                >
                  {t(item.name)}
                </span>
                {!compact && <span className="text-[13px] text-text-2">{t(item.description)}</span>}
              </span>
              {current && (
                <Icon
                  name="check"
                  size={compact ? 16 : 18}
                  className="flex-none text-primary-text"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {own.length > 1 && (
        <>
          <div className={`my-2 h-px bg-hair ${compact ? 'mx-2' : 'mx-3.5'}`} />
          <label
            className={`flex flex-wrap items-center justify-between gap-3 pt-1.5 pb-1 text-neutral ${
              compact ? 'px-2 text-[13px]' : 'px-3.5 text-sm'
            }`}
          >
            {t('switcher.startLabel')}
            <select
              value={preference}
              onChange={(event) => {
                const value = event.target.value as StartPreference;
                const previous = preference;
                setPreference(value);
                setStartPreference(value).catch(() => {
                  setPreference(previous);
                  toast.error(t('switcher.saveFailed'));
                });
              }}
              className={`max-w-full rounded-full bg-canvas px-3 text-text ${compact ? 'h-11 text-[13px]' : 'h-11 text-sm'}`}
            >
              <option value="last">{t('switcher.start.last')}</option>
              {own.map((item) => (
                <option key={item.id} value={item.id}>
                  {t('switcher.start.always', { panel: t(item.name) })}
                </option>
              ))}
              <option value="ask">{t('switcher.start.ask')}</option>
            </select>
          </label>
        </>
      )}
    </>
  );
}

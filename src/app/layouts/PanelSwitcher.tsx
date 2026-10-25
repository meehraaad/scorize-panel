import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import type { SessionUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { setStartPreference, startPreference, type StartPreference } from '@/panels/registry';
import { panelHref, type PanelDefinition } from '@/panels/types';
import { PanelTile } from './PanelTile';

interface Props {
  user: SessionUser;
  panel: PanelDefinition;
  /** Only rendered for two or more: with one panel there is nothing to switch. */
  panels: PanelDefinition[];
}

const DESKTOP = '(min-width: 1024px)';

/**
 * "Panel X ▾" beside the logo (design: canvas "Scorize Seller Panel", section 6). Lists the user's
 * panels and where to land after login. A <dialog>: on desktop a non-modal dropdown under the
 * button; on phones a modal bottom sheet (focus trapped, Esc and the backdrop close it).
 */
export function PanelSwitcher({ user, panel, panels }: Props) {
  const { t } = useTranslation();
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useState<StartPreference>(() => startPreference(user));
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const close = () => {
    dialog.current?.close();
  };

  const show = () => {
    const element = dialog.current;
    if (!element) return;
    if (window.matchMedia(DESKTOP).matches) element.show();
    else element.showModal();
    setOpen(true);
    // Start on the current panel, like a menu opening on its selected item.
    element.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
  };

  // Desktop dropdown is non-modal: close it on Esc and on a click outside.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (dialog.current?.open && !root.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (panels.length < 2) return null;

  const name = `${user.first_name} ${user.last_name}`.trim() || user.email || user.phone_number;

  return (
    <div ref={root} className="relative min-w-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : show())}
        className="inline-flex h-11 max-w-full items-center gap-2 rounded-full bg-canvas ps-3 pe-2.5 text-[13px] font-semibold text-text shadow-[inset_0_0_0_1px_var(--hair)] transition-colors hover:bg-tint hover:text-primary-text lg:h-10 lg:max-w-32 xl:max-w-none"
      >
        <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-primary" />
        <span className="truncate">{t(panel.name)}</span>
        <Icon name="chevronDown" size={15} className="flex-none opacity-60" />
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false);
          button.current?.focus();
        }}
        // Modal sheet: a click on the backdrop lands on the dialog itself.
        onClick={(event) => event.target === event.currentTarget && close()}
        className="fixed inset-x-0 top-auto bottom-0 z-50 m-0 w-full max-w-none rounded-t-[28px] bg-surface p-0 text-text shadow-[0_0_0_1px_var(--hair),0_24px_60px_rgb(27_16_32/0.18)] backdrop:bg-black/40 lg:absolute lg:inset-x-auto lg:start-0 lg:top-full lg:bottom-auto lg:mt-3 lg:w-[420px] lg:rounded-3xl"
      >
        <div className="flex flex-col gap-1 px-2 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))] lg:p-2.5">
          <span
            aria-hidden="true"
            className="mb-2.5 h-[5px] w-10 self-center rounded-full bg-line-2 lg:hidden"
          />
          <div className="flex items-baseline justify-between gap-3 px-3.5 pt-1.5 pb-2.5">
            <h2 id={titleId} className="m-0 font-display text-base font-bold">
              {t('switcher.title')}
            </h2>
            <span className="truncate text-[13px] text-text-2">
              {t('switcher.who', { name, count: format.number(panels.length) })}
            </span>
          </div>

          <nav aria-label={t('switcher.title')} className="flex flex-col gap-1">
            {panels.map((item) => {
              const current = item.id === panel.id;
              return (
                <Link
                  key={item.id}
                  to={panelHref(item)}
                  aria-current={current ? 'page' : undefined}
                  onClick={close}
                  className={`flex min-h-16 items-center gap-3.5 rounded-[18px] px-3.5 py-2.5 text-start ${current ? 'bg-tint' : 'hover:bg-canvas'}`}
                >
                  <PanelTile panel={item} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-text">{t(item.name)}</span>
                    <span className="text-[13px] text-text-2">{t(item.description)}</span>
                  </span>
                  {current && (
                    <Icon name="check" size={18} className="flex-none text-primary-text" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mx-3.5 my-2 h-px bg-hair" />
          <label className="flex flex-wrap items-center justify-between gap-3 px-3.5 pt-1.5 pb-1 text-sm text-neutral">
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
              className="h-11 max-w-full rounded-full bg-canvas px-3 text-sm text-text"
            >
              <option value="last">{t('switcher.start.last')}</option>
              {panels.map((item) => (
                <option key={item.id} value={item.id}>
                  {t('switcher.start.always', { panel: t(item.name) })}
                </option>
              ))}
              <option value="ask">{t('switcher.start.ask')}</option>
            </select>
          </label>
        </div>
      </dialog>
    </div>
  );
}

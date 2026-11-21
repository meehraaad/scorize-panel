import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import type { SessionUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import type { PanelDefinition } from '@/panels/types';
import { PanelChoices } from './PanelChoices';

interface Props {
  user: SessionUser;
  panel: PanelDefinition;
  /**
   * Only rendered for two or more: with one panel there is nothing to switch. Staff also get the
   * applicant panel here, though it isn't one of their own (see PanelLayout).
   */
  panels: PanelDefinition[];
}

const DESKTOP = '(min-width: 1024px)';

/**
 * "Panel X ▾" beside the logo (design: canvas "Scorize Seller Panel", section 6). Lists the user's
 * panels and where to land after login. A <dialog>: on desktop a non-modal dropdown under the
 * button; on phones a modal bottom sheet (focus trapped, Esc and the backdrop close it). The header
 * hides it on phones, where the account menu lists the panels instead (less in a narrow bar).
 */
export function PanelSwitcher({ user, panel, panels }: Props) {
  const { t } = useTranslation();
  const format = useFormat();
  const [open, setOpen] = useState(false);
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

          <PanelChoices user={user} panel={panel} panels={panels} onPick={close} />
        </div>
      </dialog>
    </div>
  );
}

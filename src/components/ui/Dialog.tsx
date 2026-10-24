import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A modal panel (native <dialog>: focus trap, Esc and the back gesture close it): a bottom sheet on
 * phones, a panel at the end side of the screen from lg up (log a call, sell a product). The parent
 * decides when it is open; the content renders only while open.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  closeLabel: string;
  /** Pinned under the scrolling body: the form's buttons. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && ref.current?.close()}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-card bg-surface p-0 text-text backdrop:bg-black/40 lg:ms-auto lg:mt-0 lg:h-dvh lg:max-h-dvh lg:w-[480px] lg:rounded-none lg:rounded-s-card"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col lg:h-full lg:max-h-none">
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-7 lg:pt-7">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={titleId} className="m-0 font-display text-lg font-bold lg:text-xl">
                {title}
              </h2>
              {subtitle && <span className="text-sm leading-6 text-text-2">{subtitle}</span>}
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label={closeLabel}
              className="inline-flex size-11 flex-none items-center justify-center rounded-full text-text-2 hover:bg-canvas"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-2 pb-6 lg:px-7">
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap gap-2 px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_var(--hair)] lg:px-7 lg:pb-6">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A modal panel (native <dialog>: focus trap, Esc and the back gesture close it): a bottom sheet on
 * phones, a panel at the end side of the screen from lg up (log a call, sell a product). `wide`: a
 * large centred window from lg up and the whole screen on phones, for a workspace (booking on a
 * week calendar). The parent decides when it is open; the content renders only while open.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  footer,
  size = 'panel',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  closeLabel: string;
  /** Pinned under the scrolling body: the form's buttons. */
  footer?: ReactNode;
  size?: 'panel' | 'wide';
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
      className={`p-0 text-text backdrop:bg-black/40 ${
        size === 'wide'
          ? 'm-0 h-dvh max-h-dvh w-full max-w-none bg-canvas lg:m-auto lg:h-[min(940px,94dvh)] lg:max-h-[94dvh] lg:w-[min(1280px,95vw)] lg:rounded-card'
          : 'm-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-card bg-surface lg:ms-auto lg:mt-0 lg:h-dvh lg:max-h-dvh lg:w-[480px] lg:rounded-none lg:rounded-s-card'
      }`}
    >
      {open && (
        <div
          className={`flex flex-col ${size === 'wide' ? 'h-full' : 'max-h-[92dvh] lg:h-full lg:max-h-none'}`}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-7 lg:pt-7">
            <div className="flex min-w-0 flex-col gap-1">
              <h2
                id={titleId}
                className="m-0 font-display text-lg font-bold [overflow-wrap:anywhere] lg:text-xl"
              >
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

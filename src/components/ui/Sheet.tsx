import { useId, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * A round icon button that opens a bottom sheet (native <dialog>: focus trap, Esc and the back
 * gesture close it). For phones, where a side column doesn't fit: the page shows it here instead.
 * The content renders only while open.
 */
export function SheetButton({
  icon,
  label,
  title,
  closeLabel,
  className = '',
  children,
}: {
  icon: IconName;
  /** The button's name for screen readers ("Help and questions"). */
  label: string;
  title: string;
  closeLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = () => sheet.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          sheet.current?.showModal();
        }}
        className={`inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface text-text shadow-[inset_0_0_0_1px_var(--line-2)] ${className}`}
      >
        <Icon name={icon} />
      </button>
      <dialog
        ref={sheet}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-card bg-surface p-0 text-text backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3 p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="m-0 font-display text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={closeLabel}
              className="inline-flex size-11 flex-none items-center justify-center rounded-full text-text-2"
            >
              <Icon name="close" />
            </button>
          </div>
          {open && children}
        </div>
      </dialog>
    </>
  );
}

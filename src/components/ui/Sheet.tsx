import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const sheetClass =
  'm-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-card bg-surface p-0 text-text backdrop:bg-black/40';

/**
 * A bottom sheet (native <dialog>: focus trap, Esc and the back gesture close it), opened by its
 * owner: `open` shows it, `onClose` runs however it closes. The content renders only while open.
 * For a sheet behind its own round button, see `SheetButton`.
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  const close = () => sheet.current?.close();
  return (
    <dialog
      ref={sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && close()}
      className={sheetClass}
    >
      {open && (
        <SheetBody titleId={titleId} title={title} closeLabel={closeLabel} onClose={close}>
          {children}
        </SheetBody>
      )}
    </dialog>
  );
}

function SheetBody({
  titleId,
  title,
  closeLabel,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="m-0 font-display text-lg font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="inline-flex size-11 flex-none items-center justify-center rounded-full text-text-2"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </div>
  );
}

/**
 * A round icon button that opens a bottom sheet. For phones, where a side column doesn't fit: the
 * page shows it here instead.
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface text-text shadow-[inset_0_0_0_1px_var(--line-2)] ${className}`}
      >
        <Icon name={icon} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} closeLabel={closeLabel}>
        {children}
      </Sheet>
    </>
  );
}

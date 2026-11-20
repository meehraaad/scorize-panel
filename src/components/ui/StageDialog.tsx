import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A modal window for content that draws its own header and close button (a quiz), edge to edge:
 * a large centred window from lg up, a tall sheet on phones. Native <dialog> like `Dialog`: focus
 * trap, Esc and the back gesture close it. Its title is read by screen readers only. In its own
 * file so pages without one don't load it.
 */
export function StageDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
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
      onClose={(event) => event.target === event.currentTarget && onClose()}
      onClick={(event) => event.target === event.currentTarget && ref.current?.close()}
      className="m-0 mt-auto h-[92dvh] max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-card bg-surface p-0 text-text backdrop:bg-black/40 lg:m-auto lg:h-[min(940px,94dvh)] lg:max-h-[94dvh] lg:w-[min(1280px,95vw)] lg:rounded-card"
    >
      {open && (
        <div className="flex h-full flex-col">
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

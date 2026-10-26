import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** A non-modal form: the page and navigation remain usable. Closing minimizes the draft. */
export function FloatingPanel({
  active = true,
  title,
  subtitle,
  closeLabel,
  onClose,
  footer,
  children,
}: {
  active?: boolean;
  title: string;
  subtitle?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);
  return (
    <section
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex max-h-[calc(100dvh-180px)] flex-col overflow-hidden rounded-card bg-surface text-text shadow-panel outline-none lg:inset-x-auto lg:end-5 lg:bottom-5 lg:max-h-[calc(100dvh-124px)] lg:w-[440px]"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="m-0 font-display text-lg font-bold">
            {title}
          </h2>
          {subtitle && <span className="text-sm leading-6 text-text-2">{subtitle}</span>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="inline-flex size-11 flex-none items-center justify-center rounded-full text-text-2 hover:bg-canvas"
        >
          <Icon name="chevronDown" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-2 pb-6">
        {children}
      </div>
      {footer && <div className="flex flex-wrap gap-2 border-t border-hair p-4">{footer}</div>}
    </section>
  );
}

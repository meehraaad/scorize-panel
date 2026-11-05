import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A non-modal form: the page and navigation remain usable. Closing minimizes the draft.
 * `chat`: a chat window of fixed height whose content fills it unpadded (it scrolls its own
 * messages); `actions` go in the header before the minimize button.
 */
export function FloatingPanel({
  active = true,
  title,
  subtitle,
  closeLabel,
  onClose,
  actions,
  variant = 'form',
  footer,
  children,
}: {
  active?: boolean;
  title: string;
  subtitle?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
  variant?: 'form' | 'chat';
  footer?: ReactNode;
  children: ReactNode;
}) {
  const chat = variant === 'chat';
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
      className={`fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex flex-col overflow-hidden rounded-card bg-surface text-text shadow-panel outline-none lg:inset-x-auto lg:end-5 lg:bottom-5 ${
        chat
          ? 'h-[calc(100dvh-180px)] lg:h-[min(660px,calc(100dvh-124px))] lg:w-[420px]'
          : 'max-h-[calc(100dvh-180px)] lg:max-h-[calc(100dvh-124px)] lg:w-[440px]'
      }`}
    >
      <div
        className={
          chat
            ? 'flex items-center gap-1 py-2.5 ps-5 pe-2 shadow-[inset_0_-1px_0_var(--hair)]'
            : 'flex items-start justify-between gap-3 px-5 pt-5 pb-3'
        }
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2
            id={titleId}
            className={`m-0 font-display font-bold ${chat ? 'truncate text-base' : 'text-lg'}`}
          >
            {title}
          </h2>
          {subtitle && (
            <span className={`text-text-2 ${chat ? 'truncate text-[13px]' : 'text-sm leading-6'}`}>
              {subtitle}
            </span>
          )}
        </div>
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="inline-flex size-11 flex-none items-center justify-center rounded-full text-text-2 hover:bg-canvas"
        >
          <Icon name="chevronDown" />
        </button>
      </div>
      <div
        className={
          chat
            ? 'flex min-h-0 flex-1 flex-col'
            : 'flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-2 pb-6'
        }
      >
        {children}
      </div>
      {footer && (
        <footer className="flex flex-wrap gap-2 border-t border-hair p-4">{footer}</footer>
      )}
    </section>
  );
}

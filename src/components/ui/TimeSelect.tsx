import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

export interface TimeOption {
  /** Any key; the chosen one is `value`. */
  value: string;
  /** The time as shown («۱۱:۳۰»). */
  label: string;
  /** Beside it, quieter: how long it lasts from the start («۴۵ دقیقه»). */
  hint?: string | undefined;
}

/** The list's height; the chosen time is scrolled to its middle. */
const LIST_HEIGHT = 264;

/**
 * A time as a chip that opens a list of times under it, as a calendar app's event does: tap the
 * start or the end, scroll, tap a time. The list floats over the page (it isn't clipped by the card
 * it sits in), closes on a pick, Escape, a tap outside or a scroll, and works by keyboard (arrows,
 * Home/End, Enter). `label` names the chip for screen readers («شروع»).
 */
export function TimeSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly TimeOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  const current = options.find((option) => option.value === value);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const pick = (next: string) => {
    if (next !== value) onChange(next);
    close();
  };

  // Under the chip, inside the window (above it when there is no room below).
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const box = button.current.getBoundingClientRect();
    const width = Math.max(box.width, 176);
    const below = box.bottom + 6;
    const top =
      below + LIST_HEIGHT > window.innerHeight - 8 ? Math.max(8, box.top - 6 - LIST_HEIGHT) : below;
    const rtl = getComputedStyle(button.current).direction === 'rtl';
    const start = rtl ? box.right - width : box.left;
    setPlace({ top, left: Math.min(Math.max(8, start), window.innerWidth - width - 8), width });
  }, [open]);

  // The chosen time in the middle of the list, and the keyboard on it.
  useEffect(() => {
    if (!open || !place) return;
    const chosen = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (chosen && list.current)
      list.current.scrollTop = chosen.offsetTop - LIST_HEIGHT / 2 + chosen.offsetHeight / 2;
    list.current?.focus();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    const away = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  });

  const move = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const index = options.findIndex((option) => option.value === active);
    const to = (next: number) => {
      event.preventDefault();
      const option = options[Math.min(Math.max(next, 0), options.length - 1)];
      if (!option) return;
      setActive(option.value);
      list.current
        ?.querySelector<HTMLElement>(`[data-value="${CSS.escape(option.value)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    };
    if (event.key === 'ArrowDown') to(index + 1);
    else if (event.key === 'ArrowUp') to(index - 1);
    else if (event.key === 'PageDown') to(index + 4);
    else if (event.key === 'PageUp') to(index - 4);
    else if (event.key === 'Home') to(0);
    else if (event.key === 'End') to(options.length - 1);
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${label}: ${current?.label ?? ''}`}
        onClick={() => {
          setActive(value);
          setOpen((was) => !was);
        }}
        className={`inline-flex min-h-11 items-center rounded-xl px-3 text-[15px] font-bold text-text tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 motion-safe:transition-colors ${
          open ? 'bg-tint text-primary-text' : 'bg-canvas hover:bg-tint'
        }`}
      >
        {current?.label}
      </button>
      {open &&
        place &&
        createPortal(
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-${active}`}
            onKeyDown={move}
            style={{ top: place.top, left: place.left, width: place.width, height: LIST_HEIGHT }}
            className="fixed z-[60] m-0 list-none overflow-y-auto overscroll-contain rounded-2xl bg-surface p-1.5 shadow-toast outline-none"
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${id}-${option.value}`}
                  data-value={option.value}
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(option.value)}
                  onPointerMove={() => setActive(option.value)}
                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm tabular-nums ${
                    selected
                      ? 'bg-primary font-bold text-on-primary'
                      : option.value === active
                        ? 'bg-tint text-text'
                        : 'text-text'
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  {option.hint && (
                    <span
                      className={`text-xs ${selected ? 'text-on-primary opacity-80' : 'text-text-2'}`}
                    >
                      {option.hint}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}

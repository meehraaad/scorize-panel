import { useId, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { TextField } from './TextField';

/**
 * A text field with suggestions under it (autocomplete): what is typed is always the answer, and
 * a suggestion only fills it in. Unlike `SearchSelect`, nothing outside the list is refused, so a
 * new name (a major nobody listed) is kept as typed. The caller finds the suggestions (after a
 * pause in typing); the list shows while the field has the focus. Arrows move, Enter picks,
 * Escape closes. `onPick`: a suggestion stands for something (a colleague's id) instead of text: it
 * goes there, and the field keeps what was typed.
 */
export function SuggestField({
  suggestions,
  listLabel,
  describe,
  onPick,
  value,
  onValue,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: Omit<ComponentProps<typeof TextField>, 'value' | 'onChange'> & {
  value: string;
  onValue: (value: string) => void;
  /** Names to offer for what is typed now (the same text as typed is left out). */
  suggestions: readonly string[];
  /** The list's name for screen readers. */
  listLabel: string;
  /** How an option reads, when more than its value (a number with its owner's name). */
  describe?: (suggestion: string) => ReactNode;
  /** Picking a suggestion calls this instead of filling the field with it. */
  onPick?: (suggestion: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [focused, setFocused] = useState(false);
  const [closed, setClosed] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = suggestions.filter((one) => one.trim() !== value.trim());
  const open = focused && !closed && shown.length > 0;
  const current = Math.min(active, shown.length - 1);
  const optionId = (index: number) => `${id}-option-${String(index)}`;

  const pick = (suggestion: string | undefined) => {
    if (suggestion === undefined) return;
    if (onPick) onPick(suggestion);
    else onValue(suggestion);
    setClosed(true);
    setActive(-1);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (Math.max(index, -1) + step + shown.length) % shown.length);
    } else if (event.key === 'Enter' && current >= 0) {
      event.preventDefault();
      pick(shown[current]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setClosed(true);
    }
  };

  return (
    <div className="relative">
      <TextField
        {...props}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && current >= 0 ? optionId(current) : undefined}
        autoComplete="off"
        onChange={(event) => {
          onValue(event.target.value);
          setClosed(false);
          setActive(-1);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onKeyDown={onKey}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="absolute inset-x-0 top-full z-20 m-0 mt-1 flex max-h-64 list-none flex-col gap-1 overflow-y-auto rounded-2xl bg-surface p-1 shadow-float"
        >
          {shown.map((suggestion, index) => (
            <li
              key={suggestion}
              id={optionId(index)}
              role="option"
              aria-selected={index === current}
              onMouseEnter={() => setActive(index)}
              // The input keeps focus: a click picks without blurring it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(suggestion)}
              className={`flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-[15px] text-text ${
                index === current ? 'bg-tint' : ''
              }`}
            >
              {describe ? describe(suggestion) : suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

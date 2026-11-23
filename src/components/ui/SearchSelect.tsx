import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface SearchOption {
  value: string;
  label: string;
  /** A quiet line under the label (an English name, why it matched). */
  hint?: string | undefined;
}

/**
 * One answer out of many, found by typing: a combobox whose matches show as a short list under it
 * (arrows move, Enter picks, Escape clears the text). Once picked, the answer shows as one row with
 * a "change" button that brings the search back. The caller filters: `options` is what to list for
 * `search` now (it may list suggestions while the text is empty), `message` a quiet line at the
 * list's top (searching, no match, "usual ones").
 */
export function SearchSelect({
  label,
  hint,
  placeholder,
  value,
  onChange,
  search,
  onSearch,
  options,
  message,
  listLabel,
  changeLabel,
}: {
  label: string;
  hint?: string | undefined;
  /** A format hint only (the label always shows). */
  placeholder?: string | undefined;
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  search: string;
  onSearch: (text: string) => void;
  options: readonly SearchOption[];
  /** A quiet line at the top of the list; with no options and no message the list is closed. */
  message?: ReactNode;
  /** The list's name for screen readers. */
  listLabel: string;
  /** The button that drops the answer to search again. */
  changeLabel: string;
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  const count = options.length;
  const current = Math.min(active, count - 1);
  const open = count > 0 || Boolean(message);
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${String(index)}`;

  const pick = (option: SearchOption | undefined) => {
    if (!option) return;
    onChange(option);
    onSearch('');
    setActive(0);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // A form around it isn't sent by Enter: it picks.
      event.preventDefault();
      if (count > 0) pick(options[current]);
    } else if (event.key === 'Escape' && search) {
      event.preventDefault();
      onSearch('');
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count > 0) {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (Math.min(index, count - 1) + step + count) % count);
    }
  };

  if (value)
    return (
      <div className="flex flex-col gap-2">
        <span id={`${id}-label`} className="text-[15px] font-medium text-text">
          {label}
        </span>
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          className="flex items-center justify-between gap-3 rounded-2xl bg-tint px-4 py-3 shadow-[inset_0_0_0_1.5px_var(--primary)]"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex-none text-primary-text">
              <Icon name="check" size={18} />
            </span>
            <OptionText option={value} strong />
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onSearch('');
            }}
            className="min-h-11 flex-none rounded-full px-3 text-sm font-semibold text-primary-text hover:bg-surface"
          >
            {changeLabel}
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-medium text-text">
        {label}
      </label>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute start-4 text-text-3">
          <Icon name="search" size={18} />
        </span>
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={count > 0 ? optionId(current) : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          value={search}
          onChange={(event) => {
            onSearch(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          className="h-12 w-full rounded-2xl bg-surface ps-11 pe-4 text-base text-text shadow-[inset_0_0_0_1px_var(--line-2)] outline-none placeholder:text-text-3 focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]"
        />
      </div>
      {hint && (
        <span id={`${id}-hint`} className="text-sm text-text-2">
          {hint}
        </span>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto rounded-2xl bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line-2)]"
        >
          {message && (
            <li role="presentation" className="px-3 py-2 text-sm text-text-2">
              {message}
            </li>
          )}
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={index === current}
              onMouseEnter={() => setActive(index)}
              // The input keeps focus: a click picks without blurring it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              className={`flex min-h-12 cursor-pointer items-center rounded-xl px-3 py-2 ${
                index === current ? 'bg-tint' : ''
              }`}
            >
              <OptionText option={option} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OptionText({ option, strong = false }: { option: SearchOption; strong?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={`text-[15px] text-text ${strong ? 'font-semibold' : 'font-medium'}`}>
        {option.label}
      </span>
      {option.hint && <span className="text-xs text-text-2">{option.hint}</span>}
    </span>
  );
}

import { tabClass } from './buttonStyles';
import { Icon } from './Icon';

/** A row of pill buttons to filter a list, each with its count. Scrolls sideways on phones. */
export function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  /** `count` already formatted for the locale. */
  options: readonly { value: T; label: string; count?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={tabClass(value === option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="text-[13px] font-normal text-text-2">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Search box with its icon; the label is for screen readers (the placeholder shows the hint). */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  className = 'flex-[1_1_100%] sm:flex-[0_1_300px]',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label
      className={`flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] focus-within:shadow-[inset_0_0_0_2px_var(--focus)] ${className}`}
    >
      <Icon name="search" size={18} />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-text outline-0 placeholder:text-text-2"
      />
    </label>
  );
}

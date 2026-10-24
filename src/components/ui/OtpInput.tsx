import { useState, type ComponentProps, type Ref } from 'react';

interface Props extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'ref'> {
  /** Digits in the code (Django's login code: 6). */
  length: number;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  ref?: Ref<HTMLInputElement>;
}

/**
 * An SMS code as boxes (design), backed by ONE real input laid over them. A single input keeps
 * paste, SMS autofill (`one-time-code`), screen readers and Backspace working like any text field.
 */
export function OtpInput({ length, value, onChange, invalid, className = '', ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);

  const ring = (index: number) => {
    if (invalid) return 'shadow-[inset_0_0_0_2px_var(--danger)] text-danger';
    if (focused && index === active) return 'shadow-[inset_0_0_0_2px_var(--focus)]';
    return 'shadow-[inset_0_0_0_1.5px_var(--line-2)]';
  };

  return (
    <div dir="ltr" className="relative">
      <div
        aria-hidden="true"
        className="grid gap-2 sm:gap-2.5"
        style={{ gridTemplateColumns: `repeat(${String(length)}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            className={`flex h-14 items-center justify-center rounded-[18px] bg-surface text-[26px] font-semibold text-text tabular-nums transition-shadow sm:h-16 ${ring(index)}`}
          >
            {value[index] ?? ''}
          </span>
        ))}
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Invisible but on top of the boxes: a tap anywhere on them focuses it. 16px: no iOS zoom.
        className={`absolute inset-0 size-full text-base text-transparent caret-transparent opacity-0 outline-none ${className}`}
        {...props}
      />
    </div>
  );
}

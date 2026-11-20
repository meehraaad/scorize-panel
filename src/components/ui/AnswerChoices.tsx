import { useId, type ReactNode } from 'react';
import { Icon } from './Icon';

/*
 * The large answers of a one-question-per-screen quiz (the pathway finder). In their own file, not
 * a look of `ChoiceGroup`: only the quiz draws them, so they stay out of the first load.
 */

/** A large answer row; checked = primary ring on the tint. */
const answer =
  'flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl bg-canvas px-5 py-4 text-start transition-colors hover:bg-track lg:px-6 has-checked:bg-tint has-checked:shadow-[inset_0_0_0_2px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';
/** The same row inside a `CheckTile`, which draws the box itself. */
const row =
  'flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl px-5 py-4 text-start lg:px-6 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';
/** An answer's picture: a line icon, a level or a flag. */
const picture =
  'flex size-12 flex-none items-center justify-center overflow-hidden rounded-[14px] bg-surface text-primary-text';

function Text({ label, hint }: { label: string; hint?: string | undefined }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-lg leading-7 font-semibold">{label}</span>
      {hint && <span className="text-sm leading-6 text-text-2">{hint}</span>}
    </span>
  );
}

export interface Answer<T extends string> {
  value: T;
  label: string;
  /** A line under the label. */
  hint?: string | undefined;
  /** At the start: a line icon, a level, a flag. */
  icon?: ReactNode;
  /** At the end of the row (its key on the keyboard). */
  extra?: ReactNode;
}

/** One answer out of a few, as real radio buttons: large rows, two columns from lg up. */
export function AnswerGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly Answer<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-3 lg:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className={answer}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon && (
              <span aria-hidden="true" className={picture}>
                {option.icon}
              </span>
            )}
            <Text label={option.label} hint={option.hint} />
            {value === option.value ? (
              <span
                aria-hidden="true"
                className="flex size-7 flex-none items-center justify-center rounded-full bg-primary text-on-primary"
              >
                <Icon name="check" size={16} />
              </span>
            ) : (
              option.extra
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * One of several picks (a quiz's "which countries"): a checkbox row with its picture, and what to
 * ask about the pick inside it once it is checked (years there).
 */
export function CheckTile({
  label,
  checked,
  onChange,
  icon,
  note,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** At the start: a flag, or a line icon ("none"). */
  icon?: ReactNode;
  /** A line under the label once checked ("2 years"). */
  note?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-canvas transition-colors hover:bg-track has-checked:bg-tint has-checked:shadow-[inset_0_0_0_2px_var(--primary)]">
      <label className={row}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
        />
        {icon && (
          <span aria-hidden="true" className={picture}>
            {icon}
          </span>
        )}
        <Text label={label} hint={checked ? note : undefined} />
        <span
          aria-hidden="true"
          className={`flex size-7 flex-none items-center justify-center rounded-lg ${
            checked ? 'bg-primary text-on-primary' : 'border-[1.5px] border-line-3'
          }`}
        >
          {checked && <Icon name="check" size={16} />}
        </span>
      </label>
      {checked && children && (
        <div
          className="px-5 pb-4 lg:px-6"
          style={icon ? { paddingInlineStart: '5.25rem' } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}

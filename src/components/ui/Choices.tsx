import { useId, type ComponentProps, type ReactNode } from 'react';
import { Icon } from './Icon';

/** The pill look of a radio or checkbox label; checked = filled with the dark hero colour. */
const pill =
  'inline-flex min-h-11 flex-none cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap text-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)] has-checked:bg-hero has-checked:text-on-hero has-checked:shadow-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

/** A tile: a title and a line under it, checked = primary ring (outcomes, message templates). */
const tile =
  'flex min-h-11 cursor-pointer flex-col gap-1 rounded-2xl px-4 py-3 text-start shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)] has-checked:bg-tint has-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** `tiles` only: a line under the label. */
  hint?: string | undefined;
}

/**
 * One choice out of a few, as real radio buttons drawn as pills or tiles (call outcome, when to
 * follow up, who a task is for). A fieldset named by its legend.
 */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  look = 'pills',
  hint,
  hideLegend = false,
}: {
  legend: string;
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** `pills`: a wrapping row of short labels; `tiles`: a grid of labelled boxes. */
  look?: 'pills' | 'tiles';
  /** Under the choices: what the pick does. */
  hint?: ReactNode;
  hideLegend?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className={hideLegend ? 'sr-only' : 'mb-2.5 p-0 text-sm font-semibold text-text-2'}>
        {legend}
      </legend>
      <div className={look === 'pills' ? 'flex flex-wrap gap-2' : 'grid gap-2 sm:grid-cols-2'}>
        {options.map((option) => (
          <label key={option.value} className={look === 'pills' ? pill : tile}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {look === 'pills' ? (
              option.label
            ) : (
              <>
                <span className="text-[15px] font-semibold">{option.label}</span>
                {option.hint && (
                  <span className="text-sm leading-6 text-text-2">{option.hint}</span>
                )}
              </>
            )}
          </label>
        ))}
      </div>
      {hint && <span className="text-sm leading-6 text-text-2">{hint}</span>}
    </fieldset>
  );
}

/** A checkbox drawn as a pill ("Only overdue"). */
export function TogglePill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`${pill} gap-2 bg-surface`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {checked && <Icon name="check" size={16} />}
      {label}
    </label>
  );
}

const box =
  'w-full rounded-2xl bg-surface px-4 text-base text-text shadow-[inset_0_0_0_1px_var(--line-2)] outline-none placeholder:text-text-3 hover:shadow-[inset_0_0_0_1px_var(--line-3)] focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] aria-invalid:shadow-[inset_0_0_0_1.5px_var(--danger)]';

/** A labelled <select> with the field look. `inline`: label beside a pill select (toolbars). */
export function SelectField<T extends string>({
  label,
  options,
  value,
  onChange,
  inline = false,
  hint,
  error,
  id: givenId,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  inline?: boolean;
  hint?: string | undefined;
  error?: string | undefined;
  /** The select's id, to focus it from a form's check; generated when not given. */
  id?: string;
}) {
  const generatedId = useId();
  const id = givenId ?? generatedId;
  const message = error ?? hint;
  const select = (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(options.find((option) => option.value === event.target.value)?.value ?? value)
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? `${id}-message` : undefined}
        className={
          inline
            ? 'h-11 appearance-none rounded-full bg-surface ps-4 pe-10 text-sm text-text shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]'
            : `${box} h-12 appearance-none pe-10`
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={16}
        className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-text-2"
      />
    </div>
  );
  if (inline)
    return (
      <div className="inline-flex items-center gap-2">
        <label htmlFor={id} className="text-sm text-text-2">
          {label}
        </label>
        {select}
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-text-2">
        {label}
      </label>
      {select}
      {message && (
        <p
          id={`${id}-message`}
          className={`m-0 text-sm leading-6 ${error ? 'text-danger' : 'text-text-2'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/** A labelled multi-line field. */
export function TextAreaField({
  label,
  hint,
  className = '',
  ...props
}: ComponentProps<'textarea'> & { label: string; hint?: string | undefined }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-text-2">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${box} resize-y py-3 leading-7 ${className}`}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="m-0 text-sm leading-6 text-text-2">
          {hint}
        </p>
      )}
    </div>
  );
}

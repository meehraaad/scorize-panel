import { useId, type ComponentProps, type ReactNode } from 'react';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'size'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  /** Inline control at the end of the input, e.g. a show-password button. */
  trailing?: ReactNode;
}

/**
 * Labelled input with hint and error wired up for screen readers. 16px text so iOS doesn't zoom
 * on focus. The visible label is always present; placeholders are never a substitute.
 */
export function TextField({
  label,
  hint,
  error,
  trailing,
  id,
  className = '',
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[15px] font-medium text-text">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`h-12 w-full rounded-2xl bg-surface px-4 text-base text-text shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow outline-none placeholder:text-text-3 read-only:bg-canvas read-only:text-text-2 hover:shadow-[inset_0_0_0_1px_var(--line-3)] focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] aria-invalid:shadow-[inset_0_0_0_1.5px_var(--danger)] ${trailing ? 'pe-14' : ''} ${className}`}
          {...props}
        />
        {trailing && <div className="absolute end-1.5 flex items-center">{trailing}</div>}
      </div>
      {message && (
        <p
          id={messageId}
          className={`m-0 text-sm leading-6 ${error ? 'text-danger' : 'text-text-2'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

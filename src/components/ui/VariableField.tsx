import { useId, useRef, type ReactNode } from 'react';
import { PLACEHOLDER, type FieldVariable } from '@/lib/messageVariables';
import { Icon } from './Icon';

/**
 * A message text with its variables one tap away: a row of buttons above the box, each puts its
 * `{name}` where the cursor is (no braces to type). Every word comes from the caller.
 */
export function VariableField({
  label,
  hint,
  error,
  value,
  onChange,
  variables,
  variablesLabel,
  rows = 6,
  disabled = false,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  variables: readonly FieldVariable[];
  /** Names the button row for screen readers ("Add a variable"). */
  variablesLabel: string;
  rows?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const message = error ?? hint;

  const insert = (name: string) => {
    const element = box.current;
    const token = `{${name}}`;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    // Back in the box, the cursor after what was added.
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-medium text-text">
        {label}
      </label>
      {variables.length > 0 && (
        <div role="group" aria-label={variablesLabel} className="flex flex-wrap gap-2">
          {variables.map((variable) => (
            <button
              key={variable.name}
              type="button"
              disabled={disabled}
              onClick={() => insert(variable.name)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-medium text-primary-text hover:brightness-95 disabled:opacity-60"
            >
              <Icon name="plus" size={14} />
              {variable.label}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={box}
        id={id}
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? `${id}-message` : undefined}
        className="w-full resize-y rounded-2xl bg-surface px-4 py-3 text-base leading-8 text-text shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow outline-none hover:shadow-[inset_0_0_0_1px_var(--line-3)] focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] disabled:bg-canvas disabled:text-text-2 aria-invalid:shadow-[inset_0_0_0_1.5px_var(--danger)]"
      />
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

/** The text as it will read, each variable replaced by its sample and marked. */
export function VariablePreview({
  label,
  text,
  variables,
}: {
  label: string;
  text: string;
  variables: readonly FieldVariable[];
}) {
  const samples = new Map(variables.map((variable) => [variable.name, variable.sample]));
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const sample = samples.get(match[1] ?? '');
    if (sample === undefined) continue;
    parts.push(text.slice(last, match.index));
    parts.push(
      <mark key={match.index} className="rounded-md bg-tint px-1 text-primary-text">
        {sample}
      </mark>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-text-2">{label}</span>
      <p className="m-0 rounded-2xl bg-canvas px-4 py-3 text-[15px] leading-8 [overflow-wrap:anywhere] whitespace-pre-wrap">
        {parts}
      </p>
    </section>
  );
}

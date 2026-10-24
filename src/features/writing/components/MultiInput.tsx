import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TagList } from '@/components/ui/Tags';
import type { FieldSpec, FormType } from '../formSpec';
import { useFormText } from '../useFormText';

interface Props {
  type: FormType;
  /** A `checks` or `tags` field. */
  field: FieldSpec;
  value: readonly string[];
  id: string;
  missing: boolean;
  readOnly: boolean;
  onChange: (value: string[]) => void;
}

/** Longest tag (Django's ResearchInterest name). */
const MAX_TAG = 64;

/**
 * A question answered with several values: checkboxes of its options (target countries), or tags
 * the applicant types and removes (research interests).
 */
export function MultiInput({ type, field, value, id, missing, readOnly, onChange }: Props) {
  const { t } = useTranslation('writing');
  const { text, has } = useFormText(type);
  const [draft, setDraft] = useState('');
  const helpKey = `help.${field.name}`;
  const describedBy = [has(helpKey) && `${id}-help`, missing && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  const label = (
    <>
      {text(`field.${field.name}`)}{' '}
      {!field.required && <span className="text-xs font-normal text-text-2">{t('optional')}</span>}
    </>
  );
  const help = has(helpKey) && (
    <span id={`${id}-help`} className="text-[13px] leading-7 text-text-2">
      {text(helpKey)}
    </span>
  );
  const error = missing && (
    <span id={`${id}-error`} className="text-[13px] leading-7 text-danger">
      {t('requiredError')}
    </span>
  );

  if (field.kind === 'checks') {
    const options = (field.options?.values ?? []).map(String);
    const toggle = (option: string, on: boolean) =>
      onChange(
        on
          ? options.filter((o) => o === option || value.includes(o))
          : value.filter((v) => v !== option),
      );
    return (
      <fieldset
        className="col-span-full m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
        aria-describedby={describedBy || undefined}
      >
        <legend className="mb-2 p-0 text-[15px] leading-7 font-semibold">{label}</legend>
        {help}
        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-canvas ps-3.5 pe-4 text-sm font-medium shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-tint has-checked:text-primary-text has-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-focus"
            >
              <input
                type="checkbox"
                id={index === 0 ? id : undefined}
                checked={value.includes(option)}
                disabled={readOnly}
                onChange={(event) => toggle(option, event.target.checked)}
                className="size-4 flex-none accent-primary"
              />
              {text(`option.${field.options?.set ?? ''}.${option}`)}
            </label>
          ))}
        </div>
        {error}
      </fieldset>
    );
  }

  const add = () => {
    const tag = draft.trim().slice(0, MAX_TAG);
    if (!tag) return;
    if (!value.some((item) => item.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft('');
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    // Enter adds the tag instead of submitting the form.
    event.preventDefault();
    add();
  };

  return (
    <div className="col-span-full flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-[15px] leading-7 font-semibold">
        {label}
      </label>
      {help}
      {value.length > 0 && (
        <TagList
          label={text(`field.${field.name}`)}
          tags={value}
          latin={Boolean(field.ltr)}
          disabled={readOnly}
          {...(readOnly
            ? {}
            : {
                removeLabel: (tag: string) => t('tags.remove', { tag }),
                onRemove: (tag: string) => onChange(value.filter((item) => item !== tag)),
              })}
        />
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            id={id}
            type="text"
            dir={field.ltr ? 'ltr' : 'auto'}
            value={draft}
            maxLength={MAX_TAG}
            placeholder={
              has(`placeholder.${field.name}`) ? text(`placeholder.${field.name}`) : undefined
            }
            aria-describedby={describedBy || undefined}
            aria-invalid={missing ? true : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
            className={`h-12 min-w-0 flex-1 rounded-[14px] bg-canvas px-4 text-[15px] text-text outline-0 placeholder:text-text-2 focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] ${
              missing
                ? 'shadow-[inset_0_0_0_1.5px_var(--danger)]'
                : 'shadow-[inset_0_0_0_1px_var(--line-2)]'
            }`}
          />
          <Button variant="outline" className="h-12 flex-none" onClick={add}>
            {t('tags.add')}
          </Button>
        </div>
      )}
      {error}
    </div>
  );
}

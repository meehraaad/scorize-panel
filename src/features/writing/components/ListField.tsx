import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import {
  applies,
  isAnswered,
  itemGaps,
  type FormType,
  type ListItem,
  type ListSpec,
  type Scalar,
} from '../formSpec';
import { useFormText } from '../useFormText';
import { FieldInput } from './FieldInput';

interface Props {
  type: FormType;
  list: ListSpec;
  items: ListItem[];
  readOnly: boolean;
  /** A heading above the list (sections with more than one list). */
  showTitle: boolean;
  /** Keys from a final submit: the list name (no entry) or "<list>.<index>". */
  missing: ReadonlySet<string>;
  /** Open this entry's editor (a final submit pointed at it). */
  focusItem: number | null;
  onChange: (items: ListItem[]) => void;
}

/**
 * A repeating part of the form (work experience, courses, …): entries as cards, one editor open at
 * a time, "add" at the bottom. Removing asks first. Every change goes to the draft (autosave).
 */
export function ListField({
  type,
  list,
  items,
  readOnly,
  showTitle,
  missing,
  focusItem,
  onChange,
}: Props) {
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  const f = useFormat();
  const [editing, setEditing] = useState<number | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [removing, setRemoving] = useState<number | null>(null);
  const prefix = `${type}-${list.name}`;
  const listMissing = missing.has(list.name) && items.length === 0;

  // An entry asked for from outside (a missing answer) opens for editing. Adjusted while
  // rendering, not in an effect, so it shows in the same paint.
  const [focused, setFocused] = useState<number | null>(null);
  if (focusItem !== focused) {
    setFocused(focusItem);
    if (focusItem !== null) {
      setEditing(focusItem);
      setChecked((previous) => new Set(previous).add(focusItem));
    }
  }

  const valueText = (name: string, value: Scalar | undefined) => {
    const field = list.fields.find((candidate) => candidate.name === name);
    if (!isAnswered(value ?? null)) return null;
    return field?.options ? text(`option.${field.options.set}.${String(value)}`) : String(value);
  };
  const titleOf = (item: ListItem, index: number) =>
    valueText(list.title, item[list.title]) ?? t('list.untitled', { n: f.number(index + 1) });

  const update = (index: number, name: string, value: Scalar) => {
    onChange(items.map((item, at) => (at === index ? { ...item, [name]: value } : item)));
  };

  const add = () => {
    onChange([...items, {}]);
    setEditing(items.length);
  };

  const close = (index: number) => {
    const item = items[index];
    if (!item) return;
    // An untouched new entry: leaving it means not adding it.
    if (!Object.values(item).some((value) => isAnswered(value))) {
      onChange(items.filter((_, at) => at !== index));
      setEditing(null);
      return;
    }
    const gaps = itemGaps(list, item);
    if (gaps.length) {
      setChecked((previous) => new Set(previous).add(index));
      document.getElementById(`${prefix}-${String(index)}-${gaps[0] ?? ''}`)?.focus();
      return;
    }
    setEditing(null);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, at) => at !== index));
    setRemoving(null);
    setEditing(null);
    setChecked(new Set());
  };

  return (
    <div className="col-span-full flex min-w-0 flex-col gap-2.5">
      {showTitle && <h3 className="m-0 text-base font-bold">{text(`field.${list.name}`)}</h3>}

      {items.map((item, index) => {
        const title = titleOf(item, index);
        const subtitle = (list.subtitle ?? [])
          .map((name) => valueText(name, item[name]))
          .filter(Boolean);
        const [start, end] = list.period ?? [];
        const period =
          start && isAnswered(item[start] ?? null)
            ? `${String(item[start])} – ${isAnswered(item[end ?? ''] ?? null) ? String(item[end ?? '']) : t('list.present')}`
            : null;
        const showErrors = checked.has(index) || missing.has(`${list.name}.${String(index)}`);
        const gaps = new Set(showErrors ? itemGaps(list, item) : []);

        if (removing === index && !readOnly)
          return (
            <InlineConfirm
              key={index}
              message={t('list.confirmRemove', { name: title })}
              confirmLabel={t('list.remove')}
              cancelLabel={t('list.cancel')}
              onConfirm={() => remove(index)}
              onCancel={() => setRemoving(null)}
            />
          );

        if (editing === index && !readOnly)
          return (
            <fieldset
              key={index}
              className="m-0 flex min-w-0 flex-col gap-4 rounded-2xl border-0 p-4 shadow-[inset_0_0_0_1.5px_var(--primary)]"
            >
              <legend className="sr-only">{title}</legend>
              <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                {list.fields
                  .filter((field) => applies(field, item))
                  .map((field) => (
                    <FieldInput
                      key={field.name}
                      type={type}
                      field={field}
                      value={item[field.name]}
                      id={`${prefix}-${String(index)}-${field.name}`}
                      labelKey={`item.${list.name}.${field.name}`}
                      missing={gaps.has(field.name)}
                      onChange={(value) => update(index, field.name, value)}
                    />
                  ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => close(index)}>{t('list.done')}</Button>
              </div>
            </fieldset>
          );

        return (
          <div
            key={index}
            className={`flex items-center gap-3 rounded-2xl py-3.5 ps-4 pe-2 ${
              showErrors && gaps.size
                ? 'shadow-[inset_0_0_0_1.5px_var(--danger)]'
                : 'shadow-[inset_0_0_0_1px_var(--line-2)]'
            }`}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <bdi className="truncate text-[15px] font-semibold">{title}</bdi>
              {(subtitle.length > 0 || period) && (
                <bdi className="truncate text-[13px] text-text-2">
                  {[...subtitle, period].filter(Boolean).join(' · ')}
                </bdi>
              )}
              {showErrors && gaps.size > 0 && (
                <span className="text-[13px] text-danger">{t('list.incomplete')}</span>
              )}
            </span>
            {list.link && safeHref(String(item[list.link] ?? '')) && (
              <a
                href={safeHref(String(item[list.link]))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 flex-none items-center px-2 text-sm font-medium"
              >
                {text(`linkLabel.${list.name}`)}
              </a>
            )}
            {!readOnly && (
              <>
                <IconButton
                  icon="pen"
                  iconSize={18}
                  aria-label={t('list.edit', { name: title })}
                  onClick={() => setEditing(index)}
                />
                <IconButton
                  icon="trash"
                  iconSize={18}
                  tone="danger"
                  aria-label={t('list.removeNamed', { name: title })}
                  onClick={() => setRemoving(index)}
                />
              </>
            )}
          </div>
        );
      })}

      {readOnly && items.length === 0 && (
        <p className="m-0 text-sm text-text-2">{t('list.none')}</p>
      )}

      {!readOnly && editing === null && (
        <button
          id={`${prefix}-add`}
          type="button"
          onClick={add}
          aria-describedby={listMissing ? `${prefix}-error` : undefined}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed text-[15px] font-semibold text-primary-text ${
            listMissing ? 'border-danger' : 'border-line-3'
          }`}
        >
          <Icon name="plus" size={18} />
          {text(`add.${list.name}`)}
        </button>
      )}
      {listMissing && (
        <span id={`${prefix}-error`} className="text-[13px] leading-7 text-danger">
          {t('list.required')}
        </span>
      )}
    </div>
  );
}

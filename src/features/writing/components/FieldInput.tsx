import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinNumber } from '@/lib/text';
import { parseTerm, upcomingTerms, type FieldSpec, type FormType, type Scalar } from '../formSpec';
import { useFormText } from '../useFormText';

interface Props {
  type: FormType;
  field: FieldSpec;
  value: Scalar | undefined;
  /** Element id; also prefixes the help and error ids. */
  id: string;
  /** Dictionary key of the label (`field.<name>` or `item.<list>.<name>`), help is `help.<same>`. */
  labelKey: string;
  /** Shown after a final submit (or closing an entry) found this required field empty. */
  missing: boolean;
  onChange: (value: Scalar) => void;
}

const box =
  'w-full rounded-[14px] bg-canvas px-4 text-[15px] text-text outline-0 placeholder:text-text-2 focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] disabled:text-text-2';
const ring = (missing: boolean) =>
  missing ? 'shadow-[inset_0_0_0_1.5px_var(--danger)]' : 'shadow-[inset_0_0_0_1px_var(--line-2)]';

const INPUT_TYPE = {
  text: 'text',
  email: 'email',
  tel: 'tel',
  url: 'url',
  date: 'date',
  month: 'month',
  number: 'text',
} as const;

/** One question: label, optional help, the input that fits its kind, and its error. */
export function FieldInput({ type, field, value, id, labelKey, missing, onChange }: Props) {
  const { t } = useTranslation('writing');
  const { text, has } = useFormText(type);
  const f = useFormat();
  const helpKey = labelKey.replace(/^(field|item)\./, 'help.');
  const hasHelp = has(helpKey);
  const describedBy = [hasHelp && `${id}-help`, missing && `${id}-error`].filter(Boolean).join(' ');
  const describe = describedBy ? { 'aria-describedby': describedBy } : {};
  const invalid = missing ? { 'aria-invalid': true } : {};
  const dir = field.ltr ? 'ltr' : 'auto';
  const wide = field.wide || field.kind === 'textarea';
  const current =
    typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  // A start term offers the next intakes (and keeps a stored one that has passed).
  const terms = field.kind === 'term' ? upcomingTerms() : [];
  if (field.kind === 'term' && current && !terms.includes(current)) terms.unshift(current);
  const options = field.kind === 'term' ? terms : (field.options?.values ?? []);
  const optionText = (option: Scalar) => {
    if (field.kind === 'term') {
      const term = parseTerm(String(option));
      return term
        ? t(`term.${term.season}`, { year: f.digits(String(term.year)) })
        : String(option);
    }
    return text(`option.${field.options?.set ?? ''}.${String(option)}`);
  };

  const label = (
    <>
      {text(labelKey)}{' '}
      {!field.required && <span className="text-xs font-normal text-text-2">{t('optional')}</span>}
    </>
  );
  const help = hasHelp && (
    <span id={`${id}-help`} className="text-[13px] leading-7 text-text-2">
      {text(helpKey)}
    </span>
  );
  const error = missing && (
    <span id={`${id}-error`} className="text-[13px] leading-7 text-danger">
      {t('requiredError')}
    </span>
  );

  if (field.kind === 'choice')
    return (
      <fieldset
        className={`m-0 flex min-w-0 flex-col gap-2 border-0 p-0 ${wide ? 'col-span-full' : ''}`}
        {...describe}
      >
        <legend className="mb-2 p-0 text-[15px] leading-7 font-semibold">{label}</legend>
        {help}
        {field.layout === 'stack' ? (
          <div className="flex flex-col gap-2">
            {options.map((option, index) => (
              <label
                key={String(option)}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] bg-canvas px-4 py-2.5 text-[15px] leading-7 shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-tint has-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name={id}
                  id={index === 0 ? id : undefined}
                  className="size-[18px] flex-none accent-primary"
                  checked={value === option}
                  onChange={() => onChange(option)}
                />
                {optionText(option)}
              </label>
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5 rounded-full bg-canvas p-1 shadow-[inset_0_0_0_1px_var(--line-2)]">
            {options.map((option, index) => (
              <label
                key={String(option)}
                className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-center text-sm font-semibold text-text-2 has-checked:bg-surface has-checked:text-text has-checked:shadow-[0_1px_3px_rgb(27_16_32/0.12)] has-focus-visible:outline-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name={id}
                  id={index === 0 ? id : undefined}
                  className="sr-only"
                  checked={value === option}
                  onChange={() => onChange(option)}
                />
                {optionText(option)}
              </label>
            ))}
          </div>
        )}
        {error}
      </fieldset>
    );

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${wide ? 'col-span-full' : ''}`}>
      <label htmlFor={id} className="text-[15px] leading-7 font-semibold">
        {label}
      </label>
      {help}
      {field.kind === 'textarea' ? (
        <>
          <textarea
            id={id}
            dir={dir}
            rows={field.ltr ? 4 : 5}
            value={current}
            onChange={(event) => onChange(event.target.value)}
            className={`${box} ${ring(missing)} resize-y py-3.5 leading-8`}
            {...describe}
            {...invalid}
          />
          <span className="text-end text-xs text-text-2">
            {current.trim() ? t('chars', { n: f.number(current.length) }) : t('nothingYet')}
          </span>
        </>
      ) : field.kind === 'select' || field.kind === 'term' ? (
        <div className="relative">
          <select
            id={id}
            value={current}
            onChange={(event) =>
              onChange(options.find((option) => String(option) === event.target.value) ?? null)
            }
            className={`${box} ${ring(missing)} h-12 appearance-none pe-10`}
            {...describe}
            {...invalid}
          >
            {current === '' && (
              <option value="" disabled>
                {t('choose')}
              </option>
            )}
            {options.map((option) => (
              <option key={String(option)} value={String(option)}>
                {optionText(option)}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            size={18}
            className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-text-2"
          />
        </div>
      ) : (
        <input
          id={id}
          type={
            field.kind in INPUT_TYPE ? INPUT_TYPE[field.kind as keyof typeof INPUT_TYPE] : 'text'
          }
          dir={field.kind === 'date' || field.kind === 'month' ? 'ltr' : dir}
          value={current}
          maxLength={field.maxLength}
          inputMode={field.kind === 'number' ? 'decimal' : undefined}
          autoComplete={field.kind === 'email' ? 'email' : field.kind === 'tel' ? 'tel' : 'off'}
          onChange={(event) =>
            onChange(
              field.kind === 'number' ? toLatinNumber(event.target.value) : event.target.value,
            )
          }
          className={`${box} ${ring(missing)} h-12 ${field.ltr || field.kind === 'date' || field.kind === 'month' ? 'text-start' : ''}`}
          {...describe}
          {...invalid}
        />
      )}
      {error}
    </div>
  );
}

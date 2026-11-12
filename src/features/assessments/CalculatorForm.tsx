import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import type { FormSchema } from './calculatorApi';

/** Typed groups preserve absent fields; blank never becomes zero or false. */
export function CalculatorForm({
  schema,
  field,
  value,
  onChange,
}: {
  schema: FormSchema;
  field: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation('assessments');
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const choicesText = t('calculator.choices', { returnObjects: true }) as Record<string, string>;
  const label = labels[field.replaceAll('.', '_')] ?? t('calculator.unknown');
  if (schema.type === 'object') {
    const object = (value ?? {}) as Record<string, unknown>;
    return (
      <fieldset className="border-line flex min-w-0 flex-col gap-4 rounded-xl border p-4">
        <legend>{label}</legend>
        {Object.entries(schema.properties ?? {}).map(([key, child]) => (
          <CalculatorForm
            key={key}
            schema={child}
            field={key}
            value={object[key]}
            onChange={(next) => {
              onChange(
                next === undefined
                  ? Object.fromEntries(Object.entries(object).filter(([name]) => name !== key))
                  : { ...object, [key]: next },
              );
            }}
          />
        ))}
      </fieldset>
    );
  }
  if (schema.type === 'array' && schema.items) {
    const rows = (value ?? []) as unknown[];
    const itemSchema = schema.items;
    return (
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend>{label}</legend>
        <p className="text-sm text-text-2">{t('calculator.halfOpenDates')}</p>
        {value === undefined && (
          <Button variant="outline" onClick={() => onChange([])}>
            {t('calculator.noEmployment')}
          </Button>
        )}
        {rows.map((row, index) => (
          <div key={index} className="flex flex-col gap-2">
            <CalculatorForm
              schema={itemSchema}
              field="employment"
              value={row}
              onChange={(next) => onChange(rows.map((r, i) => (i === index ? next : r)))}
            />
            <Button variant="outline" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              {t('calculator.removePeriod')}
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          disabled={rows.length >= 100}
          onClick={() => onChange([...rows, {}])}
        >
          {t('calculator.addPeriod')}
        </Button>
      </fieldset>
    );
  }
  if (schema.type === 'choice' || schema.type === 'boolean') {
    const choices = schema.type === 'boolean' ? ['true', 'false'] : (schema.choices ?? []);
    return (
      <SelectField
        label={label}
        value={
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : ''
        }
        options={[
          { value: '', label: t('calculator.unknown') },
          ...choices.map((key) => ({
            value: key,
            label: choicesText[key] ?? t('calculator.unknown'),
          })),
        ]}
        onChange={(next) =>
          onChange(next === '' ? undefined : schema.type === 'boolean' ? next === 'true' : next)
        }
      />
    );
  }
  const numeric = schema.type === 'number' || schema.type === 'integer';
  const numberStep = schema.type === 'integer' ? 1 : 'any';
  return (
    <TextField
      label={label}
      type={schema.type === 'date' ? 'date' : numeric ? 'number' : 'text'}
      {...(numeric ? { step: numberStep } : {})}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      onChange={(event) =>
        onChange(
          event.target.value === ''
            ? undefined
            : numeric
              ? Number(event.target.value)
              : event.target.value,
        )
      }
    />
  );
}

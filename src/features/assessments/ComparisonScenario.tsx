import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { CalculatorForm } from './CalculatorForm';
import { calculatorOptionsQuery, interviewQuery, previewComparison } from './calculatorApi';
import type { Comparison, Country } from './calculatorApi';

export function ComparisonScenario({
  id,
  comparison,
  disabled,
}: {
  id: string;
  comparison: Comparison;
  disabled: boolean;
}) {
  const { t } = useTranslation('assessments');
  const options = useQuery(calculatorOptionsQuery);
  const interview = useQuery(interviewQuery(id));
  const [country, setCountry] = useState<Country>('canada');
  const [field, setField] = useState('');
  const [value, setValue] = useState<unknown>();
  const mutation = useMutation({
    mutationFn: () =>
      previewComparison(id, {
        revision: comparison.context.session_revision,
        decision_sha256: comparison.decision_sha256,
        changes: [{ country, field, status: 'known', value }],
      }),
    retry: false,
  });
  const labels = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const words = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  const schema = options.data?.schemas[country][field];
  const invalidate = () => mutation.reset();
  return (
    <section className="border-line flex min-w-0 flex-col gap-3 rounded-2xl border p-4">
      <h3 className="font-bold">{t('scenario.title')}</h3>
      <Notice tone="warn">{t('scenario.explanation')}</Notice>
      <SelectField
        label={t('scenario.country')}
        value={country}
        disabled={disabled || mutation.isPending}
        options={(['canada', 'australia'] as const).map((c) => ({
          value: c,
          label: words[c] ?? c,
        }))}
        onChange={(next) => {
          setCountry(next);
          setField('');
          setValue(undefined);
          invalidate();
        }}
      />
      <SelectField
        label={t('scenario.field')}
        value={field}
        disabled={disabled || mutation.isPending || !options.data}
        options={[
          { value: '', label: t('scenario.select') },
          ...Object.keys(options.data?.schemas[country] ?? {}).map((key) => ({
            value: key,
            label: labels[key.replaceAll('.', '_')] ?? t('calculator.unknown'),
          })),
        ]}
        onChange={(next) => {
          setField(next);
          const identity = options.data?.identities[country][next];
          const answer = identity ? interview.data?.answers[identity] : undefined;
          setValue(answer?.status === 'known' ? structuredClone(answer.value) : undefined);
          invalidate();
        }}
      />
      {schema && (
        <fieldset disabled={disabled || mutation.isPending}>
          <CalculatorForm
            schema={schema}
            field={field}
            value={value}
            onChange={(next) => {
              setValue(next);
              invalidate();
            }}
          />
        </fieldset>
      )}
      <Button
        disabled={disabled || mutation.isPending || !schema || value === undefined}
        onClick={() => mutation.mutate()}
      >
        {t('scenario.preview')}
      </Button>
      {mutation.error && <Notice tone="error">{t('scenario.failed')}</Notice>}
      {mutation.data && !disabled && (
        <div>
          <p>{t('scenario.result')}</p>
          <ul className="list-inside list-disc">
            {mutation.data.after.map((after) => {
              const before = mutation.data.before.find((item) => item.route_id === after.route_id);
              return (
                <li key={after.route_id}>
                  {words[after.route_id] ?? after.route_id}:{' '}
                  {after.score && (words[after.score.system] ?? t('calculator.unknown'))}{' '}
                  {t('scenario.before')} {before?.score?.score ?? t('calculator.partial')} (
                  {words[before?.eligibility_status ?? ''] ?? t('calculator.unknown')}){' → '}
                  {t('scenario.after')} {after.score?.score ?? t('calculator.partial')} (
                  {words[after.eligibility_status] ?? t('calculator.unknown')})
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

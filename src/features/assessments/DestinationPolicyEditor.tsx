import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TogglePill, SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import { DestinationFields } from './DestinationFields';
import {
  GOALS,
  type DestinationPolicy,
  type DestinationCase,
  type DestinationEntry,
} from './destinationApi';
const SOURCE_FIELDS = [
  'title',
  'url',
  'checked_on',
  'review_due',
  'received_at',
  'effective_on',
] as const;
const WEIGHTS = ['goal', 'destination'] as const;
const RELEVANCE = [
  'needs_preferences',
  'matches_preferences',
  'alternative_destination',
  'outside_stated_goals',
] as const;
export function DestinationPolicyEditor({
  value,
  onChange,
  countries,
}: {
  value: DestinationPolicy;
  onChange: (value: DestinationPolicy) => void;
  countries: { code: string; name: string }[];
}) {
  const { t, i18n } = useTranslation('assessments');
  const regions = new Intl.DisplayNames([i18n.language], { type: 'region' });
  const countryOptions = [
    { value: '', label: t('calculator.choose') },
    ...countries.map((c) => ({ value: c.code, label: regions.of(c.code) ?? c.name })),
  ];
  const set = (index: number, entry: DestinationEntry) =>
    onChange({ ...value, entries: value.entries.map((e, i) => (i === index ? entry : e)) });
  const calculatorOptions = (country: string) =>
    [
      '',
      ...(country === 'CA'
        ? ['ca-fsw', 'ca-cec', 'ca-fst']
        : country === 'AU'
          ? ['au-189', 'au-190', 'au-491']
          : []),
    ].map((code) => ({
      value: code,
      label: code
        ? ((t('comparison.labels', { returnObjects: true }) as Record<string, string>)[code] ??
          code)
        : t('destinations.noCalculator'),
    }));
  return (
    <details open className="border-line min-w-0 rounded-2xl border p-3">
      <summary className="min-h-11 cursor-pointer py-2">{t('destinations.catalogEditor')}</summary>
      <div className="flex flex-col gap-4">
        <p>{t('destinations.policyMeaning')}</p>
        {WEIGHTS.map((key) => (
          <TextField
            key={key}
            type="number"
            min={0}
            max={1000}
            label={t('destinations.weight', { criterion: t(`destinations.criteria.${key}`) })}
            value={value.weights[key]}
            onChange={(e) =>
              onChange({ ...value, weights: { ...value.weights, [key]: Number(e.target.value) } })
            }
          />
        ))}
        {value.entries.map((entry, index) => (
          <details key={index} className="border-line min-w-0 rounded-xl border p-3">
            <summary className="min-h-11 cursor-pointer py-2">
              {entry.title.fa || entry.id || t('destinations.newEntry')}
            </summary>
            <div className="flex flex-col gap-3">
              <TextField
                label={t('destinations.entryId')}
                value={entry.id}
                onChange={(e) => set(index, { ...entry, id: e.target.value })}
              />
              <TextField
                label={t('destinations.titleFa')}
                value={entry.title.fa}
                onChange={(e) =>
                  set(index, { ...entry, title: { ...entry.title, fa: e.target.value } })
                }
              />
              <TextField
                label={t('destinations.titleEn')}
                value={entry.title.en}
                onChange={(e) =>
                  set(index, { ...entry, title: { ...entry.title, en: e.target.value } })
                }
              />
              <SelectField
                label={t('destinations.country')}
                value={entry.country}
                options={countryOptions}
                onChange={(country) => set(index, { ...entry, country, calculator_route: null })}
              />
              <SelectField
                label={t('destinations.goal')}
                value={entry.goal}
                options={GOALS.map((goal) => ({
                  value: goal,
                  label: t(`destinations.goals.${goal}`),
                }))}
                onChange={(goal) => set(index, { ...entry, goal, calculator_route: null })}
              />
              <TogglePill
                label={t('financial.enabled')}
                checked={entry.enabled}
                onChange={(enabled) => set(index, { ...entry, enabled })}
              />
              <TextField
                type="number"
                min={0}
                label={t('financial.order')}
                value={entry.order}
                onChange={(e) => set(index, { ...entry, order: Number(e.target.value) })}
              />
              {entry.goal === 'work' && (
                <SelectField
                  label={t('destinations.calculatorBinding')}
                  value={entry.calculator_route ?? ''}
                  options={calculatorOptions(entry.country)}
                  onChange={(calculator_route) =>
                    set(index, { ...entry, calculator_route: calculator_route || null })
                  }
                />
              )}
              {SOURCE_FIELDS.map((key) => (
                <TextField
                  key={key}
                  label={t(`destinations.source.${key}`)}
                  type={
                    key === 'checked_on' || key === 'review_due' || key === 'effective_on'
                      ? 'date'
                      : 'text'
                  }
                  value={entry.source[key] ?? ''}
                  onChange={(e) =>
                    set(index, {
                      ...entry,
                      source: {
                        ...entry.source,
                        [key]:
                          key === 'effective_on' && e.target.value === '' ? null : e.target.value,
                      },
                    })
                  }
                />
              ))}
              <SelectField
                label={t('destinations.directoryReview')}
                value={entry.source.status}
                options={(['draft', 'reviewed_directory'] as const).map((status) => ({
                  value: status,
                  label: t(`destinations.words.${status}`),
                }))}
                onChange={(status) => set(index, { ...entry, source: { ...entry.source, status } })}
              />
              <Button
                variant="outline"
                onClick={() =>
                  onChange({ ...value, entries: value.entries.filter((_, i) => i !== index) })
                }
              >
                {t('financial.remove')}
              </Button>
            </div>
          </details>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            onChange({
              ...value,
              entries: [
                ...value.entries,
                {
                  id: '',
                  country: '',
                  goal: 'study',
                  title: { fa: '', en: '' },
                  order: value.entries.length,
                  enabled: true,
                  calculator_route: null,
                  source: {
                    title: '',
                    url: '',
                    checked_on: '',
                    review_due: '',
                    received_at: '',
                    effective_on: null,
                    status: 'draft',
                  },
                },
              ],
            })
          }
        >
          {t('destinations.addEntry')}
        </Button>
      </div>
    </details>
  );
}
export function DestinationCaseEditor({
  policy,
  value,
  onChange,
  countries,
}: {
  policy: DestinationPolicy;
  value: DestinationCase[];
  onChange: (value: DestinationCase[]) => void;
  countries: { code: string; name: string }[];
}) {
  const { t } = useTranslation('assessments');
  const words = t('destinations.words', { returnObjects: true }) as Record<string, string>;
  return (
    <div className="flex flex-col gap-4">
      <h3>{t('destinations.referenceCases')}</h3>
      {value.map((test, index) => {
        const set = (next: DestinationCase) =>
          onChange(value.map((c, i) => (i === index ? next : c)));
        return (
          <fieldset key={index} className="border-line min-w-0 rounded-xl border p-3">
            <legend>{t('destinations.case', { index: index + 1 })}</legend>
            <DestinationFields
              value={test.inputs}
              onChange={(inputs) => set({ ...test, inputs })}
              countries={countries}
            />
            <p>{t('independent')}</p>
            {policy.entries
              .filter((e) => e.enabled)
              .map((entry) => (
                <SelectField
                  key={entry.id}
                  label={t('destinations.expected', { entry: entry.title.fa || entry.id })}
                  value={test.expected[entry.id] ?? 'needs_preferences'}
                  options={RELEVANCE.map((v) => ({
                    value: v,
                    label: words[v] ?? t('calculator.unknown'),
                  }))}
                  onChange={(v) => set({ ...test, expected: { ...test.expected, [entry.id]: v } })}
                />
              ))}
            <Button variant="outline" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              {t('financial.remove')}
            </Button>
          </fieldset>
        );
      })}
      <Button
        variant="outline"
        onClick={() =>
          onChange([
            ...value,
            {
              inputs: {},
              expected: Object.fromEntries(
                policy.entries.filter((e) => e.enabled).map((e) => [e.id, 'needs_preferences']),
              ),
            },
          ])
        }
      >
        {t('destinations.addCase')}
      </Button>
    </div>
  );
}

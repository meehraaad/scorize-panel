import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { TextField, TextAreaField } from '@/components/ui/TextField';
import { FinancialInputs } from './FinancialInputs';
import {
  FINANCIAL_ROUTES,
  type FinancialPolicy,
  type FinancialReference,
  type FinancialScenario,
} from './financialTypes';

const POLICY_NUMBERS = [
  'sufficient_bps',
  'tight_bps',
  'max_fx_age_days',
  'round_to_toman',
] as const;
const RANGE_NUMBERS = ['min_toman', 'max_toman', 'order'] as const;
const RATE_NUMBERS = ['numerator', 'denominator'] as const;
const REFERENCE_FIELDS = [
  'source_title',
  'source_url',
  'version',
  'effective_on',
  'valid_until',
  'checked_on',
  'received_at',
] as const;
function emptyReference(): FinancialReference {
  return {
    source_title: '',
    source_url: '',
    version: '',
    effective_on: '',
    valid_until: '',
    checked_on: '',
    received_at: '',
    status: 'draft',
  };
}
function ReferenceEditor({
  value,
  onChange,
}: {
  value: FinancialReference;
  onChange: (value: FinancialReference) => void;
}) {
  const { t } = useTranslation('assessments');
  return (
    <>
      {REFERENCE_FIELDS.map((key) => (
        <TextField
          key={key}
          label={t(`financial.${key}`)}
          type={key.endsWith('_on') || key === 'valid_until' ? 'date' : 'text'}
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      ))}
      <SelectField
        label={t('financial.reviewStatus')}
        value={value.status}
        options={(['draft', 'verified'] as const).map((v) => ({
          value: v,
          label: t(`financial.${v}`),
        }))}
        onChange={(status) => onChange({ ...value, status })}
      />
    </>
  );
}
export function FinancialPolicyEditor({
  value,
  onChange,
}: {
  value: FinancialPolicy;
  onChange: (value: FinancialPolicy) => void;
}) {
  const { t } = useTranslation('assessments');
  const routeLabels = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  const num = (key: 'sufficient_bps' | 'tight_bps' | 'max_fx_age_days' | 'round_to_toman') => (
    <TextField
      key={key}
      type="number"
      min={0}
      label={t(`financial.${key}`)}
      value={value[key]}
      onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
    />
  );
  return (
    <details open className="border-line min-w-0 rounded-2xl border p-3">
      <summary className="min-h-11 cursor-pointer py-2">{t('financial.policy')}</summary>
      <p>{t('financial.policyMeaning')}</p>
      <div className="flex flex-col gap-4">
        {POLICY_NUMBERS.map(num)}
        <SelectField
          label={t('financial.open_ended')}
          value={value.open_ended}
          options={(['ask_exact', 'minimum'] as const).map((v) => ({
            value: v,
            label: t(`financial.${v}`),
          }))}
          onChange={(open_ended) => onChange({ ...value, open_ended })}
        />
        <h3>{t('financial.ranges')}</h3>
        {value.ranges.map((range, index) => {
          const set = (next: typeof range) =>
            onChange({ ...value, ranges: value.ranges.map((r, i) => (i === index ? next : r)) });
          return (
            <fieldset key={index} className="border-line flex flex-col gap-3 rounded-xl border p-3">
              <legend>{range.title || t('financial.range')}</legend>
              <TextField
                label={t('financial.id')}
                value={range.id}
                onChange={(e) => set({ ...range, id: e.target.value })}
              />
              <TextField
                label={t('financial.rangeTitle')}
                value={range.title}
                onChange={(e) => set({ ...range, title: e.target.value })}
              />
              {RANGE_NUMBERS.map((key) => (
                <TextField
                  key={key}
                  type="number"
                  min={0}
                  label={t(`financial.${key}`)}
                  value={range[key] ?? ''}
                  onChange={(e) =>
                    set({
                      ...range,
                      [key]:
                        key === 'max_toman' && e.target.value === ''
                          ? null
                          : Number(e.target.value),
                    })
                  }
                />
              ))}
              <TogglePill
                label={t('financial.enabled')}
                checked={range.enabled}
                onChange={(enabled) => set({ ...range, enabled })}
              />
            </fieldset>
          );
        })}
        <Button
          variant="outline"
          onClick={() =>
            onChange({
              ...value,
              ranges: [
                ...value.ranges,
                {
                  id: '',
                  title: '',
                  min_toman: 0,
                  max_toman: null,
                  order: value.ranges.length,
                  enabled: true,
                },
              ],
            })
          }
        >
          {t('financial.addRange')}
        </Button>
        <h3>{t('financial.rates')}</h3>
        {value.rates.map((rate, index) => {
          const set = (next: typeof rate) =>
            onChange({ ...value, rates: value.rates.map((r, i) => (i === index ? next : r)) });
          return (
            <fieldset key={index} className="border-line flex flex-col gap-3 rounded-xl border p-3">
              <legend>{t('financial.rate')}</legend>
              <TextField
                label={t('financial.id')}
                value={rate.id}
                onChange={(e) => set({ ...rate, id: e.target.value })}
              />
              <SelectField
                label={t('financial.currency')}
                value={rate.currency}
                options={(['CAD', 'AUD', 'USD', 'EUR'] as const).map((v) => ({
                  value: v,
                  label: t(`financial.${v}`),
                }))}
                onChange={(currency) => set({ ...rate, currency })}
              />
              <SelectField
                label={t('financial.quote_unit')}
                value={rate.quote_unit}
                options={(['TOMAN', 'IRR'] as const).map((v) => ({
                  value: v,
                  label: t(`financial.${v}`),
                }))}
                onChange={(quote_unit) => set({ ...rate, quote_unit })}
              />
              {RATE_NUMBERS.map((key) => (
                <TextField
                  key={key}
                  type="number"
                  min={1}
                  label={t(`financial.${key}`)}
                  value={rate[key]}
                  onChange={(e) => set({ ...rate, [key]: Number(e.target.value) })}
                />
              ))}
              <ReferenceEditor value={rate} onChange={(next) => set({ ...rate, ...next })} />
              <Button
                variant="outline"
                onClick={() =>
                  onChange({ ...value, rates: value.rates.filter((_, i) => i !== index) })
                }
              >
                {t('financial.remove')}
              </Button>
            </fieldset>
          );
        })}
        <Button
          variant="outline"
          onClick={() =>
            onChange({
              ...value,
              rates: [
                ...value.rates,
                {
                  ...emptyReference(),
                  id: '',
                  currency: 'CAD',
                  quote_unit: 'TOMAN',
                  numerator: 1,
                  denominator: 1,
                },
              ],
            })
          }
        >
          {t('financial.addRate')}
        </Button>
        <h3>{t('financial.routeCosts')}</h3>
        {value.routes.map((route, index) => {
          const set = (next: typeof route) =>
            onChange({ ...value, routes: value.routes.map((r, i) => (i === index ? next : r)) });
          return (
            <fieldset
              key={index}
              className="border-line flex min-w-0 flex-col gap-4 rounded-xl border p-3"
            >
              <legend>{t('financial.routeCosts')}</legend>
              <SelectField
                label={t('route')}
                value={route.id}
                options={FINANCIAL_ROUTES.map((r) => ({
                  value: r,
                  label: routeLabels[r] ?? t('financial.unknown'),
                }))}
                onChange={(id) => set({ ...route, id })}
              />
              <TogglePill
                label={t('financial.complete')}
                checked={route.complete}
                onChange={(complete) => set({ ...route, complete })}
              />
              <TextAreaField
                label={t('financial.assumptions')}
                value={route.assumptions.join('\n')}
                onChange={(e) =>
                  set({ ...route, assumptions: e.target.value ? e.target.value.split('\n') : [] })
                }
              />
              {route.components.map((part, n) => {
                const component = (next: typeof part) =>
                  set({
                    ...route,
                    components: route.components.map((p, i) => (i === n ? next : p)),
                  });
                return (
                  <details key={n} className="border-line min-w-0 rounded-xl border p-3">
                    <summary className="min-h-11 cursor-pointer py-2">
                      {part.id || t('financial.component')}
                    </summary>
                    <div className="flex flex-col gap-3">
                      <TextField
                        label={t('financial.id')}
                        value={part.id}
                        onChange={(e) => component({ ...part, id: e.target.value })}
                      />
                      <SelectField
                        label={t('financial.kind')}
                        value={part.kind}
                        options={(['application', 'tuition', 'living', 'proof'] as const).map(
                          (v) => ({ value: v, label: t(`financial.${v}`) }),
                        )}
                        onChange={(kind) =>
                          component({
                            ...part,
                            kind,
                            ...(kind === 'proof' ? { accepted_resource_kinds: [] } : {}),
                          })
                        }
                      />
                      <TextField
                        label={t('financial.amount')}
                        type="number"
                        min={0}
                        value={part.amount}
                        onChange={(e) => component({ ...part, amount: Number(e.target.value) })}
                      />
                      <SelectField
                        label={t('financial.currency')}
                        value={part.currency}
                        options={(['TOMAN', 'IRR', 'CAD', 'AUD', 'USD', 'EUR'] as const).map(
                          (v) => ({ value: v, label: t(`financial.${v}`) }),
                        )}
                        onChange={(currency) => component({ ...part, currency })}
                      />
                      <SelectField
                        label={t('financial.basis')}
                        value={part.basis}
                        options={(part.kind === 'proof'
                          ? (['household', 'proof_person'] as const)
                          : (['household', 'person', 'dependant'] as const)
                        ).map((v) => ({
                          value: v,
                          label: t(`financial.${v}`),
                        }))}
                        onChange={(basis) => component({ ...part, basis })}
                      />
                      {part.kind === 'proof' && (
                        <TextField
                          label={t('financial.acceptedKinds')}
                          value={part.accepted_resource_kinds?.join(',') ?? ''}
                          onChange={(e) =>
                            component({
                              ...part,
                              accepted_resource_kinds: e.target.value
                                .split(',')
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      )}
                      <ReferenceEditor
                        value={part}
                        onChange={(next) => component({ ...part, ...next })}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          set({ ...route, components: route.components.filter((_, i) => i !== n) })
                        }
                      >
                        {t('financial.remove')}
                      </Button>
                    </div>
                  </details>
                );
              })}
              <Button
                variant="outline"
                onClick={() =>
                  set({
                    ...route,
                    components: [
                      ...route.components,
                      {
                        ...emptyReference(),
                        id: '',
                        kind: 'application',
                        amount: 0,
                        currency: 'TOMAN',
                        basis: 'household',
                      },
                    ],
                  })
                }
              >
                {t('financial.addComponent')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  onChange({ ...value, routes: value.routes.filter((_, i) => i !== index) })
                }
              >
                {t('financial.remove')}
              </Button>
            </fieldset>
          );
        })}
        <Button
          variant="outline"
          onClick={() =>
            onChange({
              ...value,
              routes: [
                ...value.routes,
                {
                  id:
                    FINANCIAL_ROUTES.find((id) => !value.routes.some((r) => r.id === id)) ??
                    'ca-fsw',
                  complete: false,
                  assumptions: [],
                  components: [],
                },
              ],
            })
          }
        >
          {t('financial.addRoute')}
        </Button>
      </div>
    </details>
  );
}
export function FinancialScenarioEditor({
  policy,
  cases,
  onChange,
}: {
  policy: FinancialPolicy;
  cases: FinancialScenario[];
  onChange: (cases: FinancialScenario[]) => void;
}) {
  const { t } = useTranslation('assessments');
  const routeLabels = t('comparison.labels', { returnObjects: true }) as Record<string, string>;
  return (
    <div className="flex flex-col gap-4">
      <h3>{t('financial.referenceCases')}</h3>
      {cases.map((test, index) => {
        const set = (next: FinancialScenario) =>
          onChange(cases.map((c, i) => (i === index ? next : c)));
        return (
          <fieldset
            key={index}
            className="border-line flex min-w-0 flex-col gap-3 rounded-xl border p-3"
          >
            <legend>{t('financial.referenceCase', { index: index + 1 })}</legend>
            <SelectField
              label={t('route')}
              value={test.route_id}
              options={FINANCIAL_ROUTES.map((r) => ({
                value: r,
                label: routeLabels[r] ?? t('financial.unknown'),
              }))}
              onChange={(route_id) => set({ ...test, route_id })}
            />
            <FinancialInputs
              policy={policy}
              value={test.inputs}
              reference
              onChange={(inputs) => set({ ...test, inputs })}
            />
            <SelectField
              label={t('expected')}
              value={test.expected.status}
              options={(
                ['sufficient', 'tight', 'insufficient', 'unknown', 'conditional'] as const
              ).map((v) => ({ value: v, label: t(`financial.${v}`) }))}
              onChange={(status) => set({ ...test, expected: { ...test.expected, status } })}
            />
            <TogglePill
              label={t('financial.expectExact')}
              checked={test.expected.ask_exact}
              onChange={(ask_exact) => set({ ...test, expected: { ...test.expected, ask_exact } })}
            />
            <Button variant="outline" onClick={() => onChange(cases.filter((_, i) => i !== index))}>
              {t('financial.remove')}
            </Button>
          </fieldset>
        );
      })}
      <Button
        variant="outline"
        onClick={() =>
          onChange([
            ...cases,
            { route_id: 'ca-fsw', inputs: {}, expected: { status: 'unknown', ask_exact: false } },
          ])
        }
      >
        {t('financial.addCase')}
      </Button>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import type { FinancialInputs as Inputs, FinancialPolicy, Resource } from './financialTypes';

const FIELDS = ['budget', 'resources', 'dependants', 'proof_family_size'] as const;
export function FinancialInputs({
  policy,
  value,
  onChange,
  askExact = false,
  reference = false,
}: {
  policy: FinancialPolicy;
  value: Inputs;
  onChange: (value: Inputs) => void;
  askExact?: boolean;
  reference?: boolean;
}) {
  const { t } = useTranslation('assessments');
  const statuses = ['unknown', 'known', 'needs_confirmation', 'not_applicable'] as const;
  const resources = value.resources?.value ?? [];
  const setResources = (next: Resource[]) =>
    onChange({ ...value, resources: { status: 'known', value: next } });
  const proof = policy.routes.flatMap((r) => r.components.filter((c) => c.kind === 'proof'));
  const budget = value.budget?.value;
  const targets = ['spending', ...proof.map((c) => c.id)];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {FIELDS.map((field) => (
        <div key={field} className="flex flex-col gap-3">
          <SelectField
            label={t(`financial.${field}`)}
            value={value[field]?.status ?? 'unknown'}
            options={statuses.map((status) => ({
              value: status,
              label: t(`calculator.choices.${status}`),
            }))}
            onChange={(status) => onChange({ ...value, [field]: { status, value: null } })}
          />
          {value[field]?.status === 'known' && field === 'budget' && (
            <>
              <SelectField
                label={t('financial.range')}
                value={budget && 'range_id' in budget ? budget.range_id : ''}
                options={[
                  { value: '', label: t('calculator.choose') },
                  ...policy.ranges
                    .filter((r) => r.enabled)
                    .sort((a, b) => a.order - b.order)
                    .map((r) => ({ value: r.id, label: r.title })),
                ]}
                onChange={(range_id) =>
                  onChange({ ...value, budget: { status: 'known', value: { range_id } } })
                }
              />
              {(askExact || reference || (budget && 'exact_toman' in budget)) && (
                <TextField
                  type="number"
                  min={0}
                  max={10 ** 15}
                  label={t('financial.exact_toman')}
                  value={budget && 'exact_toman' in budget ? (budget.exact_toman ?? '') : ''}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      budget: {
                        status: 'known',
                        value: {
                          exact_toman: e.target.value === '' ? null : Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              )}
            </>
          )}
          {value[field]?.status === 'known' &&
            (field === 'dependants' || field === 'proof_family_size') && (
              <TextField
                label={t(
                  field === 'dependants'
                    ? 'financial.dependantCount'
                    : 'financial.proofFamilyCount',
                )}
                type="number"
                min={field === 'dependants' ? 0 : 1}
                max={field === 'dependants' ? 30 : 31}
                value={value[field].value ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [field]: {
                      status: 'known',
                      value: e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            )}
          {value[field]?.status === 'known' && field === 'resources' && (
            <>
              <p>{t('financial.allocationMeaning')}</p>
              {resources.map((resource, i) => {
                const set = (next: Resource) =>
                  setResources(resources.map((r, n) => (n === i ? next : r)));
                return (
                  <fieldset
                    key={i}
                    className="border-line flex min-w-0 flex-col gap-3 rounded-2xl border p-3"
                  >
                    <legend>{t('financial.resource', { index: i + 1 })}</legend>
                    <TextField
                      label={t('financial.id')}
                      value={resource.id}
                      onChange={(e) => set({ ...resource, id: e.target.value })}
                    />
                    <TextField
                      label={t('financial.resourceKind')}
                      value={resource.kind}
                      onChange={(e) => set({ ...resource, kind: e.target.value })}
                    />
                    <TextField
                      label={t('financial.amount_toman')}
                      type="number"
                      min={0}
                      max={10 ** 15}
                      value={resource.amount_toman}
                      onChange={(e) => set({ ...resource, amount_toman: Number(e.target.value) })}
                    />
                    {targets.map((target) => (
                      <TextField
                        key={target}
                        type="number"
                        min={0}
                        max={10 ** 15}
                        label={t('financial.allocation', {
                          target: target === 'spending' ? t('financial.spending') : target,
                        })}
                        value={resource.allocations[target] ?? ''}
                        onChange={(e) => {
                          const allocations =
                            e.target.value === ''
                              ? Object.fromEntries(
                                  Object.entries(resource.allocations).filter(
                                    ([key]) => key !== target,
                                  ),
                                )
                              : { ...resource.allocations, [target]: Number(e.target.value) };
                          set({ ...resource, allocations });
                        }}
                      />
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => setResources(resources.filter((_, n) => n !== i))}
                    >
                      {t('financial.remove')}
                    </Button>
                  </fieldset>
                );
              })}
              <Button
                variant="outline"
                onClick={() =>
                  setResources([
                    ...resources,
                    {
                      id: `resource-${resources.length + 1}`,
                      kind: '',
                      amount_toman: 0,
                      allocations: {},
                    },
                  ])
                }
              >
                {t('financial.addResource')}
              </Button>
              <Button variant="outline" onClick={() => setResources([])}>
                {t('financial.noResources')}
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

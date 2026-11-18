import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { optionsQuery, type HrOptions } from '../api';
import {
  catalogQuery,
  kpisQuery,
  rulesQuery,
  useRemoveRule,
  useSaveRule,
  type Basis,
  type Calculator,
  type Effect,
  type Kpi,
  type PayRule,
} from './api';
import { ScopeFields } from './components/ScopeFields';
import { scopeBody, scopeDraft, useScopeName } from './scope';
import { useMetricNames } from './metricNames';
import { parseNumber, parseSigned } from './numbers';

const EFFECTS: readonly Effect[] = ['reward', 'penalty'];

/**
 * Rewards and penalties (the KPI plan's third layer): each rule turns a person's KPI score, one
 * KPI's value or a calculator's amount (such as the sales commission) into a line of their slip,
 * plus or minus, for everyone, a position, a team or one person. Rules on trial show on the slip
 * without being paid.
 */
export default function RulesPage() {
  const { t } = useTranslation('hr');
  const { data } = useSuspenseQuery(rulesQuery);
  const kpis = useSuspenseQuery(kpisQuery);
  const options = useSuspenseQuery(optionsQuery);
  const catalog = useSuspenseQuery(catalogQuery);
  const [editing, setEditing] = useState<Partial<PayRule> | null>(null);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-2xl text-sm text-text-2">{t('pay.rules.hint')}</p>
        <Button onClick={() => setEditing({})}>
          <Icon name="plus" size={18} />
          {t('pay.rules.new')}
        </Button>
      </div>
      {data.rules.length === 0 ? (
        <EmptyState variant="card" title={t('pay.rules.none')}>
          {t('pay.rules.noneHint')}
        </EmptyState>
      ) : (
        EFFECTS.map((effect) => {
          const rules = data.rules.filter((rule) => rule.effect === effect);
          return rules.length === 0 ? null : (
            <RuleList
              key={effect}
              title={effect === 'reward' ? t('pay.rules.rewards') : t('pay.rules.penalties')}
              rules={rules}
              kpis={kpis.data.kpis}
              calculators={catalog.data.calculators}
              onEdit={setEditing}
            />
          );
        })
      )}
      {editing && (
        <RuleDialog
          rule={editing}
          kpis={kpis.data.kpis}
          calculators={catalog.data.calculators}
          options={options.data}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function useRuleSummary(kpis: Kpi[], calculators: Calculator[]) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const names = useMetricNames();
  const money = (rule: PayRule, amount: number) =>
    rule.amount_unit === 'percent'
      ? t('pay.rules.percentOfBase', { n: f.number(amount) })
      : t('toman', { amount: f.number(amount) });
  return (rule: PayRule) => {
    if (rule.basis === 'calculator') {
      const found = calculators.find((row) => row.key === rule.calculator);
      return names.calculator(rule.calculator, found?.label);
    }
    const what =
      rule.basis === 'score'
        ? t('pay.rules.basis.score')
        : (kpis.find((kpi) => kpi.id === rule.kpi)?.name ?? t('pay.rules.basis.kpi'));
    if (rule.method === 'per_unit')
      return t('pay.rules.perUnitSummary', {
        what,
        amount: money(rule, rule.amount),
        above: f.number(rule.above),
      });
    const steps = rule.steps
      .map((step) =>
        t('pay.rules.stepSummary', {
          range:
            step.to === null
              ? t('pay.rules.fromOnly', { from: f.number(step.from ?? 0) })
              : t('pay.rules.range', { from: f.number(step.from ?? 0), to: f.number(step.to) }),
          amount: money(rule, step.amount),
        }),
      )
      .join('، ');
    return `${what}: ${steps}`;
  };
}

function RuleList({
  title,
  rules,
  kpis,
  calculators,
  onEdit,
}: {
  title: string;
  rules: PayRule[];
  kpis: Kpi[];
  calculators: Calculator[];
  onEdit: (rule: PayRule) => void;
}) {
  const { t } = useTranslation('hr');
  const summary = useRuleSummary(kpis, calculators);
  const scopeName = useScopeName();
  const remove = useRemoveRule();
  const [removing, setRemoving] = useState<number | null>(null);
  return (
    <Card aria-label={title} className="flex flex-col gap-1 p-4 lg:px-6">
      <h2 className="m-0 text-base font-bold">{title}</h2>
      <ul className="m-0 list-none p-0">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hair py-2 first:border-t-0"
          >
            <span className="flex min-w-0 flex-[1_1_260px] flex-col">
              <span className="font-semibold">{rule.name}</span>
              <span className="text-[13px] text-text-2">{summary(rule)}</span>
            </span>
            <span className="flex flex-[0_1_200px] flex-wrap items-center gap-1 text-sm text-text-2">
              {scopeName(rule)}
              {rule.pooled && (
                <Chip tone="neutral" small>
                  {t('pay.rules.pooledChip')}
                </Chip>
              )}
              {rule.trial && (
                <Chip tone="warn" small>
                  {t('pay.trial')}
                </Chip>
              )}
            </span>
            {removing === rule.id ? (
              <InlineConfirm
                message={t('pay.rules.removeConfirm')}
                confirmLabel={t('pay.kpis.remove')}
                cancelLabel={t('close')}
                pending={remove.isPending}
                onCancel={() => setRemoving(null)}
                onConfirm={() =>
                  remove.mutate(rule.id, {
                    onSuccess: () => toast.success(t('pay.rules.removed')),
                    onError: () => toast.error(t('error')),
                  })
                }
              />
            ) : (
              <span className="flex gap-1">
                <IconButton
                  icon="pen"
                  aria-label={t('pay.kpis.edit', { name: rule.name })}
                  onClick={() => onEdit(rule)}
                />
                <IconButton
                  icon="trash"
                  aria-label={t('pay.kpis.removeOne', { name: rule.name })}
                  onClick={() => setRemoving(rule.id)}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface StepDraft {
  from: string;
  to: string;
  amount: string;
}

const stepDrafts = (rule: Partial<PayRule>): StepDraft[] =>
  rule.steps?.length
    ? rule.steps.map((step) => ({
        from: step.from === null ? '' : String(step.from),
        to: step.to === null ? '' : String(step.to),
        amount: String(step.amount),
      }))
    : [{ from: '', to: '', amount: '' }];

function RuleDialog({
  rule,
  kpis,
  calculators,
  options,
  onClose,
}: {
  rule: Partial<PayRule>;
  kpis: Kpi[];
  calculators: Calculator[];
  options: HrOptions;
  onClose: () => void;
}) {
  const { t } = useTranslation('hr');
  const names = useMetricNames();
  const save = useSaveRule();
  const [name, setName] = useState(rule.name ?? '');
  const [effect, setEffect] = useState<Effect>(rule.effect ?? 'reward');
  const [basis, setBasis] = useState<Basis>(rule.basis ?? 'score');
  const [kpi, setKpi] = useState(rule.kpi ? String(rule.kpi) : '');
  const [calculator, setCalculator] = useState(rule.calculator ?? '');
  const [method, setMethod] = useState(rule.method ?? 'steps');
  const [steps, setSteps] = useState<StepDraft[]>(stepDrafts(rule));
  const [amount, setAmount] = useState(rule.amount ? String(rule.amount) : '');
  const [above, setAbove] = useState(rule.above ? String(rule.above) : '');
  const [unit, setUnit] = useState(rule.amount_unit ?? 'toman');
  const [scope, setScope] = useState(scopeDraft({ ...rule, scope: rule.scope ?? 'all' }));
  const [pooled, setPooled] = useState(rule.pooled ?? false);
  const [trial, setTrial] = useState(rule.trial ?? rule.id === undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reads = basis !== 'calculator';

  const submit = () => {
    const found: Record<string, string> = {};
    const { missing, body } = scopeBody(scope);
    if (!name.trim()) found.name = t('form.required');
    if (missing) found.scope = t('form.required');
    if (basis === 'kpi' && !kpi) found.kpi = t('form.required');
    if (basis === 'calculator' && !calculator) found.calculator = t('form.required');
    const parsedSteps = steps.map((step) => ({
      from: step.from.trim() ? parseSigned(step.from) : null,
      to: step.to.trim() ? parseSigned(step.to) : null,
      amount: parseNumber(step.amount),
    }));
    if (reads && method === 'steps') {
      const bad = parsedSteps.some(
        (step, index) =>
          step.amount === null ||
          ((steps[index]?.from.trim() ?? '') !== '' && step.from === null) ||
          ((steps[index]?.to.trim() ?? '') !== '' && step.to === null) ||
          (step.from !== null && step.to !== null && step.to <= step.from),
      );
      if (bad) found.steps = t('pay.rules.stepsInvalid');
    }
    const each = parseNumber(amount);
    const over = above.trim() ? parseSigned(above) : 0;
    if (reads && method === 'per_unit') {
      if (!each) found.amount = t('pay.results.notNumber');
      if (over === null) found.above = t('pay.results.notNumber');
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      {
        ...(rule.id !== undefined && { id: rule.id }),
        ...body,
        name: name.trim(),
        effect,
        basis,
        kpi: basis === 'kpi' ? Number(kpi) : null,
        calculator: basis === 'calculator' ? calculator : '',
        method,
        steps:
          reads && method === 'steps'
            ? parsedSteps.map((step) => ({ ...step, amount: step.amount ?? 0 }))
            : [],
        amount: reads && method === 'per_unit' ? (each ?? 0) : 0,
        above: reads && method === 'per_unit' ? (over ?? 0) : 0,
        amount_unit: unit,
        pooled: reads && scope.scope !== 'person' && pooled,
        trial,
      },
      {
        onSuccess: () => {
          toast.success(t('pay.rules.saved'));
          onClose();
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  const setStep = (index: number, change: Partial<StepDraft>) =>
    setSteps(steps.map((step, at) => (at === index ? { ...step, ...change } : step)));

  return (
    <Dialog
      open
      onClose={onClose}
      title={rule.id === undefined ? t('pay.rules.new') : t('pay.rules.editTitle')}
      closeLabel={t('close')}
      footer={
        <Button disabled={save.isPending} onClick={submit}>
          {t('pay.save')}
        </Button>
      }
    >
      <TextField
        label={t('pay.rules.name')}
        placeholder={t('pay.rules.namePlaceholder')}
        value={name}
        maxLength={64}
        error={errors.name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t('pay.rules.effect')}
          value={effect}
          onChange={setEffect}
          options={EFFECTS.map((value) => ({ value, label: t(`pay.rules.effects.${value}`) }))}
        />
        <SelectField
          label={t('pay.rules.basisLabel')}
          value={basis}
          onChange={setBasis}
          options={(['score', 'kpi', 'calculator'] as const).map((value) => ({
            value,
            label: t(`pay.rules.basis.${value}`),
          }))}
        />
      </div>
      {basis === 'kpi' && (
        <SelectField
          label={t('pay.rules.kpi')}
          value={kpi}
          error={errors.kpi}
          onChange={setKpi}
          options={[
            { value: '', label: t('pay.rules.pickKpi') },
            ...kpis.map((row) => ({ value: String(row.id), label: row.name })),
          ]}
        />
      )}
      {basis === 'calculator' && (
        <SelectField
          label={t('pay.rules.calculator')}
          hint={t('pay.rules.calculatorHint')}
          value={calculator}
          error={errors.calculator}
          onChange={setCalculator}
          options={[
            { value: '', label: t('pay.rules.pickCalculator') },
            ...calculators.map((row) => ({
              value: row.key,
              label: names.calculator(row.key, row.label),
            })),
          ]}
        />
      )}
      <ScopeFields draft={scope} options={options} error={errors.scope} onChange={setScope} />
      {reads && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t('pay.rules.method')}
              value={method}
              onChange={setMethod}
              options={[
                { value: 'steps', label: t('pay.rules.methods.steps') },
                { value: 'per_unit', label: t('pay.rules.methods.perUnit') },
              ]}
            />
            <SelectField
              label={t('pay.rules.unit')}
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'toman', label: t('pay.rules.units.toman') },
                { value: 'percent', label: t('pay.rules.units.percent') },
              ]}
            />
          </div>
          {method === 'steps' ? (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 text-sm font-semibold">{t('pay.rules.steps')}</legend>
              <p className="m-0 text-[13px] text-text-2">{t('pay.rules.stepsHint')}</p>
              {steps.map((step, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                  <TextField
                    label={t('pay.rules.from')}
                    inputMode="decimal"
                    dir="ltr"
                    value={step.from}
                    onChange={(event) => setStep(index, { from: event.target.value })}
                  />
                  <TextField
                    label={t('pay.rules.to')}
                    inputMode="decimal"
                    dir="ltr"
                    value={step.to}
                    onChange={(event) => setStep(index, { to: event.target.value })}
                  />
                  <TextField
                    label={t('pay.rules.amount')}
                    inputMode="decimal"
                    dir="ltr"
                    value={step.amount}
                    onChange={(event) => setStep(index, { amount: event.target.value })}
                  />
                  <IconButton
                    icon="trash"
                    aria-label={t('pay.rules.removeStep')}
                    disabled={steps.length === 1}
                    onClick={() => setSteps(steps.filter((_, at) => at !== index))}
                  />
                </div>
              ))}
              {errors.steps && (
                <p role="alert" className="m-0 text-[13px] text-danger">
                  {errors.steps}
                </p>
              )}
              <div>
                <Button
                  variant="outline"
                  disabled={steps.length >= 20}
                  onClick={() => setSteps([...steps, { from: '', to: '', amount: '' }])}
                >
                  <Icon name="plus" size={16} />
                  {t('pay.rules.addStep')}
                </Button>
              </div>
            </fieldset>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={t('pay.rules.perUnit')}
                inputMode="decimal"
                dir="ltr"
                value={amount}
                error={errors.amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <TextField
                label={t('pay.rules.above')}
                hint={t('pay.rules.aboveHint')}
                inputMode="decimal"
                dir="ltr"
                value={above}
                error={errors.above}
                onChange={(event) => setAbove(event.target.value)}
              />
            </div>
          )}
          {scope.scope !== 'person' && (
            <Switch
              label={t('pay.rules.pooled')}
              description={t('pay.rules.pooledHint')}
              checked={pooled}
              onChange={setPooled}
            />
          )}
        </>
      )}
      <Switch
        label={t('pay.rules.trial')}
        description={t('pay.rules.trialHint')}
        checked={trial}
        onChange={setTrial}
      />
    </Dialog>
  );
}

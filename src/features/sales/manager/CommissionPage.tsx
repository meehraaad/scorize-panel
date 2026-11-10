import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { TOMAN, useFormat } from '@/lib/i18n/useFormat';
import { toLatinNumber } from '@/lib/text';
import { toast } from '@/lib/toast';
import {
  commissionQuery,
  useDeleteCommissionRule,
  useSaveCommissionRule,
  type CommissionBasis,
  type CommissionReward,
  type CommissionRule,
  type CommissionRules,
} from '../api';
import { useSalesFormat } from '../format';

const BASES = ['contracts', 'sales'] as const satisfies readonly CommissionBasis[];
const REWARDS = [
  'percent',
  'tiered',
  'bonus',
  'per_contract',
] as const satisfies readonly CommissionReward[];
/** Rewards in percent; the others are an amount in the rule's currency. */
const IN_PERCENT = new Set<CommissionReward>(['percent', 'tiered']);
const MILLION = 1_000_000;
const EVERYONE = 'all';
/** Toman amounts are typed in millions; other currencies as they are. */
const scaleOf = (currency: string) => (currency === TOMAN ? MILLION : 1);

type Field = 'seller' | 'basis' | 'threshold' | 'until' | 'currency' | 'value';
type Errors = Partial<Record<Field, string>>;

/** The field errors Django sends (`{threshold: ['…']}`), or null for another failure. */
function errorsOf(error: unknown): Errors | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const body = (error.body ?? {}) as Partial<Record<string, string[]>>;
  const errors: Errors = {};
  for (const [from, to] of [
    ['seller', 'seller'],
    ['basis', 'basis'],
    ['threshold', 'threshold'],
    ['until', 'until'],
    ['currency', 'currency'],
    ['percent', 'value'],
    ['amount', 'value'],
  ] as const) {
    const message = body[from]?.[0];
    if (message) errors[to] = message;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/** "2.5" → 2.5, Persian digits too; NaN when it isn't a number. */
const numberOf = (value: string) =>
  value.trim() === '' ? Number.NaN : Number(toLatinNumber(value.trim()));

type RuleShape = Pick<
  CommissionRule,
  'basis' | 'threshold' | 'until' | 'currency' | 'reward' | 'percent' | 'amount'
>;

/**
 * One rule as a sentence: "4 contracts or more in a month: 3% of the month's sales", "Sales from
 * 0 to under 4,000 euros in a month: 4% of the month's sales".
 */
function useRuleText() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  return (rule: RuleShape) => {
    const count = (value: number) =>
      rule.basis === 'contracts' ? f.number(value) : s.inCurrency(value, rule.currency);
    return t(
      `manager.commission.rule.${rule.reward}.${rule.basis}.${rule.until === null ? 'open' : 'range'}`,
      {
        n: count(rule.threshold),
        to: count(rule.until ?? 0),
        percent: f.number(rule.percent ?? 0),
        amount: s.inCurrency(rule.amount ?? 0, rule.currency),
      },
    );
  };
}

/** "Euro", "Toman": a currency's name in the page's language (its code when unknown). */
function useCurrencyName() {
  const { t } = useTranslation('sales');
  return (code: string) => t(`manager.commission.currencyName.${code}`, { defaultValue: code });
}

/**
 * The sellers' commission steps (S60): "with 4 contracts in a month, 3%", "with 500 million toman
 * of sales, 4%", for the whole team or one seller. Each seller earns the best step they reach,
 * as a share of the month's sales. A change applies from this month; past months keep theirs.
 */
export default function CommissionPage() {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(commissionQuery);
  const groups = [{ id: null, name: t('manager.commission.everyone') }, ...data.sellers].flatMap(
    (group) => {
      const rules = data.rules
        .filter((rule) => rule.seller === group.id)
        .sort((a, b) => a.basis.localeCompare(b.basis) || a.threshold - b.threshold || a.id - b.id);
      return rules.length > 0 ? [{ ...group, rules }] : [];
    },
  );

  return (
    <>
      <PageHeader
        title={t('manager.commission.title')}
        subtitle={t('manager.commission.subtitle')}
      />
      <SectionCard id="new-commission-rule" variant="panel" title={t('manager.commission.new')}>
        <RuleForm sellers={data.sellers} currencies={data.currencies} />
      </SectionCard>
      <SectionCard id="commission-rules" variant="panel" title={t('manager.commission.list')}>
        {groups.length === 0 ? (
          <EmptyState>{t('manager.commission.empty')}</EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section
                key={group.id ?? EVERYONE}
                aria-label={group.name}
                className="flex flex-col gap-2.5"
              >
                <h3 className="m-0 text-[15px] font-semibold text-text">{group.name}</h3>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {group.rules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      sellers={data.sellers}
                      currencies={data.currencies}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function RuleRow({
  rule,
  sellers,
  currencies,
}: {
  rule: CommissionRule;
  sellers: CommissionRules['sellers'];
  currencies: CommissionRules['currencies'];
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const text = useRuleText();
  const remove = useDeleteCommissionRule();
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');

  if (mode === 'edit')
    return (
      <li className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <RuleForm
          sellers={sellers}
          currencies={currencies}
          rule={rule}
          onDone={() => setMode('view')}
        />
      </li>
    );
  return (
    <li className="flex flex-col gap-3 rounded-2xl px-4 py-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium text-text">{text(rule)}</span>
          <span className="text-[13px] text-text-2">
            {t('manager.commission.since', { month: f.monthYear(rule.since) })}
          </span>
        </span>
        <span className="flex">
          <IconButton
            icon="pen"
            aria-label={t('manager.commission.edit', { rule: text(rule) })}
            onClick={() => setMode('edit')}
          />
          <IconButton
            icon="trash"
            tone="danger"
            aria-label={t('manager.commission.delete', { rule: text(rule) })}
            onClick={() => setMode('delete')}
          />
        </span>
      </div>
      {mode === 'delete' && (
        <InlineConfirm
          message={t('manager.commission.deleteConfirm')}
          confirmLabel={t('manager.commission.deleteYes')}
          cancelLabel={t('manager.commission.cancel')}
          pending={remove.isPending}
          onCancel={() => setMode('view')}
          onConfirm={() =>
            remove.mutate(rule.id, {
              onSuccess: () => toast.success(t('manager.commission.deleted')),
              onError: () => {
                setMode('view');
                toast.error(t('error'));
              },
            })
          }
        />
      )}
    </li>
  );
}

/** A new rule's form, or a rule's (`rule`) while it is being changed. */
function RuleForm({
  sellers,
  currencies,
  rule,
  onDone,
}: {
  sellers: CommissionRules['sellers'];
  currencies: CommissionRules['currencies'];
  rule?: CommissionRule;
  onDone?: () => void;
}) {
  const { t } = useTranslation('sales');
  const text = useRuleText();
  const currencyName = useCurrencyName();
  const save = useSaveCommissionRule();
  const [seller, setSeller] = useState(
    rule?.seller === null || !rule ? EVERYONE : String(rule.seller),
  );
  const [reward, setReward] = useState<CommissionReward>(rule?.reward ?? 'percent');
  const [basis, setBasis] = useState<CommissionBasis>(rule?.basis ?? 'contracts');
  const [currency, setCurrency] = useState(rule?.currency ?? currencies[0] ?? TOMAN);
  /** A sales amount or a bonus as typed: millions for the toman. */
  const typedOf = (amount: number) => String(amount / scaleOf(rule?.currency ?? TOMAN));
  const [threshold, setThreshold] = useState(
    rule ? (rule.basis === 'sales' ? typedOf(rule.threshold) : String(rule.threshold)) : '',
  );
  const [until, setUntil] = useState(
    rule?.until == null ? '' : rule.basis === 'sales' ? typedOf(rule.until) : String(rule.until),
  );
  const [value, setValue] = useState(
    rule ? (IN_PERCENT.has(rule.reward) ? String(rule.percent) : typedOf(rule.amount ?? 0)) : '',
  );
  const [errors, setErrors] = useState<Errors>({});

  const inPercent = IN_PERCENT.has(reward);
  const scale = scaleOf(currency);
  /** The currency matters for sales ranges and for amounts. */
  const usesCurrency = basis === 'sales' || !inPercent;
  const unit = currency === TOMAN ? t('manager.commission.millionUnit') : currencyName(currency);
  const inUnits = (typed: number) => (basis === 'sales' ? Math.round(typed * scale) : typed);
  const typed = numberOf(threshold);
  const typedUntil = until.trim() === '' ? null : numberOf(until);
  const number = numberOf(value);
  const countOk = (n: number) =>
    Number.isFinite(n) && n >= 0 && (basis === 'sales' || Number.isInteger(n));
  const thresholdOk = countOk(typed);
  const untilOk =
    typedUntil === null || (countOk(typedUntil) && (!thresholdOk || typedUntil > typed));
  const valueOk = Number.isFinite(number) && number > 0 && (!inPercent || number <= 100);
  const shape: RuleShape = {
    basis,
    threshold: inUnits(typed),
    until: typedUntil === null ? null : inUnits(typedUntil),
    currency,
    reward,
    percent: inPercent ? Math.round(number * 100) / 100 : null,
    amount: inPercent ? null : Math.round(number * scale * 100) / 100,
  };

  const submit = () => {
    if (!thresholdOk || !untilOk || !valueOk) {
      setErrors({
        ...(!thresholdOk && { threshold: t('manager.commission.thresholdError') }),
        ...(!untilOk && {
          until: t(
            countOk(typedUntil)
              ? 'manager.commission.untilError'
              : 'manager.commission.thresholdError',
          ),
        }),
        ...(!valueOk && {
          value: t(
            inPercent ? 'manager.commission.percentError' : 'manager.commission.amountError',
          ),
        }),
      });
      return;
    }
    save.mutate(
      {
        ...(rule && { id: rule.id }),
        seller: seller === EVERYONE ? null : Number(seller),
        ...shape,
      },
      {
        onSuccess: () => {
          setErrors({});
          toast.success(t(rule ? 'manager.commission.saved' : 'manager.commission.added'));
          if (rule) onDone?.();
          else {
            setThreshold('');
            setUntil('');
            setValue('');
          }
        },
        onError: (failure) => {
          const found = errorsOf(failure);
          if (found) setErrors(found);
          else toast.error(t('error'));
        },
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      aria-label={rule ? t('manager.commission.editForm') : t('manager.commission.new')}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label={t('manager.commission.seller')}
          value={seller}
          onChange={(next) => {
            setSeller(next);
            setErrors({});
          }}
          error={errors.seller}
          options={[
            { value: EVERYONE, label: t('manager.commission.everyone') },
            ...sellers.map((item) => ({ value: String(item.id), label: item.name })),
          ]}
        />
        <SelectField
          label={t('manager.commission.reward')}
          value={reward}
          hint={t(`manager.commission.rewardHint.${reward}`)}
          onChange={(next) => {
            if (IN_PERCENT.has(next) !== inPercent) setValue('');
            setReward(next);
            setErrors({});
          }}
          options={REWARDS.map((option) => ({
            value: option,
            label: t(`manager.commission.rewardName.${option}`),
          }))}
        />
        <SelectField
          label={t('manager.commission.basis')}
          value={basis}
          error={errors.basis}
          onChange={(next) => {
            setBasis(next);
            setThreshold('');
            setUntil('');
            setErrors({});
          }}
          options={BASES.map((option) => ({
            value: option,
            label: t(`manager.commission.basisName.${option}`),
          }))}
        />
        {usesCurrency && currencies.length > 0 && (
          <SelectField
            label={t('manager.commission.currency')}
            value={currency}
            hint={basis === 'sales' ? t('manager.commission.currencyHint') : undefined}
            error={errors.currency}
            onChange={(next) => {
              setCurrency(next);
              setErrors(({ currency: _gone, ...rest }) => rest);
            }}
            options={currencies.map((code) => ({ value: code, label: currencyName(code) }))}
          />
        )}
        <TextField
          label={t(`manager.commission.threshold.${basis}`, { unit })}
          inputMode="decimal"
          value={threshold}
          onChange={(event) => {
            setThreshold(event.target.value);
            setErrors(({ threshold: _gone, ...rest }) => rest);
          }}
          error={errors.threshold}
        />
        <TextField
          label={t(`manager.commission.until.${basis}`, { unit })}
          inputMode="decimal"
          value={until}
          hint={t('manager.commission.untilHint')}
          onChange={(event) => {
            setUntil(event.target.value);
            setErrors(({ until: _gone, ...rest }) => rest);
          }}
          error={errors.until}
        />
        <TextField
          label={
            reward === 'bonus' || reward === 'per_contract'
              ? t(`manager.commission.amount.${reward}`, { unit })
              : t('manager.commission.percent')
          }
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setErrors(({ value: _gone, ...rest }) => rest);
          }}
          error={errors.value}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-text-2" aria-live="polite">
          {thresholdOk && untilOk && valueOk ? text(shape) : t('manager.commission.hint')}
        </span>
        <span className="flex flex-wrap gap-2">
          {rule && (
            <Button variant="outline" onClick={onDone} disabled={save.isPending}>
              {t('manager.commission.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={save.isPending}>
            {t(rule ? 'manager.commission.save' : 'manager.commission.add')}
          </Button>
        </span>
      </div>
    </form>
  );
}

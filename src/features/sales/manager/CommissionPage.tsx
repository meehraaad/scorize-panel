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
import { useFormat } from '@/lib/i18n/useFormat';
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
/** Rewards in percent; the others are an amount in toman. */
const IN_PERCENT = new Set<CommissionReward>(['percent', 'tiered']);
const MILLION = 1_000_000;
const EVERYONE = 'all';

type Field = 'seller' | 'basis' | 'threshold' | 'value';
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

type RuleShape = Pick<CommissionRule, 'basis' | 'threshold' | 'reward' | 'percent' | 'amount'>;

/** One rule as a sentence: "4 contracts or more in a month: 3% of the month's sales". */
function useRuleText() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  return (rule: RuleShape) =>
    t(`manager.commission.rule.${rule.reward}.${rule.basis}`, {
      n: rule.basis === 'contracts' ? f.number(rule.threshold) : s.millions(rule.threshold),
      percent: f.number(rule.percent ?? 0),
      amount: s.millions(rule.amount ?? 0),
    });
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
        <RuleForm sellers={data.sellers} />
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
                    <RuleRow key={rule.id} rule={rule} sellers={data.sellers} />
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

function RuleRow({ rule, sellers }: { rule: CommissionRule; sellers: CommissionRules['sellers'] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const text = useRuleText();
  const remove = useDeleteCommissionRule();
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');

  if (mode === 'edit')
    return (
      <li className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <RuleForm sellers={sellers} rule={rule} onDone={() => setMode('view')} />
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
  rule,
  onDone,
}: {
  sellers: CommissionRules['sellers'];
  rule?: CommissionRule;
  onDone?: () => void;
}) {
  const { t } = useTranslation('sales');
  const text = useRuleText();
  const save = useSaveCommissionRule();
  const [seller, setSeller] = useState(
    rule?.seller === null || !rule ? EVERYONE : String(rule.seller),
  );
  const [reward, setReward] = useState<CommissionReward>(rule?.reward ?? 'percent');
  const [basis, setBasis] = useState<CommissionBasis>(rule?.basis ?? 'contracts');
  const [threshold, setThreshold] = useState(
    rule ? String(rule.basis === 'sales' ? rule.threshold / MILLION : rule.threshold) : '',
  );
  const [value, setValue] = useState(
    rule ? String(IN_PERCENT.has(rule.reward) ? rule.percent : (rule.amount ?? 0) / MILLION) : '',
  );
  const [errors, setErrors] = useState<Errors>({});

  const inPercent = IN_PERCENT.has(reward);
  const typed = numberOf(threshold);
  const step = basis === 'sales' ? Math.round(typed * MILLION) : typed;
  const number = numberOf(value);
  const thresholdOk =
    Number.isFinite(typed) && typed >= 0 && (basis === 'sales' || Number.isInteger(typed));
  const valueOk = Number.isFinite(number) && number > 0 && (!inPercent || number <= 100);
  const shape: RuleShape = {
    basis,
    threshold: step,
    reward,
    percent: inPercent ? Math.round(number * 100) / 100 : null,
    amount: inPercent ? null : Math.round(number * MILLION),
  };

  const submit = () => {
    if (!thresholdOk || !valueOk) {
      setErrors({
        ...(!thresholdOk && { threshold: t('manager.commission.thresholdError') }),
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
            setErrors({});
          }}
          options={BASES.map((option) => ({
            value: option,
            label: t(`manager.commission.basisName.${option}`),
          }))}
        />
        <TextField
          label={t(`manager.commission.threshold.${basis}`)}
          inputMode="decimal"
          value={threshold}
          onChange={(event) => {
            setThreshold(event.target.value);
            setErrors(({ threshold: _gone, ...rest }) => rest);
          }}
          error={errors.threshold}
        />
        <TextField
          label={t(
            reward === 'bonus' || reward === 'per_contract'
              ? `manager.commission.amount.${reward}`
              : 'manager.commission.percent',
          )}
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
          {thresholdOk && valueOk ? text(shape) : t('manager.commission.hint')}
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { SectionCard } from '@/components/ui/SectionCard';
import { toast } from '@/lib/toast';
import type { AssignRouting, RoutingKind, RoutingRule, SellerLoad } from '../api';
import { useAssignRule } from '../api/managerMutations';

export function AssignmentRules({
  routing,
  sellers,
}: {
  routing: AssignRouting;
  sellers: SellerLoad[];
}) {
  const { t } = useTranslation('sales');
  const [kind, setKind] = useState<RoutingKind>('lead');
  const [match, setMatch] = useState('');
  const [seller, setSeller] = useState('');
  const mutation = useAssignRule();
  const eligible = sellers.filter((item) => item.auto);
  const selected = routing.rules.find((rule) => rule.kind === kind && rule.match === match);
  const optionsFor = (ruleKind: RoutingKind) =>
    routing[ruleKind].map((option) => ({
      ...option,
      label:
        ruleKind === 'lead'
          ? t(`source.${option.value}`, { defaultValue: option.label })
          : option.label,
    }));
  const save = (rule: Omit<RoutingRule, 'seller'> & { seller: number | null }) => {
    mutation.mutate(rule, {
      onError: () => toast.error(t('error')),
      onSuccess: () => {
        if (rule.seller === null && rule.kind === kind && rule.match === match) setSeller('');
        toast.success(
          t(rule.seller === null ? 'manager.assign.rules.removed' : 'manager.assign.rules.saved'),
        );
      },
    });
  };
  const changeMatch = (next: string) => {
    setMatch(next);
    const rule = routing.rules.find((item) => item.kind === kind && item.match === next);
    setSeller(rule && eligible.some((item) => item.id === rule.seller) ? String(rule.seller) : '');
  };

  return (
    <SectionCard
      id="assignment-rules"
      variant="panel"
      size="lg"
      title={t('manager.assign.rules.title')}
      subtitle={t('manager.assign.rules.help')}
    >
      {routing.rules.length > 0 && (
        <ul className="divide-line m-0 list-none divide-y p-0">
          {routing.rules.map((rule) => {
            const target = sellers.find((item) => item.id === rule.seller);
            const label =
              optionsFor(rule.kind).find((option) => option.value === rule.match)?.label ??
              rule.match;
            return (
              <li
                key={`${rule.kind}:${rule.match}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-sm text-text-2">
                    {target?.name ?? t('manager.assign.rules.inactiveSeller')}
                    {target && !target.auto ? ` · ${t('manager.assign.noAuto')}` : ''}
                  </span>
                </div>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  aria-label={t('manager.assign.rules.removeLabel', { label })}
                  onClick={() => save({ ...rule, seller: null })}
                >
                  {t('manager.assign.rules.remove')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (match && seller && !mutation.isPending) save({ kind, match, seller: Number(seller) });
        }}
      >
        <SelectField<RoutingKind>
          label={t('manager.assign.rules.kind')}
          value={kind}
          onChange={(next) => {
            setKind(next);
            setMatch('');
            setSeller('');
          }}
          disabled={mutation.isPending}
          options={[
            { value: 'lead', label: t('manager.assign.rules.lead') },
            { value: 'consultation', label: t('manager.assign.rules.consultation') },
          ]}
        />
        <SelectField
          label={t(
            kind === 'lead' ? 'manager.assign.rules.lead' : 'manager.assign.rules.consultation',
          )}
          value={match}
          onChange={changeMatch}
          disabled={mutation.isPending}
          options={[{ value: '', label: t('manager.assign.rules.choose') }, ...optionsFor(kind)]}
        />
        <SelectField
          label={t('manager.assign.rules.seller')}
          value={seller}
          onChange={setSeller}
          disabled={mutation.isPending}
          options={[
            { value: '', label: t('manager.assign.rules.choose') },
            ...eligible.map((item) => ({ value: String(item.id), label: item.name })),
          ]}
        />
        <Button
          type="submit"
          disabled={!match || !seller || selected?.seller === Number(seller) || mutation.isPending}
        >
          {t(selected ? 'manager.assign.rules.update' : 'manager.assign.rules.add')}
        </Button>
      </form>
    </SectionCard>
  );
}

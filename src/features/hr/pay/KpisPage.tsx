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
import { catalogQuery, kpisQuery, MANUAL, type Direction, type Kpi, type Metric } from './api';
import { useRemoveKpi, useSaveKpi } from './mutations';
import { ScopeFields } from './components/ScopeFields';
import { scopeBody, scopeDraft, SCOPES, useScopeName, type ScopeDraft } from './scope';
import { useMetricNames, useMetricUnit } from './metricNames';
import { parseNumber } from './numbers';

const groupKey = (kpi: Kpi) =>
  [kpi.scope, kpi.position ?? '', kpi.team ?? '', kpi.staff?.id ?? ''].join(':');

/**
 * The KPIs (canvas "تعریف KPI"): what is measured (by the system, or entered by a manager), for
 * whom (everyone, a position, a team or one person), the target (100%), the zero point and the
 * weight in the person's score. KPIs on trial show their numbers but don't count yet.
 */
export default function KpisPage() {
  const { t } = useTranslation('hr');
  const { data } = useSuspenseQuery(kpisQuery);
  const options = useSuspenseQuery(optionsQuery);
  const catalog = useSuspenseQuery(catalogQuery);
  const scopeName = useScopeName();
  const [editing, setEditing] = useState<Partial<Kpi> | null>(null);
  const groups = new Map<string, Kpi[]>();
  const ordered = [...data.kpis].sort(
    (a, b) => SCOPES.indexOf(a.scope) - SCOPES.indexOf(b.scope) || a.id - b.id,
  );
  for (const kpi of ordered) groups.set(groupKey(kpi), [...(groups.get(groupKey(kpi)) ?? []), kpi]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-2xl text-sm text-text-2">{t('pay.kpis.hint')}</p>
        <Button onClick={() => setEditing({})}>
          <Icon name="plus" size={18} />
          {t('pay.kpis.new')}
        </Button>
      </div>
      {data.kpis.length === 0 ? (
        <EmptyState variant="card" title={t('pay.kpis.none')}>
          {t('pay.kpis.noneHint')}
        </EmptyState>
      ) : (
        [...groups.values()].map((kpis) => {
          const first = kpis[0] as Kpi;
          return (
            <Group
              key={groupKey(first)}
              name={scopeName(first)}
              kpis={kpis}
              metrics={catalog.data.metrics}
              onAdd={() =>
                setEditing({
                  scope: first.scope,
                  position: first.position,
                  team: first.team,
                  staff: first.staff,
                })
              }
              onEdit={setEditing}
            />
          );
        })
      )}
      {editing && (
        <KpiDialog
          kpi={editing}
          options={options.data}
          metrics={catalog.data.metrics}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function Group({
  name,
  kpis,
  metrics,
  onAdd,
  onEdit,
}: {
  name: string;
  kpis: Kpi[];
  metrics: Metric[];
  onAdd: () => void;
  onEdit: (kpi: Kpi) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const names = useMetricNames();
  const remove = useRemoveKpi();
  const [removing, setRemoving] = useState<number | null>(null);
  const total = kpis.reduce((sum, kpi) => sum + (kpi.trial ? 0 : kpi.weight), 0);
  return (
    <Card aria-label={name} className="flex flex-col gap-1 p-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-base font-bold">{name}</h2>
        <Button variant="outline" onClick={onAdd}>
          <Icon name="plus" size={16} />
          {t('pay.kpis.add')}
        </Button>
      </div>
      <ul className="m-0 list-none p-0">
        {kpis.map((kpi) => {
          const metric = metrics.find((row) => row.key === kpi.metric);
          return (
            <li
              key={kpi.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hair py-2 first:border-t-0"
            >
              <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                <span className="font-semibold">{kpi.name}</span>
                <span className="text-[13px] text-text-2">
                  {names.metric(kpi.metric, metric?.label)}
                </span>
              </span>
              <span className="flex-[0_1_200px] text-sm text-text-2">
                {t(kpi.direction === 'lower' ? 'pay.kpis.targetAtMost' : 'pay.kpis.targetIs', {
                  target: f.number(kpi.target),
                  unit: kpi.unit,
                })}
              </span>
              <span className="flex flex-[0_1_140px] flex-wrap gap-1 text-sm text-text-2">
                {kpi.trial ? (
                  <Chip tone="warn" small>
                    {t('pay.trial')}
                  </Chip>
                ) : (
                  t('pay.kpis.share', {
                    n: f.number(total ? Math.round((kpi.weight / total) * 100) : 0),
                  })
                )}
              </span>
              {removing === kpi.id ? (
                <InlineConfirm
                  message={t('pay.kpis.removeConfirm')}
                  confirmLabel={t('pay.kpis.remove')}
                  cancelLabel={t('close')}
                  pending={remove.isPending}
                  onCancel={() => setRemoving(null)}
                  onConfirm={() =>
                    remove.mutate(kpi.id, {
                      onSuccess: () => toast.success(t('pay.kpis.removed')),
                      onError: () => toast.error(t('error')),
                    })
                  }
                />
              ) : (
                <span className="flex gap-1">
                  <IconButton
                    icon="pen"
                    aria-label={t('pay.kpis.edit', { name: kpi.name })}
                    onClick={() => onEdit(kpi)}
                  />
                  <IconButton
                    icon="trash"
                    aria-label={t('pay.kpis.removeOne', { name: kpi.name })}
                    onClick={() => setRemoving(kpi.id)}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function KpiDialog({
  kpi,
  options,
  metrics,
  onClose,
}: {
  kpi: Partial<Kpi>;
  options: HrOptions;
  metrics: Metric[];
  onClose: () => void;
}) {
  const { t } = useTranslation('hr');
  const save = useSaveKpi();
  const names = useMetricNames();
  const unitOf = useMetricUnit();
  const [name, setName] = useState(kpi.name ?? '');
  const [metric, setMetric] = useState(kpi.metric ?? MANUAL);
  const [scope, setScope] = useState<ScopeDraft>(scopeDraft(kpi));
  const [direction, setDirection] = useState<Direction>(kpi.direction ?? 'higher');
  const [target, setTarget] = useState(kpi.target === undefined ? '' : String(kpi.target));
  const [worst, setWorst] = useState(kpi.worst == null ? '' : String(kpi.worst));
  const [cap, setCap] = useState(String(kpi.cap ?? 100));
  const [weight, setWeight] = useState(String(kpi.weight ?? 1));
  const [unit, setUnit] = useState(kpi.unit ?? '');
  const [trial, setTrial] = useState(kpi.trial ?? kpi.id === undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const groups = [...new Set(metrics.map((row) => row.group))];

  const pickMetric = (key: string) => {
    const picked = metrics.find((row) => row.key === key);
    setMetric(key);
    if (picked) {
      setDirection(picked.direction);
      if (!unit || metrics.some((row) => unitOf(row) === unit)) setUnit(unitOf(picked));
      if (!name.trim()) setName(names.metric(picked.key, picked.label));
    }
  };

  const submit = () => {
    const goal = parseNumber(target);
    const zero = worst.trim() ? parseNumber(worst) : null;
    const share = parseNumber(weight);
    const most = parseNumber(cap);
    const { missing, body } = scopeBody(scope);
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t('form.required');
    if (missing) found.scope = t('form.required');
    if (goal === null) found.target = t('pay.results.notNumber');
    if (worst.trim() && zero === null) found.worst = t('pay.results.notNumber');
    else if (zero !== null && zero === goal) found.worst = t('pay.kpis.worstSame');
    if (share === null || share < 1 || share > 100 || !Number.isInteger(share))
      found.weight = t('pay.kpis.weightRange');
    if (most === null || most < 50 || most > 300 || !Number.isInteger(most))
      found.cap = t('pay.kpis.capRange');
    setErrors(found);
    if (Object.keys(found).length > 0 || goal === null || share === null || most === null) return;
    save.mutate(
      {
        ...(kpi.id !== undefined && { id: kpi.id }),
        ...body,
        name: name.trim(),
        metric,
        direction,
        target: goal,
        worst: zero,
        cap: most,
        weight: share,
        unit: unit.trim(),
        trial,
      },
      {
        onSuccess: () => {
          toast.success(t('pay.kpis.saved'));
          onClose();
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={kpi.id === undefined ? t('pay.kpis.new') : t('pay.kpis.editTitle')}
      closeLabel={t('close')}
      footer={
        <Button disabled={save.isPending} onClick={submit}>
          {t('pay.save')}
        </Button>
      }
    >
      <SelectField
        label={t('pay.kpis.metric')}
        hint={metric === MANUAL ? t('pay.kpis.metricManualHint') : t('pay.kpis.metricAutoHint')}
        value={metric}
        onChange={pickMetric}
        options={groups.flatMap((group) =>
          metrics
            .filter((row) => row.group === group)
            .map((row) => ({
              value: row.key,
              label:
                row.group === 'manual'
                  ? names.metric(row.key, row.label)
                  : `${names.group(group)}: ${names.metric(row.key, row.label)}`,
            })),
        )}
      />
      <TextField
        label={t('pay.kpis.name')}
        placeholder={t('pay.kpis.namePlaceholder')}
        value={name}
        maxLength={64}
        error={errors.name}
        onChange={(event) => setName(event.target.value)}
      />
      <ScopeFields draft={scope} options={options} error={errors.scope} onChange={setScope} />
      <SelectField
        label={t('pay.kpis.direction')}
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'higher', label: t('pay.kpis.higher') },
          { value: 'lower', label: t('pay.kpis.lower') },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label={t('pay.kpis.target')}
          hint={t('pay.kpis.targetHint')}
          inputMode="decimal"
          dir="ltr"
          value={target}
          error={errors.target}
          onChange={(event) => setTarget(event.target.value)}
        />
        <TextField
          label={t('pay.kpis.worst')}
          hint={t(direction === 'lower' ? 'pay.kpis.worstLowerHint' : 'pay.kpis.worstHint')}
          inputMode="decimal"
          dir="ltr"
          value={worst}
          error={errors.worst}
          onChange={(event) => setWorst(event.target.value)}
        />
        <TextField
          label={t('pay.kpis.unit')}
          placeholder={t('pay.kpis.unitPlaceholder')}
          value={unit}
          maxLength={24}
          onChange={(event) => setUnit(event.target.value)}
        />
        <TextField
          label={t('pay.kpis.weight')}
          hint={t('pay.kpis.weightHint')}
          inputMode="numeric"
          dir="ltr"
          value={weight}
          error={errors.weight}
          onChange={(event) => setWeight(event.target.value)}
        />
        <TextField
          label={t('pay.kpis.cap')}
          hint={t('pay.kpis.capHint')}
          inputMode="numeric"
          dir="ltr"
          value={cap}
          error={errors.cap}
          onChange={(event) => setCap(event.target.value)}
        />
      </div>
      <Switch
        label={t('pay.kpis.trial')}
        description={t('pay.kpis.trialHint')}
        checked={trial}
        onChange={setTrial}
      />
    </Dialog>
  );
}

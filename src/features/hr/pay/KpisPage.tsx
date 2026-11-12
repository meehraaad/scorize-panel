import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import { optionsQuery } from '../api';
import { kpisQuery, useRemoveKpi, useSaveKpi, type Kpi } from './api';

/**
 * Each position's KPIs (canvas "تعریف KPI"): what is measured, the target (reaching it is 100%)
 * and its weight in the position's score. Positions themselves are set in the Django admin.
 */
export default function KpisPage() {
  const { t } = useTranslation('hr');
  const { data } = useSuspenseQuery(kpisQuery);
  const options = useSuspenseQuery(optionsQuery);
  const [editing, setEditing] = useState<Partial<Kpi> | null>(null);
  const positions = options.data.positions;
  const used = positions.filter((position) =>
    data.kpis.some((kpi) => kpi.position === position.id),
  );

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
        used.map((position) => (
          <Position
            key={position.id}
            name={position.name}
            kpis={data.kpis.filter((kpi) => kpi.position === position.id)}
            onAdd={() => setEditing({ position: position.id })}
            onEdit={setEditing}
          />
        ))
      )}
      {editing && (
        <KpiDialog kpi={editing} positions={positions} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function Position({
  name,
  kpis,
  onAdd,
  onEdit,
}: {
  name: string;
  kpis: Kpi[];
  onAdd: () => void;
  onEdit: (kpi: Kpi) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const remove = useRemoveKpi();
  const [removing, setRemoving] = useState<number | null>(null);
  const total = kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
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
        {kpis.map((kpi) => (
          <li
            key={kpi.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hair py-2 first:border-t-0"
          >
            <span className="min-w-0 flex-[1_1_180px] font-semibold">{kpi.name}</span>
            <span className="flex-[0_1_180px] text-sm text-text-2">
              {t('pay.kpis.targetIs', { target: f.number(kpi.target), unit: kpi.unit })}
            </span>
            <span className="flex-[0_1_120px] text-sm text-text-2">
              {t('pay.kpis.share', { n: f.number(Math.round((kpi.weight / total) * 100)) })}
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
        ))}
      </ul>
    </Card>
  );
}

const number = (value: string) => {
  const text = toLatinDigits(value).trim().replace(/[٫,]/g, '.');
  const parsed = Number(text);
  return text && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function KpiDialog({
  kpi,
  positions,
  onClose,
}: {
  kpi: Partial<Kpi>;
  positions: readonly { id: number; name: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation('hr');
  const save = useSaveKpi();
  const [name, setName] = useState(kpi.name ?? '');
  const [position, setPosition] = useState(kpi.position ? String(kpi.position) : '');
  const [target, setTarget] = useState(kpi.target === undefined ? '' : String(kpi.target));
  const [weight, setWeight] = useState(String(kpi.weight ?? 1));
  const [unit, setUnit] = useState(kpi.unit ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const goal = number(target);
    const share = number(weight);
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t('form.required');
    if (!position) found.position = t('form.required');
    if (goal === null) found.target = t('pay.results.notNumber');
    if (share === null || share < 1 || share > 100 || !Number.isInteger(share))
      found.weight = t('pay.kpis.weightRange');
    setErrors(found);
    if (Object.keys(found).length > 0 || goal === null || share === null) return;
    save.mutate(
      {
        ...(kpi.id !== undefined && { id: kpi.id }),
        name: name.trim(),
        position: Number(position),
        target: goal,
        weight: share,
        unit: unit.trim(),
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
      <TextField
        label={t('pay.kpis.name')}
        placeholder={t('pay.kpis.namePlaceholder')}
        value={name}
        maxLength={64}
        error={errors.name}
        onChange={(event) => setName(event.target.value)}
      />
      <SelectField
        label={t('form.position')}
        value={position}
        error={errors.position}
        onChange={setPosition}
        options={[
          { value: '', label: t('pay.kpis.pickPosition') },
          ...positions.map((item) => ({ value: String(item.id), label: item.name })),
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
      </div>
    </Dialog>
  );
}

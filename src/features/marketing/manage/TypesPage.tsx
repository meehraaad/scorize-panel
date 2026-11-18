import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ChoiceGroup } from '@/components/ui/Choices';
import { PageColumns } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { fieldErrors } from '@/lib/api/fieldErrors';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import {
  STAGE_COLORS,
  boardQuery,
  useEditType,
  useNewType,
  type CardType,
  type StageColor,
} from '../boardApi';
import { TYPE_TONE } from '../format';

/**
 * Card types (reel, post, blog…), kept by the marketing manager: a new card of a type starts with
 * its checklist. Types are turned off, not deleted, so old cards keep theirs.
 */
export default function TypesPage() {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const { data } = useSuspenseQuery(boardQuery);
  const [chosen, setChosen] = useState<number | null>(data.types[0]?.id ?? null);
  const create = useNewType();
  const type = data.types.find((item) => item.id === chosen) ?? data.types[0];

  const list = (
    <SectionCard
      id="types-list"
      title={t('types.title')}
      subtitle={t('types.subtitle')}
      variant="panel"
    >
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {data.types.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-pressed={item.id === type?.id}
              onClick={() => setChosen(item.id)}
              className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3 text-start ${
                item.id === type?.id ? 'bg-tint' : 'hover:bg-canvas'
              }`}
            >
              <Chip tone={TYPE_TONE[item.color]} small>
                {item.name}
              </Chip>
              <span className="flex-1 text-xs text-text-2">
                {t('types.items', { n: f.number(item.checklist.length) })}
              </span>
              {!item.is_active && (
                <Chip tone="neutral" small>
                  {t('types.off')}
                </Chip>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        className="self-start"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(
            { name: t('types.newName') },
            {
              onSuccess: (result) => {
                toast.success(t('types.added'));
                setChosen(result.types[result.types.length - 1]?.id ?? null);
              },
              onError: () => toast.error(t('card.error')),
            },
          )
        }
      >
        {t('types.add')}
      </Button>
    </SectionCard>
  );

  return (
    <PageColumns
      main={type ? <TypeForm key={type.id} type={type} /> : null}
      aside={list}
      asideLabel={t('types.title')}
    />
  );
}

function TypeForm({ type }: { type: CardType }) {
  const { t } = useTranslation('marketing');
  const edit = useEditType();
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState<StageColor>(type.color);
  const [days, setDays] = useState(String(type.days));
  const [checklist, setChecklist] = useState(type.checklist.join('\n'));
  const [active, setActive] = useState(type.is_active);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () =>
    edit.mutate(
      {
        id: type.id,
        name: name.trim(),
        color,
        days: Number(toLatinDigits(days).replace(/\D/g, '') || 0),
        checklist: checklist
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        is_active: active,
      },
      {
        onSuccess: () => {
          setErrors({});
          toast.success(t('types.saved'));
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          if (Object.keys(fieldErrors(error)).length === 0) toast.error(t('card.error'));
        },
      },
    );

  return (
    <SectionCard
      id="type-form"
      title={t('types.edit', { name: type.name })}
      variant="panel"
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField
          label={t('types.name')}
          value={name}
          maxLength={32}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('types.days')}
          inputMode="numeric"
          value={days}
          error={errors.days}
          onChange={(event) => setDays(event.target.value)}
        />
      </div>
      <ChoiceGroup
        legend={t('types.color')}
        value={color}
        onChange={setColor}
        options={STAGE_COLORS.map((value) => ({ value, label: t(`color.${value}`) }))}
      />
      <TextAreaField
        label={t('types.checklist')}
        hint={t('types.checklistHint')}
        rows={6}
        value={checklist}
        error={errors.checklist}
        onChange={(event) => setChecklist(event.target.value)}
      />
      <Switch
        label={t('types.active')}
        description={t('types.activeHint')}
        checked={active}
        onChange={setActive}
      />
      <Button className="self-start" disabled={edit.isPending || !name.trim()} onClick={save}>
        {t('types.save')}
      </Button>
    </SectionCard>
  );
}

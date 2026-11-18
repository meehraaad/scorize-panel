import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField, TogglePill } from '@/components/ui/Choices';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { PageColumns } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { fieldErrors } from '@/lib/api/fieldErrors';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import {
  STAGE_COLORS,
  STAGE_NEEDS,
  boardQuery,
  useDeleteStage,
  useEditStage,
  useNewStage,
  useOrderStages,
  type BoardData,
  type Stage,
  type StageColor,
  type StageNeed,
} from '../boardApi';
import { STAGE_DOT } from '../format';

const OWNER = 'owner';

/**
 * The board's stages, kept by the marketing manager (canvas "مرحله‌های بُرد"): their order, colour,
 * card limit, who may take a card out, whose the stage's task is and what a card needs to enter.
 */
export default function StagesPage() {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const { data } = useSuspenseQuery(boardQuery);
  const [chosen, setChosen] = useState<number | null>(data.stages[0]?.id ?? null);
  const order = useOrderStages();
  const create = useNewStage();
  const stage = data.stages.find((item) => item.id === chosen) ?? data.stages[0];
  const countOf = (id: number) => data.cards.filter((card) => card.stage === id).length;

  const swap = (index: number, by: -1 | 1) => {
    const ids = data.stages.map((item) => item.id);
    const other = index + by;
    const a = ids[index];
    const b = ids[other];
    if (a === undefined || b === undefined) return;
    ids[index] = b;
    ids[other] = a;
    order.mutate(ids, { onError: () => toast.error(t('card.error')) });
  };

  const list = (
    <SectionCard id="stages-list" title={t('stages.list')} variant="panel">
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {data.stages.map((item, index) => (
          <li key={item.id} className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={item.id === stage?.id}
              onClick={() => setChosen(item.id)}
              className={`flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 text-start text-[15px] ${
                item.id === stage?.id ? 'bg-tint font-semibold' : 'hover:bg-canvas'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-2.5 flex-none rounded-full ${STAGE_DOT[item.color]}`}
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="text-xs text-text-2">
                {t('stages.cards', { n: f.number(countOf(item.id)) })}
              </span>
            </button>
            <IconButton
              icon="chevronDown"
              iconSize={16}
              className="rotate-180 text-text-2"
              aria-label={t('stages.up', { name: item.name })}
              disabled={index === 0 || order.isPending}
              onClick={() => swap(index, -1)}
            />
            <IconButton
              icon="chevronDown"
              iconSize={16}
              className="text-text-2"
              aria-label={t('stages.down', { name: item.name })}
              disabled={index === data.stages.length - 1 || order.isPending}
              onClick={() => swap(index, 1)}
            />
          </li>
        ))}
      </ol>
      <Button
        variant="outline"
        className="self-start"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(
            { name: t('stages.newName') },
            {
              onSuccess: (result) => {
                toast.success(t('stages.added'));
                setChosen(result.stages[result.stages.length - 1]?.id ?? null);
              },
              onError: () => toast.error(t('card.error')),
            },
          )
        }
      >
        {t('stages.add')}
      </Button>
    </SectionCard>
  );

  return (
    <PageColumns
      main={
        stage ? (
          <StageForm
            key={stage.id}
            stage={stage}
            board={data}
            cards={countOf(stage.id)}
            onDeleted={() => setChosen(null)}
          />
        ) : null
      }
      aside={list}
      asideLabel={t('stages.list')}
    />
  );
}

function StageForm({
  stage,
  board,
  cards,
  onDeleted,
}: {
  stage: Stage;
  board: BoardData;
  cards: number;
  onDeleted: () => void;
}) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const edit = useEditStage();
  const remove = useDeleteStage();
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState<StageColor>(stage.color);
  const [limit, setLimit] = useState(stage.card_limit === null ? '' : String(stage.card_limit));
  const [managerOnly, setManagerOnly] = useState(stage.manager_only);
  const [assignee, setAssignee] = useState(stage.assignee ? String(stage.assignee.id) : OWNER);
  const [task, setTask] = useState(stage.task_text);
  const [days, setDays] = useState(String(stage.task_days));
  const [needs, setNeeds] = useState<StageNeed[]>(stage.needs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const others = board.stages.filter((item) => item.id !== stage.id);
  const [moveTo, setMoveTo] = useState(String(others[0]?.id ?? ''));
  const number = (value: string) => {
    const digits = toLatinDigits(value).replace(/\D/g, '');
    return digits ? Number(digits) : null;
  };

  const save = () =>
    edit.mutate(
      {
        id: stage.id,
        name: name.trim(),
        color,
        card_limit: number(limit),
        manager_only: managerOnly,
        assignee: assignee === OWNER ? null : Number(assignee),
        task_text: task.trim(),
        task_days: number(days) ?? 0,
        needs,
      },
      {
        onSuccess: () => {
          setErrors({});
          toast.success(t('stages.saved'));
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          if (Object.keys(fieldErrors(error)).length === 0) toast.error(t('card.error'));
        },
      },
    );

  return (
    <SectionCard
      id="stage-form"
      title={t('stages.edit', { name: stage.name })}
      variant="panel"
      size="lg"
    >
      <TextField
        label={t('stages.name')}
        value={name}
        maxLength={40}
        error={errors.name}
        onChange={(event) => setName(event.target.value)}
      />
      <ChoiceGroup
        legend={t('stages.color')}
        value={color}
        onChange={setColor}
        options={STAGE_COLORS.map((value) => ({ value, label: t(`color.${value}`) }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('stages.limit')}
          hint={t('stages.limitHint')}
          inputMode="numeric"
          value={limit}
          error={errors.card_limit}
          onChange={(event) => setLimit(event.target.value)}
        />
        <SelectField
          label={t('stages.assignee')}
          value={assignee}
          onChange={setAssignee}
          options={[
            { value: OWNER, label: t('stages.assigneeOwner') },
            ...board.people.map((person) => ({ value: String(person.id), label: person.name })),
          ]}
        />
      </div>
      <Switch
        label={t('stages.managerOnly')}
        description={t('stages.managerOnlyHint')}
        checked={managerOnly}
        onChange={setManagerOnly}
      />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField
          label={t('stages.task')}
          hint={t('stages.taskHint')}
          value={task}
          maxLength={128}
          error={errors.task_text}
          onChange={(event) => setTask(event.target.value)}
        />
        <TextField
          label={t('stages.days')}
          hint={t('stages.daysHint')}
          inputMode="numeric"
          value={days}
          error={errors.task_days}
          onChange={(event) => setDays(event.target.value)}
        />
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[15px] font-medium">{t('stages.needs')}</legend>
        <div className="flex flex-wrap gap-2">
          {STAGE_NEEDS.map((need) => (
            <TogglePill
              key={need}
              label={t(`need.${need}`)}
              checked={needs.includes(need)}
              onChange={(on) =>
                setNeeds((current) =>
                  on ? [...current, need] : current.filter((item) => item !== need),
                )
              }
            />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button disabled={edit.isPending || !name.trim()} onClick={save}>
          {t('stages.save')}
        </Button>
        {!deleting && (
          <Button
            variant="outline"
            className="text-danger"
            disabled={others.length === 0}
            onClick={() => setDeleting(true)}
          >
            {t('stages.delete')}
          </Button>
        )}
      </div>
      {others.length === 0 && <p className="m-0 text-sm text-text-2">{t('stages.lastStage')}</p>}
      {deleting && (
        <InlineConfirm
          message={t('stages.deleteConfirm', { name: stage.name })}
          confirmLabel={t('stages.delete')}
          cancelLabel={t('card.cancel')}
          pending={remove.isPending}
          onCancel={() => setDeleting(false)}
          onConfirm={() =>
            remove.mutate(
              { id: stage.id, moveTo: cards > 0 ? Number(moveTo) : null },
              {
                onSuccess: () => {
                  toast.success(t('stages.deleted'));
                  onDeleted();
                },
                onError: (error) =>
                  toast.error(
                    error instanceof ApiError && error.status === 409
                      ? t('stages.lastStage')
                      : t('card.error'),
                  ),
              },
            )
          }
        >
          {cards > 0 && (
            <SelectField
              label={t('stages.moveCardsTo', { n: f.number(cards) })}
              value={moveTo}
              onChange={setMoveTo}
              options={others.map((item) => ({ value: String(item.id), label: item.name }))}
            />
          )}
        </InlineConfirm>
      )}
    </SectionCard>
  );
}

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  ACTIVITY_KINDS,
  FORM_ACTIVITIES,
  STAGE_PHASES,
  stagesQuery,
  useSaveStages,
  type ActivityInput,
  type ActivityKind,
  type StageActivity,
  type StageInput,
  type StagePhase,
  type StagesData,
} from '../api';

/** A column being edited: `key` names it on this page, `id` in Django (null until saved). */
interface Draft {
  key: string;
  id: number | null;
  name: string;
  phase: StagePhase;
  maxDays: string;
  cards: number;
  activities: ActivityInput[];
}

const DAYS = [0, 1, 2, 3, 7] as const;
const HOURS = [9, 10, 12, 16, 18] as const;
const TIMED: readonly ActivityKind[] = ['follow_up', 'task'];
const FIXED_START = ['new'] as const;
const FIXED_END = ['draft', 'won', 'lost'] as const;

const toInput = (activity: StageActivity): ActivityInput => ({
  kind: activity.kind,
  required: activity.required,
  ...(TIMED.includes(activity.kind) && {
    days: activity.settings.days ?? 1,
    hour: activity.settings.hour ?? 10,
  }),
  ...(FORM_ACTIVITIES.includes(activity.kind) && { text: activity.settings.text ?? '' }),
  ...(activity.kind === 'message' && { template: activity.settings.template?.id ?? null }),
});

const draftsOf = (data: StagesData): Draft[] =>
  data.stages.map((stage) => ({
    key: String(stage.id),
    id: stage.id,
    name: stage.name,
    phase: stage.phase,
    maxDays: stage.max_days === null ? '' : String(stage.max_days),
    cards: stage.cards,
    activities: stage.activities.map(toInput),
  }));

const newActivity = (kind: ActivityKind): ActivityInput => ({
  kind,
  required: kind === 'follow_up',
  ...(TIMED.includes(kind) && { days: 1, hour: 10 }),
  ...(FORM_ACTIVITIES.includes(kind) && { text: '' }),
  ...(kind === 'message' && { template: null }),
});

/** What would stop the list from saving, before Django is asked. */
function problemOf(drafts: Draft[]): 'name' | 'duplicate' | 'order' | 'phases' | null {
  const names = drafts.map((draft) => draft.name.trim());
  if (names.some((name) => !name)) return 'name';
  if (new Set(names).size !== names.length) return 'duplicate';
  const order = drafts.map((draft) => STAGE_PHASES.indexOf(draft.phase));
  if (order.some((value, index) => index > 0 && value < (order[index - 1] ?? 0))) return 'order';
  if (new Set(order).size !== STAGE_PHASES.length) return 'phases';
  return null;
}

/**
 * The team's board columns and what each asks for when a card enters it (S48). Only the middle
 * columns change; new, contract draft, contract and lost stay fixed. Canvas "تنظیم مرحله‌ها و
 * فعالیت‌ها (مدیر)".
 */
export default function StagesPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(stagesQuery);
  const save = useSaveStages();
  const [drafts, setDrafts] = useState(() => draftsOf(data));
  const [selected, setSelected] = useState(drafts[0]?.key ?? '');
  const [moves, setMoves] = useState<Record<number, number>>({});
  const [removed, setRemoved] = useState<Draft[]>([]);
  const [added, setAdded] = useState(0);
  const [checked, setChecked] = useState(false);

  const current = drafts.find((draft) => draft.key === selected);
  const problem = problemOf(drafts);
  const waiting = removed.filter(
    (draft) => draft.id !== null && draft.cards > 0 && !(draft.id in moves),
  );
  const update = (key: string, values: Partial<Draft>) =>
    setDrafts((list) => list.map((draft) => (draft.key === key ? { ...draft, ...values } : draft)));
  const updateActivity = (kind: ActivityKind, values: Partial<ActivityInput>) => {
    if (!current) return;
    update(current.key, {
      activities: current.activities.map((activity) =>
        activity.kind === kind ? { ...activity, ...values } : activity,
      ),
    });
  };
  const shift = (index: number, by: -1 | 1) =>
    setDrafts((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      if (item) next.splice(index + by, 0, item);
      return next;
    });

  function remove(draft: Draft) {
    const rest = drafts.filter((item) => item.key !== draft.key);
    setDrafts(rest);
    if (draft.id !== null) setRemoved((list) => [...list, draft]);
    setSelected(rest[0]?.key ?? '');
  }

  function submit() {
    setChecked(true);
    if (problem || waiting.length) return;
    const stages: StageInput[] = drafts.map((draft) => ({
      id: draft.id,
      name: draft.name.trim(),
      phase: draft.phase,
      max_days: draft.maxDays ? Number(draft.maxDays) : null,
      activities: draft.activities,
    }));
    save.mutate(
      {
        stages,
        moves: Object.entries(moves).map(([source, to]) => ({ source: Number(source), to })),
      },
      {
        onSuccess: (saved) => {
          const next = draftsOf(saved);
          setDrafts(next);
          setRemoved([]);
          setMoves({});
          setChecked(false);
          setSelected(
            next.find((draft) => draft.name === current?.name.trim())?.key ?? next[0]?.key ?? '',
          );
          toast.success(t('manager.stages.saved'));
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('manager.stages.stale')
              : t('manager.stages.failed'),
          ),
      },
    );
  }

  const fixed = (stage: (typeof FIXED_START)[number] | (typeof FIXED_END)[number]) => (
    <li
      key={stage}
      className="flex min-h-13 items-center gap-2.5 rounded-xl bg-track px-3 text-sm text-text-2"
    >
      <Icon name="lock" size={14} />
      <span className="flex-1">{t(`stage.${stage}`)}</span>
      <span className="text-xs">{t(`manager.stages.fixed.${stage}`)}</span>
    </li>
  );

  return (
    <>
      <PageHeader
        title={t('manager.stages.title')}
        subtitle={t('manager.stages.subtitle')}
        actions={
          <Button onClick={submit} disabled={save.isPending}>
            {t('manager.stages.save')}
          </Button>
        }
      />
      {checked && (problem || waiting.length > 0) && (
        <Notice tone="error">
          {problem
            ? t(`manager.stages.problem.${problem}`)
            : t('manager.stages.problem.moves', {
                names: f.list(waiting.map((draft) => draft.name)),
              })}
        </Notice>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
        <SectionCard id="stages-list" variant="panel" title={t('manager.stages.list')}>
          <p className="m-0 text-[13px] leading-6 text-text-2">{t('manager.stages.listHint')}</p>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {FIXED_START.map(fixed)}
            {drafts.map((draft, index) => (
              <li key={draft.key} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-current={draft.key === selected ? 'true' : undefined}
                  onClick={() => setSelected(draft.key)}
                  className={`flex min-h-13 min-w-0 flex-1 flex-col justify-center rounded-xl px-3 text-start text-sm shadow-[inset_0_0_0_1px_var(--line-2)] ${draft.key === selected ? 'bg-tint shadow-[inset_0_0_0_1.5px_var(--primary)]' : 'bg-surface'}`}
                >
                  <span className="truncate font-medium">
                    {draft.name.trim() || t('manager.stages.unnamed')}
                  </span>
                  <span className="text-xs text-text-2">
                    {t('manager.stages.info', {
                      n: f.number(draft.activities.length),
                      phase: t(`stage.${draft.phase}`),
                    })}
                  </span>
                </button>
                <IconButton
                  icon="chevronDown"
                  className="rotate-180"
                  aria-label={t('manager.stages.up', { name: draft.name })}
                  disabled={index === 0}
                  onClick={() => shift(index, -1)}
                />
                <IconButton
                  icon="chevronDown"
                  aria-label={t('manager.stages.down', { name: draft.name })}
                  disabled={index === drafts.length - 1}
                  onClick={() => shift(index, 1)}
                />
              </li>
            ))}
            <li>
              <Button
                variant="outline"
                className="w-full"
                disabled={drafts.length >= 10}
                onClick={() => {
                  const key = `new-${String(added)}`;
                  setAdded(added + 1);
                  setDrafts([
                    ...drafts,
                    {
                      key,
                      id: null,
                      name: '',
                      phase: 'offer',
                      maxDays: '',
                      cards: 0,
                      activities: [newActivity('follow_up')],
                    },
                  ]);
                  setSelected(key);
                }}
              >
                <Icon name="plus" size={16} />
                {t('manager.stages.add')}
              </Button>
            </li>
            {FIXED_END.map(fixed)}
          </ol>
        </SectionCard>

        {current ? (
          <SectionCard
            id="stage-editor"
            variant="panel"
            title={current.name.trim() || t('manager.stages.unnamed')}
            subtitle={
              current.cards ? t('manager.stages.cards', { n: f.number(current.cards) }) : undefined
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t('manager.stages.name')}
                value={current.name}
                maxLength={40}
                onChange={(event) => update(current.key, { name: event.target.value })}
              />
              <SelectField
                label={t('manager.stages.phase')}
                hint={t('manager.stages.phaseHint')}
                value={current.phase}
                onChange={(phase) => update(current.key, { phase })}
                options={STAGE_PHASES.map((phase) => ({
                  value: phase,
                  label: t(`stage.${phase}`),
                }))}
              />
              <TextField
                label={t('manager.stages.maxDays')}
                hint={t('manager.stages.maxDaysHint')}
                inputMode="numeric"
                value={current.maxDays}
                onChange={(event) =>
                  update(current.key, {
                    maxDays: event.target.value.replace(/\D/g, '').slice(0, 3),
                  })
                }
              />
            </div>

            <h3 className="m-0 mt-2 text-[15px] font-bold">{t('manager.stages.activities')}</h3>
            <p className="m-0 text-[13px] text-text-2">{t('manager.stages.activitiesHint')}</p>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {current.activities.map((activity, index) => (
                <li
                  key={activity.kind}
                  className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-text-2">{f.number(index + 1)}</span>
                    <b className="flex-1 text-[15px]">{t(`board.activity.${activity.kind}`)}</b>
                    {activity.kind !== 'follow_up' && (
                      <IconButton
                        icon="trash"
                        aria-label={t('manager.stages.removeActivity', {
                          name: t(`board.activity.${activity.kind}`),
                        })}
                        onClick={() =>
                          update(current.key, {
                            activities: current.activities.filter(
                              (item) => item.kind !== activity.kind,
                            ),
                          })
                        }
                      />
                    )}
                  </div>
                  {activity.kind === 'follow_up' ? (
                    <p className="m-0 text-[13px] text-text-2">
                      {t('manager.stages.followUpAlways')}
                    </p>
                  ) : FORM_ACTIVITIES.includes(activity.kind) ? (
                    <Switch
                      label={t('manager.stages.required')}
                      description={t('manager.stages.requiredHint')}
                      checked={activity.required}
                      onChange={(required) => updateActivity(activity.kind, { required })}
                    />
                  ) : activity.kind === 'message' ||
                    activity.kind === 'offer' ||
                    activity.kind === 'sell' ||
                    activity.kind === 'contract' ? (
                    <p className="m-0 text-[13px] text-text-2">
                      {t(`manager.stages.opens.${activity.kind}`)}
                    </p>
                  ) : null}
                  {TIMED.includes(activity.kind) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label={t('manager.stages.days')}
                        value={String(activity.days ?? 1)}
                        onChange={(days) => updateActivity(activity.kind, { days: Number(days) })}
                        options={DAYS.map((days) => ({
                          value: String(days),
                          label: days
                            ? t('manager.stages.daysLater', { n: f.number(days) })
                            : t('manager.stages.sameDay'),
                        }))}
                      />
                      <SelectField
                        label={t('manager.stages.hour')}
                        value={String(activity.hour ?? 10)}
                        onChange={(hour) => updateActivity(activity.kind, { hour: Number(hour) })}
                        options={HOURS.map((hour) => ({
                          value: String(hour),
                          label: f.time(new Date(2026, 0, 1, hour).toISOString()),
                        }))}
                      />
                    </div>
                  )}
                  {FORM_ACTIVITIES.includes(activity.kind) && (
                    <TextField
                      label={t(
                        activity.kind === 'note'
                          ? 'manager.stages.notePrompt'
                          : 'manager.stages.text',
                      )}
                      value={activity.text ?? ''}
                      maxLength={500}
                      onChange={(event) =>
                        updateActivity(activity.kind, { text: event.target.value })
                      }
                    />
                  )}
                  {activity.kind === 'message' && (
                    <SelectField
                      label={t('manager.stages.template')}
                      value={activity.template ? String(activity.template) : 'none'}
                      onChange={(value) =>
                        updateActivity('message', {
                          template: value === 'none' ? null : Number(value),
                        })
                      }
                      options={[
                        { value: 'none', label: t('manager.stages.noTemplate') },
                        ...data.templates.map((template) => ({
                          value: String(template.id),
                          label: template.title,
                        })),
                      ]}
                    />
                  )}
                </li>
              ))}
            </ol>
            {current.activities.length < ACTIVITY_KINDS.length && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-2">
                  {t('manager.stages.library')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_KINDS.filter(
                    (kind) => !current.activities.some((activity) => activity.kind === kind),
                  ).map((kind) => (
                    <Button
                      key={kind}
                      variant="outline"
                      onClick={() =>
                        update(current.key, {
                          activities: [...current.activities, newActivity(kind)],
                        })
                      }
                    >
                      <Icon name="plus" size={16} />
                      {t(`board.activity.${kind}`)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-hair pt-4">
              <Button
                variant="outline"
                disabled={drafts.length <= 1}
                onClick={() => remove(current)}
              >
                <Icon name="trash" size={16} />
                {t('manager.stages.remove')}
              </Button>
              {current.cards > 0 && (
                <span className="text-[13px] text-text-2">
                  {t('manager.stages.removeHint', { n: f.number(current.cards) })}
                </span>
              )}
            </div>
          </SectionCard>
        ) : null}
      </div>

      {removed.some((draft) => draft.cards > 0) && (
        <SectionCard id="stage-moves" variant="panel" title={t('manager.stages.movesTitle')}>
          {removed
            .filter((draft) => draft.id !== null && draft.cards > 0)
            .map((draft) => {
              const source = draft.id ?? 0;
              const targets = drafts.filter((item) => item.id !== null);
              return (
                <SelectField
                  key={draft.key}
                  label={t('manager.stages.moveTo', {
                    name: draft.name,
                    n: f.number(draft.cards),
                  })}
                  value={source in moves ? String(moves[source]) : 'none'}
                  onChange={(value) =>
                    setMoves((map) => {
                      const rest: Record<number, number> = Object.fromEntries(
                        Object.entries(map).filter(([key]) => key !== String(source)),
                      );
                      return value === 'none' ? rest : { ...rest, [source]: Number(value) };
                    })
                  }
                  options={[
                    { value: 'none', label: t('manager.stages.chooseTarget') },
                    ...targets.map((item) => ({ value: String(item.id), label: item.name })),
                  ]}
                  error={
                    checked && !(source in moves) ? t('manager.stages.targetRequired') : undefined
                  }
                />
              );
            })}
        </SectionCard>
      )}
    </>
  );
}

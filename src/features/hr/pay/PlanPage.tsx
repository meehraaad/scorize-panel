import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { PageColumns } from '@/components/ui/PageColumns';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { hrPath } from '../paths';
import {
  catalogQuery,
  firstDayOf,
  MANUAL,
  planPreviewQuery,
  plansQuery,
  type Metric,
  type Plan,
  type PlanInput,
  type PlanPreview,
} from './api';
import { useMetricNames, useMetricUnit } from './metricNames';
import { useSavePlan } from './mutations';
import {
  draftOfPlan,
  goalBody,
  goalOfKpi,
  goalOfMetric,
  goalProblem,
  IMPORTANCE,
  importanceOf,
  LATE_DAYS,
  afterRemoving,
  NO_EXTRAS,
  stepOf,
  TEMPLATES,
  zeroOf,
  type GoalDraft,
  type PlanDraft,
  type Template,
} from './plan';
import { useScopeName } from './scope';

/**
 * One group's score plan (canvas "KPI ساده" 2): what the group should reach (goals, each a target
 * with − and + and an importance), what a full score pays and what a goal's overrun costs, all on
 * one page, with what it would have given last month beside it. A group with no plan starts from
 * a ready template. The zero point and cap of each goal wait under «تنظیمات بیشتر».
 */
export default function PlanPage() {
  const { t } = useTranslation('hr');
  const { key = '' } = useParams();
  const { data } = useSuspenseQuery(plansQuery);
  const catalog = useSuspenseQuery(catalogQuery);
  const plan = data.plans.find((row) => row.key === key);
  if (!plan)
    return (
      <>
        <BackLink to={hrPath('pay/plans')}>{t('pay.plans.back')}</BackLink>
        <EmptyState variant="card">{t('pay.plans.notFound')}</EmptyState>
      </>
    );
  return (
    <PlanEditor key={plan.key} plan={plan} plans={data.plans} metrics={catalog.data.metrics} />
  );
}

function PlanEditor({ plan, plans, metrics }: { plan: Plan; plans: Plan[]; metrics: Metric[] }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const scopeName = useScopeName();
  const [draft, setDraft] = useState<PlanDraft | null>(
    plan.goals.length > 0 ? draftOfPlan(plan) : null,
  );
  const title = plan.name || scopeName(plan);
  return (
    <>
      <BackLink to={hrPath('pay/plans')}>{t('pay.plans.back')}</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[22px] font-extrabold">
            {t('pay.plans.title', { name: title })}
          </h2>
          <p className="m-0 text-[15px] text-text-2">
            {t('pay.plans.people', { n: f.number(plan.people) })}
          </p>
        </div>
        {draft?.trial && (
          <Chip tone="warn" dot>
            {t('pay.plans.trialChip')}
          </Chip>
        )}
      </div>
      {draft === null ? (
        <TemplatePicker plan={plan} plans={plans} metrics={metrics} onPick={setDraft} />
      ) : (
        <Editor plan={plan} draft={draft} metrics={metrics} onChange={setDraft} />
      )}
    </>
  );
}

// region Starting
function useTemplateDraft(metrics: Metric[]) {
  const { t } = useTranslation('hr');
  const names = useMetricNames();
  const unitOf = useMetricUnit();
  return (template: Template): PlanDraft => {
    const goals = template.goals.flatMap((goal) => {
      const metric = metrics.find((row) => row.key === goal.metric);
      if (!metric) return [];
      const name = goal.name
        ? t(`pay.plans.goalNames.${goal.name}`)
        : names.metric(metric.key, metric.label);
      return [goalOfMetric(metric, name, unitOf(metric), goal.target, goal.importance)];
    });
    const late = goals.findIndex((goal) => goal.metric === LATE_DAYS);
    return {
      goals,
      rewardPercent: template.reward,
      minimum: template.minimum,
      penaltyGoal: template.latePenalty && late >= 0 ? late : null,
      penaltyAmount: 200_000,
      ...NO_EXTRAS,
      commission: template.id === 'sales',
      trial: true,
    };
  };
}

function TemplatePicker({
  plan,
  plans,
  metrics,
  onPick,
}: {
  plan: Plan;
  plans: Plan[];
  metrics: Metric[];
  onPick: (draft: PlanDraft) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const names = useMetricNames();
  const scopeName = useScopeName();
  const fromTemplate = useTemplateDraft(metrics);
  const copies = plans.filter((row) => row.key !== plan.key && row.goals.length > 0);
  const [copy, setCopy] = useState('');
  return (
    <SectionCard
      id="plan-start"
      variant="panel"
      size="lg"
      title={t('pay.plans.startTitle')}
      subtitle={t('pay.plans.startHint')}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((template) => {
          const draft = fromTemplate(template);
          if (draft.goals.length === 0) return null;
          return (
            <Card key={template.id} className="flex flex-col gap-3 p-5">
              <h3 className="m-0 text-base font-bold">{t(`pay.plans.templates.${template.id}`)}</h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[14px] text-text-2">
                {draft.goals.map((goal) => (
                  <li key={goal.key}>
                    {t(goal.direction === 'lower' ? 'pay.plans.atMost' : 'pay.plans.atLeast', {
                      name: goal.name,
                      target: f.number(goal.target),
                      unit: goal.unit,
                    })}
                  </li>
                ))}
              </ul>
              <p className="m-0 text-[13px] text-text-2">
                {t('pay.plans.templateReward', { n: f.number(template.reward) })}
              </p>
              <Button className="mt-auto" onClick={() => onPick(draft)}>
                {t('pay.plans.useTemplate')}
              </Button>
            </Card>
          );
        })}
        <Card className="flex flex-col gap-3 p-5">
          <h3 className="m-0 text-base font-bold">{t('pay.plans.copyTitle')}</h3>
          {copies.length > 0 ? (
            <>
              <SelectField
                label={t('pay.plans.copyFrom')}
                value={copy}
                onChange={setCopy}
                options={[
                  { value: '', label: t('pay.plans.pickGroup') },
                  ...copies.map((row) => ({ value: row.key, label: row.name || scopeName(row) })),
                ]}
              />
              <Button
                variant="outline"
                disabled={!copy}
                onClick={() => {
                  const source = copies.find((row) => row.key === copy);
                  if (!source) return;
                  const draft = draftOfPlan(source);
                  onPick({
                    ...draft,
                    commission: false,
                    teamGoal: null,
                    trial: true,
                    goals: source.goals.map((kpi) => ({ ...goalOfKpi(kpi), id: null })),
                  });
                }}
              >
                {t('pay.plans.copy')}
              </Button>
            </>
          ) : (
            <p className="m-0 text-[14px] text-text-2">{t('pay.plans.copyNone')}</p>
          )}
          <Button
            variant="outline"
            className="mt-auto"
            onClick={() =>
              onPick({
                goals: [],
                rewardPercent: 10,
                minimum: 60,
                penaltyGoal: null,
                penaltyAmount: 200_000,
                ...NO_EXTRAS,
                trial: true,
              })
            }
          >
            {t('pay.plans.blank')}
          </Button>
          <p className="m-0 text-[13px] text-text-2">
            {f.list(
              metrics
                .filter((row) => row.automatic)
                .slice(0, 3)
                .map((row) => names.metric(row.key, row.label)),
            )}
            {' …'}
          </p>
        </Card>
      </div>
    </SectionCard>
  );
}
// endregion

function bodyOf(plan: Plan, draft: PlanDraft): PlanInput {
  return {
    scope: plan.scope,
    position: plan.position,
    team: plan.team,
    staff: plan.staff?.id ?? null,
    goals: draft.goals.map(goalBody),
    reward:
      draft.rewardPercent > 0
        ? { percent: draft.rewardPercent, minimum: draft.minimum > 0 ? draft.minimum : null }
        : null,
    penalty:
      draft.penaltyGoal !== null && draft.goals[draft.penaltyGoal]?.direction === 'lower'
        ? { goal: draft.penaltyGoal, amount: draft.penaltyAmount }
        : null,
    commission: draft.commission,
    team_bonus:
      draft.teamGoal !== null && draft.goals[draft.teamGoal]?.direction === 'higher'
        ? { goal: draft.teamGoal, at_least: draft.teamAtLeast, amount: draft.teamAmount }
        : null,
    trial: draft.trial,
  };
}

/** `value`, held back until it has stopped changing for `delay` ms. */
function useSettled<T>(value: T, delay = 500) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function Editor({
  plan,
  draft,
  metrics,
  onChange,
}: {
  plan: Plan;
  draft: PlanDraft;
  metrics: Metric[];
  onChange: (draft: PlanDraft) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const save = useSavePlan();
  const [advanced, setAdvanced] = useState(false);
  const body = bodyOf(plan, draft);
  const problems = draft.goals.some((goal) => goalProblem(goal) !== null);
  const settled = useSettled(body);
  const preview = useQuery({
    ...planPreviewQuery(settled),
    enabled: settled.goals.length > 0 && !settled.goals.some((goal) => !goal.name),
    placeholderData: keepPreviousData,
  });
  const lowers = draft.goals
    .map((goal, index) => ({ goal, index }))
    .filter(({ goal }) => goal.direction === 'lower');
  const highers = draft.goals
    .map((goal, index) => ({ goal, index }))
    .filter(({ goal }) => goal.direction === 'higher');
  const setGoal = (index: number, goal: GoalDraft) =>
    onChange({ ...draft, goals: draft.goals.map((row, at) => (at === index ? goal : row)) });
  const removeGoal = (index: number) =>
    onChange({
      ...draft,
      goals: draft.goals.filter((_row, at) => at !== index),
      penaltyGoal: afterRemoving(draft.penaltyGoal, index),
      teamGoal: afterRemoving(draft.teamGoal, index),
    });
  const stepper = (label: string) => ({
    label,
    decreaseLabel: t('pay.plans.less', { what: label }),
    increaseLabel: t('pay.plans.more', { what: label }),
  });

  const main = (
    <>
      <SectionCard
        id="plan-goals"
        variant="panel"
        size="lg"
        title={t('pay.plans.goalsTitle')}
        subtitle={t('pay.plans.goalsHint')}
      >
        <ol className="m-0 flex list-none flex-col p-0">
          {draft.goals.map((goal, index) => (
            <GoalRow
              key={goal.key}
              goal={goal}
              index={index}
              average={preview.data?.averages[index] ?? null}
              share={
                Math.round(
                  (goal.weight / draft.goals.reduce((sum, row) => sum + row.weight, 0)) * 100,
                ) || 0
              }
              advanced={advanced}
              onChange={(next) => setGoal(index, next)}
              onRemove={() => removeGoal(index)}
            />
          ))}
        </ol>
        <AddGoal
          metrics={metrics}
          used={draft.goals.map((goal) => goal.metric)}
          onAdd={(goal) => onChange({ ...draft, goals: [...draft.goals, goal] })}
        />
      </SectionCard>

      <SectionCard id="plan-pay" variant="panel" size="lg" title={t('pay.plans.payTitle')}>
        <div className="flex flex-col gap-5">
          <p className="m-0 flex flex-wrap items-center gap-3 text-[16px] leading-8">
            <span>{t('pay.plans.rewardBefore')}</span>
            <NumberStepper
              {...stepper(t('pay.plans.rewardLabel'))}
              value={draft.rewardPercent}
              onChange={(value) => onChange({ ...draft, rewardPercent: value })}
              max={100}
              unit="٪"
            />
            <span>{t('pay.plans.rewardAfter')}</span>
          </p>
          <p className="m-0 flex flex-wrap items-center gap-3 text-[16px] leading-8">
            <span>{t('pay.plans.minimumBefore')}</span>
            <NumberStepper
              {...stepper(t('pay.plans.minimumLabel'))}
              value={draft.minimum}
              onChange={(value) => onChange({ ...draft, minimum: value })}
              step={5}
              max={100}
            />
            <span>{t('pay.plans.minimumAfter')}</span>
          </p>
          <div className="flex flex-col gap-3 border-t border-hair pt-4">
            <Switch
              label={t('pay.plans.penalty')}
              description={
                lowers.length === 0 ? t('pay.plans.penaltyNone') : t('pay.plans.penaltyHint')
              }
              checked={draft.penaltyGoal !== null}
              disabled={lowers.length === 0}
              onChange={(on) =>
                onChange({
                  ...draft,
                  penaltyGoal: on
                    ? ((lowers.find(({ goal }) => goal.metric === LATE_DAYS) ?? lowers[0])?.index ??
                      null)
                    : null,
                })
              }
            />
            {draft.penaltyGoal !== null && (
              <div className="flex flex-wrap items-center gap-3 text-[16px] leading-8">
                {lowers.length > 1 ? (
                  <SelectField
                    label={t('pay.plans.penaltyGoal')}
                    value={String(draft.penaltyGoal)}
                    onChange={(value) => onChange({ ...draft, penaltyGoal: Number(value) })}
                    options={lowers.map(({ goal, index }) => ({
                      value: String(index),
                      label: goal.name,
                    }))}
                  />
                ) : null}
                <span>
                  {t('pay.plans.penaltyBefore', {
                    name: draft.goals[draft.penaltyGoal]?.name ?? '',
                  })}
                </span>
                <NumberStepper
                  {...stepper(t('pay.plans.penaltyLabel'))}
                  value={draft.penaltyAmount}
                  onChange={(value) => onChange({ ...draft, penaltyAmount: Math.max(value, 1) })}
                  step={50_000}
                  min={1}
                  unit={t('pay.tomanUnit')}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-hair pt-4">
            <Switch
              label={t('pay.plans.commission')}
              description={t('pay.plans.commissionHint')}
              checked={draft.commission}
              onChange={(on) => onChange({ ...draft, commission: on })}
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-hair pt-4">
            <Switch
              label={t('pay.plans.team')}
              description={highers.length === 0 ? t('pay.plans.teamNone') : t('pay.plans.teamHint')}
              checked={draft.teamGoal !== null}
              disabled={highers.length === 0}
              onChange={(on) =>
                onChange({ ...draft, teamGoal: on ? (highers[0]?.index ?? null) : null })
              }
            />
            {draft.teamGoal !== null && (
              <div className="flex flex-wrap items-center gap-3 text-[16px] leading-8">
                {highers.length > 1 && (
                  <SelectField
                    label={t('pay.plans.teamGoal')}
                    value={String(draft.teamGoal)}
                    onChange={(value) => onChange({ ...draft, teamGoal: Number(value) })}
                    options={highers.map(({ goal, index }) => ({
                      value: String(index),
                      label: goal.name,
                    }))}
                  />
                )}
                <span>
                  {t('pay.plans.teamBefore', { name: draft.goals[draft.teamGoal]?.name ?? '' })}
                </span>
                <NumberStepper
                  {...stepper(t('pay.plans.teamAtLeast'))}
                  value={draft.teamAtLeast}
                  onChange={(value) => onChange({ ...draft, teamAtLeast: Math.max(value, 1) })}
                  min={1}
                  unit={draft.goals[draft.teamGoal]?.unit ?? ''}
                />
                <span>{t('pay.plans.teamMiddle')}</span>
                <NumberStepper
                  {...stepper(t('pay.plans.teamAmount'))}
                  value={draft.teamAmount}
                  onChange={(value) => onChange({ ...draft, teamAmount: Math.max(value, 1) })}
                  step={250_000}
                  min={1}
                  unit={t('pay.tomanUnit')}
                />
                <span>{t('pay.plans.teamAfter')}</span>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <Card className="flex flex-col p-0">
        <button
          type="button"
          aria-expanded={advanced}
          className="flex min-h-14 items-center justify-between gap-3 px-5 text-start text-[15px] font-bold"
          onClick={() => setAdvanced(!advanced)}
        >
          <span>
            {t('pay.plans.advanced')}{' '}
            <span className="font-normal text-text-2">{t('pay.plans.advancedHint')}</span>
          </span>
          <span className={advanced ? 'rotate-180' : ''}>
            <Icon name="chevronDown" size={18} />
          </span>
        </button>
        {advanced && (
          <div className="flex flex-col gap-3 px-5 pb-5 text-[14px] leading-7 text-text-2">
            <p className="m-0">{t('pay.plans.advancedGoals')}</p>
            <p className="m-0">
              {t('pay.plans.advancedMore')}{' '}
              <Link className="font-semibold text-primary-text" to={hrPath('pay/rules')}>
                {t('pay.section.rules')}
              </Link>
              {' · '}
              <Link className="font-semibold text-primary-text" to={hrPath('pay/kpis')}>
                {t('pay.section.kpis')}
              </Link>
            </p>
          </div>
        )}
      </Card>

      {plan.others.length > 0 && (
        <p className="m-0 text-[14px] text-text-2">
          {t('pay.plans.others', { names: f.list(plan.others.map((rule) => rule.name)) })}{' '}
          <Link className="font-semibold text-primary-text" to={hrPath('pay/rules')}>
            {t('pay.section.rules')}
          </Link>
        </p>
      )}

      <Card className="flex flex-col gap-4 p-5">
        <Switch
          label={t('pay.plans.trial')}
          description={t('pay.plans.trialHint')}
          checked={draft.trial}
          onChange={(trial) => onChange({ ...draft, trial })}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={save.isPending || problems || draft.goals.length === 0}
            onClick={() =>
              save.mutate(body, {
                onSuccess: (saved) => {
                  onChange(draftOfPlan(saved));
                  toast.success(t('pay.plans.saved'));
                },
                onError: () => toast.error(t('error')),
              })
            }
          >
            {t('pay.plans.save')}
          </Button>
          {problems && <span className="text-[14px] text-danger">{t('pay.plans.needName')}</span>}
        </div>
      </Card>
    </>
  );

  return (
    <PageColumns
      asideLabel={t('pay.plans.previewTitle')}
      main={main}
      aside={<Preview preview={preview.data} pending={preview.isPending} minimum={draft.minimum} />}
    />
  );
}

function GoalRow({
  goal,
  index,
  average,
  share,
  advanced,
  onChange,
  onRemove,
}: {
  goal: GoalDraft;
  index: number;
  average: number | null;
  share: number;
  advanced: boolean;
  onChange: (goal: GoalDraft) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const names = useMetricNames();
  const manual = goal.metric === MANUAL;
  const target = t('pay.plans.target');
  const stepperLabels = (label: string) => ({
    label,
    decreaseLabel: t('pay.plans.less', { what: label }),
    increaseLabel: t('pay.plans.more', { what: label }),
  });
  return (
    <li className="flex flex-col gap-3 border-t border-hair py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint font-extrabold text-primary-text">
            {f.number(index + 1)}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            {manual ? (
              <TextField
                label={t('pay.plans.goalName')}
                placeholder={t('pay.kpis.namePlaceholder')}
                value={goal.name}
                maxLength={64}
                error={goal.name.trim() ? undefined : t('form.required')}
                onChange={(event) => onChange({ ...goal, name: event.target.value })}
              />
            ) : (
              <span className="text-[16px] font-bold">{goal.name}</span>
            )}
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-text-2">
              {manual ? (
                <Chip tone="neutral" small>
                  {t('pay.plans.manual')}
                </Chip>
              ) : (
                <Chip tone="good" small>
                  {t('pay.results.auto')}
                </Chip>
              )}
              {!manual && goal.name !== names.metric(goal.metric) && names.metric(goal.metric)}
            </span>
          </div>
        </div>
        <IconButton
          icon="close"
          aria-label={t('pay.plans.remove', { name: goal.name })}
          onClick={onRemove}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 ps-13">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px]">
            {t(goal.direction === 'lower' ? 'pay.plans.atMostWord' : 'pay.plans.atLeastWord')}
          </span>
          <NumberStepper
            {...stepperLabels(t('pay.plans.targetOf', { name: goal.name }))}
            value={goal.target}
            step={stepOf(goal.target, goal.unit)}
            unit={goal.unit}
            onChange={(value) => onChange({ ...goal, target: value, worst: null })}
          />
          {average !== null && (
            <span className="text-[13px] text-text-2">
              {t('pay.plans.average', { value: f.number(average), unit: goal.unit })}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px]">{t('pay.plans.importance')}</span>
          <span
            role="group"
            aria-label={t('pay.plans.importanceOf', { name: goal.name })}
            className="flex gap-0.5 rounded-xl bg-canvas p-1"
          >
            {IMPORTANCE.map((level) => {
              const on = importanceOf(goal.weight) === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={on}
                  className={`min-h-10 min-w-16 rounded-lg px-3 text-[14px] ${
                    on ? 'bg-surface font-bold text-primary-text shadow-panel' : 'text-text-2'
                  }`}
                  onClick={() => onChange({ ...goal, weight: level })}
                >
                  {t(`pay.plans.levels.${String(level) as '1' | '2' | '3'}`)}
                </button>
              );
            })}
          </span>
          <span className="text-[13px] text-text-2">
            {t('pay.plans.share', { n: f.number(share) })}
          </span>
        </span>
      </div>
      {advanced && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-canvas p-3 ps-13">
          <span className="flex flex-wrap items-center gap-2 text-[14px]">
            {t('pay.plans.zero')}
            <NumberStepper
              {...stepperLabels(t('pay.plans.zeroOf', { name: goal.name }))}
              value={goal.worst ?? zeroOf(goal.direction, goal.target)}
              step={stepOf(goal.target, goal.unit)}
              unit={goal.unit}
              onChange={(value) =>
                onChange({ ...goal, worst: value === goal.target ? goal.worst : value })
              }
            />
          </span>
          <span className="flex flex-wrap items-center gap-2 text-[14px]">
            {t('pay.plans.cap')}
            <NumberStepper
              {...stepperLabels(t('pay.plans.capOf', { name: goal.name }))}
              value={goal.cap}
              step={10}
              min={50}
              max={300}
              unit="٪"
              onChange={(value) => onChange({ ...goal, cap: Math.round(value) })}
            />
          </span>
          <span className="text-[13px] text-text-2">{target}</span>
        </div>
      )}
    </li>
  );
}

function AddGoal({
  metrics,
  used,
  onAdd,
}: {
  metrics: Metric[];
  used: string[];
  onAdd: (goal: GoalDraft) => void;
}) {
  const { t } = useTranslation('hr');
  const names = useMetricNames();
  const unitOf = useMetricUnit();
  const [open, setOpen] = useState(false);
  const free = metrics.filter((row) => row.key === MANUAL || !used.includes(row.key));
  if (!open)
    return (
      <button
        type="button"
        className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-2 font-bold text-primary-text"
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size={18} />
        {t('pay.plans.addGoal')}
      </button>
    );
  return (
    <div className="mt-3 grid gap-1 rounded-2xl bg-canvas p-2 sm:grid-cols-2">
      {free.map((metric) => (
        <button
          key={metric.key}
          type="button"
          className="flex min-h-14 flex-col items-start justify-center rounded-xl px-3 py-2 text-start hover:bg-surface"
          onClick={() => {
            const unit = unitOf(metric);
            const target = metric.direction === 'lower' ? 2 : unit === '٪' ? 90 : 10;
            onAdd(
              goalOfMetric(
                metric,
                metric.key === MANUAL ? '' : names.metric(metric.key, metric.label),
                unit,
                target,
              ),
            );
            setOpen(false);
          }}
        >
          <span className="text-[15px] font-semibold">
            {metric.key === MANUAL
              ? t('pay.plans.manualGoal')
              : names.metric(metric.key, metric.label)}
          </span>
          <span className="text-[13px] text-text-2">
            {metric.key === MANUAL ? t('pay.plans.manualGoalHint') : names.group(metric.group)}
          </span>
        </button>
      ))}
      <Button variant="outline" className="sm:col-span-2" onClick={() => setOpen(false)}>
        {t('close')}
      </Button>
    </div>
  );
}

function Preview({
  preview,
  pending,
  minimum,
}: {
  preview: PlanPreview | undefined;
  pending: boolean;
  minimum: number;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const million = (amount: number) =>
    t('pay.plans.million', { n: f.number(Math.round(Math.abs(amount) / 100_000) / 10) });
  return (
    <SectionCard
      id="plan-preview"
      variant="panel"
      size="md"
      title={t('pay.plans.previewTitle')}
      subtitle={
        preview
          ? t('pay.plans.previewHint', { month: f.monthYear(firstDayOf(preview)) })
          : t('pay.plans.previewEmpty')
      }
    >
      {!preview ? (
        pending ? (
          <SkeletonRows rows={4} />
        ) : null
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-tint p-3 text-primary-text">
              <div className="text-[13px]">{t('pay.plans.avgScore')}</div>
              <div className="text-[28px] font-extrabold">
                {preview.score === null ? '—' : f.number(Math.round(preview.score))}
              </div>
            </div>
            <div className="rounded-2xl bg-canvas p-3">
              <div className="text-[13px] text-text-2">{t('pay.plans.cost')}</div>
              <div className="mt-1.5 text-[20px] font-extrabold">
                {preview.cost < 0 ? '−' : ''}
                {million(preview.cost)}
              </div>
            </div>
          </div>
          {preview.people.length === 0 ? (
            <p className="m-0 text-[14px] text-text-2">{t('pay.plans.previewNobody')}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {preview.people.map((row) => {
                const net = row.reward - row.penalty;
                return (
                  <li
                    key={row.staff.id}
                    className="flex flex-col gap-1.5 border-t border-hair py-2.5 first:border-t-0"
                  >
                    <span className="flex items-center justify-between gap-2 text-[14px]">
                      <span className="font-semibold">{row.staff.name}</span>
                      <span className="text-text-2">
                        {row.score === null ? (
                          t('pay.plans.noValues')
                        ) : (
                          <>
                            <b className="text-text">{f.number(Math.round(row.score))}</b>
                            {' · '}
                            <span
                              className={
                                net > 0
                                  ? 'font-semibold text-good'
                                  : net < 0
                                    ? 'font-semibold text-danger'
                                    : ''
                              }
                            >
                              {net === 0
                                ? t('pay.plans.noReward')
                                : t(net > 0 ? 'pay.plans.rewardOf' : 'pay.plans.penaltyOf', {
                                    amount: million(net),
                                  })}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <ProgressBar
                      size="sm"
                      value={row.score === null ? 0 : Math.min(row.score, 100)}
                      tone={row.score !== null && row.score >= minimum ? 'primary' : 'warn'}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  );
}

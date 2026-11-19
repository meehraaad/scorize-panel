import { MANUAL, type Direction, type GoalInput, type Kpi, type Metric, type Plan } from './api';

/**
 * A score plan while it is edited (`PlanPage`): goals with a target, an importance (1 کم, 2
 * معمولی, 3 زیاد: the KPI's weight) and, hidden under «تنظیمات بیشتر», a zero point and a cap.
 */
export type Importance = 1 | 2 | 3;
export const IMPORTANCE: readonly Importance[] = [1, 2, 3];

export interface GoalDraft {
  /** Saved KPI, or null for a new goal. */
  id: number | null;
  /** Stable key for the list. */
  key: string;
  name: string;
  metric: string;
  params: Record<string, unknown>;
  direction: Direction;
  unit: string;
  target: number;
  /** null: the default zero point (`zeroOf`). */
  worst: number | null;
  cap: number;
  /** The KPI's weight: kept as it was until the importance is picked. */
  weight: number;
}

export interface PlanDraft {
  goals: GoalDraft[];
  /** Percent of the base at a full score; 0: no reward. */
  rewardPercent: number;
  /** No reward under this score; 0: none. */
  minimum: number;
  /** Index of the goal its penalty reads, or null for none. */
  penaltyGoal: number | null;
  /** Tomans for each unit over the target. */
  penaltyAmount: number;
  trial: boolean;
}

export const importanceOf = (weight: number): Importance =>
  weight <= 1 ? 1 : weight === 2 ? 2 : 3;

/**
 * The value worth zero when none is set: 70% of the target where more is better; where less is
 * better, the target plus as much again (at least 3 more).
 */
export function zeroOf(direction: Direction, target: number) {
  if (direction === 'higher') return Math.round(target * 0.7 * 100) / 100;
  return target + Math.max(target, 3);
}

/** How far − and + move a target. */
export function stepOf(target: number, unit: string) {
  if (unit === '٪' || unit === '%') return 5;
  if (target < 20) return 1;
  if (target < 100) return 5;
  return 5 * 10 ** (Math.floor(Math.log10(target)) - 1);
}

let counter = 0;
const nextKey = () => `goal-${String(++counter)}`;

export function goalOfKpi(kpi: Kpi): GoalDraft {
  return {
    id: kpi.id,
    key: nextKey(),
    name: kpi.name,
    metric: kpi.metric,
    params: kpi.params,
    direction: kpi.direction,
    unit: kpi.unit,
    target: kpi.target,
    worst: kpi.worst,
    cap: kpi.cap,
    weight: kpi.weight,
  };
}

export function goalOfMetric(
  metric: Metric,
  name: string,
  unit: string,
  target: number,
  importance: Importance = 2,
): GoalDraft {
  return {
    id: null,
    key: nextKey(),
    name,
    metric: metric.key,
    params: {},
    direction: metric.direction,
    unit,
    target,
    worst: null,
    cap: 100,
    weight: importance,
  };
}

export function draftOfPlan(plan: Plan): PlanDraft {
  const goals = plan.goals.map(goalOfKpi);
  const penaltyGoal = plan.penalty
    ? plan.goals.findIndex((kpi) => kpi.id === plan.penalty?.kpi)
    : -1;
  return {
    goals,
    rewardPercent: plan.reward ? Math.round(plan.reward.amount * 1000) / 10 : 0,
    minimum: plan.reward?.minimum ?? 0,
    penaltyGoal: penaltyGoal >= 0 ? penaltyGoal : null,
    penaltyAmount: plan.penalty?.amount ?? 200_000,
    trial: plan.goals.length === 0 ? true : plan.trial,
  };
}

export function goalBody(goal: GoalDraft): GoalInput {
  return {
    id: goal.id,
    name: goal.name.trim(),
    metric: goal.metric,
    params: goal.params,
    direction: goal.direction,
    target: goal.target,
    worst: goal.worst ?? zeroOf(goal.direction, goal.target),
    cap: goal.cap,
    weight: goal.weight,
    unit: goal.unit,
  };
}

/** A goal that can't be saved yet: a manual one with no name. */
export const goalProblem = (goal: GoalDraft) =>
  goal.metric === MANUAL && !goal.name.trim() ? 'name' : null;

/**
 * Ready plans to start from. Goals whose metric this server doesn't measure are left out; `name`
 * is a `pay.plans.goalNames` key for manual goals.
 */
export interface Template {
  id: 'sales' | 'apply' | 'writing' | 'support' | 'discipline';
  goals: { metric: string; target: number; importance: Importance; name?: 'quality' }[];
  reward: number;
  minimum: number;
  /** Fine the late days over the target. */
  latePenalty: boolean;
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'sales',
    goals: [
      { metric: 'sales.contracts_won', target: 8, importance: 3 },
      { metric: 'tasks.on_time_percent', target: 90, importance: 2 },
      { metric: 'attendance.late_days', target: 2, importance: 1 },
    ],
    reward: 10,
    minimum: 60,
    latePenalty: true,
  },
  {
    id: 'apply',
    goals: [
      { metric: 'applications.on_time_percent', target: 90, importance: 3 },
      { metric: 'tickets.answer_hours', target: 24, importance: 2 },
      { metric: 'survey.supervisor_satisfied', target: 80, importance: 2 },
      { metric: 'attendance.late_days', target: 2, importance: 1 },
    ],
    reward: 10,
    minimum: 60,
    latePenalty: true,
  },
  {
    id: 'writing',
    goals: [
      { metric: 'writing.delivered', target: 10, importance: 3 },
      { metric: MANUAL, target: 8, importance: 2, name: 'quality' },
      { metric: 'attendance.late_days', target: 2, importance: 1 },
    ],
    reward: 10,
    minimum: 60,
    latePenalty: true,
  },
  {
    id: 'support',
    goals: [
      { metric: 'tickets.answer_hours', target: 12, importance: 3 },
      { metric: 'tickets.slow_answers', target: 5, importance: 2 },
      { metric: 'tasks.on_time_percent', target: 90, importance: 2 },
      { metric: 'attendance.late_days', target: 2, importance: 1 },
    ],
    reward: 10,
    minimum: 60,
    latePenalty: true,
  },
  {
    id: 'discipline',
    goals: [
      { metric: 'attendance.late_days', target: 2, importance: 2 },
      { metric: 'attendance.absent_days', target: 0, importance: 3 },
      { metric: 'tasks.on_time_percent', target: 90, importance: 2 },
    ],
    reward: 5,
    minimum: 60,
    latePenalty: true,
  },
];

export const LATE_DAYS = 'attendance.late_days';

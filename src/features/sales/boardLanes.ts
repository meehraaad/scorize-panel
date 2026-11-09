import type { TFunction } from 'i18next';
import type { LeadStage } from '@/lib/sales/api';
import type { CustomerColumn, CustomerData, StageActivity } from './api';

/** The middle stages the sales manager's columns sit in (the board's `STAGE_PHASES`). */
const PHASES = ['contacted', 'consulted', 'offer'] as const;
type Phase = (typeof PHASES)[number];
const isPhase = (stage: string): stage is Phase => (PHASES as readonly string[]).includes(stage);

/**
 * One lane of the board, as the customer page and the contact log show it: `new`, the team's
 * columns in the manager's order (S48), `draft`, `won`. `key` is a fixed lane's stage or a column's
 * id as text, the same key the board uses.
 */
export interface Lane {
  key: string;
  label: string;
  /** Full name for screen readers and the "moves to …" line. */
  name: string;
  stage: Exclude<LeadStage, 'lost'>;
  /** A team column's id; null for a fixed lane (or a middle stage before Django sends columns). */
  column: number | null;
  /** What a team column asks for when a card enters it (S48); none for a fixed lane. */
  activities: StageActivity[];
}

/**
 * The board's lanes for this customer. Before Django sends the team's columns
 * (`supports.columns`), each middle stage is one lane, as the board's defaults are.
 */
export function lanesOf(
  customer: Pick<CustomerData, 'columns' | 'supports'>,
  t: TFunction<'sales'>,
): Lane[] {
  const fixed = (stage: 'new' | 'draft' | 'won'): Lane => ({
    key: stage,
    label: t(`stageShort.${stage}`),
    name: t(`stage.${stage}`),
    stage,
    column: null,
    activities: [],
  });
  const columns: CustomerColumn[] =
    customer.supports.columns && customer.columns?.length ? customer.columns : [];
  const middle: Lane[] = columns.length
    ? columns
        .filter((column) => isPhase(column.phase))
        .map((column) => ({
          key: String(column.id),
          label: column.name,
          name: column.name,
          stage: column.phase,
          column: column.id,
          activities: column.activities ?? [],
        }))
    : PHASES.map((stage) => ({
        key: stage,
        label: t(`stageShort.${stage}`),
        name: t(`stage.${stage}`),
        stage,
        column: null,
        activities: [],
      }));
  return [fixed('new'), ...middle, fixed('draft'), fixed('won')];
}

/**
 * The lane the lead shows in on the board: its column while that column is in its stage,
 * otherwise the first lane of its stage (Django's `column_for`). Null for a lost lead.
 */
export function laneOf(
  lanes: readonly Lane[],
  lead: { stage: LeadStage; column?: number | null | undefined },
): Lane | null {
  if (lead.stage === 'lost') return null;
  return (
    lanes.find(
      (lane) => lane.column !== null && lane.column === lead.column && lane.stage === lead.stage,
    ) ??
    lanes.find((lane) => lane.stage === lead.stage) ??
    null
  );
}

/**
 * The lane a log's choice names: a lane key, or a middle stage (a session log starts on
 * "consulted"), which is that stage's first lane.
 */
export function pickedLane(lanes: readonly Lane[], choice: string): Lane | null {
  return (
    lanes.find((lane) => lane.key === choice) ?? lanes.find((lane) => lane.stage === choice) ?? null
  );
}

/** Lanes a contact log can move the lead to: the team's columns after where it is now. */
export function movableLanes(lanes: readonly Lane[], current: Lane | null): Lane[] {
  const from = current ? lanes.indexOf(current) : -1;
  return lanes.filter((lane, index) => index > from && isPhase(lane.stage));
}

/**
 * Lanes the customer page can move the card to, as a drag on the board can: `new` and the team's
 * columns, for an open lead. Draft and won follow the contract; a lost lead is reopened from the log.
 */
export function boardMoveTargets(lanes: readonly Lane[], current: Lane | null): Lane[] {
  if (!current || current.stage === 'draft' || current.stage === 'won') return [];
  return lanes.filter(
    (lane) =>
      lane !== current &&
      lane.stage !== 'draft' &&
      lane.stage !== 'won' &&
      (lane.column !== null || lane.stage === 'new'),
  );
}

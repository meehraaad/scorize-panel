import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ChipTone } from '@/components/ui/Chip';
import type { Factor, PathwayCost, PathwayGoal } from '@/lib/applicant/pathways';

/**
 * Management > pathways (key `manage_pathways`): countries and their official routes to work or
 * live there, with requirements and a points table, kept without code. A route reaches customers
 * (the pathway finder) only once checked against its official page; any edit clears that.
 * Django: `api/staff/v1/pathways.py`.
 */

export const MANAGE_PATHWAYS_API = '/staff/v1/pathways';
export const MANAGE_PATHWAYS_KEY = ['manage-pathways'] as const;
export { PATHWAYS_PERMISSION } from '@/lib/auth/roles';
export const PATHWAYS_PATH = '/founders/pathways';

/** off: switched off · draft: not checked · review_due: its recheck day passed · published. */
export type PathwayStatus = 'published' | 'draft' | 'review_due' | 'off';
export type PathwayKind = 'points' | 'requirements';

export const STATUS_TONE: Record<PathwayStatus, ChipTone> = {
  published: 'good',
  draft: 'info',
  review_due: 'warn',
  off: 'neutral',
};

export interface PathwayRow {
  id: number;
  country: { id: number; name: string };
  name: string;
  name_persian: string;
  goal: PathwayGoal;
  kind: PathwayKind;
  status: PathwayStatus;
  review_by: string | null;
  verified_at: string | null;
}

export interface PathwayList {
  pathways: PathwayRow[];
  countries: { id: number; name: string }[];
  factors: Factor[];
}

export interface ConditionInput {
  minimum: string;
  maximum: string;
  value: string;
}

export interface RequirementInput extends ConditionInput {
  group: number;
  factor: string;
  label: string;
}

export interface BandInput extends ConditionInput {
  points: number;
}

export interface CriterionInput {
  factor: string;
  label: string;
  bands: BandInput[];
}

export interface PathwayInput {
  country: number;
  name: string;
  name_persian: string;
  goal: PathwayGoal;
  kind: PathwayKind;
  pass_mark: number | null;
  source_url: string;
  notes: string;
  needs_licensed_agent: boolean;
  summary: string;
  tip: string;
  duration: string;
  cost: PathwayCost;
  review_by: string | null;
  is_active: boolean;
  requirements: RequirementInput[];
  criteria: CriterionInput[];
}

export interface PathwayDetail extends Omit<PathwayInput, 'country'> {
  id: number;
  country: { id: number; name: string };
  status: PathwayStatus;
  verified_at: string | null;
  verified_by: string | null;
  updated_at: string;
  factors: string[];
}

export interface TryResult {
  qualifies: boolean;
  eligible: boolean;
  points: number;
  pass_mark: number | null;
  max_points: number;
  missing: string[];
  scores: { label: string; points: number; max_points: number }[];
  unanswered: string[];
  factors: string[];
}

export const managedPathwaysQuery = queryOptions({
  queryKey: [...MANAGE_PATHWAYS_KEY, 'list'],
  queryFn: () => api<PathwayList>(`${MANAGE_PATHWAYS_API}/`),
});

export const managedPathwayQuery = (id: number) =>
  queryOptions({
    queryKey: [...MANAGE_PATHWAYS_KEY, 'detail', id],
    queryFn: () => api<PathwayDetail>(`${MANAGE_PATHWAYS_API}/${id}/`),
  });

export const inputOf = (detail: PathwayDetail): PathwayInput => ({
  country: detail.country.id,
  name: detail.name,
  name_persian: detail.name_persian,
  goal: detail.goal,
  kind: detail.kind,
  pass_mark: detail.pass_mark,
  source_url: detail.source_url,
  notes: detail.notes,
  needs_licensed_agent: detail.needs_licensed_agent,
  summary: detail.summary,
  tip: detail.tip,
  duration: detail.duration,
  cost: detail.cost,
  review_by: detail.review_by,
  is_active: detail.is_active,
  requirements: detail.requirements,
  criteria: detail.criteria,
});

export const emptyInput = (country: number): PathwayInput => ({
  country,
  name: '',
  name_persian: '',
  goal: 'work',
  kind: 'requirements',
  pass_mark: null,
  source_url: '',
  notes: '',
  needs_licensed_agent: false,
  summary: '',
  tip: '',
  duration: '',
  cost: '',
  review_by: null,
  is_active: true,
  requirements: [],
  criteria: [],
});

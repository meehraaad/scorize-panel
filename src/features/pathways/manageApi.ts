import { queryOptions } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { api } from '@/lib/api/client';
import type { Factor, PathwayCost, PathwayGoal } from '@/lib/applicant/pathways';

/**
 * Migration pathways, in the sales manager's and the marketing manager's area (either manager, or
 * the key `manage_pathways`): countries and their official routes to work or
 * live there, with requirements and a points table, kept without code. A route reaches customers
 * (the pathway finder) only once checked against its official page; any edit clears that.
 * Django: `api/staff/v1/pathways.py`.
 */

export const MANAGE_PATHWAYS_API = '/staff/v1/pathways';
export const MANAGE_PATHWAYS_KEY = ['manage-pathways'] as const;
/** Where the page lives: the sales manager's and the marketing manager's area, same data. */
export const SALES_PATHWAYS_PATH = '/sales/manager/pathways';
export const MARKETING_PATHWAYS_PATH = '/marketing/manage/pathways';

/** The list's address in the panel showing it (sales or marketing management). */
export function usePathwaysPath() {
  const { pathname } = useLocation();
  return pathname.startsWith('/marketing/') ? MARKETING_PATHWAYS_PATH : SALES_PATHWAYS_PATH;
}

/** off: switched off · draft: not checked · review_due: its recheck day passed · published. */
export type PathwayStatus = 'published' | 'draft' | 'review_due' | 'off';
export type PathwayKind = 'points' | 'requirements';

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

/** Django's CurrencyUnit without Toman: e euro, u US dollar, c Canadian dollar, p pound. */
export type StudyCurrency = '' | 'e' | 'u' | 'c' | 'p';

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
  /** A study route's year: all four of currency, tuition min/max and living, or none. */
  currency: StudyCurrency;
  tuition_min: number | null;
  tuition_max: number | null;
  living_per_year: number | null;
  post_study_visa: string;
  post_study_months: number | null;
  after_study: string;
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

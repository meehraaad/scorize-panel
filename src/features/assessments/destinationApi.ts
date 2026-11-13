import type { ProgramDefinition, ProgramCase, ProgramResult } from './programTypes';
import { sameAnswerContent } from './answerEquality';
import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { FinancialResult } from './financialTypes';
import type { SingleSnapshot } from './calculatorApi';

export const GOALS = ['study', 'work', 'family', 'business'] as const;
export const INTAKE_FIELDS = [
  'goals',
  'destinations',
  'citizenships',
  'residence',
  'timeline',
] as const;
export type IntakeField = (typeof INTAKE_FIELDS)[number];
export interface IntakeFact {
  status: 'known' | 'unknown' | 'needs_confirmation' | 'not_applicable';
  value: string | string[] | null;
  source?: string;
  document_verified?: boolean;
}
export type IntakeInputs = Partial<Record<IntakeField, IntakeFact>>;
export interface DestinationSource {
  title: string;
  url: string;
  checked_on: string;
  review_due: string;
  received_at: string;
  effective_on: string | null;
  status: 'draft' | 'reviewed_directory';
}
export interface DestinationEntry {
  program?: ProgramDefinition | null;
  id: string;
  country: string;
  goal: (typeof GOALS)[number];
  title: { fa: string; en: string };
  enabled: boolean;
  order: number;
  calculator_route: string | null;
  source: DestinationSource;
}
export interface DestinationPolicy {
  schema_version: 1;
  weights: { goal: number; destination: number };
  entries: DestinationEntry[];
}
export interface DestinationCase {
  programs?: Record<string, ProgramCase[]>;
  inputs: IntakeInputs;
  expected: Record<string, string>;
}
export interface DestinationEvaluation {
  coverage_gaps?: string[];
  version: string;
  assessment_date: string;
  entries: DestinationCard[];
  unknowns: string[];
  ordering: string;
}
export interface DestinationCard extends DestinationEntry {
  program_result?: ProgramResult;
  directory_status: string;
  relevance: string;
  next_actions: string[];
  preference_alignment: {
    earned: number;
    possible: number;
    complete: boolean;
    checks: { criterion: string; weight: number; matched: boolean | null }[];
  };
  eligibility: {
    status: string;
    reason?: string;
    coverage?: { from: string; through: string };
    score?: { system: string; score: number | null };
    requirements?: Record<string, boolean | string | null>;
  };
  financial: FinancialResult;
}
export interface Catalog {
  id: number;
  version: number;
  sha256: string;
  bundle: DestinationPolicy;
}
export interface PlanAction {
  id: string;
  kind: string;
  basis_sha256: string;
  status: 'todo' | 'in_progress' | 'done' | 'needs_recheck';
  reported_status: 'todo' | 'in_progress' | 'done';
  basis_changed: boolean;
  recorded_at: string | null;
  depends_on: string[];
}
export interface DestinationFollowUpPlan {
  version: string;
  selected_routes: string[];
  max_routes: number;
  routes: {
    id: string;
    available: boolean;
    title?: { fa: string; en: string };
    actions: PlanAction[];
    interview: { country: 'canada' | 'australia'; route_id: string } | null;
  }[];
}
export interface DestinationResult extends DestinationEvaluation {
  plan?: DestinationFollowUpPlan;
  country: 'destinations';
  record_kind: 'draft_destination_shortlist';
  active: false;
  context: { session_id: string; session_revision: number; assessment_date: string };
  intake: {
    catalog: Catalog | null;
    active_catalog: Catalog | null;
    catalog_changed: boolean;
    inputs: IntakeInputs;
  };
  decision_sha256: string;
  writable: boolean;
}
export interface DestinationSnapshot {
  id: number;
  payload: Omit<DestinationResult, 'decision_sha256' | 'writable'>;
  stale_reasons: string[];
  reviews: SingleSnapshot['reviews'];
}
export interface DestinationOptions {
  catalog: Catalog | null;
  today: string;
  active: false;
  countries: { code: string; name: string }[];
  sessions: { id: string; revision: number; assessment_date: string }[];
}
const PREFIX = '/applicant/v1/assessments';
export const destinationOptionsQuery = queryOptions({
  queryKey: ['assessment-destinations', 'options'],
  queryFn: ({ signal }) => api<DestinationOptions>(`${PREFIX}/destinations/options/`, { signal }),
});
export const destinationQuery = (id: string) =>
  queryOptions({
    queryKey: ['assessment-destinations', id],
    queryFn: ({ signal }) => api<DestinationResult>(`${PREFIX}/${id}/destinations/`, { signal }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
export const startDestinationSession = (body: unknown) =>
  api<{ id: string; revision: number }>(`${PREFIX}/destinations/`, { method: 'POST', body });
export const saveDestinationAnswer = (id: string, body: unknown) =>
  api<{ revision: number; destinations: DestinationResult }>(`${PREFIX}/${id}/destinations/`, {
    method: 'POST',
    body,
  });
export const recordDestinations = (id: string, body: unknown) =>
  api<DestinationSnapshot>(`${PREFIX}/${id}/destinations/snapshots/`, { method: 'POST', body });

/** Compare editable facts, independently of JSONB key order and server provenance. */
export function sameIntakeFact(a: IntakeFact | undefined, b: IntakeFact | undefined): boolean {
  if (!a || !b) return a === b;
  return sameAnswerContent(a, b);
}

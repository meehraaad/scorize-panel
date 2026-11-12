import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type Country = 'canada' | 'australia';
export type AnswerStatus = 'known' | 'unknown' | 'not_applicable' | 'needs_confirmation';
export interface FormSchema {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'date' | 'choice' | 'object' | 'array';
  choices?: string[];
  properties?: Record<string, FormSchema>;
  required?: string[];
  items?: FormSchema;
}
export interface Answer {
  status: AnswerStatus;
  value?: unknown;
  source: string;
  document_verified?: boolean;
  recorded_at?: string;
  question_version?: string;
  profile_origin?: ProfileCandidate;
}
export interface ProfileCandidate {
  id: string;
  sha256: string;
  field: string;
  source: string;
  value: unknown;
  original: Record<string, unknown>;
  complete: boolean;
  conflict?: boolean;
}
export interface ProfileEvidence {
  revision: number;
  candidates: ProfileCandidate[];
  context: { source: string; reason: string; original: Record<string, unknown> }[];
}
export interface Options {
  adapter_version: string;
  can_review?: boolean;
  schemas: Record<Country, Record<string, FormSchema>>;
  identities: Record<Country, Record<string, string>>;
  rulesets: { id: number; key: string; version: number }[];
  sessions: { id: string; revision: number; completed: boolean }[];
}
export interface Interview {
  revision: number;
  adapter_version: string;
  answers: Record<string, Answer>;
  ruleset_sha256: string;
  sources: Record<Country, { sha256: string }>;
}
export interface GuidanceQuestion {
  field: string;
  reason: string;
  tier: number;
  effects: string[];
  missing_paths: string[];
  answer_cost: number;
  shared_identity_count: number;
  decision_sha256: string;
}
export interface Guidance {
  revision: number;
  status: string;
  country: Country | null;
  mode?: 'assessment' | 'scenario';
  policy: {
    version: string;
    sha256: string;
    policy?: { costs?: Record<string, number>; default_cost?: number };
  };
  next_question: GuidanceQuestion | null;
  deferred?: string[];
  candidates?: GuidanceQuestion[];
  blocked?: { field: string; dependency: string }[];
  excluded?: { field: string; reason: string }[];
}
export interface Ranking {
  score: number | null;
  score_status: string;
  breakdown: Record<string, number | null>;
  nomination_scenario: null | {
    hypothetical: true;
    condition: string;
    score: number | null;
    delta: number | null;
  };
}
export interface SingleSnapshot {
  id: number;
  stale_reasons: string[];
  payload: {
    country: Country;
    active: false;
    results: {
      crs?: Ranking;
      fsw?: { score: number | null };
      express_entry?: { status: string };
      covered_requirements_status?: string;
      route_id?: string;
      score?: number | null;
    };
    mapping: { unresolved: string[]; provenance?: Record<string, Answer> };
    context: { session_revision: number };
  };
  reviews: { id: number; decision: string; note: string }[];
}
export const calculatorOptionsQuery = queryOptions({
  queryKey: ['calculator-interview', 'options'],
  queryFn: () => api<Options>('/applicant/v1/assessments/calculators/options/'),
});
const prefix = (id: string) => `/applicant/v1/assessments/${id}/calculators/`;
export const guidanceQuery = (id: string) =>
  queryOptions({
    queryKey: ['calculator-guidance', id],
    queryFn: () => api<Guidance>(prefix(id) + 'guidance/'),
  });
export const configureGuidance = (id: string, body: unknown) =>
  api<Pick<Interview, 'revision' | 'answers'> & { guidance: Guidance }>(prefix(id) + 'guidance/', {
    method: 'POST',
    body,
  });
export const profileEvidenceQuery = (id: string, country: Country) =>
  queryOptions({
    queryKey: ['calculator-profile-evidence', id, country],
    queryFn: () => api<ProfileEvidence>(prefix(id) + `profile-evidence/?country=${country}`),
  });
export const interviewQuery = (id: string) =>
  queryOptions({
    queryKey: ['calculator-interview', id],
    queryFn: () => api<Interview>(prefix(id) + 'interview/'),
  });
export const snapshotsQuery = (id: string, page = 1) =>
  queryOptions({
    queryKey: ['calculator-snapshots', id, page],
    queryFn: () =>
      api<{ count: number; page_size: number; results: Snapshot[] }>(
        prefix(id) + `snapshots/?page=${page}`,
      ),
  });
export const startCalculatorSession = (ruleset: number, key: string) =>
  api<{ id: string }>('/applicant/v1/assessments/', {
    method: 'POST',
    body: { ruleset_id: ruleset, request_key: key },
  });
export const saveCalculatorAnswer = (id: string, body: unknown) =>
  api<Interview>(prefix(id) + 'interview/', { method: 'POST', body });
export const recordCalculation = (id: string, body: unknown) =>
  api<Snapshot>(prefix(id) + 'snapshots/', { method: 'POST', body });

export const reviewQueueQuery = (page: number) =>
  queryOptions({
    queryKey: ['calculator-reviews', page],
    queryFn: () =>
      api<{ count: number; page_size: number; results: Snapshot[] }>(
        `/staff/v1/assessments/calculator-snapshots/?page=${page}`,
      ),
  });
export const reviewCalculation = (id: number, body: unknown) =>
  api(`/staff/v1/assessments/calculator-snapshots/${id}/review/`, { method: 'POST', body });

export function readyForAutosave(schema: FormSchema | undefined, value: unknown): boolean {
  if (!schema || value === undefined || value === null) return false;
  if (schema.type === 'array')
    return Array.isArray(value) && value.every((row) => readyForAutosave(schema.items, row));
  if (schema.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    const object = value as Record<string, unknown>;
    return (schema.required ?? []).every((key) =>
      readyForAutosave(schema.properties?.[key], object[key]),
    );
  }
  return true;
}

export interface RouteCard {
  route_id: string;
  country: Country;
  eligibility_status: string;
  requirements: Record<string, string>;
  score: null | {
    system: string;
    score: number | null;
    score_status: string;
    breakdown: Record<string, number | null>;
  };
  selection_score: null | { score: number | null; system: string };
  conditional_points: {
    kind: string;
    hypothetical: true;
    score: number | null;
    delta: number | null;
  }[];
  limitations: string[];
  cost: { status: string; reason: string };
  time: { status: string; reason: string };
  historical_evidence: { status: string; reason: string };
}
export interface PlanAction {
  id: string;
  kind: string;
  country: Country;
  field?: string;
  requirement?: string;
  answer_status?: string;
  missing_paths?: string[];
  applies_to: string[];
  depends_on: string[];
  status: 'todo' | 'in_progress' | 'done';
  requires_reassessment: boolean;
}
export interface Comparison {
  country: 'comparison';
  active: false;
  version: string;
  context: { session_revision: number; assessment_date: string };
  selected_routes: string[];
  ordering: string;
  routes: RouteCard[];
  actions: PlanAction[];
  decision_sha256: string;
  writable: boolean;
  sources: Record<
    Country,
    { sha256: string; manifest: { sources: Record<string, { url: string; checked_on?: string }> } }
  >;
  evaluations: Partial<Record<Country, { mapping: { provenance: Record<string, Answer> } }>>;
}
export interface ComparisonSnapshot {
  id: number;
  stale_reasons: string[];
  payload: Omit<Comparison, 'decision_sha256' | 'writable'>;
  reviews: SingleSnapshot['reviews'];
}
export type Snapshot = SingleSnapshot | ComparisonSnapshot;
export const isComparisonSnapshot = (s: Snapshot): s is ComparisonSnapshot =>
  s.payload.country === 'comparison';
export const comparisonQuery = (id: string) =>
  queryOptions({
    queryKey: ['calculator-comparison', id],
    queryFn: () => api<Comparison>(prefix(id) + 'comparison/'),
  });
export const updateComparison = (id: string, body: unknown) =>
  api<Pick<Interview, 'revision' | 'answers'> & { comparison: Comparison }>(
    prefix(id) + 'comparison/',
    { method: 'POST', body },
  );
export const recordComparison = (id: string, body: unknown) =>
  api<ComparisonSnapshot>(prefix(id) + 'comparison/snapshots/', { method: 'POST', body });

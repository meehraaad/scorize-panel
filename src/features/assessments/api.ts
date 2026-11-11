import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type Value = string | number | boolean;
export type Condition =
  | { fact: string; op: 'eq' | 'in' | 'gte' | 'gt' | 'lte' | 'lt'; value: Value | Value[] }
  | { all: Condition[] }
  | { any: Condition[] };
export interface Question {
  id: string;
  text: string;
  kind: 'number' | 'boolean' | 'choice';
  minimum?: number;
  maximum?: number;
  choices?: string[];
  show_if?: Condition;
}
export interface Route {
  id: string;
  name: string;
  requirements: { id: string; label: string; condition: Condition }[];
  scores?: {
    id: string;
    label: string;
    cap?: number;
    bands: { id: string; points: number; condition: Condition }[];
  }[];
  score_cap?: number;
  pass_mark?: number;
}
export interface Bundle {
  schema_version: number;
  synthetic: boolean;
  questions: Question[];
  routes: Route[];
}
export interface Fact {
  status: 'known' | 'unknown' | 'not_applicable' | 'needs_confirmation';
  value: Value | null;
}
export interface Expected {
  route_id: string;
  eligibility_status: 'met' | 'unmet' | 'insufficient_information';
  score_status: 'partial' | 'complete_self_reported' | 'not_applicable';
  score: number | null;
  pass_mark_met: boolean | null;
}
export interface Scenario {
  name: string;
  assessment_date: string;
  answers: Record<string, Fact>;
  expected: Expected[];
}
export interface Source {
  title: string;
  url: string;
  reviewed_on: string;
  review_due: string;
  route_ids: string[];
}
export interface DraftInput {
  key: string;
  title: string;
  bundle: Bundle;
  scenarios: Scenario[];
  sources: Source[];
}
export interface Summary {
  id: number;
  key: string;
  title: string;
  revision: number;
  state: 'draft' | 'review' | 'approved';
  ruleset_id: number | null;
}
export interface Evaluation {
  results: (Expected & {
    name: string;
    requirement_details: { id: string; label: string; status: 'met' | 'unmet' | 'unknown' }[];
  })[];
}
export interface Draft extends DraftInput, Summary {
  is_active: boolean;
  revoked: boolean;
  last_run: {
    id: number;
    passed: boolean;
    report: {
      name: string;
      passed: boolean;
      expected: Expected[];
      actual: Evaluation;
      before: Evaluation | null;
    }[];
  } | null;
  events: { id: number; action: string; actor_id: number; revision: number; created_at: string }[];
}
export interface Options {
  bundle: Bundle;
  scenarios: Scenario[];
  permissions: Record<'create' | 'edit' | 'review' | 'publish', boolean>;
}
export type Action = 'test' | 'submit' | 'approve' | 'publish' | 'revoke';
const BASE = '/staff/v1/assessments';
export const optionsQuery = queryOptions({
  queryKey: ['assessment-management', 'options'],
  queryFn: ({ signal }) => api<Options>(`${BASE}/options/`, { signal }),
});
export const draftsQuery = (page = 1) =>
  queryOptions({
    queryKey: ['assessment-management', 'drafts', page],
    queryFn: ({ signal }) =>
      api<{ count: number; page_size: number; results: Summary[] }>(
        `${BASE}/drafts/?page=${String(page)}`,
        { signal },
      ),
  });
export const draftQuery = (id: number) =>
  queryOptions({
    queryKey: ['assessment-management', 'draft', id],
    queryFn: ({ signal }) => api<Draft>(`${BASE}/drafts/${String(id)}/`, { signal }),
  });
export const saveDraft = (input: DraftInput, draft?: Summary) =>
  api<Draft>(draft ? `${BASE}/drafts/${String(draft.id)}/` : `${BASE}/drafts/`, {
    method: draft ? 'PUT' : 'POST',
    body: { ...input, ...(draft ? { revision: draft.revision } : {}) },
  });
export const draftAction = (draft: Summary, action: Action) =>
  api<Draft>(`${BASE}/drafts/${String(draft.id)}/${action}/`, {
    method: 'POST',
    body: { revision: draft.revision },
  });

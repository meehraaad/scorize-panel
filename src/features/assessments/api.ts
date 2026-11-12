import type {
  FinancialPolicy,
  FinancialScenario,
  FinancialResult,
  FinancialStatus,
} from './financialTypes';
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
  cost?: number;
  help?: string;
  translations?: Partial<Record<'fa' | 'en', string>>;
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
  financial_policy?: FinancialPolicy;
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
  financial?: FinancialScenario[];
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
  scheduled_at?: string | null;
  is_active: boolean;
  revoked: boolean;
  last_run: {
    id: number;
    passed: boolean;
    report: {
      name: string;
      passed: boolean;
      financial?: {
        route_id: string;
        expected: { status: FinancialStatus; ask_exact: boolean };
        actual: FinancialResult;
        before: FinancialResult;
        passed: boolean;
      }[];
      expected: Expected[];
      actual: Evaluation;
      before: Evaluation | null;
      before_incompatible_answers?: string[];
    }[];
  } | null;
  comparison?: {
    version: number | null;
    changes: { path: string[]; before: unknown; after: unknown }[];
  };
  events: {
    id: number;
    action: string;
    actor_id: number;
    revision: number;
    created_at: string;
    detail?: { note?: string };
  }[];
}
export interface Options {
  financial_policy?: FinancialPolicy;
  bundle: Bundle;
  scenarios: Scenario[];
  permissions: Record<'create' | 'edit' | 'review' | 'publish', boolean>;
}
export type Action =
  'test' | 'submit' | 'approve' | 'reject' | 'publish' | 'revoke' | 'schedule' | 'cancel_schedule';
const BASE = '/staff/v1/assessments';
export interface Health {
  counts: Record<'active_routes' | 'overdue' | 'blocked' | 'in_review' | 'ready', number>;
  issues: {
    id: number;
    title: string;
    state: Summary['state'];
    reasons: ('invalid_content' | 'source_review_required' | 'tests_required' | 'revoked')[];
  }[];
  issues_limit: number;
}
export const healthQuery = queryOptions({
  queryKey: ['assessment-management', 'health'],
  queryFn: ({ signal }) => api<Health>(`${BASE}/health/`, { signal }),
});
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
export const saveDraft = (
  input: DraftInput,
  draft?: Summary,
  requestKey: string = crypto.randomUUID(),
) =>
  api<Draft>(draft ? `${BASE}/drafts/${String(draft.id)}/` : `${BASE}/drafts/`, {
    method: draft ? 'PUT' : 'POST',
    body: { ...input, request_key: requestKey, ...(draft ? { revision: draft.revision } : {}) },
  });
export const draftAction = (
  draft: Summary,
  action: Action,
  note = '',
  publishAt?: string,
  requestKey: string = crypto.randomUUID(),
) =>
  api<Draft>(`${BASE}/drafts/${String(draft.id)}/${action}/`, {
    method: 'POST',
    body: {
      revision: draft.revision,
      request_key: requestKey,
      ...(action === 'reject' ? { note } : {}),
      ...(action === 'schedule' ? { publish_at: publishAt } : {}),
    },
  });

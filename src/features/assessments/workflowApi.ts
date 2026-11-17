import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { FormSchema } from './calculatorApi';

export interface WorkflowQuestion {
  id: string;
  field: string;
  label?: string | null;
  schema: FormSchema;
  status: string | null;
  value: unknown;
  allowed_statuses: ('known' | 'unknown' | 'not_applicable')[];
  current_reference: { id: string; revision: number } | null;
  can_detach: boolean;
  scoped?: boolean;
  shared_kind: 'birth_date' | 'language' | null;
  targets: { adapter: string; field: string; entry?: string }[];
  effects: string[];
  missing_paths: string[];
  tier: number;
  answer_cost: number;
}
export interface EvaluatorResult {
  id: string;
  kind: 'conditions' | 'score';
  coverage: { status: string; reason: string | null };
  applicability: { status: string; reason: string | null };
  conditions: { status: string; checks: Record<string, string> };
  score: {
    status: string;
    system: string | null;
    value: number | null;
    breakdown: Record<string, number | null>;
  };
  missing_facts: string[];
  evidence_states: Record<
    string,
    { status: string; reason: string | null; missing_paths: string[]; usable: boolean }
  >;
  limitations: string[];
  sources: Record<string, unknown>;
  reference_versions: Record<string, string>;
  definition_sha256: string;
  implementation_sha256: string | null;
}
export interface WorkflowResults {
  assessment_date: string;
  evaluations: Record<string, EvaluatorResult>;
  pathways: Record<
    string,
    {
      id: string;
      title?: { fa: string; en: string };
      status: string;
      conditions: string[];
      scores: string[];
      financial_fit: { status: string; unknowns?: string[] };
      preferences?: { status: string; reasons: Record<string, unknown> };
    }
  >;
}
export interface Workflow {
  version: string;
  session_id: string;
  revision: number;
  assessment_date: string;
  active: false;
  writable: boolean;
  status: string;
  mode: 'assessment' | 'explore';
  selected_pathways: string[];
  /** Selected earlier but missing from the adopted catalog: choose again. */
  unavailable_pathways: string[];
  options: {
    id: string;
    conditions: string[];
    scores: string[];
    capabilities: string[];
    title?: { fa: string; en: string } | null;
  }[];
  questions: WorkflowQuestion[];
  review_questions: WorkflowQuestion[];
  next_question: WorkflowQuestion | null;
  deferred: string[];
  blocked: { evaluator: string; reason: string }[];
  results: WorkflowResults;
  decision_sha256: string;
  snapshot_id?: number;
}
export interface WorkflowHistory {
  count: number;
  page_size: number;
  results: {
    id: number;
    created_at: string;
    payload: { assessment_date: string; workflow: Workflow };
  }[];
}
export interface WorkflowScenario {
  hypothetical: true;
  assumptions: { question_id: string; status: string; value: unknown }[];
  baseline: WorkflowResults;
  results: WorkflowResults;
}
export const workflowUrl = (id: string) => `/applicant/v1/assessments/${id}/workflow/`;
export const workflowQuery = (id: string) =>
  queryOptions({
    queryKey: ['assessment-workflow', id],
    queryFn: ({ signal }) => api<Workflow>(workflowUrl(id), { signal }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
export const workflowHistoryQuery = (id: string, page = 1) =>
  queryOptions({
    queryKey: ['assessment-workflow-history', id, page],
    queryFn: ({ signal }) =>
      api<WorkflowHistory>(`${workflowUrl(id)}history/?page=${page}`, { signal }),
  });
export const saveWorkflow = (id: string, body: Record<string, unknown>) =>
  api<Workflow>(workflowUrl(id), { method: 'POST', body });

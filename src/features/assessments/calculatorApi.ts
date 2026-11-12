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
  value: unknown;
  source: string;
  document_verified: boolean;
  recorded_at?: string;
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
export interface Snapshot {
  id: number;
  stale_reasons: string[];
  payload: {
    country: Country;
    active: false;
    results: {
      crs?: Ranking;
      fsw?: { score: number | null };
      express_entry?: { status: string };
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

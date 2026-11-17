import { http, HttpResponse } from 'msw';
import type {
  Workflow,
  WorkflowHistory,
  WorkflowScenario,
} from '@/features/assessments/workflowApi';
import fixture from './workflow-fixture.json';

const BASE = '/api/applicant/v1/assessments/:id/workflow/';
const initial = (): Workflow => ({
  version: 'unified-workflow-2',
  session_id: '11111111-1111-4111-8111-111111111111',
  revision: 0,
  assessment_date: '2026-11-12',
  active: false,
  writable: true,
  status: 'not_started',
  mode: 'explore',
  selected_pathways: [],
  options: fixture.options,
  questions: [],
  review_questions: [],
  next_question: null,
  deferred: [],
  blocked: [],
  results: { assessment_date: '2026-11-12', evaluations: {}, pathways: {} },
  decision_sha256: '0'.repeat(64),
});
let states = new Map<string, Workflow>();
let histories = new Map<string, WorkflowHistory['results']>();
let requests = new Map<string, { request: string; response: Workflow }>();
export function resetWorkflowMocks() {
  states = new Map();
  histories = new Map();
  requests = new Map();
}
export const workflowHandlers = [
  http.get(BASE, ({ params }) => HttpResponse.json(states.get(String(params.id)) ?? initial())),
  http.post(BASE, async ({ request, params }) => {
    const data = (await request.json()) as Record<string, unknown>;
    const id = String(params.id);
    const key = `${id}:${String(data.request_key)}`;
    const old = requests.get(key);
    if (old)
      return old.request === JSON.stringify(data)
        ? HttpResponse.json(old.response)
        : new HttpResponse(null, { status: 409 });
    const state = structuredClone(states.get(id) ?? initial());
    if (
      state.revision !== data.revision ||
      (data.action === 'answer' && data.decision_sha256 !== state.decision_sha256)
    )
      return new HttpResponse(null, { status: 409 });
    if (data.action === 'select') {
      state.selected_pathways = data.pathways as string[];
      state.mode = data.mode as Workflow['mode'];
      state.status = 'question';
      state.questions = [fixture.question as Workflow['questions'][number]];
      state.review_questions = structuredClone(state.questions);
      state.next_question = state.questions[0] ?? null;
      state.results = structuredClone(fixture.results) as Workflow['results'];
    }
    if (data.action === 'answer') {
      state.questions = [];
      state.next_question = null;
      state.status = data.status === 'unknown' ? 'needs_review' : 'initial_result_available';
      state.review_questions = [
        {
          ...(fixture.question as Workflow['questions'][number]),
          value: data.value,
          status: String(data.status),
        },
      ];
      state.deferred = data.status === 'unknown' ? [String(data.question_id)] : [];
    }
    if (data.action === 'pause') {
      state.status = 'paused';
      state.next_question = null;
    }
    if (data.action === 'resume') {
      state.status = 'question';
      state.next_question = state.questions[0] ?? null;
    }
    state.revision += 1;
    state.decision_sha256 = state.revision.toString(16).padStart(64, '0');
    if (data.action === 'record') {
      const rows = histories.get(id) ?? [];
      state.snapshot_id = rows.length + 1;
      rows.unshift({
        id: state.snapshot_id,
        created_at: '2026-11-17T09:00:00Z',
        payload: { assessment_date: state.assessment_date, workflow: structuredClone(state) },
      });
      histories.set(id, rows);
    }
    states.set(id, state);
    requests.set(key, { request: JSON.stringify(data), response: structuredClone(state) });
    return HttpResponse.json(state);
  }),
  http.post(`${BASE}scenario/`, () => {
    const response: WorkflowScenario = {
      hypothetical: true,
      assumptions: [],
      baseline: structuredClone(fixture.results) as Workflow['results'],
      results: structuredClone(fixture.results) as Workflow['results'],
    };
    const crs = response.results.evaluations['ca.crs'];
    if (crs) crs.score.value = 404;
    return HttpResponse.json(response);
  }),
  http.get(`${BASE}history/`, ({ params, request }) => {
    const rows = histories.get(String(params.id)) ?? [];
    const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
    return HttpResponse.json({
      count: rows.length,
      page_size: 20,
      results: rows.slice((page - 1) * 20, page * 20),
    });
  }),
];

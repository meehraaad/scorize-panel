import { http, HttpResponse } from 'msw';
import type { Draft, DraftInput, Options } from '@/features/assessments/api';
import fixture from './assessment-options.json';

const BASE = '/api/staff/v1/assessments';
let drafts: Draft[] = [];
export const resetAssessmentMocks = () => {
  drafts = [];
};
export const assessmentHandlers = [
  http.get(`${BASE}/options/`, () => HttpResponse.json(fixture)),
  http.get(`${BASE}/drafts/`, () =>
    HttpResponse.json({
      count: drafts.length,
      page_size: 20,
      results: drafts.map(({ id, key, title, state, revision, ruleset_id }) => ({
        id,
        key,
        title,
        state,
        revision,
        ruleset_id,
      })),
    }),
  ),
  http.post(`${BASE}/drafts/`, async ({ request }) => {
    const body = (await request.json()) as DraftInput;
    const draft: Draft = {
      ...body,
      id: drafts.length + 1,
      revision: 1,
      state: 'draft',
      is_active: false,
      revoked: false,
      ruleset_id: null,
      last_run: null,
      events: [],
    };
    drafts.push(draft);
    return HttpResponse.json(draft, { status: 201 });
  }),
  http.get(`${BASE}/drafts/:id/`, ({ params }) => {
    const draft = drafts.find((d) => String(d.id) === params.id);
    return draft ? HttpResponse.json(draft) : new HttpResponse(null, { status: 404 });
  }),
  http.put(`${BASE}/drafts/:id/`, async ({ request, params }) => {
    const body = (await request.json()) as DraftInput & { revision: number };
    const draft = drafts.find((d) => String(d.id) === params.id);
    if (!draft) return new HttpResponse(null, { status: 404 });
    if (draft.revision !== body.revision || draft.state === 'approved')
      return HttpResponse.json({ detail: 'Conflict' }, { status: 409 });
    Object.assign(draft, body, { revision: draft.revision + 1, last_run: null, state: 'draft' });
    return HttpResponse.json(draft);
  }),
  http.post(`${BASE}/drafts/:id/:action/`, async ({ request, params }) => {
    const draft = drafts.find((d) => String(d.id) === params.id);
    if (!draft) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { revision: number };
    if (draft.revision !== body.revision) return new HttpResponse(null, { status: 409 });
    if (params.action === 'test')
      draft.last_run = {
        id: 1,
        passed: true,
        report: [
          {
            name: draft.scenarios[0]?.name ?? '',
            passed: true,
            expected: draft.scenarios[0]?.expected ?? [],
            before: null,
            actual: {
              results: [
                {
                  route_id: 'sandbox-study',
                  name: draft.bundle.routes[0]?.name ?? '',
                  eligibility_status: 'met',
                  score_status: 'complete_self_reported',
                  score: 10,
                  pass_mark_met: true,
                  requirement_details: [],
                },
              ],
            },
          },
        ],
      };
    if (params.action === 'submit') {
      if (!draft.last_run?.passed) return new HttpResponse(null, { status: 409 });
      draft.state = 'review';
    }
    if (params.action === 'approve') {
      draft.state = 'approved';
      draft.ruleset_id = 1;
    }
    if (params.action === 'publish') {
      draft.is_active = true;
      draft.revoked = false;
    }
    if (params.action === 'revoke') {
      draft.is_active = false;
      draft.revoked = true;
    }
    draft.revision += 1;
    return HttpResponse.json(draft);
  }),
];
export const assessmentOptionsFixture = fixture as Options;

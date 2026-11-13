import { http, HttpResponse } from 'msw';
import type { Draft, DraftInput, Options } from '@/features/assessments/api';
import fixture from './assessment-options.json';
import financialFixture from './calculator-financial.json';
import destinationFixture from './destination-result.json';

const BASE = '/api/staff/v1/assessments';
let drafts: Draft[] = [];
export const resetAssessmentMocks = () => {
  drafts = [];
};
export const assessmentHandlers = [
  http.get(`${BASE}/health/`, () =>
    HttpResponse.json({
      counts: {
        active_routes: drafts
          .filter((d) => d.is_active)
          .reduce((n, d) => n + d.bundle.routes.length, 0),
        overdue: 0,
        blocked: drafts.filter((d) => !d.last_run?.passed).length,
        in_review: drafts.filter((d) => d.state === 'review').length,
        ready: drafts.filter((d) => d.state === 'approved' && !d.is_active).length,
      },
      issues: [],
      issues_limit: 50,
    }),
  ),
  http.get(`${BASE}/options/`, () =>
    HttpResponse.json({
      ...fixture,
      financial_policy: financialFixture.policy.bundle,
      destination_policy: destinationFixture.intake.catalog.bundle,
      countries: [
        { code: 'CA', name: 'Canada' },
        { code: 'AU', name: 'Australia' },
        { code: 'DE', name: 'Germany' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
      ],
    }),
  ),
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
    const body = (await request.json()) as { revision: number; note?: string; publish_at?: string };
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
    if (params.action === 'reject') {
      if (draft.state !== 'review' || !body.note?.trim())
        return new HttpResponse(null, { status: 409 });
      draft.state = 'draft';
      draft.last_run = null;
      draft.events.push({
        id: draft.events.length + 1,
        actor_id: 4,
        action: 'reject',
        revision: draft.revision + 1,
        created_at: new Date().toISOString(),
        detail: { note: body.note },
      });
    }
    if (params.action === 'publish') {
      draft.is_active = true;
      draft.revoked = false;
    }
    if (params.action === 'revoke') {
      draft.is_active = false;
      draft.revoked = true;
    }
    if (params.action === 'schedule') draft.scheduled_at = body.publish_at ?? null;
    if (params.action === 'cancel_schedule') draft.scheduled_at = null;
    draft.revision += 1;
    return HttpResponse.json(draft);
  }),
];
export const assessmentOptionsFixture = fixture as Options;

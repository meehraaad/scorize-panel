import type { Workflow } from './workflowApi';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

const id = '11111111-1111-4111-8111-111111111111';
const endpoint = `/api/applicant/v1/assessments/${id}/workflow/`;
beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
});
async function open() {
  const user = userEvent.setup();
  renderApp(`/dev/assessment-workflow?session=${id}`);
  await user.click(
    await screen.findByRole('checkbox', { name: 'Canada — Federal Skilled Worker' }),
  );
  await user.click(screen.getByRole('button', { name: 'Start or update interview' }));
  await screen.findByLabelText('Birth date for shared evidence');
  return user;
}

it('uses shared questions, preserves separate scores and records immutable history', async () => {
  const user = await open();
  await user.type(screen.getByLabelText('Birth date for shared evidence'), '1996-11-12');
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await screen.findByText('Initial results are available for the supported coverage.');
  expect(screen.getAllByText('424').length).toBeGreaterThan(0);
  expect(screen.getAllByText('68').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Save a result to history' }));
  const history = screen.getByRole('region', { name: 'Recorded pathway results' });
  await waitFor(() =>
    expect(within(history).getByText('2026-11-17T09:00:00Z')).toBeInTheDocument(),
  );
});

it('defers an unknown answer and lets the applicant review it without a loop', async () => {
  const user = await open();
  await user.selectOptions(screen.getByLabelText('Answer status'), 'unknown');
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await screen.findByText(/1 unknown answer is deferred/);
  expect(screen.queryByRole('button', { name: 'Save answer' })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Review or change an answer'), 'fact:birth_date');
  expect(await screen.findByLabelText('Birth date for shared evidence')).toBeInTheDocument();
});

it('retains a failed save and retries the exact request key and content', async () => {
  const user = await open();
  const attempts: Record<string, unknown>[] = [];
  let failures = 0;
  server.use(
    http.post(endpoint, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      attempts.push(body);
      failures += 1;
      return new HttpResponse(null, { status: failures === 1 ? 503 : 409 });
    }),
  );
  await user.type(screen.getByLabelText('Birth date for shared evidence'), '1990-01-01');
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  const retry = await screen.findByRole('button', { name: 'Retry the same request' });
  expect(screen.getByLabelText('Birth date for shared evidence')).toHaveValue('1990-01-01');
  await user.click(retry);
  await screen.findByText(/This assessment changed. Your input is preserved/);
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  await user.click(screen.getByRole('button', { name: 'Reload and keep my input' }));
  expect(screen.getByLabelText('Birth date for shared evidence')).toHaveValue('1990-01-01');
});

it('previews hypothetical changes without saving answers or creating history', async () => {
  const user = await open();
  let writes = 0;
  server.use(
    http.post(endpoint, () => {
      writes += 1;
      return new HttpResponse(null, { status: 500 });
    }),
  );
  await user.type(screen.getByLabelText('Birth date for shared evidence'), '1990-01-01');
  await user.click(screen.getByRole('button', { name: 'Preview as a hypothetical change' }));
  const scenario = await screen.findByRole('region', { name: /Hypothetical only/ });
  expect(within(scenario).getAllByText('404').length).toBeGreaterThan(0);
  expect(writes).toBe(0);
  expect(
    within(screen.getByRole('region', { name: 'Recorded pathway results' })).queryByRole('group'),
  ).not.toBeInTheDocument();
});

it('resumes the same persisted workflow after reloading the route', async () => {
  const user = await open();
  await user.click(screen.getByRole('button', { name: 'Show results and pause questions' }));
  await screen.findByText('Questions paused at your request; current results remain visible.');
  const { queryClient } = await import('@/lib/api/queryClient');
  await queryClient.invalidateQueries({ queryKey: ['assessment-workflow', id] });
  await screen.findByRole('button', { name: 'Resume questions' });
  await user.click(screen.getByRole('button', { name: 'Resume questions' }));
  expect(await screen.findByLabelText('Birth date for shared evidence')).toBeInTheDocument();
});

it('renders the Persian shared interview with labeled keyboard controls', async () => {
  await i18n.changeLanguage('fa');
  const user = userEvent.setup();
  renderApp(`/dev/assessment-workflow?session=${id}`);
  await user.click(await screen.findByRole('checkbox', { name: 'کانادا — نیروی متخصص فدرال' }));
  await user.click(screen.getByRole('button', { name: 'شروع یا به‌روزرسانی مصاحبه' }));
  const input = await screen.findByLabelText('تاریخ تولد برای اطلاعات مشترک');
  input.focus();
  expect(input).toHaveFocus();
  expect(document.documentElement.dir).toBe('rtl');
});

it('keeps a conflicted draft when reload advances the automatic question (F06)', async () => {
  const user = await open();
  const { queryClient } = await import('@/lib/api/queryClient');
  const current = (await (await fetch(endpoint)).json()) as Workflow;
  const birth = current.next_question;
  if (!birth) throw new Error('Expected automatic question');
  const language = {
    ...birth,
    id: 'calculator:canada:first_language',
    field: 'first_language',
    shared_kind: null,
    schema: { type: 'choice' as const, choices: ['english', 'french'] },
    value: null,
  };
  const changed = {
    ...current,
    revision: current.revision + 1,
    next_question: language,
    questions: [language],
    review_questions: [{ ...birth, value: '1992-01-01' }, language],
  };
  server.use(
    http.post(endpoint, () => new HttpResponse(null, { status: 409 })),
    http.get(endpoint, () => HttpResponse.json(changed)),
  );
  await user.type(screen.getByLabelText('Birth date for shared evidence'), '1990-01-01');
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await user.click(await screen.findByRole('button', { name: 'Reload and keep my input' }));
  await waitFor(() =>
    expect(queryClient.getQueryData(['assessment-workflow', id])).toMatchObject({
      revision: changed.revision,
    }),
  );
  expect(screen.getByLabelText('Birth date for shared evidence')).toHaveValue('1990-01-01');
});

it('renders recorded history when the current ruleset is unavailable (F08)', async () => {
  const fixture = (await import('@/mocks/workflow-fixture.json')).default;
  server.use(
    http.get(endpoint, () => new HttpResponse(null, { status: 409 })),
    http.get(endpoint + 'history/', () =>
      HttpResponse.json({
        count: 1,
        page_size: 20,
        results: [
          {
            id: 1,
            created_at: '2026-11-17T09:00:00Z',
            payload: { workflow: { results: fixture.results } },
          },
        ],
      }),
    ),
  );
  renderApp(`/dev/assessment-workflow?session=${id}`);
  const history = await screen.findByRole('region', { name: 'Recorded pathway results' });
  expect(await within(history).findByText('2026-11-17T09:00:00Z')).toBeInTheDocument();
});

it('uses count and page_size to reach the 21st recorded result (F07)', async () => {
  const pages: string[] = [];
  server.use(
    http.get(endpoint + 'history/', ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '1';
      pages.push(page);
      return HttpResponse.json({ count: 21, page_size: 20, results: [] });
    }),
  );
  const user = userEvent.setup();
  renderApp(`/dev/assessment-workflow?session=${id}`);
  const next = await screen.findByRole('button', { name: 'Next' });
  await user.click(next);
  await waitFor(() => expect(pages).toContain('2'));
});

it('keeps the bound source by default and requires explicit canonical edit intent (F03/F04)', async () => {
  const user = await open();
  const { queryClient } = await import('@/lib/api/queryClient');
  const current = (await (await fetch(endpoint)).json()) as Workflow;
  const original = current.next_question;
  if (!original) throw new Error('Expected shared question');
  const question = {
    ...original,
    status: 'known',
    value: '1996-11-12',
    can_detach: true,
    current_reference: { id: '33333333-3333-4333-8333-333333333333', revision: 4 },
  };
  queryClient.setQueryData(['assessment-workflow', id], {
    ...current,
    next_question: question,
    questions: [question],
    review_questions: [question],
  });
  await waitFor(() =>
    expect(screen.getByLabelText('Birth date for shared evidence')).toHaveValue('1996-11-12'),
  );
  expect(screen.getByLabelText('Reuse a confirmed statement')).toHaveValue('current');
  await user.clear(screen.getByLabelText('Birth date for shared evidence'));
  await user.type(screen.getByLabelText('Birth date for shared evidence'), '1995-11-12');
  expect(screen.getByRole('button', { name: 'Save answer' })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('How should this source change?'), 'edit');
  const submitted: Record<string, unknown>[] = [];
  server.use(
    http.post(endpoint, async ({ request }) => {
      submitted.push((await request.json()) as Record<string, unknown>);
      return new HttpResponse(null, { status: 409 });
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await waitFor(() => expect(submitted).toHaveLength(1));
  expect(submitted[0]).toMatchObject({
    evidence_action: 'edit',
    shared_reference: question.current_reference,
    value: '1995-11-12',
  });
});

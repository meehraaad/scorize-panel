import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

const oldId = '11111111-1111-4111-8111-111111111111';
const newId = '22222222-2222-4222-8222-222222222222';
const answer = {
  status: 'needs_confirmation',
  value: null,
  source: 'previous_session',
  previous_answer: { status: 'known', value: '1996-11-12', source: 'user' },
};
const response = {
  revision: 0,
  adapter_version: 'calculator-interview-1',
  answers: { 'calculator:shared:birth_date': answer },
  ruleset_sha256: 'a'.repeat(64),
  sources: { canada: { sha256: 'b'.repeat(64) }, australia: { sha256: 'c'.repeat(64) } },
};

beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/interview/', ({ params }) =>
      HttpResponse.json({
        ...response,
        engine_available: params.id !== oldId,
        coverage_available: { canada: false, australia: false },
      }),
    ),
  );
});

it('copies old answers as unconfirmed and requires an explicit save', async () => {
  let copied: Record<string, unknown> | undefined;
  let confirmed: Record<string, unknown> | undefined;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/transfer/', async ({ request }) => {
      copied = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: newId }, { status: 201 });
    }),
    http.post('/api/applicant/v1/assessments/:id/calculators/interview/', async ({ request }) => {
      confirmed = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        revision: 1,
        answers: {
          'calculator:shared:birth_date': {
            status: 'known',
            value: confirmed.value,
            source: 'user',
          },
        },
      });
    }),
  );
  const user = userEvent.setup();
  renderApp(`/dev/assessment-calculators?session=${oldId}`);
  await screen.findByText(/This session uses an older calculation version/);
  await user.selectOptions(screen.getByLabelText('Versioned sandbox package'), '1');
  await user.click(screen.getByRole('button', { name: 'Copy answers for review' }));
  expect(copied).toMatchObject({ revision: 0, ruleset_id: 1 });
  await user.click(await screen.findByRole('button', { name: 'Review the previous answer' }));
  expect(screen.getByLabelText('Birth date')).toHaveValue('1996-11-12');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(confirmed).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Record draft result' })).toBeDisabled();
  expect(
    screen.getByText(/available legal sources do not cover this assessment date/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Confirm this answer' }));
  expect(confirmed).toMatchObject({ status: 'known', value: '1996-11-12' });
});

it('offers transfer for a changed implementation even when the engine version is current', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
      HttpResponse.json({
        ...response,
        engine_available: true,
        transfer_required: true,
        coverage_available: { canada: true, australia: true },
      }),
    ),
  );
  renderApp(`/dev/assessment-calculators?session=${oldId}`);
  expect(await screen.findByRole('button', { name: 'Copy answers for review' })).toBeDisabled();
});

it('keeps the same copy request after a save failure', async () => {
  const requests: unknown[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/transfer/', async ({ request }) => {
      requests.push(await request.json());
      return requests.length === 1
        ? HttpResponse.json({ detail: 'failed' }, { status: 503 })
        : HttpResponse.json({ id: newId }, { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderApp(`/dev/assessment-calculators?session=${oldId}`);
  await screen.findByRole('button', { name: 'Copy answers for review' });
  await user.selectOptions(screen.getByLabelText('Versioned sandbox package'), '1');
  await user.click(screen.getByRole('button', { name: 'Copy answers for review' }));
  expect(screen.getByLabelText('Versioned sandbox package')).toBeDisabled();
  await user.click(await screen.findByRole('button', { name: 'Retry copying answers' }));
  await screen.findByRole('button', { name: 'Review the previous answer' });
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

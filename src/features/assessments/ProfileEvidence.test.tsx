import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

const birth = {
  id: 'profile:1:birth_date',
  sha256: 'd'.repeat(64),
  field: 'birth_date',
  source: 'profile',
  value: '1996-11-12',
  original: { birth_date: '1996-11-12' },
  complete: true,
  conflict: true,
};
async function open() {
  const user = userEvent.setup();
  renderApp('/dev/assessment-calculators');
  await user.selectOptions(
    await screen.findByLabelText('Previous sessions'),
    '11111111-1111-4111-8111-111111111111',
  );
  await screen.findByLabelText('Evidence group');
  return user;
}
beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/profile-evidence/', () =>
      HttpResponse.json({ revision: 0, candidates: [birth], context: [] }),
    ),
  );
});
it('requires explicit confirmation, preserves source and never autosaves imported details', async () => {
  let submitted: Record<string, unknown> | undefined;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/interview/', async ({ request }) => {
      submitted = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        revision: 1,
        answers: {
          'calculator:shared:birth_date': {
            status: 'known',
            value: submitted.value,
            source: 'profile_confirmed_by_user',
            document_verified: false,
          },
        },
      });
    }),
  );
  const user = await open();
  expect(await screen.findByText(/This differs from another record/)).toBeInTheDocument();
  expect(screen.getByLabelText('Answer status')).toHaveValue('unknown');
  await user.click(screen.getByRole('button', { name: 'Review and use these details' }));
  expect(screen.getByLabelText('Birth date')).toHaveValue('1996-11-12');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(submitted).toBeUndefined();
  await user.click(screen.getByRole('button', { name: 'Confirm details and save' }));
  await screen.findByText(/Answer source: Account information confirmed by you/);
  expect(submitted?.profile_candidate).toEqual({ id: birth.id, sha256: birth.sha256 });
});
it('keeps stale imported input until explicitly discarded and permits refreshing sources', async () => {
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
      HttpResponse.json({ detail: 'Source changed' }, { status: 409 }),
    ),
  );
  const user = await open();
  await user.click(await screen.findByRole('button', { name: 'Review and use these details' }));
  await user.click(screen.getByRole('button', { name: 'Confirm details and save' }));
  await screen.findByText(/Account information or the session changed/);
  expect(screen.getByLabelText('Birth date')).toHaveValue('1996-11-12');
  await user.click(screen.getByRole('button', { name: 'Discard this draft' }));
  expect(screen.getByLabelText('Answer status')).toHaveValue('unknown');
  expect(screen.getByRole('button', { name: 'Refresh account information' })).toBeEnabled();
});
it('prefills work dates while blocking incomplete confirmation and explains language limitations', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/profile-evidence/', () =>
      HttpResponse.json({
        revision: 0,
        candidates: [
          {
            ...birth,
            id: 'cv_work:1:work',
            field: 'work',
            source: 'cv_work',
            value: [{ start: '2021-01-01', end: '2022-01-01' }],
            original: { start_date: '2021-01-01', end_date: '2022-01-01' },
            complete: false,
          },
        ],
        context: [
          {
            source: 'profile_language',
            reason: 'four_skills_and_test_variant_required',
            original: { exam__name: 'IELTS overall', score: 7, is_verified: true },
          },
        ],
      }),
    ),
  );
  const user = await open();
  expect(
    await screen.findByText(/An overall score cannot replace four skill scores/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Review and use these details' }));
  expect(screen.getByLabelText('Start')).toHaveValue('2021-01-01');
  expect(screen.getByRole('button', { name: 'Confirm details and save' })).toBeDisabled();
  const history = screen.getByRole('region', { name: 'Result history' });
  await waitFor(() =>
    expect(within(history).queryByText('Current score: 424')).not.toBeInTheDocument(),
  );
});

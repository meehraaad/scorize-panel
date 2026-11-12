import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
});

async function openInterview() {
  const user = userEvent.setup();
  renderApp('/dev/assessment-calculators');
  await user.selectOptions(
    await screen.findByLabelText('Previous sessions'),
    '11111111-1111-4111-8111-111111111111',
  );
  await screen.findByLabelText('Evidence group');
  return user;
}

it('records an answer through the actual route contract and separates nomination scenario from current points', async () => {
  const user = await openInterview();
  await user.selectOptions(screen.getByLabelText('Answer status'), 'known');
  await user.type(screen.getByLabelText('Birth date'), '1996-11-12');
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await screen.findByText(/Answer source: User/);
  await user.click(screen.getByRole('button', { name: 'Record draft result' }));
  const results = await screen.findAllByRole('region', { name: 'Recorded result' });
  const first = results.at(0);
  if (!first) throw new Error('Recorded result missing');
  expect(within(first).getByText('Current score: 424')).toBeInTheDocument();
  expect(within(first).getByText('Hypothetical score: 1024')).toBeInTheDocument();
  expect(within(first).getByText(/conditional on confirmed provincial/)).toBeInTheDocument();
});

it('preserves unsaved input after a revision conflict and blocks recording it', async () => {
  const user = await openInterview();
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
      HttpResponse.json({ detail: 'changed' }, { status: 409 }),
    ),
  );
  await user.selectOptions(screen.getByLabelText('Answer status'), 'known');
  await user.type(screen.getByLabelText('Birth date'), '1996-11-12');
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await screen.findByText(/The session changed/);
  expect(screen.getByLabelText('Birth date')).toHaveValue('1996-11-12');
  expect(screen.getByRole('button', { name: 'Record draft result' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Reload revision and keep input' }));
  expect(screen.getByLabelText('Birth date')).toHaveValue('1996-11-12');
});

it('uses explicit unknown instead of preselecting a factual answer', async () => {
  const user = await openInterview();
  expect(screen.getByLabelText('Answer status')).toHaveValue('unknown');
  await user.selectOptions(screen.getByLabelText('Evidence group'), 'sibling_in_canada');
  expect(screen.getByLabelText('Answer status')).toHaveValue('unknown');
  expect(screen.queryByLabelText('Sibling in canada')).not.toBeInTheDocument();
});

it('autosaves explicit unknown and never substitutes it with a negative answer', async () => {
  const user = await openInterview();
  await user.selectOptions(screen.getByLabelText('Answer status'), 'needs_confirmation');
  await screen.findByText(/Answer source: User/);
  expect(screen.getByLabelText('Answer status')).toHaveValue('needs_confirmation');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Record draft result' })).toBeEnabled(),
  );
});

it('waits for required work-period fields before attempting autosave', async () => {
  const user = await openInterview();
  let writes = 0;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/interview/', () => {
      writes += 1;
      return HttpResponse.json({ detail: 'unexpected incomplete work write' }, { status: 400 });
    }),
  );
  await user.selectOptions(screen.getByLabelText('Evidence group'), 'work');
  await user.selectOptions(screen.getByLabelText('Answer status'), 'known');
  await user.click(screen.getByRole('button', { name: 'Add employment period' }));
  await user.type(screen.getByLabelText('Start'), '2021-01-01');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(writes).toBe(0);
  expect(screen.getByLabelText('Start')).toHaveValue('2021-01-01');
});

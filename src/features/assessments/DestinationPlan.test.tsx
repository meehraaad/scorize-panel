import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
const ID = '22222222-2222-4222-8222-222222222222';
beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
});
async function open() {
  const user = userEvent.setup();
  renderApp(`/dev/assessment-destinations?session=${ID}`);
  const plan = within(
    await screen.findByRole('region', { name: 'Your destination follow-up plan' }),
  );
  return { user, plan };
}
it('selects and orders options explicitly, persists progress and never enables an expired interview', async () => {
  const { user, plan } = await open();
  expect(plan.getByText(/Select up to 6/)).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Add Germany — synthetic route to my plan' }),
  );
  await plan.findByRole('heading', { name: 'Germany — synthetic route' });
  await user.click(screen.getByRole('button', { name: 'Add Canada — synthetic route to my plan' }));
  await plan.findByRole('heading', { name: 'Canada — synthetic route' });
  expect(plan.getAllByRole('heading', { level: 3 }).map((e) => e.textContent)).toEqual([
    'Germany — synthetic route',
    'Canada — synthetic route',
  ]);
  expect(plan.queryByRole('link')).not.toBeInTheDocument();
  await user.click(plan.getByRole('button', { name: 'Move earlier in my plan' }));
  await waitFor(() =>
    expect(plan.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Canada'),
  );
  const fields = plan.getAllByLabelText(
    'Progress — Check the official directory and its review dates',
  );
  const first = fields[0];
  if (!first) throw new Error('Missing first action control');
  await user.selectOptions(first, 'done');
  await waitFor(() => expect(fields[0]).toHaveValue('done'));
  expect(
    plan.getByText(/marking an action done never establishes eligibility/),
  ).toBeInTheDocument();
  expect(plan.getAllByText(/Self-reported on/)).toHaveLength(1);
});
it('requires recheck after a saved intake change and keeps the original reported progress', async () => {
  const { user, plan } = await open();
  await user.click(
    screen.getByRole('button', { name: 'Add Germany — synthetic route to my plan' }),
  );
  const field = await plan.findByLabelText(
    'Progress — Check the official directory and its review dates',
  );
  await user.selectOptions(field, 'done');
  await waitFor(() => expect(field).toHaveValue('done'));
  await user.selectOptions(screen.getByLabelText('Answer status — Planning horizon'), 'known');
  await user.selectOptions(screen.getByLabelText('Preferred planning horizon'), 'flexible');
  expect(field).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Save Planning horizon' }));
  await waitFor(() => expect(field).toHaveValue('needs_recheck'));
  expect(plan.getByText(/Previous self-report: Done/)).toBeInTheDocument();
  await user.selectOptions(field, 'in_progress');
  await waitFor(() => expect(field).toHaveValue('in_progress'));
});
it('records the selected plan in read-only history', async () => {
  const { user, plan } = await open();
  await user.click(
    screen.getByRole('button', { name: 'Add Germany — synthetic route to my plan' }),
  );
  await plan.findByRole('heading', { name: 'Germany — synthetic route' });
  await user.click(screen.getByRole('button', { name: 'Record this destination shortlist' }));
  await waitFor(() =>
    expect(screen.getAllByRole('region', { name: 'Your destination follow-up plan' })).toHaveLength(
      2,
    ),
  );
  const savedRegion = screen.getAllByRole('region', { name: 'Your destination follow-up plan' })[1];
  if (!savedRegion) throw new Error('Missing saved action plan');
  const saved = within(savedRegion);
  expect(saved.getByRole('heading', { name: 'Germany — synthetic route' })).toBeInTheDocument();
  expect(saved.queryByRole('combobox')).not.toBeInTheDocument();
  expect(saved.queryByRole('button')).not.toBeInTheDocument();
});
it('preserves the exact selection request for retry after a controlled error', async () => {
  const bodies: unknown[] = [];
  let fail = true;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/destinations/', async ({ request }) => {
      bodies.push(await request.json());
      if (fail) {
        fail = false;
        return HttpResponse.json({ detail: 'temporary' }, { status: 503 });
      }
      return HttpResponse.json({ detail: 'still retryable' }, { status: 503 });
    }),
  );
  const { user } = await open();
  await user.click(
    screen.getByRole('button', { name: 'Add Germany — synthetic route to my plan' }),
  );
  await user.click(await screen.findByRole('button', { name: 'Retry the same save request' }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[0]).toEqual(bodies[1]);
});
it('opens an Australian route without writes, prepares its subclass only after a click and saves explicitly', async () => {
  let writes = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST') writes++;
  });
  const user = userEvent.setup();
  renderApp(`/dev/assessment-calculators?session=${ID}&country=australia&route=au-190`);
  await screen.findByText(/Investigating Australia — subclass 190/);
  expect(screen.getByLabelText('Country route')).toHaveValue('australia');
  expect(screen.getByLabelText('Evidence group')).toHaveValue('subclass');
  expect(writes).toBe(0);
  await user.click(
    screen.getByRole('button', { name: 'Prepare subclass questions for Australia — subclass 190' }),
  );
  expect(screen.getByLabelText('Subclass')).toHaveValue('190');
  expect(writes).toBe(0);
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await waitFor(() => expect(writes).toBe(1));
  expect(screen.getByRole('link', { name: 'Return to my destination plan' })).toHaveAttribute(
    'href',
    `/dev/assessment-destinations?session=${ID}`,
  );
});

it('never offers a detailed handoff for an unsupported program even with a reviewed directory', async () => {
  const { default: fixture } = await import('@/mocks/destination-result.json');
  const data = structuredClone(fixture);
  const entry = data.entries[0];
  if (!entry) throw new Error('Missing program fixture');
  entry.id = 'ca-fst';
  entry.calculator_route = 'ca-fst';
  entry.eligibility = { status: 'unsupported', reason: 'fst_not_implemented' };
  data.entries = [entry];
  server.use(
    http.get('/api/applicant/v1/assessments/:id/destinations/', () => HttpResponse.json(data)),
  );
  await open();
  expect(screen.queryByRole('link', { name: 'Open detailed assessment' })).not.toBeInTheDocument();
});

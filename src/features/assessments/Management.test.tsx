import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, Suspense } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { queryClient } from '@/lib/api/queryClient';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('scorize.mock.session', '4');
  await i18n.changeLanguage('en');
});

async function createDraft() {
  const user = userEvent.setup();
  renderApp('/dev/assessments');
  await user.click(await screen.findByRole('button', { name: 'New draft' }));
  await user.type(screen.getByLabelText('Stable ruleset key (Latin)'), 'test-route');
  await user.type(screen.getByRole('textbox', { name: 'Draft title' }), 'Test assessment');
  await user.click(screen.getByRole('button', { name: 'Add source' }));
  await user.type(screen.getByLabelText('Source title'), 'Synthetic fixture');
  await user.type(screen.getByLabelText('Source URL'), 'https://example.org/synthetic');
  await user.type(screen.getByLabelText('Reviewed on'), '2026-11-11');
  await user.type(screen.getByLabelText('Review due'), '2026-12-11');
  for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByRole('heading', { name: 'Draft' });
  return user;
}

describe('assessment content sandbox', () => {
  it('opens from a cold cache under the development StrictMode frame', async () => {
    queryClient.clear();
    const router = createMemoryRouter(routes, { initialEntries: ['/dev/assessments'] });
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <Suspense>
            <RouterProvider router={router} />
          </Suspense>
        </QueryClientProvider>
      </StrictMode>,
    );
    expect(await screen.findByRole('button', { name: 'New draft' })).toBeEnabled();
  });
  it('saves, tests, reviews and freezes a version with an actual/expected comparison', async () => {
    const user = await createDraft();
    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    await screen.findByRole('heading', { name: 'Validation and change impact' });
    expect(screen.getByText('All scenarios passed')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Actual' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Expected' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await screen.findByRole('heading', { name: 'In review' });
    await user.click(screen.getByRole('button', { name: 'Independent approval' }));
    await screen.findByRole('heading', { name: 'Approved' });
    expect(screen.getByRole('textbox', { name: 'Draft title' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Activate in sandbox' })).toBeEnabled();
  });

  it('keeps unsaved content on a revision conflict and blocks testing it', async () => {
    const user = await createDraft();
    const title = screen.getByRole('textbox', { name: 'Draft title' });
    await user.clear(title);
    await user.type(title, 'Unsaved revised title');
    expect(screen.getByRole('button', { name: 'Run tests' })).toBeDisabled();
    server.use(
      http.put('/api/staff/v1/assessments/drafts/:id/', () =>
        HttpResponse.json({ detail: 'Conflict' }, { status: 409 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByRole('alert');
    expect(title).toHaveValue('Unsaved revised title');
  });

  it('routes signed-out visitors to login', async () => {
    localStorage.removeItem('scorize.mock.session');
    const router = renderApp('/dev/assessments');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('creates a new question and route and persists independent scenario expectations', async () => {
    const user = await createDraft();
    await user.type(screen.getByLabelText('Definition ID (Latin)'), 'income');
    await user.type(screen.getByLabelText('Definition name'), 'Available income');
    const answerType = screen.getAllByLabelText('Answer type')[0];
    if (!answerType) throw new Error('Missing answer type');
    await user.selectOptions(answerType, 'number');
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    await user.click(screen.getByText('Available income', { selector: 'summary' }));
    const question = screen
      .getByText('Available income', { selector: 'summary' })
      .closest('details');
    if (!question) throw new Error('Missing question editor');
    expect(within(question).getByLabelText('Minimum')).toHaveValue(0);
    expect(within(question).getByLabelText('Maximum')).toHaveValue(120);
    await user.selectOptions(screen.getByLabelText('Definition type'), 'route');
    await user.type(screen.getByLabelText('Definition ID (Latin)'), 'new-study');
    await user.type(screen.getByLabelText('Definition name'), 'New study route');
    await user.click(screen.getByRole('button', { name: 'Add route' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run tests' })).toBeEnabled());
    expect(screen.getByText('New study route', { selector: 'summary' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add reference scenario' }));
    expect(screen.getByText('New scenario 2', { selector: 'summary' })).toBeInTheDocument();
  });

  it('blocks deleting referenced questions and exposes their route dependency', async () => {
    await createDraft();
    const question = screen
      .getByText('سن شما چقدر است؟', { selector: 'summary' })
      .closest('details');
    if (!question) throw new Error('Missing question editor');
    expect(
      within(question).getByRole('button', { name: 'Remove question', hidden: true }),
    ).toBeDisabled();
    expect(within(question).getByText(/Remove references from conditions/)).toBeInTheDocument();
  });

  it('returns reviewed content with an explanation and requires testing it again', async () => {
    const user = await createDraft();
    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    await screen.findByText('All scenarios passed');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await screen.findByRole('heading', { name: 'In review' });
    expect(screen.getByRole('button', { name: 'Return for changes' })).toBeDisabled();
    await user.type(
      screen.getByLabelText('Required changes for the editor'),
      'Check the age boundary',
    );
    await user.click(screen.getByRole('button', { name: 'Return for changes' }));
    await screen.findByRole('heading', { name: 'Draft' });
    expect(screen.getByText('Check the age boundary')).toBeInTheDocument();
    expect(screen.queryByText('All scenarios passed')).not.toBeInTheDocument();
  });
});

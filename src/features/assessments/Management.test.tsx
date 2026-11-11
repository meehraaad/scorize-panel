import { render, screen, waitFor } from '@testing-library/react';
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
});

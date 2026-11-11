import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import i18n from '@/lib/i18n';
import { SectionError } from './ErrorPage';
import { missingOf } from './routeFailure';

/** A page whose data answered with `error`, in a panel's section boundary. */
function renderFailingPage(error: Error) {
  const router = createMemoryRouter(
    [
      {
        ErrorBoundary: SectionError,
        children: [
          {
            path: '/',
            loader: () => {
              throw error;
            },
            Component: () => null,
          },
        ],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('a page whose data is not found', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fa');
  });

  it('says an inactive account is inactive (customer 63437), not "did not load"', async () => {
    renderFailingPage(new ApiError(404, { detail: 'inactive', code: 'inactive' }));
    expect(await screen.findByText(i18n.t('errors.inactiveTitle'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('errors.sectionTitle'))).toBeNull();
  });

  it('says another 404 from the API is not found', async () => {
    renderFailingPage(new ApiError(404, { detail: 'Not found.' }));
    expect(await screen.findByText(i18n.t('errors.notFoundTitle'))).toBeInTheDocument();
  });
});

describe('missingOf', () => {
  it('keeps other API errors as errors', () => {
    expect(missingOf(new ApiError(500, null))).toBeNull();
    expect(missingOf(new ApiError(403, { code: 'inactive' }))).toBeNull();
    expect(missingOf(new TypeError('boom'))).toBeNull();
  });
});

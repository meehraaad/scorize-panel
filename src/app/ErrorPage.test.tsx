import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { MOCK_CRASH_CODE } from '@/mocks/clientErrors';
import '@/test/server';
import i18n from '@/lib/i18n';
import { SectionError } from './ErrorPage';
import { missingOf, supportCodeOf } from './routeFailure';

// A copy the tests can switch: the endpoint is off in the real file until Django ships it.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER } };
});
const setClientErrors = (on: boolean) => {
  (ON_SERVER as Record<string, boolean>).clientErrors = on;
};

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

describe('the support code', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fa');
  });

  it('shows the request ID of a server error, to find it in the logs', async () => {
    renderFailingPage(new ApiError(500, null, 'a1b2c3d4e5f60718293a4b5c6d7e8f90'));
    expect(await screen.findByText(i18n.t('errors.sectionTitle'))).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('errors.copyCode') })).toBeInTheDocument();
  });

  it('shows none when there is nothing to look up', async () => {
    renderFailingPage(new ApiError(500, null));
    expect(await screen.findByText(i18n.t('errors.sectionTitle'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('errors.supportCode'))).toBeNull();
  });

  it('is only for failures on the server', () => {
    expect(supportCodeOf(new ApiError(502, null, 'abc12345'))).toBe('abc12345');
    expect(supportCodeOf(new ApiError(400, null, 'abc12345'))).toBeNull();
    expect(supportCodeOf(new TypeError('boom'))).toBeNull();
  });
});

describe('a crash in the panel’s own code', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fa');
  });
  afterEach(() => {
    setClientErrors(false);
  });

  it('shows the code the server logged the report under', async () => {
    setClientErrors(true);
    renderFailingPage(new TypeError("Cannot read properties of undefined (reading 'name')"));
    expect(await screen.findByText(MOCK_CRASH_CODE)).toBeInTheDocument();
  });
});

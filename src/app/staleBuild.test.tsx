import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { SectionError } from './ErrorPage';

const reload = vi.fn();

/** A page whose code can't be fetched any more, in a panel's section boundary. */
function renderFailingPage(message: string) {
  const router = createMemoryRouter(
    [
      {
        ErrorBoundary: SectionError,
        children: [
          {
            path: '/',
            lazy: () => Promise.reject(new TypeError(message)),
          },
        ],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

const OLD_BUILD = 'Failed to fetch dynamically imported module: /panel/assets/TodayPage-0ld.js';

describe('a page whose code is from before a deploy', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    reload.mockClear();
    vi.stubGlobal('location', { reload });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await i18n.changeLanguage('fa');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reloads into the new build instead of showing an error', async () => {
    renderFailingPage(OLD_BUILD);
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the error when the reload just happened and the page still fails', async () => {
    sessionStorage.setItem('scorize.staleBuildReload', String(Date.now()));
    renderFailingPage(OLD_BUILD);
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.sectionTitle'));
    expect(reload).not.toHaveBeenCalled();
  });

  it('shows other errors as they are', async () => {
    renderFailingPage("Cannot read properties of undefined (reading 'results')");
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});

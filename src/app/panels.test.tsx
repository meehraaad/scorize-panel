import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

/** Logs in as one of the mock accounts in src/mocks/handlers.ts without going through the form. */
const loginAs = (id: 1 | 2) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const SARA = 1; // applicant only
const MARYAM = 2; // staff: supervisor + writer

describe('panels', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('sends staff to their work panel after login', async () => {
    loginAs(MARYAM);
    const router = renderApp('/start');
    expect(await screen.findByRole('heading', { name: 'امروز' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/supervisor');
    // With several panels, the header names the current one.
    expect(within(screen.getByRole('banner')).getByText('پنل سوپروایزر')).toBeInTheDocument();
  });

  it('lets someone with several roles switch panels and remembers the choice', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/supervisor');

    await user.click(await screen.findByRole('button', { name: 'حساب کاربری' }));
    const switcher = screen.getByRole('navigation', { name: 'پنل‌های شما' });
    expect(
      within(switcher)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['پنل سوپروایزر', 'پنل نگارش', 'پنل متقاضی']);

    await user.click(within(switcher).getByRole('link', { name: 'پنل نگارش' }));
    expect(await screen.findByRole('heading', { name: 'سفارش‌های نگارش' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/writer');
    expect(localStorage.getItem('scorize.panel')).toBe('writer');
  });

  it('keeps people out of panels they have no role for', async () => {
    loginAs(SARA);
    const router = renderApp('/supervisor/files');
    expect(await screen.findByRole('heading', { name: 'سلام سارا' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows no panel switcher to someone with one panel', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'حساب کاربری' }));
    expect(screen.queryByRole('navigation', { name: 'پنل‌های شما' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تنظیمات' })).toBeInTheDocument();
  });

  it('shows shared pages inside the last-used panel', async () => {
    loginAs(MARYAM);
    localStorage.setItem('scorize.panel', 'writer');
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'تنظیمات' })).toBeInTheDocument();
    // jsdom applies no CSS, so the desktop menu (header) is the one to check.
    expect(
      within(screen.getByRole('banner')).getByRole('navigation', { name: 'منوی پنل نگارش' }),
    ).toBeInTheDocument();
  });

  it('shows a not-found page inside the panel, keeping its menu', async () => {
    loginAs(SARA);
    renderApp('/no-such-page');
    expect(await screen.findByRole('heading', { name: 'این صفحه پیدا نشد' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getByRole('navigation', { name: 'منوی پنل متقاضی' }),
    ).toBeInTheDocument();
  });
});

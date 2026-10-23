import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

/** Logs in as one of the mock accounts in src/mocks/handlers.ts without going through the form. */
const loginAs = (id: 1 | 2 | 3) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const SARA = 1; // applicant only
const MARYAM = 2; // staff: supervisor + writer
const NIMA = 3; // staff: sales only

describe('panels', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('asks staff with several panels where to start on their first login here', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/start');
    expect(
      await screen.findByRole('heading', { name: 'سلام مریم، امروز از کدام پنل شروع کنیم؟' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/choose');
    // Work panels only: Maryam has no applicant file of her own. Each card opens its panel.
    const cards = within(screen.getByRole('navigation', { name: 'پنل‌ها' })).getAllByRole('link');
    expect(cards.map((card) => card.getAttribute('href'))).toEqual(['/supervisor', '/writer']);
    expect(screen.getByRole('link', { name: 'ورود به پنل به‌عنوان کاربر عادی' })).toHaveAttribute(
      'href',
      '/',
    );

    await user.click(
      within(screen.getByRole('navigation', { name: 'پنل‌ها' })).getByRole('link', {
        name: /پنل نگارش/,
      }),
    );
    expect(await screen.findByRole('heading', { name: 'سفارش‌های نگارش' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/writer');
    expect(localStorage.getItem('scorize.panel.start')).toBe('last');
  });

  it('sends staff straight to the panel they used last', async () => {
    loginAs(MARYAM);
    localStorage.setItem('scorize.panel', 'supervisor');
    const router = renderApp('/start');
    expect(await screen.findByRole('heading', { name: 'امروز' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/supervisor');
  });

  it('follows the "open after login" choice: always ask, or always one panel', async () => {
    loginAs(MARYAM);
    localStorage.setItem('scorize.panel', 'supervisor');
    localStorage.setItem('scorize.panel.start', 'ask');
    let router = renderApp('/start');
    await screen.findByRole('heading', { name: /کدام پنل/ });
    expect(router.state.location.pathname).toBe('/choose');
    cleanup();

    localStorage.setItem('scorize.panel.start', 'writer');
    router = renderApp('/start');
    expect(await screen.findByRole('heading', { name: 'سفارش‌های نگارش' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/writer');
  });

  it('switches panels from the button beside the logo and remembers the choice', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/supervisor');

    const header = within(await screen.findByRole('banner'));
    await user.click(await header.findByRole('button', { name: 'پنل سوپروایزر' }));
    const switcher = screen.getByRole('navigation', { name: 'پنل‌های شما' });
    const links = within(switcher).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/supervisor', '/writer']);
    expect(links[0]).toHaveAttribute('aria-current', 'page');

    await user.selectOptions(screen.getByLabelText('بعد از ورود باز شود'), 'همیشه بپرس');
    expect(localStorage.getItem('scorize.panel.start')).toBe('ask');

    await user.click(within(switcher).getByRole('link', { name: /پنل نگارش/ }));
    expect(await screen.findByRole('heading', { name: 'سفارش‌های نگارش' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/writer');
    expect(localStorage.getItem('scorize.panel')).toBe('writer');
  });

  it('sends staff with one work panel straight to it, with no switcher', async () => {
    loginAs(NIMA);
    const router = renderApp('/start');
    expect(await screen.findByRole('heading', { name: 'لیدها' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sales');
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: 'پنل فروش' }),
    ).toBeNull();

    // Nothing to choose either.
    cleanup();
    const again = renderApp('/choose');
    await screen.findByRole('heading', { name: 'لیدها' });
    expect(again.state.location.pathname).toBe('/sales');
  });

  it('keeps people out of panels they have no role for', async () => {
    loginAs(SARA);
    const router = renderApp('/supervisor/files');
    expect(await screen.findByRole('heading', { name: 'سلام سارا' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows no panel switcher to someone with one panel', async () => {
    loginAs(SARA);
    renderApp('/');
    await screen.findByRole('heading', { name: 'سلام سارا' });
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: 'پنل متقاضی' }),
    ).toBeNull();
  });

  it('lets staff open the panel as a regular customer, and switch back to work', async () => {
    const user = userEvent.setup();
    loginAs(NIMA);
    const router = renderApp('/sales');
    await screen.findByRole('heading', { name: 'لیدها' });

    await user.click(screen.getByRole('button', { name: 'حساب کاربری' }));
    await user.click(screen.getByRole('link', { name: 'پنل کاربر عادی' }));
    expect(await screen.findByRole('heading', { name: 'سلام نیما' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    // Not one of his panels, but listed while he is in it, so he can get back.
    await user.click(
      within(screen.getByRole('banner')).getByRole('button', { name: 'پنل متقاضی' }),
    );
    await user.click(
      within(screen.getByRole('navigation', { name: 'پنل‌های شما' })).getByRole('link', {
        name: /پنل فروش/,
      }),
    );
    expect(await screen.findByRole('heading', { name: 'لیدها' })).toBeInTheDocument();
  });

  it('logs out for real: the session is gone', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'حساب کاربری' }));
    await user.click(screen.getByRole('button', { name: 'خروج از حساب' }));
    await waitFor(() => {
      expect(localStorage.getItem('scorize.mock.session')).toBeNull();
    });
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

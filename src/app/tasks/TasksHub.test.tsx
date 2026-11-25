import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ParseKeys } from 'i18next';
import i18n from '@/lib/i18n';
import { resetTaskMocks } from '@/mocks/tasks';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // applicant only
const MARYAM = 2; // staff: supervisor, writer, executive
const HIRE = 603; // staff with no panel of her own yet

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const t = (key: ParseKeys) => i18n.t(key);
const tasks = (key: ParseKeys<'tasks'>) => i18n.t(key, { ns: 'tasks' });

/** The bell's desktop button (the phone link has the same name). */
const bellButton = () => screen.findByRole('button', { name: new RegExp(`^${t('header.tasks')}`) });

describe('staff tasks and notifications', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetTaskMocks();
    await i18n.changeLanguage('fa');
    await i18n.loadNamespaces(['tasks', 'account']);
  });

  it('the bell counts both, opens on tasks, and Esc closes it back to the bell', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor');
    const bell = await bellButton();
    await waitFor(() => {
      expect(bell).toHaveAccessibleName(expect.stringMatching(/منتظر/));
    });
    await user.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    const popup = await screen.findByRole('region', { name: t('header.tasks') });
    const tabs = await within(popup).findByRole('group', { name: tasks('hub.tabs') });
    expect(
      within(tabs).getByRole('button', { name: new RegExp(tasks('hub.title')) }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await within(popup).findByText(/بررسی SOP نسخه‌ی دوم/)).toBeInTheDocument();
    expect(within(popup).getByRole('link', { name: tasks('hub.all') })).toHaveAttribute(
      'href',
      '/tasks?panel=supervisor',
    );

    await user.click(
      within(tabs).getByRole('button', { name: new RegExp(tasks('hub.notifications')) }),
    );
    expect(
      within(popup).getByRole('link', { name: tasks('hub.allNotifications') }),
    ).toHaveAttribute('href', '/tasks?tab=notifications');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: t('header.tasks') })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });

  it('on a phone the bell is a link to the page, not a popup', async () => {
    loginAs(MARYAM);
    renderApp('/supervisor');
    await bellButton();
    const link = screen.getByRole('link', { name: new RegExp(`^${t('header.tasks')}`) });
    // Shown below lg only (CSS), always in the page: no media query decides whether it exists.
    expect(link).toHaveAttribute('href', '/tasks?panel=supervisor');
    expect(link).toHaveClass('lg:hidden');
  });

  it('/tasks opens on tasks, switches panel and tab from the address', async () => {
    loginAs(MARYAM);
    const router = renderApp('/tasks');
    const tabs = await screen.findByRole('navigation', { name: tasks('hub.tabs') });
    expect(
      within(tabs).getByRole('link', { name: new RegExp(tasks('hub.title')) }),
    ).toHaveAttribute('aria-current', 'page');
    const whose = screen.getByRole('navigation', { name: tasks('hub.context') });
    expect(
      within(whose)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/tasks?panel=supervisor', '/tasks?panel=executive']);
    expect(await screen.findByText(/بررسی SOP نسخه‌ی دوم/)).toBeInTheDocument();

    await router.navigate('/tasks?tab=notifications');
    expect(
      await screen.findByRole('heading', { name: tasks('hub.notifications') }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: tasks('hub.context') }),
    ).not.toBeInTheDocument();
  });

  it('staff with no panel have the page too', async () => {
    loginAs(HIRE);
    const router = renderApp('/tasks');
    expect(await screen.findByText(tasks('mine.empty'))).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tasks');
    expect(
      screen.queryByRole('navigation', { name: tasks('hub.context') }),
    ).not.toBeInTheDocument();
  });

  it('accounts without staff access keep their notifications', async () => {
    loginAs(SARA);
    const router = renderApp('/tasks');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/account');
    });
    expect(router.state.location.hash).toBe('#notifications');
    expect(
      await screen.findByRole('link', { name: new RegExp(`^${t('header.notifications')}`) }),
    ).toHaveAttribute('href', '/account#notifications');
  });

  it("the dock waits in the corner, opens today's tasks, and steps aside on the tasks page", async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/supervisor');
    const pill = await screen.findByRole('button', { name: /^کارهای امروز:/ });
    await user.click(pill);
    const dock = await screen.findByRole('region', { name: tasks('dock.title') });
    expect(await within(dock).findByText(/بررسی SOP نسخه‌ی دوم/)).toBeInTheDocument();
    await user.click(within(dock).getByRole('button', { name: tasks('dock.minimize') }));
    expect(screen.queryByRole('region', { name: tasks('dock.title') })).not.toBeInTheDocument();

    await router.navigate('/supervisor/tasks');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^کارهای امروز:/ })).not.toBeInTheDocument();
    });
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const MARYAM = 2; // supervisor with can_assign_supervisor (src/mocks/handlers.ts)
const NIMA = 3; // seller

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const sections = () => screen.getByRole('navigation', { name: 'بخش‌های مدیریت اجرایی' });
const table = () => screen.getByRole('table');

describe('supervisor manager section', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it("shows the team's load and opens one person's cases", async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/executive/manager/team');
    expect(await screen.findByRole('heading', { name: 'تیم', level: 1 })).toBeInTheDocument();
    expect(within(sections()).getByRole('link', { name: 'تیم' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const summary = screen.getByRole('region', { name: 'خلاصه‌ی تیم' });
    expect(within(summary).getByText('پرونده‌های بدون سرپرست')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دیدن پرونده‌های بدون سرپرست' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'علی نوری' }));
    expect(await screen.findByRole('heading', { name: 'پرونده‌های تیم', level: 1 })).toBeVisible();
    expect(router.state.location.search).toBe('?supervisor=11');
    expect(screen.getByLabelText('سرپرست')).toHaveValue('11');
    expect(await within(table()).findByRole('link', { name: 'محمد کریمی' })).toBeInTheDocument();
    expect(within(table()).queryByRole('link', { name: 'سارا محمدی' })).not.toBeInTheDocument();
  });

  it('lists every case with its supervisors, and the ones nobody supervises', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/executive/manager/cases');
    await screen.findByRole('heading', { name: 'پرونده‌های تیم', level: 1 });
    expect(within(table()).getByRole('columnheader', { name: 'سرپرست' })).toBeInTheDocument();
    const sara = within(table()).getByRole('link', { name: 'سارا محمدی' }).closest('tr');
    expect(sara).toHaveTextContent('مریم کاظمی');

    await user.selectOptions(screen.getByLabelText('سرپرست'), 'none');
    await waitFor(() =>
      expect(within(table()).queryByRole('link', { name: 'سارا محمدی' })).not.toBeInTheDocument(),
    );
    expect(within(table()).getByText('بدون سرپرست')).toBeInTheDocument();
    expect(within(table()).getByRole('link', { name: 'علی نوری' })).toBeInTheDocument();
  });

  it("moves all of one person's open cases from the team page", async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/executive/manager/team');
    const ali = (await screen.findByRole('link', { name: 'علی نوری' })).closest(
      'li',
    ) as HTMLElement;
    await user.click(within(ali).getByRole('button', { name: 'انتقال پرونده‌ها' }));
    const dialog = await screen.findByRole('dialog', { name: 'انتقال پرونده‌های علی نوری' });
    await user.click(within(dialog).getByRole('button', { name: 'انتقال پرونده‌ها' }));
    expect(within(dialog).getByText('انتخاب کنید پرونده‌ها به چه کسی سپرده شوند.')).toBeVisible();
    await user.selectOptions(within(dialog).getByLabelText('سپردن به'), '7');
    await user.click(within(dialog).getByRole('button', { name: 'انتقال پرونده‌ها' }));
    expect(
      await toasts().findByText(/^.+ پرونده و ۰ خدمت به مریم کاظمی سپرده شد\.$/),
    ).toBeVisible();
  });

  it("gives one person's chosen cases to someone else from their list", async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/executive/manager/cases?supervisor=7');
    const sara = await within(await screen.findByRole('table')).findByRole('link', {
      name: 'سارا محمدی',
    });
    expect(screen.queryByRole('button', { name: 'سپردن به دیگری' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'انتخاب سارا محمدی' }));
    await user.click(screen.getByRole('button', { name: 'سپردن به دیگری' }));
    const dialog = await screen.findByRole('dialog', { name: 'انتقال پرونده‌های مریم کاظمی' });
    expect(within(dialog).getByText(/۱ پرونده‌ی انتخاب‌شده/)).toBeVisible();
    await user.selectOptions(within(dialog).getByLabelText('سپردن به'), '11');
    await user.click(within(dialog).getByRole('button', { name: 'انتقال پرونده‌ها' }));
    // Her admission services there went along.
    expect(
      await toasts().findByText(/^۱ پرونده و [۱-۹] خدمت به علی نوری سپرده شد\.$/),
    ).toBeVisible();
    await waitFor(() => expect(sara).not.toBeInTheDocument());
  });

  it('opens a move from the move page', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/executive/manager/move');
    await screen.findByRole('heading', { name: 'انتقال پرونده‌ها', level: 1 });
    await user.selectOptions(screen.getByLabelText('پرونده‌های چه کسی؟'), '11');
    expect(screen.getByRole('link', { name: 'انتخاب چند پرونده' })).toHaveAttribute(
      'href',
      '/executive/manager/cases?supervisor=11',
    );
    await user.click(screen.getByRole('button', { name: /^انتقال همه‌ی .+ پرونده‌ی فعال$/ }));
    expect(
      await screen.findByRole('dialog', { name: 'انتقال پرونده‌های علی نوری' }),
    ).toBeInTheDocument();
  });

  it('is only for those who assign supervisors', async () => {
    loginAs(NIMA);
    const router = renderApp('/executive/manager/team');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).not.toBe('/executive/manager/team');
  });

  it("moved from the supervisor panel: the old addresses open the executive panel's tab", async () => {
    loginAs(MARYAM);
    const router = renderApp('/supervisor/manager/cases?supervisor=11');
    expect(await screen.findByRole('heading', { name: 'پرونده‌های تیم', level: 1 })).toBeVisible();
    expect(router.state.location.pathname).toBe('/executive/manager/cases');
    expect(router.state.location.search).toBe('?supervisor=11');
    expect(within(sections()).getByRole('link', { name: 'ایمیل‌ها' })).toBeInTheDocument();
  });
});

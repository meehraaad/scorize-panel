import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3; // seller
const REZA = 4; // sales manager

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe("the sales manager's consultations", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('is only for the sales manager', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager/consultations');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
  });

  it('lists every session with its consultant, and the types in a sub-tab', async () => {
    loginAs(REZA);
    renderApp('/sales/manager/consultations/sessions?view=all');
    expect(await screen.findByRole('heading', { name: 'جلسه‌های مشاوره' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'بخش‌های مشاوره' });
    expect(within(nav).getByRole('link', { name: 'نوع‌ها و قیمت‌ها' })).toHaveAttribute(
      'href',
      '/sales/manager/consultations',
    );
    expect(await screen.findByText('۷ جلسه')).toBeInTheDocument();
    // Every third mock session nobody holds: its menu says so.
    const menus = screen.getAllByRole('combobox', { name: /^مشاور جلسه‌ی / });
    expect(menus).toHaveLength(7);
    expect(menus.filter((menu) => (menu as HTMLSelectElement).value === 'none')).toHaveLength(3);
  });

  it('shows those nobody holds, and gives one to a seller', async () => {
    loginAs(REZA);
    renderApp('/sales/manager/consultations/sessions');
    const tabs = await screen.findByRole('group', { name: 'کدام جلسه‌ها' });
    await userEvent.click(await within(tabs).findByRole('button', { name: /بدون مشاور/ }));
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: 'مشاور' })).not.toBeInTheDocument(),
    );
    const menus = () => screen.getAllByRole('combobox', { name: /^مشاور جلسه‌ی / });
    await waitFor(() =>
      expect(menus().every((menu) => (menu as HTMLSelectElement).value === 'none')).toBe(true),
    );
    const [first] = menus();
    if (!first) throw new Error('no session');
    await userEvent.selectOptions(first, '8');
    expect(await toasts().findByText(/سپرده شد/)).toBeInTheDocument();
  });

  it('filters by in person or online', async () => {
    loginAs(REZA);
    renderApp('/sales/manager/consultations/sessions?view=all');
    expect(await screen.findByText('۷ جلسه')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'جلسه' }), 'in_person');
    await waitFor(() => expect(screen.queryByText('۷ جلسه')).not.toBeInTheDocument());
    expect(screen.getByText(/^[۰-۹]+ جلسه$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پاک کردن فیلترها' })).toBeInTheDocument();
  });
});

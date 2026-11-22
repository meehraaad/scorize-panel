import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const MARYAM = 2; // supervisor with can_assign_supervisor (src/mocks/handlers.ts)
const NIMA = 3; // seller

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const sections = () => screen.getByRole('navigation', { name: 'بخش‌های مدیریت سرپرستی' });
const table = () => screen.getByRole('table');

describe('supervisor manager section', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it("shows the team's load and opens one person's cases", async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/supervisor/manager/team');
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
    renderApp('/supervisor/manager/cases');
    await screen.findByRole('heading', { name: 'پرونده‌های تیم', level: 1 });
    expect(within(table()).getByRole('columnheader', { name: 'سرپرست' })).toBeInTheDocument();
    const sara = within(table()).getByRole('link', { name: 'سارا محمدی' }).closest('tr');
    expect(sara).toHaveTextContent('مریم کاظمی');

    await user.selectOptions(screen.getByLabelText('سرپرست'), 'none');
    expect(await within(table()).findByText('بدون سرپرست')).toBeInTheDocument();
    expect(within(table()).queryByRole('link', { name: 'سارا محمدی' })).not.toBeInTheDocument();
    expect(within(table()).getByRole('link', { name: 'علی نوری' })).toBeInTheDocument();
  });

  it('is only for those who assign supervisors', async () => {
    loginAs(NIMA);
    const router = renderApp('/supervisor/manager/team');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).not.toBe('/supervisor/manager/team');
  });
});

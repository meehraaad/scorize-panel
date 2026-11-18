import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const ELHAM = 7; // marketing team (src/mocks/marketing.ts)
const NIMA = 3; // seller: not a marketer

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('marketing panel', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the marketing day: my tasks, campaigns and the team’s attendance', async () => {
    loginAs(ELHAM);
    renderApp('/marketing');
    expect(await screen.findByRole('heading', { name: 'امروز', level: 1 })).toBeInTheDocument();
    const tasks = screen.getByRole('region', { name: 'کارهای امروز من' });
    expect(within(tasks).getByText('کپشن و هشتگ ریلز آلمان')).toBeInTheDocument();
    const campaigns = screen.getByRole('region', { name: 'کمپین‌های در جریان' });
    expect(within(campaigns).getByText('وبینار اپلای کانادا ۲۰۲۷')).toBeInTheDocument();
    const team = screen.getByRole('region', { name: 'تیم امروز' });
    expect(within(team).getByText('تأخیر ۰:۴۱')).toBeInTheDocument();
    expect(within(team).getByText('بدون شماره‌ی دستگاه')).toBeInTheDocument();
    const me = screen.getByRole('region', { name: 'حضور من امروز' });
    expect(within(me).getByText('حاضر')).toBeInTheDocument();
  });

  it('keeps people who aren’t marketers out', async () => {
    loginAs(NIMA);
    renderApp('/marketing/performance');
    await waitFor(() => {
      expect(window.location.pathname).not.toMatch(/^\/marketing/);
    });
  });

  it('shows a campaign starting on the calendar beside my tasks', async () => {
    loginAs(ELHAM);
    renderApp('/marketing/calendar');
    expect(await screen.findByRole('heading', { name: 'تقویم', level: 1 })).toBeInTheDocument();
    expect(await screen.findAllByText('شروع: وبینار اپلای کانادا ۲۰۲۷')).not.toHaveLength(0);
  });

  it('shows my month’s attendance and keeps a place for KPIs', async () => {
    loginAs(ELHAM);
    renderApp('/marketing/performance');
    expect(await screen.findByRole('heading', { name: 'عملکرد من', level: 1 })).toBeInTheDocument();
    const kpi = screen.getByRole('region', { name: 'KPI' });
    expect(within(kpi).getByText('به‌زودی')).toBeInTheDocument();
    const totals = await screen.findByRole('region', { name: 'جمع ماه' });
    expect(within(totals).getByText('روز حاضر')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /^روزهای / })).toBeInTheDocument();
  });

  it('lists my tasks on the shared tasks page', async () => {
    loginAs(ELHAM);
    renderApp('/marketing/tasks');
    expect(await screen.findByText('متن پیامک یادآوری وبینار کانادا')).toBeInTheDocument();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const AMIR = 6; // superuser: holds can_manage_support_staff (src/mocks/hr.ts)
const NIMA = 3; // seller: no key

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('HR panel', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows HR’s day: counts, the joining under way, a trial ending and a birthday', async () => {
    loginAs(AMIR);
    renderApp('/hr');
    expect(await screen.findByRole('heading', { name: 'امروز', level: 1 })).toBeInTheDocument();
    const moves = await screen.findByRole('region', { name: 'ورود و خروج‌های باز' });
    expect(within(moves).getByRole('link', { name: /بهار نیکو/ })).toBeInTheDocument();
    const ending = screen.getByRole('region', { name: 'قراردادهایی که تمام می‌شوند' });
    expect(within(ending).getByRole('link', { name: /مریم کریمی/ })).toBeInTheDocument();
    const birthdays = screen.getByRole('region', { name: 'تولدهای این هفته' });
    expect(within(birthdays).getByRole('link', { name: /مریم کریمی/ })).toBeInTheDocument();
  });

  it('keeps people without the key out', async () => {
    loginAs(NIMA);
    renderApp('/hr/staff');
    await waitFor(() => {
      expect(window.location.pathname).not.toMatch(/^\/hr/);
    });
  });

  it('adds a staff member and opens their file on the joining checklist', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    const list = await screen.findByRole('list', { name: 'کارکنان' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    await user.type(within(dialog).getByLabelText('نام'), 'سینا');
    await user.type(within(dialog).getByLabelText('نام خانوادگی'), 'مرادی');
    await user.type(within(dialog).getByLabelText('موبایل'), '09121112233');
    await user.type(within(dialog).getByLabelText('شماره شناسنامه'), '5566');
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '20000000');
    await user.click(within(dialog).getByRole('button', { name: 'ساخت پرونده' }));
    expect(await toasts().findByText('پرونده‌ی سینا مرادی ساخته شد')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'سینا مرادی', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '۰ از ۸ انجام شده' })).toBeInTheDocument();
  });

  it('asks for the missing fields before saving', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    await user.type(within(dialog).getByLabelText('موبایل'), '123');
    await user.click(within(dialog).getByRole('button', { name: 'ساخت پرونده' }));
    expect(within(dialog).getByText('شماره‌ی موبایل درست نیست')).toBeInTheDocument();
    expect(within(dialog).getAllByText('این را پر کنید').length).toBeGreaterThan(1);
  });

  it('ticks a checklist step', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    const step = await screen.findByRole('checkbox', { name: /ایمیل شرکتی/ });
    await user.click(step);
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: '۱ از ۸ انجام شده' })).toBeInTheDocument();
    });
  });

  it('starts someone’s leaving with its checklist', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/1');
    await user.click(await screen.findByRole('button', { name: 'شروع خروج' }));
    const dialog = await screen.findByRole('dialog', { name: 'شروع خروج' });
    await user.click(within(dialog).getByRole('button', { name: 'شروع خروج' }));
    expect(await toasts().findByText('چک‌لیست خروج باز شد')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ورود و خروج' }));
    expect(
      await screen.findByRole('progressbar', { name: '۰ از ۷ انجام شده' }),
    ).toBeInTheDocument();
  });

  it('changes a salary from today', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/1');
    await user.click(await screen.findByRole('button', { name: 'قرارداد و حقوق' }));
    await user.click(screen.getByRole('button', { name: 'تغییر حقوق' }));
    const dialog = await screen.findByRole('dialog', { name: 'تغییر حقوق' });
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '36000000');
    await user.click(within(dialog).getByRole('button', { name: 'ثبت حقوق' }));
    expect(await toasts().findByText('حقوق ثبت شد')).toBeInTheDocument();
    const pay = screen.getByRole('region', { name: 'حقوق و مزایا' });
    expect(within(pay).getAllByText('۳۶٬۰۰۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
  });

  it('shows the staff’s days on the calendar beside my tasks', async () => {
    loginAs(AMIR);
    renderApp('/hr/calendar');
    expect(await screen.findByRole('heading', { name: 'تقویم', level: 1 })).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: /ورود بهار نیکو/ })).not.toHaveLength(0);
  });

  it('shows the org chart: each position under the one it reports to', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'چارت سازمانی' }));
    const manager = await screen.findByRole('region', { name: 'مدیر فروش' });
    expect(within(manager).getByText('خالی')).toBeInTheDocument();
    const sellers = screen.getByRole('region', { name: 'کارشناس فروش' });
    expect(within(sellers).getByRole('link', { name: /علی رضایی/ })).toBeInTheDocument();
    expect(within(sellers).getByRole('link', { name: /مریم کریمی/ })).toBeInTheDocument();
    expect(screen.getByText('بدون سمت (۱)')).toBeInTheDocument();
  });
});

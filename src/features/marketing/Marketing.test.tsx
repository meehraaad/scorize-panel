import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const ELHAM = 7; // marketing team (src/mocks/marketing.ts)
const AMIR = 6; // superuser: the marketing manager too (src/mocks/marketingBoard.ts)
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

describe('marketing board', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the manager’s stages as lanes with their cards', async () => {
    loginAs(ELHAM);
    renderApp('/marketing/board');
    const board = await screen.findByRole('region', { name: 'مرحله‌های بُرد' });
    const making = within(board).getByRole('region', { name: 'در حال تولید' });
    expect(
      within(making).getByRole('button', { name: 'باز کردن «ریلز «پذیرش بدون آیلتس در آلمان»»' }),
    ).toBeInTheDocument();
    expect(within(making).getByText('۱ از ۶')).toBeInTheDocument();
    const review = within(board).getByRole('region', { name: 'بازبینی مدیر' });
    expect(
      within(review).getByText('فقط مدیر مارکتینگ کارت را از این مرحله بیرون می‌برد'),
    ).toBeInTheDocument();
  });

  it('moves a card on once its checklist is done', async () => {
    const user = userEvent.setup();
    loginAs(ELHAM);
    renderApp('/marketing/board?card=2');
    const dialog = await screen.findByRole('dialog', { name: 'ریلز «پذیرش بدون آیلتس در آلمان»' });
    expect(within(dialog).getByText('اول لازم است: چک‌لیست کامل')).toBeInTheDocument();
    const next = within(dialog).getByRole('button', { name: 'بردن به «بازبینی مدیر»' });
    expect(next).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'ضبط' }));
    await waitFor(() => {
      expect(within(dialog).getByRole('checkbox', { name: 'ضبط' })).toBeChecked();
    });
    await user.click(within(dialog).getByRole('checkbox', { name: 'تدوین' }));
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'بردن به «بازبینی مدیر»' })).toBeEnabled();
    });
    await user.click(within(dialog).getByRole('button', { name: 'بردن به «بازبینی مدیر»' }));
    expect(await toasts().findByText('کارت به «بازبینی مدیر» رفت')).toBeInTheDocument();
  });

  it('shows the owner the manager’s note on a card sent back', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/marketing/board?card=3');
    const dialog = await screen.findByRole('dialog', { name: 'کاروسل «۵ اشتباه رایج در SOP»' });
    await user.type(within(dialog).getByLabelText('یادداشت برای مسئول'), 'فونت تیتر خوانا نیست');
    await user.click(within(dialog).getByRole('button', { name: 'برگرداندن با یادداشت' }));
    expect(await toasts().findByText('کارت برگردانده شد')).toBeInTheDocument();
    expect(within(dialog).getByText('مدیر برگرداند: «فونت تیتر خوانا نیست»')).toBeInTheDocument();
  });

  it('leaves a card in review to the manager', async () => {
    loginAs(ELHAM);
    renderApp('/marketing/board?card=3');
    const dialog = await screen.findByRole('dialog', { name: 'کاروسل «۵ اشتباه رایج در SOP»' });
    expect(
      within(dialog).getByText('فقط مدیر مارکتینگ کارت را از «بازبینی مدیر» بیرون می‌برد.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^بردن به/ })).not.toBeInTheDocument();
  });

  it('makes a new card with its type’s checklist', async () => {
    const user = userEvent.setup();
    loginAs(ELHAM);
    renderApp('/marketing/board');
    await user.click(await screen.findByRole('button', { name: 'کارت تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارت تازه' });
    await user.type(within(dialog).getByLabelText('عنوان'), 'استوری شمارش معکوس');
    await user.click(within(dialog).getByRole('button', { name: 'ساختن کارت' }));
    expect(await toasts().findByText('کارت ساخته شد')).toBeInTheDocument();
    const card = await screen.findByRole('dialog', { name: 'استوری شمارش معکوس' });
    expect(within(card).getByRole('checkbox', { name: 'سناریو' })).not.toBeChecked();
  });

  it('keeps the manager’s area for the manager', async () => {
    loginAs(ELHAM);
    renderApp('/marketing/manage/stages');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'مدیریت مارکتینگ' })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('heading', { name: 'امروز', level: 1 })).toBeInTheDocument();
  });

  it('lets the manager approve a card waiting for review', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/marketing/manage');
    const review = await screen.findByRole('region', { name: /منتظر بازبینی شما/ });
    await user.click(
      within(review).getByRole('button', { name: 'تأیید و بردن به «آماده‌ی انتشار»' }),
    );
    expect(
      await toasts().findByText('«کاروسل «۵ اشتباه رایج در SOP»» تأیید شد'),
    ).toBeInTheDocument();
  });

  it('lets the manager change a stage', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/marketing/manage/stages');
    await user.click(await screen.findByRole('button', { name: /^برنامه‌ریزی/ }));
    const form = await screen.findByRole('region', { name: 'مرحله‌ی «برنامه‌ریزی»' });
    const name = within(form).getByLabelText('نام مرحله');
    await user.clear(name);
    await user.type(name, 'برنامه و سناریو');
    await user.click(within(form).getByRole('button', { name: 'ذخیره‌ی مرحله' }));
    expect(await toasts().findByText('مرحله ذخیره شد')).toBeInTheDocument();
  });
});

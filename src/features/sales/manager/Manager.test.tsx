import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { api } from '@/lib/api/client';
import type { AssignData, TeamData } from '../api';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

// The quiz funnel follows the quiz (src/lib/applicant/onServer.ts): switch everything on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const NIMA = 3; // seller
const REZA = 4; // sales manager (can_assign_to_seller)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const salesNav = () => screen.getAllByRole('navigation', { name: 'منوی پنل فروش' })[0];

describe('sales manager section', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('is hidden from sellers, and its pages send them home', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
    expect(
      within(salesNav() as HTMLElement).queryByRole('link', { name: 'مدیریت فروش' }),
    ).not.toBeInTheDocument();
  });

  it('assigns unowned leads, one or all as suggested', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager');
    expect(await screen.findByRole('heading', { name: '۴ لید بی‌صاحب است' })).toBeInTheDocument();
    expect(
      within(salesNav() as HTMLElement).getByRole('link', { name: 'مدیریت فروش' }),
    ).toBeInTheDocument();

    const queue = screen.getByRole('region', { name: 'صف بی‌صاحب' });
    await user.selectOptions(within(queue).getByLabelText('فروشنده برای آیدا شفیعی'), '8');
    await user.click(within(queue).getAllByRole('button', { name: 'تخصیص' })[0] as HTMLElement);
    expect(await screen.findByRole('heading', { name: '۳ لید بی‌صاحب است' })).toBeInTheDocument();

    await user.click(within(queue).getByRole('button', { name: 'تخصیص پیشنهادی برای همه' }));
    expect(
      await screen.findByRole('heading', { name: 'همه‌ی لیدها صاحب دارند' }),
    ).toBeInTheDocument();
  });

  it('disables assignment when every seller is away and no suggestion exists', async () => {
    loginAs(REZA);
    const data = await api<AssignData>('/sales/v1/manager/assign/');
    server.use(
      http.get('/api/sales/v1/manager/assign/', () =>
        HttpResponse.json({
          ...data,
          sellers: data.sellers.map((seller) => ({
            ...seller,
            status: 'away',
            response_minutes: null,
          })),
          queue: {
            ...data.queue,
            results: data.queue.results.map((lead) => ({ ...lead, suggested: null })),
          },
        }),
      ),
    );
    renderApp('/sales/manager');
    const queue = await screen.findByRole('region', { name: 'صف بی‌صاحب' });
    expect(within(queue).getByRole('button', { name: 'تخصیص پیشنهادی برای همه' })).toBeDisabled();
    for (const button of within(queue).getAllByRole('button', { name: 'تخصیص' })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getAllByText('داده‌ی تماس موجود نیست')).toHaveLength(data.sellers.length);
  });

  it('ranks by wins with ties, and displays unset targets and missing measurements honestly', async () => {
    loginAs(REZA);
    const data = await api<TeamData>('/sales/v1/manager/team/?range=month');
    const seller = data.sellers[0];
    server.use(
      http.get('/api/sales/v1/manager/team/', () =>
        HttpResponse.json({
          ...data,
          target: 0,
          first_call_minutes: null,
          sales_change: null,
          sellers: [
            { ...seller, id: 1, name: 'A', won: 1, target: 0, first_call_minutes: null },
            { ...seller, id: 2, name: 'B', won: 3, target: 0, first_call_minutes: 0 },
            { ...seller, id: 3, name: 'C', won: 3, target: 0, first_call_minutes: null },
          ],
        }),
      ),
    );
    renderApp('/sales/manager/team');
    const board = await screen.findByRole('region', { name: 'رتبه‌بندی فروشنده‌ها' });
    const rows = within(board).getAllByRole('row').slice(1);
    rows.forEach((row, index) => {
      expect(within(row).getByRole('rowheader')).toHaveAccessibleName(['B', 'C', 'A'][index]);
    });
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      '۱',
      '۱',
      '۳',
    ]);
    expect(within(board).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(board).getByText('۰ دقیقه')).toBeInTheDocument();
    expect(within(board).getAllByText('داده‌ی تماس موجود نیست')).toHaveLength(2);
    expect(screen.getByText('هدف تعیین نشده')).toBeInTheDocument();
    expect(screen.getByText('برای محاسبه‌ی رشد، فروشی در دوره‌ی قبل ثبت نشده')).toBeInTheDocument();
  });

  it('returning a draft needs a note; approving opens it for the customer', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/approvals');
    expect(
      await screen.findByRole('heading', { name: '۱ پیش‌نویس قرارداد منتظر شماست' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/از سقف ۱۰٪ فروشنده بیشتر است/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'بازگرداندن به فروشنده' }));
    expect(screen.getByText('برای بازگرداندن یا رد، توضیح بنویسید.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'تأیید و ارسال به پنل مشتری' }));
    expect(
      await screen.findByRole('heading', { name: 'پیش‌نویسی منتظر نیست' }),
    ).toBeInTheDocument();
  });

  it('team report and follow-up health: remind and hand over an old task', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/team');
    expect(await screen.findByRole('region', { name: 'رتبه‌بندی فروشنده‌ها' })).toHaveTextContent(
      'مهدی توکلی',
    );
    await user.click(screen.getByRole('link', { name: 'سلامت پیگیری' }));
    const oldest = await screen.findByRole('region', { name: 'قدیمی‌ترین عقب‌افتاده‌ها' });
    await user.click(
      within(oldest).getAllByRole('button', { name: 'یادآوری به کاوه' })[0] as HTMLElement,
    );
    expect(await within(oldest).findByText('یادآوری رفت')).toBeInTheDocument();

    await user.click(
      within(oldest).getAllByRole('button', { name: 'سپردن به دیگری' })[0] as HTMLElement,
    );
    await user.selectOptions(within(oldest).getByLabelText('به'), '33');
    await user.click(within(oldest).getByRole('button', { name: 'بسپار' }));
    expect(await within(oldest).findByText(/مسئول: امید رنجبر/)).toBeInTheDocument();
  });

  it('shows the quiz funnel with the step that loses the most people', async () => {
    loginAs(REZA);
    renderApp('/sales/manager/team');
    const funnel = await screen.findByRole('region', { name: 'پرسش‌نامه‌ی شانس پذیرش' });
    expect(within(funnel).getByText('پرسش‌نامه را باز کردند')).toBeInTheDocument();
    expect(within(funnel).getByText('۱۲۰')).toBeInTheDocument();
    expect(
      within(funnel).getByText('بیشترین ریزش پیش از «تا آخر جواب دادند»: ۴۰٪ از دست رفتند.'),
    ).toBeInTheDocument();
    expect(
      within(funnel).getByText(
        '۲۵ نفر از ۱۲۰ نفری که پرسش‌نامه را تمام کردند، کار یا زندگی در خارج را هم می‌خواهند.',
      ),
    ).toBeInTheDocument();
  });
});

describe('board stages (S48)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('the manager renames, adds a stage with a required note, and sellers see it on the board', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/stages');
    expect(
      await screen.findByRole('heading', { name: 'مرحله‌ها و فعالیت‌ها' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^تماس گرفته شد/ }));
    const name = screen.getByLabelText('نام مرحله');
    await user.clear(name);
    await user.type(name, 'تماس اول');

    await user.click(screen.getByRole('button', { name: 'مرحله‌ی تازه' }));
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('به هر مرحله یک نام بدهید.');
    await user.type(screen.getByLabelText('نام مرحله'), 'مذاکره');
    await user.click(screen.getByRole('button', { name: 'ثبت یادداشت' }));
    await user.click(screen.getByRole('switch', { name: /^اجباری/ }));
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(
      await screen.findByText('مرحله‌ها ذخیره شد و تابلوی همه‌ی تیم به‌روز شد.'),
    ).toBeInTheDocument();

    cleanup();
    renderApp('/sales/board');
    expect(await screen.findByRole('region', { name: 'تماس اول' })).toBeInTheDocument();
    const negotiation = screen.getByRole('region', { name: 'مذاکره' });
    expect(within(negotiation).getByText('ثبت یادداشت')).toBeInTheDocument();
    expect(screen.getByLabelText('فروشنده')).toBeInTheDocument();
  });

  it('a stage that has cards asks where they go before it is removed', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/stages');
    await user.click(await screen.findByRole('button', { name: /^مشاوره شد/ }));
    expect(screen.getByText(/بعد از حذف باید مقصدشان را انتخاب کنید/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'حذف مرحله' }));
    await user.click(screen.getByRole('button', { name: 'مرحله‌ی تازه' }));
    await user.type(screen.getByLabelText('نام مرحله'), 'جلسه برگزار شد');
    await user.selectOptions(screen.getByLabelText('در گزارش‌ها جزو'), 'consulted');
    await user.click(screen.getByRole('button', { name: /^جلسه برگزار شد/ }));
    await user.click(screen.getByRole('button', { name: 'بردن جلسه برگزار شد به بالا' }));
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/^مقصد کارت‌های مشاوره شد/);
    await user.selectOptions(
      screen.getByLabelText(/^کارت‌های «مشاوره شد»/),
      '503', // «پیشنهاد ارسال شد» (src/mocks/sales.ts)
    );
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(
      await screen.findByText('مرحله‌ها ذخیره شد و تابلوی همه‌ی تیم به‌روز شد.'),
    ).toBeInTheDocument();
  });
});

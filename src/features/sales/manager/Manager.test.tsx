import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { api } from '@/lib/api/client';
import type { AssignData, TeamData } from '../api';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

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

  it('sets working hours and the wait for a first call', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    const saved: unknown[] = [];
    server.use(
      http.put('/api/sales/v1/manager/assign/settings/', async ({ request }) => {
        saved.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/sales/manager');
    const start = await screen.findByLabelText('شروع ساعت کاری');
    expect(screen.queryByLabelText('پایان ساعت کاری')).toBeNull();
    await user.selectOptions(start, '08:30');
    await user.selectOptions(screen.getByLabelText('پایان ساعت کاری'), '20:00');
    expect(saved.at(-1)).toMatchObject({ day_start: '08:30', day_end: '20:00' });
    expect(screen.getByText(/بیرون از ساعت کاری، لید تازه در صف می‌ماند/)).toBeInTheDocument();
    await user.selectOptions(start, 'any');
    expect(saved.at(-1)).toMatchObject({ day_start: null, day_end: null });
    await user.selectOptions(screen.getByLabelText('اگر کسی تماس نگرفت، صبر تا'), '۴ ساعت');
    expect(saved.at(-1)).toMatchObject({ escalate_after: 240 });
  });

  it('adds leads from a CSV after showing what each row does', async () => {
    const user = userEvent.setup({ applyAccept: false });
    loginAs(REZA);
    renderApp('/sales/manager');
    await user.click(await screen.findByRole('button', { name: 'افزودن از فایل CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'افزودن لید از فایل CSV' });
    expect(within(dialog).getByRole('link', { name: 'دریافت فایل نمونه' })).toHaveAttribute(
      'href',
      '/api/sales/v1/manager/leads/import/sample/',
    );

    await user.upload(
      within(dialog).getByLabelText('انتخاب فایل CSV'),
      new File(['x'], 'leads.xlsx', { type: 'application/vnd.ms-excel' }),
    );
    expect(within(dialog).getByText('فقط فایل CSV.')).toBeInTheDocument();

    const csv = [
      'شماره,نام,نام خانوادگی',
      '۰۹۱۲۱۱۱۱۱۱۱,سارا,احمدی',
      '+989120000001,,',
      '09120000002,,',
      '12,,',
      '09121111111,,',
    ].join('\n');
    await user.upload(
      within(dialog).getByLabelText('انتخاب فایل CSV'),
      new File([csv], 'expo.csv', { type: 'text/csv' }),
    );
    const summary = await within(dialog).findByRole('list', { name: 'خلاصه‌ی فایل' });
    expect(within(summary).getByText('۱ مشتری تازه')).toBeInTheDocument();
    expect(within(summary).getByText('۱ مشتری قبلی')).toBeInTheDocument();
    expect(within(summary).getByText('۳ ردیف کنار گذاشته شد')).toBeInTheDocument();
    expect(within(dialog).getByText('لید باز دارد')).toBeInTheDocument();
    expect(within(dialog).getByText('شماره نامعتبر')).toBeInTheDocument();
    expect(within(dialog).getByText('شماره تکراری در فایل')).toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText('یادداشت برای همه‌ی لیدها (اختیاری)'),
      'نمایشگاه',
    );
    await user.click(within(dialog).getByRole('button', { name: 'افزودن ۲ لید' }));
    expect(await within(dialog).findByText('۲ لید ثبت شد (۱ مشتری تازه).')).toBeInTheDocument();
    await user.click(within(dialog).getAllByRole('button', { name: 'بستن' }).at(-1) as HTMLElement);

    // They wait in the queue for a seller.
    expect(await screen.findByRole('heading', { name: '۶ لید بی‌صاحب است' })).toBeInTheDocument();
  });

  it('lets the manager choose who gets leads automatically', async () => {
    loginAs(REZA);
    const user = userEvent.setup();
    renderApp('/sales/manager');
    const who = await screen.findByRole('group', { name: 'چه کسانی لید خودکار بگیرند' });
    const sara = within(who).getByRole('checkbox', { name: 'سارا جهانی' });
    expect(sara).toBeChecked();
    await user.click(sara);
    const loads = screen.getByRole('region', { name: 'بار کاری فروشنده‌ها، همین الان' });
    expect(
      await within(within(loads).getByLabelText('سارا جهانی')).findByText(/بدون تخصیص خودکار/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'چه کسانی لید خودکار بگیرند' })).getByRole(
        'checkbox',
        { name: 'سارا جهانی' },
      ),
    ).not.toBeChecked();
  });

  it("shows each seller's two extensions and hides a seller until shown again", async () => {
    loginAs(REZA);
    const user = userEvent.setup();
    renderApp('/sales/manager');
    const loads = await screen.findByRole('region', { name: 'بار کاری فروشنده‌ها، همین الان' });
    const nima = within(loads).getByLabelText('نیما رستمی');
    expect(within(nima).getByText('۲۵۰')).toBeInTheDocument();
    expect(within(nima).getByText('۳۰۱')).toBeInTheDocument();

    await user.click(
      within(nima).getByRole('button', { name: 'پنهان کردن نیما رستمی از این فهرست' }),
    );
    expect(await toasts().findByText('نیما رستمی از این فهرست پنهان شد.')).toBeInTheDocument();
    const shown = await within(loads).findByRole('button', { name: 'پنهان‌شده‌ها (۱)' });
    expect(within(loads).queryByLabelText('نیما رستمی')).not.toBeInTheDocument();

    await user.click(shown);
    await user.click(
      within(within(loads).getByLabelText('نیما رستمی')).getByRole('button', {
        name: 'نمایش دوباره‌ی نیما رستمی',
      }),
    );
    expect(await toasts().findByText('نیما رستمی دوباره نمایش داده می‌شود.')).toBeInTheDocument();
    expect(
      await within(loads).findByRole('button', { name: 'پنهان کردن نیما رستمی از این فهرست' }),
    ).toBeInTheDocument();
    expect(within(loads).queryByRole('button', { name: /پنهان‌شده‌ها/ })).not.toBeInTheDocument();
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

  it("team: a seller's contracts, and moving one with a reason", async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/team');
    await user.click(await screen.findByRole('button', { name: 'قراردادهای مهدی توکلی' }));
    const dialog = await screen.findByRole('dialog', { name: 'قراردادهای مهدی توکلی' });
    expect(await within(dialog).findByText('سارا حیدری')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'انتقال قرارداد سارا حیدری' }));
    // The reason is required: it goes on the customer's history.
    await user.click(within(dialog).getByRole('button', { name: 'انتقال قرارداد' }));
    expect(within(dialog).getByText('دلیل انتقال را بنویسید.')).toBeInTheDocument();
    const to = within(dialog).getByLabelText('به نام');
    await user.selectOptions(to, within(to).getAllByRole('option')[1] as HTMLOptionElement);
    await user.type(within(dialog).getByLabelText('دلیل'), 'جلسه را او برگزار کرد');
    await user.click(within(dialog).getByRole('button', { name: 'انتقال قرارداد' }));
    expect(await toasts().findByText('قرارداد منتقل شد.')).toBeInTheDocument();
    expect(
      await within(dialog).findByText('در این بازه قراردادی به نام این فروشنده نیست.'),
    ).toBeInTheDocument();
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

describe('commission rules (S60)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('the manager adds a step for one seller, refuses a repeated one, changes and removes', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/commission');
    expect(await screen.findByRole('heading', { name: 'قانون‌های پورسانت' })).toBeInTheDocument();
    // Each change refetches the rules: find the groups again after it.
    const group = (name: string) => screen.getByRole('region', { name });
    expect(
      within(group('همه‌ی فروشنده‌ها')).getByText('با ۴ قرارداد یا بیشتر در ماه: ۲٪ از فروش ماه'),
    ).toBeInTheDocument();

    const form = screen.getByRole('form', { name: 'قانون تازه' });
    await user.type(within(form).getByLabelText('حداقل تعداد قرارداد'), '۴');
    await user.type(within(form).getByLabelText('درصد پورسانت'), '۵');
    await user.click(within(form).getByRole('button', { name: 'افزودن قانون' }));
    expect(
      await within(form).findByText('There is already a rule for this step.'),
    ).toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('برای'), '31');
    await user.selectOptions(within(form).getByLabelText('بر اساس'), 'sales');
    await user.type(within(form).getByLabelText('حداقل فروش (میلیون تومان)'), '900');
    await user.clear(within(form).getByLabelText('درصد پورسانت'));
    await user.type(within(form).getByLabelText('درصد پورسانت'), '5');
    await user.click(within(form).getByRole('button', { name: 'افزودن قانون' }));
    expect(await toasts().findByText('قانون اضافه شد')).toBeInTheDocument();
    expect(
      within(await screen.findByRole('region', { name: 'مهدی توکلی' })).getByText(
        /^با ۹۰۰ میلیون تومان فروش یا بیشتر/,
      ),
    ).toBeInTheDocument();

    await user.click(
      within(group('همه‌ی فروشنده‌ها')).getByRole('button', {
        name: 'ویرایش «با ۴ قرارداد یا بیشتر در ماه: ۲٪ از فروش ماه»',
      }),
    );
    const edit = within(group('همه‌ی فروشنده‌ها')).getByRole('form', { name: 'ویرایش قانون' });
    await user.clear(within(edit).getByLabelText('درصد پورسانت'));
    await user.type(within(edit).getByLabelText('درصد پورسانت'), '2.5');
    await user.click(within(edit).getByRole('button', { name: 'ذخیره' }));
    // The form shows the rule as typed: wait for it to close, then read the saved row.
    expect(await toasts().findByText('قانون از این ماه عوض شد')).toBeInTheDocument();
    await vi.waitFor(() => expect(edit).not.toBeInTheDocument());
    expect(
      within(group('همه‌ی فروشنده‌ها')).getByText('با ۴ قرارداد یا بیشتر در ماه: ۲٫۵٪ از فروش ماه'),
    ).toBeInTheDocument();

    await user.click(within(group('مهدی توکلی')).getByRole('button', { name: /^حذف/ }));
    await user.click(within(group('مهدی توکلی')).getByRole('button', { name: 'بردار' }));
    await vi.waitFor(() =>
      expect(screen.queryByRole('region', { name: 'مهدی توکلی' })).not.toBeInTheDocument(),
    );
  });

  it('adds tiered steps on the sales amount or the contracts, and lists the fixed bonus', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/commission');
    const everyone = await screen.findByRole('region', { name: 'همه‌ی فروشنده‌ها' });
    expect(
      within(everyone).getByText('با ۱۰ قرارداد یا بیشتر در ماه: ۵ میلیون تومان پاداش'),
    ).toBeInTheDocument();

    const form = screen.getByRole('form', { name: 'قانون تازه' });
    await user.selectOptions(within(form).getByLabelText('نوع پاداش'), 'tiered');
    await user.type(within(form).getByLabelText('حداقل تعداد قرارداد'), '5');
    await user.type(within(form).getByLabelText('درصد پورسانت'), '3');
    expect(within(form).getByText('از قرارداد ۵ به بعد: هر قرارداد ۳٪')).toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('بر اساس'), 'sales');
    await user.clear(within(form).getByLabelText('درصد پورسانت'));
    await user.type(within(form).getByLabelText('حداقل فروش (میلیون تومان)'), '300');
    await user.type(within(form).getByLabelText('درصد پورسانت'), '2');
    await user.click(within(form).getByRole('button', { name: 'افزودن قانون' }));
    expect(await toasts().findByText('قانون اضافه شد')).toBeInTheDocument();
    expect(
      await within(screen.getByRole('region', { name: 'همه‌ی فروشنده‌ها' })).findByText(
        'از ۳۰۰ میلیون تومان فروش به بالا: ۲٪ از همین بخش فروش',
      ),
    ).toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('نوع پاداش'), 'per_contract');
    await user.selectOptions(within(form).getByLabelText('بر اساس'), 'contracts');
    await user.type(within(form).getByLabelText('حداقل تعداد قرارداد'), '6');
    await user.type(within(form).getByLabelText('مبلغ هر قرارداد (میلیون تومان)'), '1.5');
    expect(
      within(form).getByText('با ۶ قرارداد یا بیشتر در ماه: ۱٫۵ میلیون تومان برای هر قرارداد'),
    ).toBeInTheDocument();
  });

  it("the team report shows each seller's commission", async () => {
    loginAs(REZA);
    renderApp('/sales/manager/team');
    const board = await screen.findByRole('region', { name: 'رتبه‌بندی فروشنده‌ها' });
    expect(within(board).getByRole('columnheader', { name: 'پورسانت' })).toBeInTheDocument();
    // Mahdi: 9 contracts and 820 million reach the 700 million step (4%).
    const mahdi = within(board).getByRole('row', { name: /مهدی توکلی/ });
    expect(mahdi).toHaveTextContent('۳۲٫۸ میلیون تومان');
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

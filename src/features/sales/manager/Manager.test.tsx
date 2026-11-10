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

  it('offers sellers on leave, and disables assignment until one is chosen', async () => {
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
    for (const choose of within(queue).getAllByRole('combobox')) {
      for (const seller of data.sellers) {
        expect(within(choose).getByRole('option', { name: seller.name })).toBeInTheDocument();
      }
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

  it('the manager reviews only the clauses the seller changed, and after a return only what changed since', async () => {
    const user = userEvent.setup();
    loginAs(NIMA);
    // The text is the third step of building the contract (S71).
    renderApp('/sales/customers/105/offer?step=3');
    await screen.findByRole('heading', { level: 1, name: 'قرارداد استاندارد' });
    const clauses = screen.getByRole('region', { name: 'متن قرارداد' });
    // Named as the contract prints them (S69).
    await user.click(within(clauses).getByRole('button', { name: 'ویرایش ماده ۳: فسخ قرارداد' }));
    const text = within(clauses).getByLabelText('متن بند');
    await user.clear(text);
    await user.type(
      text,
      'تا ۱۴ روز پس از امضا، با فسخ قرارداد کل مبلغ پرداختی بازگردانده می‌شود.',
    );
    await user.click(within(clauses).getByRole('button', { name: 'حذف ماده ۲: تعهدات متقاضی' }));
    expect(within(clauses).getByText('۲ بند تغییر کرده · ۰ بند اضافه شده')).toBeInTheDocument();
    await user.click(within(clauses).getByRole('button', { name: '+ ماده‌ی تازه' }));
    expect(screen.getByText('هر بند متن می‌خواهد و ماده‌ی تازه عنوان هم.')).toBeInTheDocument();
    await user.type(within(clauses).getByLabelText('عنوان ماده'), 'بورسیه');
    await user.type(within(clauses).getByLabelText('متن بند'), 'با بورسیه، قسط آخر ۱۰٪ کمتر.');
    await user.click(screen.getByRole('button', { name: 'رفتن به «پیش‌نمایش و ارسال»' }));
    await user.click(
      await screen.findByRole('button', { name: 'ارسال پیش‌نویس قرارداد برای تأیید مدیر' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'عرفان ملکی' });

    cleanup();
    loginAs(REZA);
    renderApp('/sales/manager/approvals');
    await user.click(await screen.findByRole('button', { name: /^عرفان ملکی/ }));
    const changes = await screen.findByRole('region', { name: 'تغییرات متن قرارداد' });
    expect(within(changes).getByText(/۳ بند با قرارداد استاندارد فرق دارد/)).toBeInTheDocument();
    // Word by word: the 7 days became 14, the rest is as the standard says.
    expect(changes.querySelector('del')).toHaveTextContent('۷');
    expect(changes.querySelector('ins')).toHaveTextContent('۱۴');
    expect(within(changes).getByText('حذف شده')).toBeInTheDocument();
    expect(within(changes).getByText('بند جدید')).toBeInTheDocument();
    expect(within(changes).queryByText('موضوع قرارداد')).not.toBeInTheDocument(); // unchanged
    await user.type(screen.getByLabelText(/توضیح برای فروشنده/), 'بند بورسیه را بردار');
    await user.click(screen.getByRole('button', { name: 'بازگرداندن به فروشنده' }));

    cleanup();
    loginAs(NIMA);
    renderApp('/sales/customers/105/offer?step=3');
    await screen.findByRole('heading', { level: 1, name: 'قرارداد استاندارد' });
    await user.click(screen.getByRole('button', { name: /^حذف ماده .: بورسیه$/ }));
    await user.click(screen.getByRole('button', { name: 'رفتن به «خدمات و جزئیات»' }));
    const applies = await screen.findByLabelText('تعداد اپلای');
    await user.clear(applies);
    await user.type(applies, '4');
    await user.click(screen.getByRole('button', { name: 'رفتن به «پیش‌نمایش و ارسال»' }));
    await user.click(
      await screen.findByRole('button', { name: 'ارسال پیش‌نویس قرارداد برای تأیید مدیر' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'عرفان ملکی' });

    cleanup();
    loginAs(REZA);
    renderApp('/sales/manager/approvals');
    await user.click(await screen.findByRole('button', { name: /^عرفان ملکی/ }));
    expect(await screen.findByText(/یک بار برگشت خورده/)).toBeInTheDocument();
    expect(screen.getByText('قبلاً: 6')).toBeInTheDocument(); // the mock doesn't localize digits
    const after = screen.getByRole('region', { name: 'تغییرات متن قرارداد' });
    expect(within(after).getByText(/۲ بند با قرارداد استاندارد فرق دارد/)).toBeInTheDocument();
    expect(within(after).queryByText('تغییر بعد از برگشت')).not.toBeInTheDocument();
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

  it('the manager adds a range for one seller, refuses an overlapping one, changes and removes', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/commission');
    expect(await screen.findByRole('heading', { name: 'قانون‌های پورسانت' })).toBeInTheDocument();
    // Each change refetches the rules: find the groups again after it.
    const group = (name: string) => screen.getByRole('region', { name });
    expect(
      within(group('همه‌ی فروشنده‌ها')).getByText(
        'با ۴ تا کمتر از ۸ قرارداد در ماه: ۲٪ از فروش ماه',
      ),
    ).toBeInTheDocument();

    const form = screen.getByRole('form', { name: 'قانون تازه' });
    await user.type(within(form).getByLabelText('از چند قرارداد'), '۴');
    await user.type(within(form).getByLabelText('درصد پورسانت'), '۵');
    await user.click(within(form).getByRole('button', { name: 'افزودن قانون' }));
    expect(await within(form).findByText('This range overlaps another rule.')).toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('برای'), '31');
    await user.selectOptions(within(form).getByLabelText('بر اساس'), 'sales');
    await user.type(within(form).getByLabelText('از فروش (میلیون تومان)'), '900');
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
        name: 'ویرایش «با ۴ تا کمتر از ۸ قرارداد در ماه: ۲٪ از فروش ماه»',
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
      within(group('همه‌ی فروشنده‌ها')).getByText(
        'با ۴ تا کمتر از ۸ قرارداد در ماه: ۲٫۵٪ از فروش ماه',
      ),
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
    await user.type(within(form).getByLabelText('از چند قرارداد'), '5');
    await user.type(within(form).getByLabelText('درصد پورسانت'), '3');
    expect(within(form).getByText('از قرارداد ۵ به بعد: هر قرارداد ۳٪')).toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('بر اساس'), 'sales');
    await user.clear(within(form).getByLabelText('درصد پورسانت'));
    await user.type(within(form).getByLabelText('از فروش (میلیون تومان)'), '300');
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
    await user.type(within(form).getByLabelText('از چند قرارداد'), '6');
    await user.type(within(form).getByLabelText('مبلغ هر قرارداد (میلیون تومان)'), '1.5');
    expect(
      within(form).getByText('با ۶ قرارداد یا بیشتر در ماه: ۱٫۵ میلیون تومان برای هر قرارداد'),
    ).toBeInTheDocument();
  });

  it('adds sales ranges in euro: 0 to 4,000 at 4%, from 4,000 up at 5%', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/commission');
    const form = await screen.findByRole('form', { name: 'قانون تازه' });
    // For one seller: the team's own "700 million or more" would overlap "4,000 euros or more".
    await user.selectOptions(within(form).getByLabelText('برای'), '31');
    await user.selectOptions(within(form).getByLabelText('بر اساس'), 'sales');
    await user.selectOptions(within(form).getByLabelText('واحد پول'), 'EUR');
    await user.type(within(form).getByLabelText('از فروش (یورو)'), '0');
    await user.type(within(form).getByLabelText('تا کمتر از (یورو)'), '4000');
    await user.type(within(form).getByLabelText('درصد پورسانت'), '4');
    expect(
      within(form).getByText('با فروش ماه از ۰ یورو تا کمتر از ۴٬۰۰۰ یورو: ۴٪ از فروش ماه'),
    ).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'افزودن قانون' }));
    expect(await toasts().findByText('قانون اضافه شد')).toBeInTheDocument();

    // "Up to" must be above "from".
    await user.type(within(form).getByLabelText('از فروش (یورو)'), '4000');
    await user.type(within(form).getByLabelText('تا کمتر از (یورو)'), '3000');
    await user.type(within(form).getByLabelText('درصد پورسانت'), '5');
    await user.click(within(form).getByRole('button', { name: 'افزودن قانون' }));
    expect(within(form).getByText('«تا» باید از «از» بیشتر باشد.')).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('تا کمتر از (یورو)'));
    expect(
      within(form).getByText('با ۴٬۰۰۰ یورو فروش یا بیشتر در ماه: ۵٪ از فروش ماه'),
    ).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'افزودن قانون' }));
    const mahdi = await screen.findByRole('region', { name: 'مهدی توکلی' });
    expect(
      await within(mahdi).findByText('با ۴٬۰۰۰ یورو فروش یا بیشتر در ماه: ۵٪ از فروش ماه'),
    ).toBeInTheDocument();
    expect(
      within(mahdi).getByText('با فروش ماه از ۰ یورو تا کمتر از ۴٬۰۰۰ یورو: ۴٪ از فروش ماه'),
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

describe('contract builder and agreement desk (S64)', () => {
  beforeEach(() => {
    loginAs(REZA);
  });

  it('the manager adds a fixed clause, orders it and reads it in the versions', async () => {
    const user = userEvent.setup();
    renderApp('/sales/manager/contract');
    // The editor's list comes first; the preview's sheet has the same heading.
    const clauses = await screen.findByRole('region', { name: 'متن قرارداد' });
    expect(within(clauses).getByText('ماده ۱: موضوع قرارداد')).toBeInTheDocument();
    await user.click(within(clauses).getByRole('button', { name: '+ ماده، بند یا تبصره' }));
    await user.click(within(clauses).getByRole('radio', { name: 'ماده' }));
    await user.type(within(clauses).getByLabelText('عنوان ماده'), 'بورسیه');
    await user.type(
      within(clauses).getByLabelText('متن ماده (اختیاری)'),
      'با بورسیه، قسط آخر کمتر.',
    );
    await user.click(within(clauses).getByRole('switch', { name: /بند ثابت/ }));
    await user.click(within(clauses).getByRole('button', { name: 'ذخیره' }));
    expect(await within(clauses).findByText('ماده ۵: بورسیه')).toBeInTheDocument();

    await user.click(within(clauses).getByRole('button', { name: 'بالا بردن ماده ۵: بورسیه' }));
    // Above the last clauses and note of article ۴ it is still the fifth article…
    expect(await within(clauses).findByText('ماده ۵: بورسیه')).toBeInTheDocument();
    // …and the note after it now belongs to it.
    expect(within(clauses).getByText('تبصره ۱')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'نسخه‌ها' }));
    const versions = await screen.findByRole('region', { name: 'نسخه‌های متن قرارداد' });
    expect(within(versions).getByText('ترتیب بندها عوض شد')).toBeInTheDocument();
    expect(within(versions).getByText('ماده «بورسیه» اضافه شد')).toBeInTheDocument();
    expect(within(versions).getByText('متن پیش از اولین تغییر')).toBeInTheDocument();
  });

  it('rules are saved, and the desk holds the offer to them', async () => {
    const user = userEvent.setup();
    renderApp('/sales/manager/contract?tab=prices');
    const rules = await screen.findByRole('region', { name: 'قانون‌های پیشنهاد' });
    const prepayment = within(rules).getByLabelText('کمترین پیش‌پرداخت (٪)');
    await user.clear(prepayment);
    await user.type(prepayment, '50');
    await user.click(within(rules).getByRole('button', { name: 'ذخیره' }));
    expect(await screen.findByText('قانون‌ها ذخیره شد.')).toBeInTheDocument();

    cleanup();
    renderApp('/sales/manager/approvals');
    const figures = await screen.findByRole('region', { name: 'اعداد پیشنهاد' });
    expect(within(figures).getByText('کمترین ۵۰٪')).toBeInTheDocument();
    const parties = screen.getByRole('list', { name: 'موافقت‌ها' });
    expect(within(parties).getByText('فروشنده موافق')).toBeInTheDocument();
    expect(within(parties).getByText('منتظر شما')).toBeInTheDocument();
  });

  it('the preview shows a clause as it is typed, before it is saved (S68)', async () => {
    const user = userEvent.setup();
    renderApp('/sales/manager/contract');
    const preview = await screen.findByRole('region', { name: 'پیش‌نمایش قرارداد' });
    expect(within(preview).getByText(/موضوع قرارداد/)).toBeInTheDocument();
    const clauses = screen.getByRole('region', { name: 'متن قرارداد' });
    await user.click(within(clauses).getByRole('button', { name: '+ ماده، بند یا تبصره' }));
    await user.click(within(clauses).getByRole('radio', { name: 'ماده' }));
    await user.type(within(clauses).getByLabelText('عنوان ماده'), 'بورسیه');
    await user.type(within(clauses).getByLabelText('متن ماده (اختیاری)'), 'متن در حال نوشتن');
    expect(within(preview).getByText(/بورسیه/)).toBeInTheDocument();
    expect(within(preview).getByText('متن در حال نوشتن')).toBeInTheDocument();
    // The whole sheet opens full screen too.
    await user.click(within(preview).getByRole('button', { name: 'تمام‌صفحه' }));
    expect(await screen.findByRole('dialog', { name: 'پیش‌نمایش قرارداد' })).toBeInTheDocument();
  });

  it('the manager makes a second kind of contract as a copy and switches between them (S68)', async () => {
    const user = userEvent.setup();
    const router = renderApp('/sales/manager/contract');
    const kinds = await screen.findByRole('region', { name: 'نوع قرارداد' });
    await user.click(within(kinds).getByRole('button', { name: '+ قرارداد تازه' }));
    await user.type(within(kinds).getByLabelText('نام قرارداد'), 'فقط ویزا');
    await user.click(within(kinds).getByRole('radio', { name: /کپی از «قرارداد استاندارد»/ }));
    await user.click(within(kinds).getByRole('button', { name: 'ساختن قرارداد' }));
    expect(await screen.findByText('«فقط ویزا» ساخته شد.')).toBeInTheDocument();
    // It opens on the new one, with the standard text copied.
    await screen.findByRole('radio', { name: /فقط ویزا/, checked: true });
    expect(router.state.location.search).toMatch(/template=\d+/);
    const clauses = screen.getByRole('region', { name: 'متن قرارداد' });
    expect(within(clauses).getByText('ماده ۱: موضوع قرارداد')).toBeInTheDocument();
    // Back to the standard contract.
    await user.click(screen.getByRole('radio', { name: /^قرارداد استاندارد/ }));
    expect(router.state.location.search).not.toMatch(/template=/);
  });

  it('the manager reads the whole contract before approving (S68)', async () => {
    const user = userEvent.setup();
    renderApp('/sales/manager/approvals');
    await user.click(await screen.findByRole('button', { name: 'خواندن کل قرارداد' }));
    const dialog = await screen.findByRole('dialog', { name: /^قرارداد / });
    expect(within(dialog).getAllByText(/موضوع قرارداد/).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('link', { name: 'صفحه‌ی چاپ و PDF' })).toBeInTheDocument();
  });

  it('a seller picks the free Turkey contract: its own text, and nothing to pay (S68)', async () => {
    loginAs(NIMA);
    const user = userEvent.setup();
    renderApp('/sales/customers/105/offer');
    // The kind is changed with the same chooser as on the customer page (S71).
    await user.click(await screen.findByRole('button', { name: 'عوض کردن قرارداد' }));
    const dialog = await screen.findByRole('dialog', { name: 'کدام قرارداد؟' });
    await user.click(within(dialog).getByRole('radio', { name: /اپلای رایگان ترکیه/ }));
    await user.click(within(dialog).getByRole('button', { name: 'ادامه با «اپلای رایگان ترکیه»' }));
    await screen.findByRole('heading', { level: 1, name: 'اپلای رایگان ترکیه' });
    await user.click(screen.getByRole('button', { name: 'رفتن به «متن و متغیرها»' }));
    expect(
      await screen.findByText('تعهدنامه‌ی اپلای رایگان', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText('موضوع قرارداد', { exact: false })).not.toBeInTheDocument();
  });

  it('the sheet numbers clauses by their article and fills the variables (S69)', async () => {
    const user = userEvent.setup();
    renderApp('/sales/manager/contract');
    const preview = await screen.findByRole('region', { name: 'پیش‌نمایش قرارداد' });
    // Article ۴ has untitled clauses ۴-۱، ۴-۲ and a note.
    expect(within(preview).getByText('ماده ۴: تعهدات مؤسسه')).toBeInTheDocument();
    expect(within(preview).getByText('۴\u200f-\u200f۱')).toBeInTheDocument();
    expect(within(preview).getByText('۴\u200f-\u200f۲')).toBeInTheDocument();
    expect(within(preview).getByText(/تبصره ۱/)).toBeInTheDocument();
    // The variables show with the samples: the default search count, a sample customer.
    expect(within(preview).getByText('10')).toBeInTheDocument();
    expect(within(preview).getByText('سارا محمدی')).toBeInTheDocument();

    // The manager adds a variable and puts it in a new clause where the cursor is.
    const variables = screen.getByRole('region', { name: 'متغیرها' });
    await user.click(within(variables).getByRole('button', { name: '+ متغیر تازه' }));
    const names = within(variables).getAllByLabelText('نام متغیر');
    await user.type(names.at(-1) as HTMLElement, 'نام سفارت');
    const defaults = within(variables).getAllByLabelText('مقدار پیش‌فرض');
    await user.type(defaults.at(-1) as HTMLElement, 'آلمان');
    await user.click(within(variables).getByRole('button', { name: 'ذخیره‌ی متغیرها' }));
    expect(await screen.findByText('متغیرها ذخیره شد.')).toBeInTheDocument();

    const clauses = screen.getByRole('region', { name: 'متن قرارداد' });
    await user.click(within(clauses).getByRole('button', { name: '+ ماده، بند یا تبصره' }));
    await user.type(within(clauses).getByLabelText('متن'), 'نوبت ');
    await user.click(within(clauses).getByRole('button', { name: 'افزودن نام سفارت به متن' }));
    expect(within(clauses).getByLabelText('متن')).toHaveValue('نوبت {{نام سفارت}}');
    // The preview fills it before it is saved.
    expect(within(preview).getByText('آلمان')).toBeInTheDocument();
    await user.click(within(clauses).getByRole('button', { name: 'ذخیره' }));
    // At the end of the text: the third clause of article ۴, after its note.
    expect(await within(clauses).findByText('۴\u200f-\u200f۳')).toBeInTheDocument();
  });

  it('the seller fills a variable and adds a clause into an article (S69)', async () => {
    loginAs(NIMA);
    const user = userEvent.setup();
    const posts: unknown[] = [];
    const listen = ({ request }: { request: Request }) => {
      if (request.method === 'POST' && request.url.endsWith('/customers/105/offer/'))
        void request
          .clone()
          .json()
          .then((body: unknown) => posts.push(body));
    };
    server.events.on('request:start', listen);
    renderApp('/sales/customers/105/offer?step=3');
    const clauses = await screen.findByRole('region', { name: 'متن قرارداد' });
    const count = within(clauses).getByLabelText('تعداد سرچ');
    expect(count).toHaveValue('10');
    await user.clear(count);
    await user.type(count, '15');
    // The text shows the value at once.
    expect(within(clauses).getByText('15')).toBeInTheDocument();
    const adds = within(clauses).getAllByRole('button', { name: '+ بند یا تبصره در این ماده' });
    await user.click(adds.at(-1) as HTMLElement);
    await user.click(within(clauses).getByRole('radio', { name: 'تبصره' }));
    await user.type(within(clauses).getByLabelText('متن بند'), 'هزینه‌ی سفارت با متقاضی است.');
    // A note added after the article's note: تبصره ۲.
    expect(within(clauses).getByText('تبصره ۲')).toBeInTheDocument();
    // The preview fills the value in the text.
    await user.click(screen.getByRole('button', { name: 'بعدی: پیش‌نمایش و ارسال' }));
    const preview = await screen.findByRole('region', { name: 'پیش‌نمایش قرارداد' });
    expect(within(preview).getByText('15')).toBeInTheDocument();
    expect(within(preview).getAllByText('عرفان ملکی').length).toBeGreaterThan(1); // the parties and the clause
    await user.click(
      screen.getByRole('button', { name: 'ارسال پیش‌نویس قرارداد برای تأیید مدیر' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'عرفان ملکی' });
    server.events.removeListener('request:start', listen);
    const body = posts.at(-1) as { variables: Record<string, string>; clauses: unknown[] };
    expect(body.variables).toEqual({ 'تعداد سرچ': '15' });
    expect(body.clauses).toEqual([
      {
        clause: null,
        kind: 'note',
        title: '',
        text: 'هزینه‌ی سفارت با متقاضی است.',
        removed: false,
        after: 7,
      },
    ]);
  });

  it('a seller cannot change a fixed clause', async () => {
    loginAs(NIMA);
    renderApp('/sales/customers/105/offer?step=3');
    const clauses = await screen.findByRole('region', { name: 'متن قرارداد' });
    expect(within(clauses).getAllByText('ثابت').length).toBeGreaterThan(0);
    expect(
      within(clauses).queryByRole('button', { name: 'ویرایش ماده ۱: موضوع قرارداد' }),
    ).not.toBeInTheDocument();
    expect(
      within(clauses).getByRole('button', { name: 'ویرایش ماده ۳: فسخ قرارداد' }),
    ).toBeInTheDocument();
  });
});

describe('office phone hours', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it("shows the PBX's hours, refuses a closing time before opening, and saves the week", async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/hours');
    expect(await screen.findByRole('heading', { name: 'ساعت کاری تلفن' })).toBeInTheDocument();
    expect(screen.getByText(/هنوز ساعت‌های خود سانترال است/)).toBeInTheDocument();
    const week = screen.getByRole('region', { name: 'ساعت پاسخ‌گویی' });
    expect(within(week).getByLabelText('یکشنبه، از ساعت')).toHaveValue('10:30');
    expect(within(week).getByRole('switch', { name: /^شنبه/ })).not.toBeChecked();

    await user.click(within(week).getByRole('switch', { name: /^شنبه/ }));
    await user.selectOptions(within(week).getByLabelText('شنبه، از ساعت'), '10:00');
    await user.selectOptions(within(week).getByLabelText('شنبه، تا ساعت'), '09:00');
    await user.click(screen.getByRole('button', { name: 'ذخیره‌ی ساعت‌ها' }));
    expect(within(week).getByText('ساعت پایان را بعد از ساعت شروع بگذارید.')).toBeInTheDocument();
    expect(within(week).getByLabelText('شنبه، تا ساعت')).toHaveFocus();

    await user.selectOptions(within(week).getByLabelText('شنبه، تا ساعت'), '14:00');
    await user.click(screen.getByRole('button', { name: 'ذخیره‌ی ساعت‌ها' }));
    expect(await toasts().findByText(/^ذخیره شد/)).toBeInTheDocument();
    expect(await screen.findByText(/آخرین تغییر: رضا کامرانی/)).toBeInTheDocument();
    const saved = await api<{ week: { day: string }[] }>('/sales/v1/calls/hours/');
    expect(saved.week.map((row) => row.day)).toEqual(['sat', 'sun', 'mon', 'tue', 'wed', 'thu']);
  });

  it('closes the line for today at once, and adds and removes a closed day', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/hours');
    const today = await screen.findByRole('region', { name: 'امروز' });
    await user.click(within(today).getByRole('radio', { name: 'بسته' }));
    expect(await toasts().findByText('خط تلفن تا نیمه‌شب بسته است')).toBeInTheDocument();
    expect(await screen.findByText('خط تلفن الان بسته است')).toBeInTheDocument();

    const closed = screen.getByRole('region', { name: 'روزهای تعطیل' });
    expect(within(closed).getByText('روز تعطیلی اضافه نشده است.')).toBeInTheDocument();
    await user.click(within(closed).getByRole('button', { name: 'افزودن روز' }));
    expect(within(closed).getByText('اول روز را انتخاب کنید.')).toBeInTheDocument();
  });

  it('is hidden from sellers', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager/hours');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
  });
});

describe('phone teams', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it("shows the PBX's team, changes its name, people and outside numbers, and adds a team", async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/phone-teams');
    expect(await screen.findByRole('heading', { name: 'تیم‌های تلفن' })).toBeInTheDocument();
    const card = screen.getByRole('region', { name: 'moshavere-foroosh' });
    expect(within(card).getByText(/همان تنظیم خود سانترال/)).toBeInTheDocument();
    expect(within(card).getByText(/داخلی‌های ۲۳۰ در این صف هستند/)).toBeInTheDocument();
    expect(within(card).getByText(/با کد ورود وارد این صف شده‌اند: ۱۰۳/)).toBeInTheDocument();
    expect(within(card).getByRole('checkbox', { name: /^نیما رضایی/ })).toBeChecked();

    await user.clear(within(card).getByLabelText('نام تیم'));
    await user.type(within(card).getByLabelText('نام تیم'), 'فروش;');
    await user.click(within(card).getByRole('button', { name: 'ذخیره‌ی تیم' }));
    expect(within(card).getByText(/یک نام تا ۴۰ حرف بنویسید/)).toBeInTheDocument();
    await user.type(within(card).getByLabelText('نام تیم'), '{Backspace}');

    await user.click(within(card).getByRole('checkbox', { name: /^رضا کامرانی/ }));
    await user.type(within(card).getByLabelText('شماره‌ی بیرون از شرکت'), '912');
    await user.click(within(card).getByRole('button', { name: 'افزودن شماره' }));
    expect(
      within(card).getByText('یک شماره‌ی موبایل مثل 09121234567 بنویسید.'),
    ).toBeInTheDocument();
    await user.clear(within(card).getByLabelText('شماره‌ی بیرون از شرکت'));
    await user.type(within(card).getByLabelText('شماره‌ی بیرون از شرکت'), '۰۹۱۲۱۲۳۴۵۶۷');
    await user.click(within(card).getByRole('button', { name: 'افزودن شماره' }));
    await user.click(within(card).getByRole('button', { name: 'برداشتن ۰۹۹۶۲۸۳۳۹۱۸' }));
    await user.click(within(card).getByRole('button', { name: 'ذخیره‌ی تیم' }));
    expect(await toasts().findByText(/^تیم «فروش» ذخیره شد/)).toBeInTheDocument();
    const saved = await api<{ teams: { members: number[]; outside_numbers: string[] }[] }>(
      '/sales/v1/calls/teams/',
    );
    expect(saved.teams[0]).toMatchObject({ members: [8, 9], outside_numbers: ['09121234567'] });

    const add = screen.getByRole('form', { name: 'تیم تازه' });
    await user.type(within(add).getByLabelText('نام تیم'), 'ویزا');
    await user.click(within(add).getByRole('button', { name: 'افزودن تیم' }));
    expect(await toasts().findByText('تیم «ویزا» اضافه شد')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'ویزا' })).toBeInTheDocument();
  });

  it('is hidden from sellers', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager/phone-teams');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
  });
});

describe('phone menus', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it("shows the PBX's keys, refuses a repeated key, and saves changes", async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/phone-menus');
    expect(await screen.findByRole('heading', { name: 'منوهای تلفن' })).toBeInTheDocument();
    const main = screen.getByRole('region', { name: 'منوی اصلی' });
    expect(within(main).getByLabelText('کلید ۱ به کجا برود')).toHaveValue('team');
    expect(within(main).getByLabelText('مقصد کلید ۱')).toHaveValue('1000');
    expect(within(main).getByLabelText('مقصد کلید ۲۲۳')).toHaveValue('223');
    expect(
      within(main).getByText('تنظیم خاص سانترال؛ همان‌طور که هست می‌ماند.'),
    ).toBeInTheDocument();

    await user.click(within(main).getByRole('button', { name: 'افزودن کلید' }));
    const keys = within(main).getAllByLabelText('کلید');
    const added = keys[keys.length - 1] as HTMLElement;
    await user.type(added, '۱');
    await user.click(within(main).getByRole('button', { name: 'ذخیره‌ی منو' }));
    expect(within(main).getAllByText('این کلید دو بار آمده است.')).toHaveLength(2);
    await user.clear(added);
    await user.type(added, '0');
    await user.selectOptions(within(main).getByLabelText('کلید ۰ به کجا برود'), 'menu');
    expect(within(main).getByLabelText('مقصد کلید ۰')).toHaveValue('5');
    await user.selectOptions(within(main).getByLabelText('کلید ۴ به کجا برود'), 'hangup');
    await user.click(within(main).getByRole('button', { name: 'برداشتن کلید ۹' }));
    await user.click(within(main).getByRole('button', { name: 'ذخیره‌ی منو' }));
    expect(await toasts().findByText(/^«منوی اصلی» ذخیره شد/)).toBeInTheDocument();
    const saved = await api<{ menus: { id: string; keys: unknown[] }[] }>('/sales/v1/calls/menus/');
    expect(saved.menus[0]?.keys).toEqual([
      { key: '1', kind: 'team', target: '1000' },
      { key: '4', kind: 'hangup', target: '' },
      { key: '223', kind: 'direct', target: '223' },
      { key: '0', kind: 'menu', target: '5' },
    ]);
  });

  it('is hidden from sellers', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager/phone-menus');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
  });
});

describe('voice messages', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('lists the greetings, refuses a non-sound file, and sends a new one', async () => {
    const user = userEvent.setup({ applyAccept: false });
    loginAs(REZA);
    renderApp('/sales/manager/phone-voices');
    expect(await screen.findByRole('heading', { name: 'پیام‌های صوتی' })).toBeInTheDocument();
    const main = screen.getByRole('region', { name: 'منوی اصلی' });
    expect(within(main).getByText('پخش در: منوی اصلی')).toBeInTheDocument();
    const closed = screen.getByRole('region', { name: 'بیرون از ساعت کاری' });
    expect(within(closed).getByText(/آخرین فایل روی سانترال نرفت/)).toBeInTheDocument();

    const input = within(main).getByLabelText('فایل صوتی تازه برای منوی اصلی', {
      selector: 'input',
    });
    await user.upload(input, new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    expect(within(main).getByRole('alert')).toHaveTextContent(
      'یک فایل MP3، WAV، M4A یا OGG انتخاب کنید.',
    );
    await user.upload(input, new File(['ID3 sound'], 'greeting.mp3', { type: 'audio/mpeg' }));
    expect(await toasts().findByText('پیام صوتی فرستاده شد')).toBeInTheDocument();
    expect(await within(main).findByText('فایل تازه در راه سانترال است…')).toBeInTheDocument();
  });

  it('is hidden from sellers', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager/phone-voices');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
  });
});

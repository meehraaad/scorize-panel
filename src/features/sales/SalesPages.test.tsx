import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { api } from '@/lib/api/client';
import type { CustomerData, CustomerInfo, TodayData } from './api';
import type { MonthData } from './api/month';
import { MONTH_PASSWORD } from '@/mocks/sales';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';
import { onDesktop } from '@/test/viewport';

const NIMA = 3; // seller (mock user in src/mocks/handlers.ts)
const ERFAN = 105; // a consulted lead with history and tasks (src/mocks/sales.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const readMonth = () =>
  api<MonthData>('/sales/v1/month/', { method: 'POST', body: { password: MONTH_PASSWORD } });

/** Opens "my month" and types the password it asks for. */
async function openMonth(password = MONTH_PASSWORD) {
  const user = userEvent.setup();
  const router = renderApp('/sales/month');
  await user.type(await screen.findByLabelText('رمز عبور'), password);
  await user.click(screen.getByRole('button', { name: 'باز کردن ماه من' }));
  return { user, router };
}

describe('sales panel, seller pages', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    loginAs(NIMA);
  });

  it('today: the next person, then the whole day in one timetable', async () => {
    const user = userEvent.setup();
    renderApp('/sales');
    expect(
      await screen.findByRole('heading', { name: /^سلام نیما، .* کار فوری منتظر شماست$/ }),
    ).toBeInTheDocument();

    // Due now on top: new leads, overdue follow-ups, receipts; the rest at its hour.
    const day = await screen.findByRole('region', { name: 'برنامه‌ی امروز' });
    const due = within(day).getByRole('region', { name: 'همین الان' });
    expect(within(due).getByRole('button', { name: 'تماس با کیانا رضوی' })).toBeInTheDocument();
    await user.click(within(due).getByRole('button', { name: /^نمایش همه/ }));
    expect(within(due).getByRole('button', { name: 'تماس با سمیرا نوروزی' })).toBeInTheDocument();
    expect(within(day).getByRole('listitem', { name: /^اکنون، / })).toBeInTheDocument();

    // One filter at a time: receipts only.
    await user.click(within(day).getByRole('button', { name: /^رسید/ }));
    expect(
      within(day).queryByRole('button', { name: 'تماس با کیانا رضوی' }),
    ).not.toBeInTheDocument();
    await user.click(within(day).getByRole('button', { name: 'تأیید رسید کیان مرادی' }));
    expect(await toasts().findByText('رسید کیان مرادی تأیید شد.')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(day).queryByRole('button', { name: 'تأیید رسید کیان مرادی' }),
      ).not.toBeInTheDocument();
    });
    await user.click(within(day).getByRole('button', { name: /^مشاوره/ }));
    // A consultation's card opens the consultations calendar's card, with its actions.
    const session = await waitFor(() => {
      const card = within(day)
        .getAllByRole('button')
        .find((button) => button.getAttribute('aria-haspopup') === 'dialog');
      if (!card) throw new Error('no consultation card yet');
      return card;
    });
    await user.click(session);
    const popup = await screen.findByRole('dialog', { name: session.textContent });
    await user.click(within(popup).getByRole('button', { name: 'بستن' }));

    // Tomorrow: its timed follow-ups and consultations.
    await user.click(within(day).getByRole('button', { name: 'روز بعد' }));
    expect(await within(day).findByRole('heading', { name: 'برنامه‌ی فردا' })).toBeInTheDocument();
    await user.click(within(day).getByRole('button', { name: 'امروز' }));
    expect(within(day).getByRole('heading', { name: 'برنامه‌ی امروز' })).toBeInTheDocument();

    // The next step: the oldest new lead first; "next person" moves on.
    const next = screen.getByRole('region', { name: 'کار بعدی شما' });
    expect(within(next).getByText('هانیه کرمی')).toBeInTheDocument();
    expect(within(next).getByRole('button', { name: 'تماس با هانیه کرمی' })).toBeInTheDocument();
    for (let step = 0; step < 3 && !within(next).queryByText('کیانا رضوی'); step += 1)
      await user.click(within(next).getByRole('button', { name: 'نفر بعد' }));
    // A result in one click opens the contact log with it chosen.
    await user.click(within(next).getByRole('button', { name: 'ثبت «جواب نداد» برای کیانا رضوی' }));
    await screen.findByRole('dialog', { name: 'ثبت ارتباط با کیانا رضوی' });
    // The form sits beside the dialog's title bar (src/features/sales/ContactWorkspace.tsx).
    expect(await screen.findByRole('radio', { name: 'جواب نداد' })).toBeChecked();

    // The quiet column: the month and the chances, two admissions of one customer in one line.
    const side = screen.getByRole('complementary', { name: 'خلاصه‌ی ماه و فرصت‌ها' });
    expect(
      await within(side).findByRole('link', {
        name: /زهرا موسوی از Uppsala University و Lund University پذیرش گرفت/,
      }),
    ).toHaveAttribute('href', '/sales/customers/120/offer');
    expect(within(side).getByRole('progressbar', { name: '۷ از ۱۲ قرارداد' })).toBeInTheDocument();
  });

  // Leads are Django's SaleLead (src/mocks/staff.ts): "new" = not called yet, "contacted" = called.
  // Later stages, scores and bulk changes wait for S3, S5, S13.
  it('leads: new and contacted from Django, with search', async () => {
    const user = userEvent.setup();
    renderApp('/sales/leads?stage=new');
    // Phones get one card per lead, not a table wider than the screen.
    const cards = await screen.findByRole('list', { name: 'فهرست لیدها' });
    expect(cards.children).toHaveLength(10); // not called yet
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const tabs = screen.getByRole('group', { name: 'مرحله' });
    expect(within(tabs).getAllByRole('button')).toHaveLength(3); // all, new, contacted

    await user.type(screen.getByRole('searchbox', { name: 'جستجوی لید' }), 'کیانا');
    expect(await screen.findByText('نمایش ۱ از ۱ لید')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'کیانا رضوی' })).toHaveAttribute(
      'href',
      '/sales/customers/101',
    );
  });

  it("leads: a sales manager's rows name their seller, with a seller filter", async () => {
    loginAs(4);
    onDesktop();
    renderApp('/sales/leads');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByText('فروشنده: نیما رستمی').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('بدون فروشنده').length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'فروشنده' })).toBeInTheDocument();
  });

  it('leads: adds a lead by hand and opens the customer', async () => {
    const user = userEvent.setup();
    const router = renderApp('/sales/leads');
    await user.click(await screen.findByRole('button', { name: 'ثبت لید دستی' }));
    const dialog = await screen.findByRole('dialog', { name: 'ثبت لید دستی' });
    await user.type(within(dialog).getByLabelText('نام'), 'رضا');
    await user.type(within(dialog).getByLabelText('شماره‌ی موبایل'), '0912 000 1234');
    await user.click(screen.getByRole('button', { name: 'ثبت و باز کردن صفحه‌ی مشتری' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'رضا' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/sales\/customers\/\d+$/);
  });

  it('header: searches every customer, opens mine, takes a free one, names another seller', async () => {
    let taken: string | null = null;
    server.use(
      http.get('/api/sales/v1/customers/search/', ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        if (q === 'هیچ') return HttpResponse.json({ results: [] });
        return HttpResponse.json({
          results: [
            {
              customer: ERFAN,
              name: 'عرفان ملکی',
              phone: '09120000105',
              email: '',
              access: 'mine',
              seller: null,
              stage: 'consulted',
            },
            {
              customer: 777,
              name: 'مینا آزاد',
              phone: '09127770000',
              email: 'mina@example.com',
              access: 'free',
              seller: null,
              stage: null,
            },
            {
              customer: 778,
              name: 'مینا دیگری',
              phone: '',
              email: '',
              access: 'other',
              seller: 'سارا',
              stage: 'new',
            },
          ],
        });
      }),
      http.post('/api/sales/v1/customers/:id/take/', ({ params }) => {
        taken = String(params.id);
        return HttpResponse.json({ customer: Number(params.id) });
      }),
    );
    const user = userEvent.setup();
    const router = renderApp('/sales/leads');
    await user.click(await screen.findByRole('button', { name: 'جستجو در همه‌ی مشتری‌ها' }));
    const dialog = await screen.findByRole('dialog', { name: 'جستجو در همه‌ی مشتری‌ها' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'جستجوی مشتری' }), 'هیچ');
    expect(await within(dialog).findByText('کسی با این مشخصات پیدا نشد.')).toBeInTheDocument();
    await user.clear(within(dialog).getByRole('searchbox', { name: 'جستجوی مشتری' }));
    await user.type(within(dialog).getByRole('searchbox', { name: 'جستجوی مشتری' }), 'مینا');
    const results = await within(dialog).findByRole('list', { name: 'مشتری‌های پیدا شده' });
    expect(within(results).getByRole('link', { name: 'باز کردن صفحه' })).toHaveAttribute(
      'href',
      `/sales/customers/${String(ERFAN)}`,
    );
    expect(within(results).getByText('مشتریِ سارا')).toBeInTheDocument();
    await user.click(within(results).getByRole('button', { name: 'برداشتن مشتری' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sales/customers/777'));
    expect(taken).toBe('777');
    expect(await toasts().findByText('مینا آزاد به مشتری‌های شما اضافه شد.')).toBeInTheDocument();
  });

  it('header: searches every customer from any page; nobody found opens the new lead', async () => {
    server.use(
      http.get('/api/sales/v1/customers/search/', () => HttpResponse.json({ results: [] })),
    );
    const user = userEvent.setup();
    const router = renderApp('/sales/board');
    await user.click(await screen.findByRole('button', { name: 'جستجو در همه‌ی مشتری‌ها' }));
    const dialog = await screen.findByRole('dialog', { name: 'جستجو در همه‌ی مشتری‌ها' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'جستجوی مشتری' }), 'کسی نیست');
    await user.click(await within(dialog).findByRole('button', { name: 'ثبت به‌عنوان لید تازه' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sales/leads'));
    expect(await screen.findByRole('dialog', { name: 'ثبت لید دستی' })).toBeInTheDocument();
  });

  it('customer: logs an unanswered call; the history shows it and a follow-up is set', async () => {
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}?log=call`);
    const dialog = await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' });
    await user.click(within(dialog).getByRole('radio', { name: 'جواب نداد' }));
    expect(within(dialog).getByText(/یک پیگیری برای فردا ساخته می‌شود/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ثبت و ساختن پیگیری' }));

    const history = await screen.findByRole('region', { name: 'تاریخچه' });
    // One was already there (a week ago).
    await waitFor(() =>
      expect(within(history).getAllByText('تماس بی‌پاسخ · نیما رستمی')).toHaveLength(2),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    // The retry tomorrow is a task about him.
    const tasks = screen.getByRole('region', { name: 'کارهای باز عرفان' });
    expect(await within(tasks).findByText('تماس دوباره؛ قبلی بی‌پاسخ ماند')).toBeInTheDocument();
  });

  it('customer: a talked call goes to the history; no stage move until Django has stages', async () => {
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    await user.click(await screen.findByRole('button', { name: 'تماس و ثبت' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('مرحله‌ی بعدی')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('چه گذشت؟'), 'قرار شد بورسیه‌ها را بفرستم');
    await user.type(
      within(dialog).getByLabelText('یادداشت برای خود مشتری'),
      'رزومه‌ی خود را تکمیل کنید',
    );
    await user.click(screen.getByRole('button', { name: /^ثبت · پیگیری/ }));

    const history = await screen.findByRole('region', { name: 'تاریخچه' });
    expect(await within(history).findByText('قرار شد بورسیه‌ها را بفرستم')).toBeInTheDocument();
    expect(await within(history).findByText('رزومه‌ی خود را تکمیل کنید')).toBeInTheDocument();
  });

  it('customer: similar admissions from ExperienceViewSet', async () => {
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const similar = await screen.findByRole('region', { name: 'برای قانع کردن مشتری' });
    // Bachelor's in computer engineering, GPA 16.2, wants a master's: 4 successful matches.
    expect(within(similar).getByText(/^۴ متقاضی/)).toHaveTextContent(
      'کارشناسی مهندسی کامپیوتر، معدل ۱۶٫۲',
    );
    const universities = within(similar)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(universities).toEqual(['University of Toronto', 'University of Waterloo', 'TU Munich']);
  });

  it('customer: opens the contact dialog while the details tab is still loading', async () => {
    const info = await api<CustomerInfo>('/sales/v1/customers/105/info/');
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/sales/v1/customers/105/info/', async () => {
        await pending;
        return HttpResponse.json(info);
      }),
    );
    renderApp('/sales/customers/105/info?log=call');
    try {
      expect(
        await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'عرفان ملکی' })).toBeInTheDocument();
    } finally {
      release();
    }
    await screen.findByRole('region', {
      name: i18n.t('info.personal.title', { ns: 'sales' }),
      hidden: true,
    });
  });

  it('customer: asks a colleague for something', async () => {
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const tasks = await screen.findByRole('region', { name: 'کارهای باز عرفان' });
    expect(within(tasks).getAllByRole('listitem')).toHaveLength(4);
    const sent = within(tasks).getAllByText('فرستاده شد').length;
    await user.type(within(tasks).getByLabelText('کار تازه درباره‌ی عرفان'), 'نمونه‌ی پذیرش هلند');
    await user.click(within(tasks).getByRole('radio', { name: 'یک همکار' }));
    await user.click(within(tasks).getByRole('button', { name: 'فرستادن درخواست به همکار' }));
    expect(await within(tasks).findByText('نمونه‌ی پذیرش هلند')).toBeInTheDocument();
    expect(within(tasks).getAllByText('فرستاده شد')).toHaveLength(sent + 1);
  });

  it('board: deals by stage', async () => {
    renderApp('/sales/board');
    expect(await screen.findByRole('heading', { name: 'تابلوی فروش' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'پیش‌نویس، منتظر مدیر' })).toHaveTextContent(
      'مدیر بررسی می‌کند',
    );
  });

  it('board: fullscreen exits with Escape and does not carry into the leads list', async () => {
    const user = userEvent.setup();
    renderApp('/sales/board');
    const enter = await screen.findByRole('button', { name: 'تمام‌صفحه' });
    await user.click(enter);
    expect(screen.getByRole('button', { name: 'خروج از تمام‌صفحه' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.keyboard('[Escape]');
    expect(screen.getByRole('button', { name: 'تمام‌صفحه' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'تمام‌صفحه' }));
    await user.click(screen.getByRole('link', { name: i18n.t('board.listView', { ns: 'sales' }) }));
    expect(await screen.findByRole('heading', { name: 'لیدهای من' })).toBeInTheDocument();
    expect(document.querySelector('[data-page-workspace]')).not.toBeInTheDocument();
  });

  it('board: can add a lead in fullscreen; Escape in its dialog keeps the workspace open', async () => {
    const user = userEvent.setup();
    renderApp('/sales/board');
    await user.click(await screen.findByRole('button', { name: 'تمام‌صفحه' }));
    await user.click(screen.getByRole('button', { name: 'ثبت لید دستی' }));
    const dialog = screen.getByRole('dialog', { name: 'ثبت لید دستی' });
    fireEvent.keyDown(within(dialog).getByLabelText('نام'), { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('button', { name: 'خروج از تمام‌صفحه', hidden: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(
      within(dialog).getByRole('button', { name: i18n.t('close', { ns: 'sales' }) }),
    );
    await user.keyboard('[Escape]');
    expect(screen.getByRole('button', { name: 'تمام‌صفحه' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('board: replaces the board with the customer page skeleton while a customer request is pending', async () => {
    const user = userEvent.setup();
    const customer = await api<CustomerData>('/sales/v1/customers/101/');
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/sales/v1/customers/101/', async () => {
        await pending;
        return HttpResponse.json(customer);
      }),
    );
    const router = renderApp('/sales/board');
    await screen.findByRole('heading', { name: 'تابلوی فروش' });
    const card = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/sales/customers/101');
    if (!card) throw new Error('No customer card');
    try {
      await user.click(card);
      await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/sales\/customers\//));
      // The customer page's shape (PageSkeleton), not the board.
      expect(await screen.findByRole('status', { name: /در حال بارگذاری/ })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'تابلوی فروش' })).not.toBeInTheDocument();
    } finally {
      release();
    }
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('today: new leads past the first server page are a link to the leads', async () => {
    const today = await api<TodayData>('/sales/v1/today/');
    const outreach = await api<{ calls: unknown }>('/sales/v1/today/outreach/?bucket=overdue');
    server.use(
      http.get('/api/sales/v1/today/outreach/', () =>
        HttpResponse.json({
          ...outreach,
          hot: { count: today.hot.length + 4, page_size: 50, results: today.hot },
        }),
      ),
    );
    renderApp('/sales');
    const due = await screen.findByRole('region', { name: 'همین الان' });
    expect(within(due).getByRole('link', { name: /^۴ لید تازه‌ی دیگر/ })).toHaveAttribute(
      'href',
      '/sales/leads?stage=new',
    );
  });

  it('month: goal and funnel', async () => {
    await openMonth();
    expect(await screen.findByRole('heading', { name: /^ماه من · / })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '۷ از ۱۲ قرارداد' })).toBeInTheDocument();
  });

  it('month: asks for the password again on every visit', async () => {
    const { router } = await openMonth();
    expect(await screen.findByRole('heading', { name: /^ماه من · / })).toBeInTheDocument();
    await router.navigate('/sales/board');
    expect(await screen.findByRole('heading', { name: 'تابلوی فروش' })).toBeInTheDocument();
    await router.navigate('/sales/month');
    expect(await screen.findByLabelText('رمز عبور')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^ماه من · / })).not.toBeInTheDocument();
  });

  it('month: its contracts and instalments, and a past month without the password again', async () => {
    const month = await readMonth();
    const asked: (string | undefined)[] = [];
    server.use(
      http.post('/api/sales/v1/month/', async ({ request }) => {
        const body = (await request.json()) as { month?: string };
        asked.push(body.month);
        const past = body.month === month.months[1];
        return HttpResponse.json({
          ...month,
          month: past ? month.months[1] : month.months[0],
          current: !past,
          contracts: past
            ? []
            : [
                {
                  lead: 1,
                  customer: ERFAN,
                  name: 'عرفان مرادی',
                  title: 'پذیرش + ویزا · کانادا',
                  amount: 120_000_000,
                  amount_text: null,
                  won_at: new Date().toISOString(),
                  seller: 'نیما',
                  seller_id: 8,
                  status: 'فعال',
                },
              ],
          instalments: [
            {
              id: 5,
              customer: ERFAN,
              name: 'عرفان مرادی',
              title: 'قسط دوم',
              amount: 40_000_000,
              amount_text: null,
              due: '2026-11-01',
              condition: null,
              state: 'overdue',
            },
          ],
        });
      }),
    );
    const { user } = await openMonth();
    const contracts = await screen.findByRole('region', { name: 'قراردادهای این ماه' });
    expect(within(contracts).getByRole('link', { name: 'عرفان مرادی' })).toHaveAttribute(
      'href',
      `/sales/customers/${String(ERFAN)}`,
    );
    const instalments = screen.getByRole('region', { name: 'قسط‌های این ماه' });
    expect(within(instalments).getByText('عقب‌افتاده')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('ماه'), month.months[1] ?? '');
    expect(
      await screen.findByText('در این ماه قراردادی به نام شما بسته نشده.'),
    ).toBeInTheDocument();
    expect(screen.getByText('این ماه تمام شده است.')).toBeInTheDocument();
    expect(asked).toEqual([undefined, month.months[1]]);
  });

  it('calendar list: one chosen day with its sessions and logged contacts', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    server.use(
      http.get('/api/sales/v1/consultations/', ({ request }) => {
        const query = new URL(request.url).searchParams;
        asked.push(`${query.get('range') ?? ''} ${query.get('date') ?? ''}`);
        return HttpResponse.json({
          counts: { today: 0, week: 0, past: 0, all: 0, day: 0 },
          unlogged: 0,
          types: [],
          sellers: [],
          count: 0,
          page_size: 20,
          results: [],
          ...(query.get('range') === 'day'
            ? {
                day: {
                  sessions: [{ type: 'ارزیابی', count: 2 }],
                  kinds: [{ kind: 'call', count: 3 }],
                  contacts: [
                    {
                      id: 1,
                      customer: ERFAN,
                      name: 'عرفان مرادی',
                      kind: 'call',
                      channel: null,
                      at: new Date().toISOString(),
                      author: 'نیما',
                      text: 'تماس ورودی، قیمت پرسید',
                    },
                  ],
                  more: false,
                },
              }
            : {}),
        });
      }),
    );
    renderApp('/sales/calendar');
    await user.click(await screen.findByRole('button', { name: 'فهرست' }));
    await user.click(await screen.findByRole('button', { name: /^یک روز/ }));
    const report = await screen.findByRole('region', { name: 'کارهای این روز' });
    expect(within(report).getByText('ارزیابی: ۲')).toBeInTheDocument();
    expect(within(report).getByText('تماس: ۳')).toBeInTheDocument();
    expect(within(report).getByText('تماس ورودی، قیمت پرسید')).toBeInTheDocument();
    expect(asked.at(-1)).toMatch(/^day \d{4}-\d{2}-\d{2}$/);
  });

  it('customer: whose work it is, and who the lead went to', async () => {
    server.use(
      http.get('/api/sales/v1/customers/:id/history/', () =>
        HttpResponse.json({
          results: [
            {
              id: 'assign-1',
              kind: 'assign',
              at: new Date().toISOString(),
              author: 'رضا',
              channel: null,
              title: 'نیما',
              previous: 'کاوه',
              text: '',
              stage: null,
            },
          ],
          next: null,
        }),
      ),
    );
    const customer = await api<CustomerData>(`/sales/v1/customers/${String(ERFAN)}/`);
    server.use(
      http.get('/api/sales/v1/customers/:id/', () =>
        HttpResponse.json({
          ...customer,
          attribution: { first_contact: 'کاوه', won_by: 'نیما' },
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    expect(await screen.findByText('لید از کاوه به نیما رسید · رضا')).toBeInTheDocument();
    // In the shared column (a sheet on phones).
    await user.click(screen.getByRole('button', { name: 'درباره‌ی مشتری و یادداشت‌ها' }));
    const about = await screen.findByRole('region', { name: 'درباره‌ی مشتری' });
    expect(within(about).getByText('اولین تماس').nextSibling).toHaveTextContent('کاوه');
    expect(within(about).getByText('قرارداد به نام').nextSibling).toHaveTextContent('نیما');
  });

  it('month: a wrong password shows nothing of the month', async () => {
    await openMonth('not-it');
    expect(await screen.findByText('رمز عبور درست نیست.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('month: estimates leads from the same cohort as the funnel', async () => {
    const month = await readMonth();
    server.use(
      http.post('/api/sales/v1/month/', () =>
        HttpResponse.json({
          ...month,
          won: 7,
          target: 12,
          funnel: { ...month.funnel, leads: 10, won: 2 },
        }),
      ),
    );
    await openMonth();
    expect(
      await screen.findByText('۵ قرارداد دیگر تا هدف. با نرخ تبدیل فعلی، یعنی حدود ۲۵ لید تازه.'),
    ).toBeInTheDocument();
  });

  it('month: an unset target is not shown as achieved', async () => {
    const month = await readMonth();
    server.use(http.post('/api/sales/v1/month/', () => HttpResponse.json({ ...month, target: 0 })));
    await openMonth();
    expect(await screen.findAllByText('هدف ماه تعیین نشده')).toHaveLength(2);
    expect(screen.queryByText('به هدف این ماه رسیدید.')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it.each([0, 10])(
    'month: no conversion estimate with %i leads and zero cohort wins',
    async (leads) => {
      const month = await readMonth();
      server.use(
        http.post('/api/sales/v1/month/', () =>
          HttpResponse.json({
            ...month,
            funnel: { ...month.funnel, leads, won: 0 },
          }),
        ),
      );
      await openMonth();
      expect(
        await screen.findByText(
          '۵ قرارداد دیگر تا هدف. داده‌ی کافی برای تخمین تعداد لید تازه وجود ندارد.',
        ),
      ).toBeInTheDocument();
    },
  );

  it('month: distinguishes missing call measurements from a real zero', async () => {
    const month = await readMonth();
    server.use(
      http.post('/api/sales/v1/month/', () =>
        HttpResponse.json({
          ...month,
          weeks: [null, 0, 20, null],
        }),
      ),
    );
    await openMonth();
    const chart = await screen.findByRole('img', { name: /هفته‌ی ۱: داده‌ی تماس موجود نیست/ });
    expect(chart).toHaveAccessibleName(/هفته‌ی ۲: ۰ دقیقه/);
    expect(within(chart).getAllByText('داده‌ی تماس موجود نیست')).toHaveLength(2);
    expect(within(chart).getByText('۰ د')).toBeInTheDocument();
  });

  it('consultations: past sessions open the session log without leaving the list', async () => {
    const user = userEvent.setup();
    const router = renderApp('/sales/calendar');
    expect(await screen.findByRole('heading', { name: 'مشاوره‌های من' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'فهرست' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /^ثبت جلسه: / }))[0] as HTMLElement,
    );
    const log = await screen.findByRole('dialog', { name: /^ثبت جلسه‌ی / });
    // A booked session's log has no channel to choose: it names the session instead.
    expect(within(log).queryByRole('radio', { name: 'جلسه‌ی مشاوره' })).not.toBeInTheDocument();
    expect(
      within(log).getByRole('button', { name: /ثبت جلسه و ساختن پیگیری/ }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sales/calendar');
  });

  it('calendar: its own nav tab, also at its two old addresses', async () => {
    for (const old of ['/sales/consultations', '/sales/leads/consultations']) {
      const router = renderApp(old);
      expect(await screen.findByRole('heading', { name: 'مشاوره‌های من' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/sales/calendar');
      cleanup();
    }
  });
});

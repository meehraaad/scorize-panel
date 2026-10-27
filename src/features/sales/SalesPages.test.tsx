import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

  it('today: new leads to call now, the call list, receipts', async () => {
    const user = userEvent.setup();
    renderApp('/sales');
    expect(
      await screen.findByRole('heading', { name: 'سلام نیما، ۳ لید منتظر تماس شماست' }),
    ).toBeInTheDocument();
    const hot = screen.getByRole('region', { name: 'لیدهای تازه، به ترتیب زمان انتظار' });
    expect(within(hot).getAllByRole('listitem')).toHaveLength(3);
    expect(within(hot).getByRole('button', { name: 'تماس با کیانا رضوی' })).toBeInTheDocument();

    // Consultations and today's timed follow-ups on the day calendar.
    const calendar = await screen.findByRole('region', { name: 'تقویم امروز' });
    expect(
      within(calendar).getByRole('link', { name: /^مشاوره‌ی .*، جلسه ثبت شد$/ }),
    ).toHaveAttribute('href', '/sales/customers/104');
    expect(within(calendar).getAllByRole('button', { name: /^پیگیری .*، ساعت / })).toHaveLength(3);

    // Ten calls: six on the first page, four on the next.
    const calls = screen.getByRole('region', { name: 'پیگیری‌ها و تماس‌های امروز' });
    expect(within(calls).getAllByRole('listitem')).toHaveLength(6);
    expect(within(calls).getByText('۱ تا ۶ از ۱۰')).toBeInTheDocument();
    await user.click(within(calls).getByRole('button', { name: 'بعدی' }));
    await waitFor(() => expect(within(calls).getAllByRole('listitem')).toHaveLength(4));
    await user.click(within(calls).getByRole('button', { name: /عقب‌افتاده/ }));
    expect(await within(calls).findByText('سمیرا نوروزی')).toBeInTheDocument();
    await waitFor(() => expect(within(calls).getAllByRole('listitem')).toHaveLength(2));

    expect(within(calendar).getAllByRole('button', { name: /^پیگیری .*، ساعت / })).toHaveLength(3);
    // Two admissions of one customer make one card.
    const upsell = await screen.findByRole('region', { name: /^فرصت‌های فروش مکمل/ });
    expect(
      within(upsell).getByRole('link', {
        name: 'زهرا موسوی از Uppsala University و Lund University پذیرش گرفت',
      }),
    ).toHaveAttribute('href', '/sales/customers/120');
    expect(within(upsell).getByRole('link', { name: /پیشنهاد خدمات ویزا/ })).toHaveAttribute(
      'href',
      '/sales/customers/120/offer',
    );
    expect(within(upsell).getByRole('link', { name: /کامران زارع/ })).toHaveAttribute(
      'href',
      '/sales/customers/123',
    );

    const receipts = screen.getByRole('region', { name: /رسیدهای منتظر تأیید/ });
    await user.click(within(receipts).getByRole('button', { name: 'تأیید رسید کیان مرادی' }));
    expect(await toasts().findByText('رسید کیان مرادی تأیید شد.')).toBeInTheDocument();
    expect(
      await within(receipts).findByRole('button', { name: 'تأیید رسید محمد یزدانی' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(receipts).queryByRole('button', { name: 'تأیید رسید کیان مرادی' }),
      ).not.toBeInTheDocument();
    });
  });

  // Leads are Django's SaleLead (src/mocks/staff.ts): "new" = not called yet, "contacted" = called.
  // Later stages, scores and bulk changes wait for S3, S5, S13.
  it('leads: new and contacted from Django, with search', async () => {
    const user = userEvent.setup();
    renderApp('/sales/leads?stage=new');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11); // header + 10 not called yet
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
    await user.type(within(dialog).getByLabelText('یادداشت'), 'قرار شد بورسیه‌ها را بفرستم');
    await user.type(within(dialog).getByLabelText('خلاصه برای مشتری'), 'رزومه‌ی خود را تکمیل کنید');
    await user.click(screen.getByRole('button', { name: 'ثبت و ساختن پیگیری' }));

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

  it('today: new leads to call now, three at a time', async () => {
    const user = userEvent.setup();
    const today = await api<TodayData>('/sales/v1/today/');
    const more = today.hot.map((lead) => ({
      ...lead,
      lead: lead.lead + 100,
      name: `${lead.name} ۲`,
    }));
    const waiting = [...today.hot, ...more.slice(0, 2)];
    const outreach = await api<{ calls: unknown }>('/sales/v1/today/outreach/?page=1');
    server.use(
      http.get('/api/sales/v1/today/outreach/', () =>
        HttpResponse.json({
          ...outreach,
          hot: { count: waiting.length, page_size: 50, results: waiting },
        }),
      ),
    );
    renderApp('/sales');
    const hot = await screen.findByRole('region', { name: 'لیدهای تازه، به ترتیب زمان انتظار' });
    expect(within(hot).getAllByRole('listitem')).toHaveLength(3);
    expect(within(hot).getByText('۱ تا ۳ از ۵ لید منتظر')).toBeInTheDocument();
    await user.click(within(hot).getByRole('button', { name: 'بعدی' }));
    expect(within(hot).getAllByRole('listitem')).toHaveLength(2);
    expect(within(hot).getByText(`${today.hot[0]?.name ?? ''} ۲`)).toBeInTheDocument();
  });

  it('today: receipts three at a time, across server pages', async () => {
    const user = userEvent.setup();
    // Five receipts, four per server page.
    const names = ['رسید ۱', 'رسید ۲', 'رسید ۳', 'رسید ۴', 'رسید ۵'];
    const receipt = (name: string, index: number) => ({
      payment: index + 1,
      customer: 200 + index,
      name,
      amount: 1_000_000,
      what: 'مشاوره',
      method: 'card',
      uploaded_at: new Date().toISOString(),
      receipt_url: 'https://example.com/r.jpg',
    });
    server.use(
      http.get('/api/sales/v1/receipts/', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        const rows = names.map(receipt).slice((page - 1) * 4, page * 4);
        return HttpResponse.json({ count: names.length, page_size: 4, results: rows });
      }),
    );
    renderApp('/sales');
    const receipts = await screen.findByRole('region', { name: /رسیدهای منتظر تأیید/ });
    expect(await within(receipts).findByText('رسید ۱')).toBeInTheDocument();
    expect(within(receipts).getAllByRole('listitem')).toHaveLength(3);
    // The second page holds what is left of the first server page; the third is server page 2.
    await user.click(within(receipts).getByRole('button', { name: 'بعدی' }));
    expect(await within(receipts).findByText('رسید ۴')).toBeInTheDocument();
    expect(within(receipts).getAllByRole('listitem')).toHaveLength(1);
    await user.click(within(receipts).getByRole('button', { name: 'بعدی' }));
    expect(await within(receipts).findByText('رسید ۵')).toBeInTheDocument();
    expect(within(receipts).getByText('۵ تا ۵ از ۵')).toBeInTheDocument();
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
    const router = renderApp('/sales/leads/consultations');
    expect(await screen.findByRole('heading', { name: 'مشاوره‌های من' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'فهرست' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /^ثبت جلسه: / }))[0] as HTMLElement,
    );
    expect(await screen.findByRole('radio', { name: 'جلسه‌ی مشاوره' })).toBeChecked();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sales/leads/consultations');
  });

  it('consultations: a sub-tab of the leads tab, also at its old address', async () => {
    const router = renderApp('/sales/consultations');
    expect(await screen.findByRole('heading', { name: 'مشاوره‌های من' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sales/leads/consultations');
    const sections = screen.getByRole('navigation', { name: 'بخش‌های لیدها' });
    await userEvent.click(within(sections).getByRole('link', { name: 'لیدها' }));
    expect(await screen.findByRole('heading', { name: 'لیدهای من' })).toBeInTheDocument();
  });
});

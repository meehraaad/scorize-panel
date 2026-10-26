import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { api } from '@/lib/api/client';
import type { CustomerData, CustomerInfo } from './api';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3; // seller (mock user in src/mocks/handlers.ts)
const ERFAN = 105; // a consulted lead with history and tasks (src/mocks/sales.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

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
    expect(within(hot).getByRole('link', { name: 'تماس با کیانا رضوی' })).toHaveAttribute(
      'href',
      '/sales/customers/101?log=call',
    );

    // Consultations and today's timed follow-ups on the day calendar.
    const calendar = screen.getByRole('region', { name: 'تقویم امروز' });
    expect(
      within(calendar).getByRole('link', { name: /^مشاوره‌ی .*، جلسه ثبت شد$/ }),
    ).toHaveAttribute('href', '/sales/customers/104');
    expect(within(calendar).getAllByRole('link', { name: /^پیگیری .*، ساعت / })).toHaveLength(3);

    // Ten calls: six on the first page, four on the next.
    const calls = screen.getByRole('region', { name: 'پیگیری‌ها و تماس‌های امروز' });
    expect(within(calls).getAllByRole('listitem')).toHaveLength(6);
    expect(within(calls).getByText('۱ تا ۶ از ۱۰')).toBeInTheDocument();
    await user.click(within(calls).getByRole('button', { name: 'بعدی' }));
    expect(within(calls).getAllByRole('listitem')).toHaveLength(4);
    await user.click(within(calls).getByRole('button', { name: /عقب‌افتاده/ }));
    expect(within(calls).getAllByRole('listitem')).toHaveLength(2);
    expect(within(calls).getByText('سمیرا نوروزی')).toBeInTheDocument();

    // Two admissions of one customer make one row; the group row names its people.
    const upsell = screen.getByRole('region', { name: /^فرصت‌های فروش مکمل/ });
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
    await user.click(screen.getByRole('button', { name: 'ثبت و ساختن پیگیری' }));

    const history = await screen.findByRole('region', { name: 'تاریخچه' });
    expect(await within(history).findByText('قرار شد بورسیه‌ها را بفرستم')).toBeInTheDocument();
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

  it('board: replaces the board with loading while a customer request is pending', async () => {
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
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('در حال بارگذاری'));
      expect(screen.queryByRole('heading', { name: 'تابلوی فروش' })).not.toBeInTheDocument();
    } finally {
      release();
    }
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('month: goal and funnel', async () => {
    renderApp('/sales/month');
    expect(await screen.findByRole('heading', { name: /^ماه من · / })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '۷ از ۱۲ قرارداد' })).toBeInTheDocument();
  });

  it('consultations: past sessions link to the session log', async () => {
    renderApp('/sales/consultations');
    expect(await screen.findByRole('heading', { name: 'مشاوره‌های من' })).toBeInTheDocument();
    expect((await screen.findAllByRole('link', { name: /^ثبت جلسه: / }))[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/log=meeting&reservation=\d+$/),
    );
  });
});

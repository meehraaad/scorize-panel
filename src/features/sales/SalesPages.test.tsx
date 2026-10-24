import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

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

    const calls = screen.getByRole('region', { name: 'فهرست تماس امروز' });
    await user.click(within(calls).getByRole('button', { name: /عقب‌افتاده/ }));
    expect(within(calls).getAllByRole('listitem')).toHaveLength(2);
    expect(within(calls).getByText('سمیرا نوروزی')).toBeInTheDocument();

    const receipts = screen.getByRole('region', { name: /رسیدهای منتظر تأیید/ });
    await user.click(within(receipts).getByRole('button', { name: 'تأیید رسید کیان مرادی' }));
    expect(
      await within(receipts).findByRole('button', { name: 'تأیید رسید محمد یزدانی' }),
    ).toBeInTheDocument();
    expect(
      within(receipts).queryByRole('button', { name: 'تأیید رسید کیان مرادی' }),
    ).not.toBeInTheDocument();
  });

  it('leads: filters by stage and moves selected leads to another stage', async () => {
    const user = userEvent.setup();
    renderApp('/sales/leads?stage=new');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6); // header + 5 new leads

    await user.click(screen.getByRole('checkbox', { name: 'انتخاب کیانا رضوی' }));
    await user.click(screen.getByRole('checkbox', { name: 'انتخاب پویا عسگری' }));
    expect(screen.getByText('۲ لید انتخاب شده')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'اعمال' }));
    // Both moved to "contacted": four new leads left, minus Kiana and Pouya.
    expect(await screen.findByText('نمایش ۳ از ۳ لید')).toBeInTheDocument();
    expect(screen.queryByText('کیانا رضوی')).not.toBeInTheDocument();
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
    expect(within(dialog).getByText(/پیامک «تماس بی‌پاسخ» خودکار/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ثبت و ساختن پیگیری' }));

    const history = await screen.findByRole('region', { name: 'تاریخچه' });
    // One was already there (a week ago).
    expect(await within(history).findAllByText('تماس بی‌پاسخ · نیما رستمی')).toHaveLength(2);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('customer: closing a lead needs a reason', async () => {
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    await user.click(await screen.findByRole('button', { name: 'تماس و ثبت' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('مرحله‌ی بعدی'), 'lost');
    expect(within(dialog).queryByRole('group', { name: 'پیگیری بعدی' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ثبت و بستن لید' }));
    expect(within(dialog).getByLabelText('علت از دست رفتن (اجباری)')).toBeInvalid();

    await user.selectOptions(within(dialog).getByLabelText('علت از دست رفتن (اجباری)'), 'budget');
    await user.click(screen.getByRole('button', { name: 'ثبت و بستن لید' }));
    expect(await screen.findByText('از دست رفت: بودجه کافی نیست')).toBeInTheDocument();
  });

  it('customer: asks a colleague for something', async () => {
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const tasks = await screen.findByRole('region', { name: 'کارهای باز عرفان' });
    expect(within(tasks).getAllByRole('listitem')).toHaveLength(3);
    await user.type(within(tasks).getByLabelText('کار تازه درباره‌ی عرفان'), 'نمونه‌ی پذیرش هلند');
    await user.click(within(tasks).getByRole('radio', { name: 'یک همکار' }));
    await user.click(within(tasks).getByRole('button', { name: 'فرستادن درخواست به همکار' }));
    expect(await within(tasks).findByText('نمونه‌ی پذیرش هلند')).toBeInTheDocument();
    expect(within(tasks).getAllByText('فرستاده شد')).toHaveLength(1);
  });

  it('board: deals by stage', async () => {
    renderApp('/sales/board');
    expect(await screen.findByRole('heading', { name: 'تابلوی فروش' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'پیش‌نویس، منتظر مدیر' })).toHaveTextContent(
      'مدیر بررسی می‌کند',
    );
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

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { scheduleComplete, scheduleTotal, spreadRest, suggestedSchedule } from './plan';
import '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3;
const ERFAN = '/sales/customers/105';

describe('sales panel, customer sub-tabs, sale and offer', () => {
  // The first test opens the payments page: compile its lazy chunk up front, outside the
  // 12 s wait for the page (src/test/setup.ts), which a cold chunk can use up on a busy CI runner.
  beforeAll(() => import('./CustomerPaymentsPage'), 30_000);

  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });

  // Django names a payment after its invoices (PaymentViewSet).
  const WRITING = 'نگارش انگیزه‌نامه (ارشد)، نگارش رزومه';

  it('payments: confirms a receipt; a pending online payment has its link', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/money`);
    const detail = await screen.findByRole('region', { name: WRITING });
    await user.click(within(detail).getByRole('button', { name: 'تأیید رسید' }));
    expect(await within(detail).findByText('پرداخت کامل شد.')).toBeInTheDocument();
    expect(await toasts().findByText('رسید تأیید شد.')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'پرداخت شماره‌ی ۴۹۰۲، بسته‌ی نمونه انگیزه‌نامه‌ها' }),
    );
    const pending = await screen.findByRole('region', { name: 'بسته‌ی نمونه انگیزه‌نامه‌ها' });
    expect(within(pending).getByRole('button', { name: 'کپی لینک پرداخت' })).toBeInTheDocument();
    await user.click(within(pending).getByRole('button', { name: 'ارسال فاکتور با پیامک' }));
    expect(within(pending).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('payments: declining a receipt asks first and takes an optional reason', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/money`);
    const detail = await screen.findByRole('region', { name: WRITING });
    await user.click(within(detail).getByRole('button', { name: 'رد رسید' }));
    await user.type(within(detail).getByLabelText('علت رد (اختیاری)'), 'مبلغ یکی نیست');
    await user.click(within(detail).getByRole('button', { name: 'رد رسید' }));
    expect(await within(detail).findByText(/منتظر آپلود دوباره‌ی مشتری/)).toBeInTheDocument();
    expect(await toasts().findByText('رسید رد شد و برای مشتری پیامک رفت.')).toBeInTheDocument();
  });

  it('payments: records a receipt the customer sent on an instalment, for review', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/money`);
    const card = await screen.findByRole('region', { name: 'قسط‌های قرارداد' });
    // The paid prepayment has nothing to record.
    expect(
      within(card).queryByRole('button', { name: 'ثبت رسید پیش‌پرداخت' }),
    ).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'ثبت رسید قسط دوم' }));
    const form = within(card).getByRole('form', { name: 'رسید قسط دوم' });
    await user.click(within(form).getByRole('button', { name: 'ثبت رسید' }));
    expect(within(form).getByText('اول فایل رسید را انتخاب کنید.')).toBeInTheDocument();
    await user.upload(
      within(form).getByLabelText('فایل رسید'),
      new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' }),
    );
    await user.click(within(form).getByRole('button', { name: 'ثبت رسید' }));
    expect(await toasts().findByText('رسید ثبت شد و منتظر تأیید مالی است.')).toBeInTheDocument();
    expect(await within(card).findByText('رسید منتظر بررسی')).toBeInTheDocument();
    expect(
      within(card).queryByRole('button', { name: 'ثبت رسید قسط دوم' }),
    ).not.toBeInTheDocument();
  });

  it('sells a product with a discount code and opens its invoice', async () => {
    const user = userEvent.setup();
    const router = renderApp(ERFAN);
    await user.click(await screen.findByText('فروش تازه'));
    await user.click(screen.getByRole('button', { name: /^فروش محصول/ }));
    const dialog = await screen.findByRole('dialog', { name: 'فروش محصول به عرفان ملکی' });
    await user.click(await within(dialog).findByRole('button', { name: 'نگارش' }));
    await user.click(within(dialog).getByRole('checkbox', { name: /نگارش رزومه/ }));
    await user.type(within(dialog).getByLabelText('کد تخفیف'), 'scorize10');
    await user.click(within(dialog).getByRole('button', { name: 'اعمال' }));
    expect(await within(dialog).findByText('تخفیف: ۳۵۰٬۰۰۰ تومان')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ساختن پرداخت و ارسال فاکتور با پیامک' }));

    expect(await screen.findByRole('region', { name: 'نگارش رزومه' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${ERFAN}/money`);
  });

  it('sells a consultation at a time picked on the schedule', async () => {
    const user = userEvent.setup();
    const router = renderApp(ERFAN);
    await user.click(await screen.findByText('فروش تازه'));
    await user.click(screen.getByRole('button', { name: /^فروش محصول/ }));
    const dialog = await screen.findByRole('dialog', { name: 'فروش محصول به عرفان ملکی' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /اپلای ارشد/ }));
    const times = within(dialog).getByRole('region', { name: /^زمان مشاوره‌ی اپلای ارشد/ });
    await user.click(screen.getByRole('button', { name: 'ساختن پرداخت و ارسال فاکتور با پیامک' }));
    expect(await within(dialog).findByText('زمان مشاوره را انتخاب کنید.')).toBeInTheDocument();

    // Each free time is a block naming its consultant; the chosen one is summed up beside it.
    const [block] = within(times).getAllByRole('button', { name: /حسین رحیمی/ });
    if (!block) throw new Error('no free time');
    await user.click(block);
    expect(block).toHaveAttribute('aria-pressed', 'true');
    expect(within(times).getByText(/· حسین رحیمی$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ساختن پرداخت و ارسال فاکتور با پیامک' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ERFAN}/money`));
  });

  it('details: automatically saves a section', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/info`);
    const personal = await screen.findByRole('region', { name: 'مشخصات' });
    const city = within(personal).getByLabelText('شهر محل زندگی');
    await user.clear(city);
    await user.type(city, 'تهران');
    expect(await within(personal).findByText('همهٔ تغییرات ذخیره شد')).toBeInTheDocument();
  });

  it('details: copies the tablet form link to send (it names no customer)', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    renderApp(`${ERFAN}/info`);
    const quick = await screen.findByRole('group', { name: 'دسترسی سریع' });
    // The info tab's own button (the head's quick one is checked below).
    const copy = () =>
      screen
        .getAllByRole('button', { name: 'کپی لینک فرم تبلت' })
        .find((button) => !quick.contains(button)) as HTMLElement;
    await waitFor(() => expect(copy()).toBeDefined());
    await user.click(copy());
    expect(write).toHaveBeenCalledWith('https://scorize.com/panel/background');
    expect(await toasts().findByText(/^لینک فرم تبلت کپی شد/)).toBeInTheDocument();
    write.mockRejectedValueOnce(new Error('denied'));
    await user.click(copy());
    expect(await toasts().findByText('لینک کپی نشد. دوباره امتحان کنید.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'باز کردن فرم تبلت' })).toBeInTheDocument();
    write.mockRestore();
  });

  it('head: the quick actions are icons, and the tablet link copies from there too', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    renderApp(ERFAN);
    const quick = await screen.findByRole('group', { name: 'دسترسی سریع' });
    // Every quick action is an icon with a name, no visible text.
    // WhatsApp, Telegram, the tablet link and the in-person meeting.
    const items = quick.querySelectorAll('a, button');
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item).toHaveAccessibleName();
      expect(item.textContent).toBe('');
    }
    const tablet = within(quick).getByRole('button', { name: 'کپی لینک فرم تبلت' });
    expect(tablet).toHaveAttribute('data-tip', 'کپی لینک فرم تبلت');
    await user.click(tablet);
    expect(write).toHaveBeenCalledWith('https://scorize.com/panel/background');
    expect(await toasts().findByText(/^لینک فرم تبلت کپی شد/)).toBeInTheDocument();
    expect(tablet).toHaveAttribute('data-tip', 'کپی شد');
    write.mockRestore();
  });

  it('purchases: one row per Django invoice, filtered by kind', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/money`);
    const purchases = await screen.findByRole('region', { name: 'خریدها' });
    expect(within(purchases).getByText('نگارش رزومه')).toBeInTheDocument();
    await user.click(within(purchases).getByRole('radio', { name: 'مشاوره' }));
    expect(within(purchases).queryByText('نگارش رزومه')).not.toBeInTheDocument();
    // The paid session and the failed attempt.
    expect(within(purchases).getAllByText('مشاوره‌ی اپلای ارشد')).toHaveLength(2);
    expect(within(purchases).getByText('پرداخت ناموفق')).toBeInTheDocument();
  });

  it('old purchases and payments addresses open the one contract-and-money tab', async () => {
    const router = renderApp(`${ERFAN}/payments?payment=4902`);
    expect(
      await screen.findByRole('region', { name: 'بسته‌ی نمونه انگیزه‌نامه‌ها' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${ERFAN}/money`);
    expect(screen.getByRole('link', { name: /^قرارداد و پول/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('notebook: the team notes are in the shared column, a new one goes to everyone', async () => {
    const user = userEvent.setup();
    renderApp(ERFAN);
    // A phone: the shared column opens from the header.
    await user.click(await screen.findByRole('button', { name: 'درباره‌ی مشتری و یادداشت‌ها' }));
    const notes = await screen.findByRole('region', { name: 'یادداشت‌ها' });
    expect(await within(notes).findByText(/پدرش هزینه را می‌دهد/)).toBeInTheDocument();
    expect(within(notes).getByText('یادداشت قدیمی فروش')).toBeInTheDocument();
    await user.type(within(notes).getByLabelText(/^یادداشت درباره‌ی/), 'تا آخر هفته خبر می‌دهد');
    await user.click(within(notes).getByRole('button', { name: 'سنجاق', pressed: false }));
    await user.click(within(notes).getByRole('button', { name: 'ثبت' }));
    expect(await toasts().findByText('یادداشت ذخیره شد.')).toBeInTheDocument();
    expect(await within(notes).findByText('تا آخر هفته خبر می‌دهد')).toBeInTheDocument();
    // Pinned when written.
    expect(within(notes).getAllByRole('button', { name: 'برداشتن سنجاق' }).length).toBeGreaterThan(
      0,
    );
    // Mine: I can change it.
    await user.click(within(notes).getByRole('button', { name: 'ویرایش' }));
    expect(within(notes).getByLabelText('متن یادداشت')).toHaveValue('تا آخر هفته خبر می‌دهد');
  });

  it('details: countries are picked from the list and removed from their pills', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/info`);
    const goal = await screen.findByRole('region', { name: 'هدف و شرایط' });
    const picked = () =>
      within(within(goal).getByRole('list', { name: 'کشورهای مورد نظر' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent);
    expect(picked()).toEqual(['هلند', 'آلمان']);
    const add = within(goal).getByRole('combobox', { name: 'کشورهای مورد نظر' });
    // A picked country isn't offered again.
    expect(within(add).queryByRole('option', { name: 'آلمان' })).toBeNull();
    await user.selectOptions(add, 'کانادا');
    await user.click(within(goal).getByRole('button', { name: 'حذف هلند' }));
    expect(picked()).toEqual(['آلمان', 'کانادا']);
    expect(await within(goal).findByText('همهٔ تغییرات ذخیره شد')).toBeInTheDocument();
  });

  it('application file is read-only', async () => {
    renderApp(`${ERFAN}/apply`);
    expect(await screen.findByText(/فقط خواندنی/)).toBeInTheDocument();
    expect(screen.getByText('University of Twente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ذخیره' })).not.toBeInTheDocument();
  });

  it('offer: a big discount needs the manager; the draft goes to the manager', async () => {
    const user = userEvent.setup();
    const router = renderApp(`${ERFAN}/offer?step=2`);
    await screen.findByRole('heading', { level: 1, name: 'قرارداد استاندارد' });
    await user.selectOptions(screen.getByLabelText('تخفیف'), '15');
    expect(screen.getByText(/فقط با تأیید مدیر فروش ممکن است/)).toBeInTheDocument();

    // Sending is the last step (S71), after the whole contract is read.
    await user.click(screen.getByRole('button', { name: 'بعدی: متن و متغیرها' }));
    await user.click(await screen.findByRole('button', { name: 'بعدی: پیش‌نمایش و ارسال' }));
    expect(await screen.findByRole('region', { name: 'پیش‌نمایش قرارداد' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'فقط ارسال پیشنهاد به مشتری (پیامک و واتساپ)' }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'ارسال پیش‌نویس قرارداد برای تأیید مدیر' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'عرفان ملکی' });
    expect(router.state.location.pathname).toBe(ERFAN);
  });

  it('offer: the instalments are what was agreed in the session and must add up', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/offer?step=2`);
    await screen.findByRole('heading', { level: 1, name: 'قرارداد استاندارد' });
    const mismatch = 'برای ارسال، جمع اقساط باید با مبلغ قرارداد برابر باشد.';
    const incomplete = 'هر قسط مبلغ می‌خواهد و قسطِ تاریخ‌دار، تاریخ.';
    expect(screen.getByText(/جمع اقساط ۷۰٬۰۰۰٬۰۰۰ تومان از ۷۰٬۰۰۰٬۰۰۰ تومان/)).toBeInTheDocument();

    // The customer pays a bigger prepayment, and the last instalment after the visa.
    const prepayment = screen.getAllByLabelText('مبلغ (تومان)')[0] as HTMLElement;
    await user.clear(prepayment);
    await user.type(prepayment, '40000000');
    expect(screen.getByText(/۱۲٬۰۰۰٬۰۰۰ تومان بیشتر از مبلغ قرارداد/)).toBeInTheDocument();
    expect(screen.getByText(mismatch)).toBeInTheDocument();
    await user.selectOptions(screen.getAllByLabelText('زمان پرداخت')[2] as HTMLElement, 'visa');
    await user.click(screen.getByRole('button', { name: 'تقسیم باقی‌مانده بین قسط‌ها' }));
    expect(screen.getByText(/جمع اقساط ۷۰٬۰۰۰٬۰۰۰ تومان از/)).toBeInTheDocument();
    expect(screen.queryByText(mismatch)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'افزودن قسط' }));
    expect(screen.getByText('قسط ۴')).toBeInTheDocument();
    expect(screen.getByText(incomplete)).toBeInTheDocument(); // the new dated row has no date yet
    await user.click(screen.getByRole('button', { name: 'حذف قسط ۴' }));
    expect(screen.queryByText(incomplete)).not.toBeInTheDocument();

    // On the last step the send button follows the same rule.
    await user.click(screen.getByRole('button', { name: 'رفتن به «پیش‌نمایش و ارسال»' }));
    expect(
      await screen.findByRole('button', { name: 'ارسال پیش‌نویس قرارداد برای تأیید مدیر' }),
    ).toBeEnabled();
  });

  it('new contract: the seller picks a kind on the customer page, then builds it step by step (S71)', async () => {
    const user = userEvent.setup();
    const router = renderApp(ERFAN);
    await screen.findByRole('heading', { level: 1, name: 'عرفان ملکی' });
    await user.click(await screen.findByText('فروش تازه'));
    await user.click(screen.getByRole('button', { name: /^پیشنهاد قرارداد/ }));
    const dialog = await screen.findByRole('dialog', { name: 'کدام قرارداد؟' });
    // Each kind with what it offers, from what price, how much text.
    const turkey = within(dialog).getByRole('radio', { name: /اپلای رایگان ترکیه/ });
    expect(within(dialog).getByText('رایگان')).toBeInTheDocument();
    expect(within(dialog).getByText('۴ ماده · ۱ متغیر')).toBeInTheDocument();
    await user.click(turkey);
    await user.click(within(dialog).getByRole('button', { name: 'ادامه با «اپلای رایگان ترکیه»' }));
    await screen.findByRole('heading', { level: 1, name: 'اپلای رایگان ترکیه' });
    expect(router.state.location.pathname).toBe(`${ERFAN}/offer`);
    expect(router.state.location.search).toBe('?template=1');
    // Four steps; the first one is open.
    const steps = screen.getByRole('list', { name: 'قدم‌های ساختن قرارداد' });
    expect(within(steps).getByText('خدمات و جزئیات').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await user.click(screen.getByRole('button', { name: 'بعدی: مبلغ و اقساط' }));
    await screen.findByRole('button', { name: 'بعدی: متن و متغیرها' });
    expect(router.state.location.search).toBe('?template=1&step=2');
  });

  it('the summary shows the contract on its way, and the chooser offers to continue it (S71)', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/offer?step=4`);
    await user.click(
      await screen.findByRole('button', { name: 'ارسال پیش‌نویس قرارداد برای تأیید مدیر' }),
    );
    const card = await screen.findByRole('region', { name: 'قرارداد · قرارداد استاندارد' });
    expect(within(card).getByText('منتظر تأیید مدیر')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'پیش‌نمایش' })).toHaveAttribute(
      'href',
      expect.stringContaining('/offer?step=4'),
    );
    // The chooser offers to continue the open one.
    await user.click(await screen.findByText('فروش تازه'));
    await user.click(screen.getByRole('button', { name: /^پیشنهاد قرارداد/ }));
    const dialog = await screen.findByRole('dialog', { name: 'کدام قرارداد؟' });
    expect(
      within(dialog).getByText(/یک قرارداد باز دارد: «قرارداد استاندارد»/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'ادامه‌ی همان' })).toBeInTheDocument();
  });
});

describe('instalment schedule', () => {
  it('suggests 40% at signing (rounded to 100,000), the rest monthly from the start', () => {
    const rows = suggestedSchedule(70_000_000, 3, '2026-11-22');
    expect(rows.map((row) => row.amount)).toEqual([28_000_000, 21_000_000, 21_000_000]);
    expect(rows.map((row) => row.when)).toEqual(['signing', 'date', 'date']);
    expect(rows[1]?.date).toBe('2026-12-22');
    expect(suggestedSchedule(5, 1, '2026-11-22')).toEqual([
      { amount: 5, when: 'signing', date: null },
    ]);
  });

  it('spreads what is left after the prepayment, and checks the rows', () => {
    const rows = spreadRest(
      [
        { amount: 50_000_000, when: 'signing', date: null },
        { amount: 0, when: 'admission', date: null },
        { amount: 0, when: 'visa', date: null },
      ],
      104_500_000,
    );
    expect(rows.map((row) => row.amount)).toEqual([50_000_000, 27_250_000, 27_250_000]);
    expect(scheduleTotal(rows)).toBe(104_500_000);
    expect(scheduleComplete(rows)).toBe(true);
    expect(scheduleComplete([{ amount: 1, when: 'date', date: null }])).toBe(false);
  });
});

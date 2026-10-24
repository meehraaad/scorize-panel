import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const NIMA = 3; // seller (src/mocks/tasks.ts)

const openTasks = async () => {
  renderApp('/sales/tasks');
  await screen.findByRole('heading', { level: 1, name: 'کارهای امروز' });
};

describe('tasks page (sales panel)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });

  it('groups my follow-ups and flags people with no next step', async () => {
    await openTasks();
    expect(screen.getByRole('heading', { name: /^عقب‌افتاده/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '۳ مشتری فعال قدم بعدی ندارند' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تعیین قدم بعدی' })).toHaveAttribute(
      'href',
      '/sales/customers/109',
    );
  });

  it('done asks for the next step; without one it needs a reason', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: 'انجام شد: تماس دوم؛ دیروز جواب نداد' }));
    const dialog = await screen.findByRole('dialog', { name: 'پیگیری انجام شد' });
    expect(within(dialog).getByLabelText('قدم بعدی')).toHaveValue(
      'تماس سوم، اگر جواب نداد پیام واتساپ',
    );
    await user.click(within(dialog).getByRole('radio', { name: 'جواب نداد' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'این مشتری پیگیری دیگری لازم ندارد' }),
    );
    expect(within(dialog).getByLabelText('چرا پیگیری دیگری لازم نیست؟')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ثبت و بستن پیگیری' }));

    expect(await screen.findByText('انجام‌شده‌های امروز: ۶')).toBeInTheDocument();
    expect(screen.queryByText('تماس دوم؛ دیروز جواب نداد')).not.toBeInTheDocument();
  });

  it('pushes a follow-up to tomorrow', async () => {
    const user = userEvent.setup();
    await openTasks();
    const row = screen
      .getByText('بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود')
      .closest('li');
    if (!row) throw new Error('row not found');
    await user.click(within(row).getByRole('button', { name: 'عقب بینداز' }));
    await user.click(within(row).getByRole('button', { name: 'فردا ۱۰:۰۰' }));
    expect(await screen.findByText('فردا: ۸ پیگیری')).toBeInTheDocument();
  });

  it('requests: starts one, answers in its conversation, finishes it', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: /^درخواست‌ها به من/ }));
    await user.click(screen.getByRole('button', { name: 'دیدم، شروع می‌کنم' }));
    expect(await screen.findByText('در حال انجام')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^باز کردن: پذیرش Uppsala/ }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(/نگران وقت سفارت است/);
    await user.type(within(dialog).getByLabelText('پیام برای مریم'), 'امروز زنگ می‌زنم');
    await user.click(within(dialog).getByRole('button', { name: 'ارسال' }));
    expect(await within(dialog).findByText('امروز زنگ می‌زنم')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'انجام شد و به مریم خبر بده' }));
    const row = (await screen.findAllByText(/^پذیرش Uppsala/))[0]?.closest('li');
    if (!row) throw new Error('row not found');
    expect(await within(row).findByText('انجام شد')).toBeInTheDocument();
  });

  it('team queue: taking a task moves it to my follow-ups', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: /^صف تیم/ }));
    await user.click(screen.getByRole('button', { name: /^برمی‌دارم: درخواست تماس از پنل/ }));
    expect(await screen.findByText('برداشتید؛ به «پیگیری‌های من» رفت')).toBeInTheDocument();
  });

  it('sends an internal request to a colleague', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: 'درخواست داخلی از همکار' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'نمونه قرارداد ترکیه را بفرست');
    await user.click(screen.getByRole('button', { name: 'فرستادن درخواست' }));
    const sent = screen.getByRole('region', { name: 'درخواست‌هایی که فرستاده‌ام' });
    expect(await within(sent).findByText('نمونه قرارداد ترکیه را بفرست')).toBeInTheDocument();
  });
});

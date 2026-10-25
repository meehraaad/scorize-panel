import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const NIMA = 3; // seller (src/mocks/staff.ts)

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

  // Tasks are Django's StaffToDo (src/mocks/staff.ts): a deadline is a date, there are no team
  // queues or "no next step" lists yet (backend-changes T3–T8).
  it('groups my follow-ups by day and links the person', async () => {
    await openTasks();
    expect(await screen.findByRole('heading', { name: /^عقب‌افتاده/ })).toBeInTheDocument();
    expect(screen.getByText('تماس دوم؛ دیروز جواب نداد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'سمیرا نوروزی' })).toHaveAttribute(
      'href',
      '/sales/customers/106',
    );
    expect(screen.queryByText(/قدم بعدی ندارند/)).not.toBeInTheDocument();
    expect(screen.getByText('فردا: ۱ پیگیری')).toBeInTheDocument();
  });

  it('done with a next step makes the next task; without one it needs a reason', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(
      await screen.findByRole('button', { name: 'انجام شد: تماس دوم؛ دیروز جواب نداد' }),
    );
    let dialog = await screen.findByRole('dialog', { name: 'پیگیری انجام شد' });
    await user.type(within(dialog).getByLabelText('قدم بعدی'), 'پیام واتساپ بفرست');
    await user.click(within(dialog).getByRole('radio', { name: 'فردا ۱۰:۰۰' }));
    await user.click(screen.getByRole('button', { name: 'ثبت و ساختن قدم بعدی' }));
    expect(await screen.findByText('فردا: ۲ پیگیری')).toBeInTheDocument();
    expect(screen.queryByText('تماس دوم؛ دیروز جواب نداد')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'انجام شد: بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود',
      }),
    );
    dialog = await screen.findByRole('dialog', { name: 'پیگیری انجام شد' });
    await user.click(
      within(dialog).getByRole('button', { name: 'این مشتری پیگیری دیگری لازم ندارد' }),
    );
    expect(within(dialog).getByLabelText('چرا پیگیری دیگری لازم نیست؟')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ثبت و بستن پیگیری' }));
    await waitFor(() =>
      expect(
        screen.queryByText('بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود'),
      ).not.toBeInTheDocument(),
    );
  });

  it('pushes a follow-up to tomorrow', async () => {
    const user = userEvent.setup();
    await openTasks();
    const row = (
      await screen.findByText('بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود')
    ).closest('li');
    if (!row) throw new Error('row not found');
    await user.click(within(row).getByRole('button', { name: 'عقب بینداز' }));
    await user.click(within(row).getByRole('button', { name: 'فردا ۱۰:۰۰' }));
    expect(await screen.findByText('فردا: ۲ پیگیری')).toBeInTheDocument();
  });

  it('requests: starts one, answers in its conversation, finishes it', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: /^درخواست‌ها به من/ }));
    await user.click(await screen.findByRole('button', { name: 'دیدم، شروع می‌کنم' }));
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

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import type { TasksOverview } from '@/lib/tasks/api';
import { http, HttpResponse } from 'msw';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

const NIMA = 3; // seller (src/mocks/staff.ts)
const SUPERVISOR = 2; // src/mocks/supervisor.ts

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

  it.each([
    [{ week: 0.86, last_week: 1, target: 0.9 }, '۸۶٪', 'هفته‌ی پیش ۱۰۰٪ · هدف تیم ۹۰٪'],
    // Nothing done or overdue yet: a dash, not a made-up 100%.
    [{ week: null, last_week: null, target: 0.9 }, '—', 'هفته‌ی پیش کاری سررسید نشد · هدف تیم ۹۰٪'],
  ])('on time: shows the shares Django counted (%o)', async (onTime, week, note) => {
    const overview = await api<TasksOverview>('/staff/v1/tasks/?panel=sales');
    server.use(
      http.get('/api/staff/v1/tasks/', () => HttpResponse.json({ ...overview, on_time: onTime })),
    );
    await openTasks();
    expect(screen.getByText(week)).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
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
    // The row leaves at once (optimistic): let the server finish before the next test.
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
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

  it('sent requests: one name and a count, a tick when done, and they open', async () => {
    const user = userEvent.setup();
    const overview = await api<TasksOverview>('/staff/v1/tasks/?panel=sales');
    const requests = await api<{ results: { id: number }[] }>(
      '/staff/v1/tasks/lists/requests/?panel=sales&page=1',
    );
    const request = requests.results[0];
    if (!request) throw new Error('no request in the mock');
    server.use(
      http.get('/api/staff/v1/tasks/', () =>
        HttpResponse.json({
          ...overview,
          sent: [
            {
              id: request.id,
              text: 'نصب سافت‌فون',
              to: { name: 'مهران درمنکی', others: 45 },
              at: new Date().toISOString(),
              status: 'done',
              comments: 3,
              reactions: [{ emoji: '👍', count: 18, mine: true }],
              progress: { done: 18, total: 46 },
            },
          ],
        }),
      ),
    );
    await openTasks();
    const sent = screen.getByRole('region', { name: 'درخواست‌هایی که فرستاده‌ام' });
    expect(
      within(sent).getByText(
        /^به مهران درمنکی و ۴۵ نفر دیگر · .* · ۱۸ از ۴۶ نفر انجام داده‌اند · ۳ پیام$/,
      ),
    ).toBeInTheDocument();
    expect(within(sent).getByRole('img', { name: 'موافق: ۱۸ نفر' })).toBeInTheDocument();
    expect(within(sent).getByRole('img', { name: 'انجام شد' })).toBeInTheDocument();
    await user.click(within(sent).getByRole('button', { name: /نصب سافت‌فون/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /خبر بده/ })).not.toBeInTheDocument();
  });

  it('new task: several colleagues get one row with their names, and it needs someone', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'نمونه قرارداد ترکیه را بفرست');
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن درخواست' }));
    expect(within(dialog).getByText('دست‌کم یک همکار را انتخاب کنید.')).toBeInTheDocument();

    const boxes = within(dialog).getAllByRole('checkbox');
    const [first, second] = boxes;
    if (!first || !second) throw new Error('fewer than two colleagues in the mock');
    await user.click(first);
    await user.click(second);
    expect(
      within(dialog).getByText('هر کدام جداگانه انجامش می‌دهند و شما پیشرفت هر نفر را می‌بینید.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن به ۲ نفر' }));
    expect(await screen.findByText('برای ۲ نفر فرستاده شد.')).toBeInTheDocument();
    const sent = screen.getByRole('region', { name: 'درخواست‌هایی که فرستاده‌ام' });
    const row = (await within(sent).findByText('نمونه قرارداد ترکیه را بفرست')).closest('button');
    if (!row) throw new Error('row not found');
    expect(within(row).getByText(/ و ۱ نفر دیگر · /)).toBeInTheDocument();
  });

  it('new task for me lands in my follow-ups; one for a team goes to its queue', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    let dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'گزارش هفته را بنویس');
    await user.click(within(dialog).getByRole('radio', { name: 'خودم' }));
    await user.click(within(dialog).getByRole('button', { name: 'افزودن به کارهای من' }));
    expect(await screen.findByText('به کارهای شما اضافه شد.')).toBeInTheDocument();
    expect(await screen.findByText('فردا: ۲ پیگیری')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'ترجمه‌ی ریزنمرات');
    await user.click(within(dialog).getByRole('radio', { name: 'یک تیم' }));
    await user.click(within(dialog).getByRole('radio', { name: 'تیم مدارک' }));
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن به صف تیم' }));
    expect(await screen.findByText('در صف تیم گذاشته شد.')).toBeInTheDocument();
  });

  it('reactions: adds mine from the popup, shows who, and the row counts it', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: /^درخواست‌ها به من/ }));
    await user.click(await screen.findByRole('button', { name: /^باز کردن: پذیرش Uppsala/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'افزودن واکنش' }));
    await user.click(within(dialog).getByRole('button', { name: 'ممنون' }));
    const mine = await within(dialog).findByRole('button', { name: 'ممنون: ۱ نفر' });
    expect(mine).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByText('🙏 شما')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'بستن' }));
    const row = (await screen.findAllByText(/^پذیرش Uppsala/))[0]?.closest('li');
    if (!row) throw new Error('row not found');
    expect(await within(row).findByRole('img', { name: 'ممنون: ۱ نفر' })).toBeInTheDocument();
  });
});

describe('tasks page (supervisor panel)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(SUPERVISOR));
  });

  it('a request to several colleagues: how many have done it, and each one', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/tasks');
    await screen.findByRole('heading', { level: 1, name: 'کارهای امروز' });
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'فرم جدید را امضا کنید');
    await user.type(within(dialog).getByRole('searchbox'), 'رض');
    for (const box of within(dialog).getAllByRole('checkbox')) await user.click(box);
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن به ۲ نفر' }));
    const sent = screen.getByRole('region', { name: 'درخواست‌هایی که فرستاده‌ام' });
    await user.click(await within(sent).findByRole('button', { name: /فرم جدید را امضا کنید/ }));
    const popup = await screen.findByRole('dialog', { name: 'فرم جدید را امضا کنید' });
    expect(
      await within(popup).findByRole('heading', { name: '۰ از ۲ نفر انجام داده‌اند' }),
    ).toBeInTheDocument();
    expect(within(popup).getByText('علی رضایی')).toBeInTheDocument();
    expect(within(popup).getByText('الهام رضوی')).toBeInTheDocument();
  });
});

describe('tasks page, server refuses', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });

  it('a task marked done comes back when the server refuses', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/staff/v1/tasks/:id/done/', () =>
        HttpResponse.json({ detail: 'no' }, { status: 400 }),
      ),
    );
    await openTasks();
    const text = 'بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود';
    await user.click(await screen.findByRole('button', { name: `انجام شد: ${text}` }));
    const dialog = await screen.findByRole('dialog', { name: 'پیگیری انجام شد' });
    await user.type(within(dialog).getByLabelText('قدم بعدی'), 'پیام واتساپ بفرست');
    await user.click(within(dialog).getByRole('radio', { name: 'فردا ۱۰:۰۰' }));
    await user.click(screen.getByRole('button', { name: 'ثبت و ساختن قدم بعدی' }));
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});

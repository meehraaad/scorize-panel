import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { api } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import type { MyTask, TasksOverview } from '@/lib/tasks/api';
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
  it('overdue follow-ups lead «نیازمند توجه» and link the person', async () => {
    await openTasks();
    const attention = await screen.findByRole('region', { name: 'نیازمند توجه' });
    const late = 'زنگ بزن و جواب خانواده درباره‌ی پیشنهاد اپلای آلمان را بگیر';
    expect(await within(attention).findByText(late)).toBeInTheDocument();
    // Not twice: the list below keeps only what is still ahead today.
    expect(screen.getAllByText(late)).toHaveLength(1);
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

  it('a follow-up opens in a popup to talk and react; done is a tick', async () => {
    const user = userEvent.setup();
    await openTasks();
    const text = 'تماس دوم؛ دیروز جواب نداد';
    expect(await screen.findByRole('button', { name: `انجام شد: ${text}` })).toHaveAttribute(
      'title',
      `انجام شد: ${text}`,
    );
    await user.click(screen.getByRole('button', { name: `باز کردن: ${text}` }));
    const dialog = await screen.findByRole('dialog', { name: text });
    expect(await within(dialog).findByRole('button', { name: 'افزودن واکنش' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('list', { name: 'وضعیت درخواست' })).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('پیام شما'), 'شماره‌ی دوم را امتحان کردم');
    await user.click(within(dialog).getByRole('button', { name: 'ارسال' }));
    expect(await within(dialog).findByText('شماره‌ی دوم را امتحان کردم')).toBeInTheDocument();
  });

  it('task rows carry no snooze button', async () => {
    await openTasks();
    await screen.findByText('بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود');
    expect(screen.queryByRole('button', { name: 'عقب بینداز' })).toBeNull();
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
    expect(
      await within(row).findByRole('button', { name: /^انجام شد: پذیرش Uppsala/ }),
    ).toBeInTheDocument();
  });

  it('opens on the list the address asks for (the calendar links here)', async () => {
    renderApp('/sales/tasks?view=requests');
    expect(
      await screen.findByRole('button', { name: /^درخواست‌ها به من/, pressed: true }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'دیدم، شروع می‌کنم' })).toBeInTheDocument();
  });

  it('?day= lists only what is due that day, ahead too, until the day is cleared', async () => {
    const user = userEvent.setup();
    const ahead = new Date();
    ahead.setDate(ahead.getDate() + 2);
    renderApp(`/sales/tasks?day=${toValue(ahead, false)}`);
    expect(await screen.findByText('یادآوری مدارک')).toBeInTheDocument();
    expect(screen.getByText('تماس دوباره درباره‌ی پیشنهاد')).toBeInTheDocument();
    expect(screen.queryByText(/^فردا: /)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'نمایش همه‌ی روزها' }));
    await waitFor(() => expect(screen.queryByText('یادآوری مدارک')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'نمایش همه‌ی روزها' })).not.toBeInTheDocument();
  });

  it('sent requests wait in «نیازمند توجه»: one name and a count, progress, and they open', async () => {
    const user = userEvent.setup();
    const overview = await api<TasksOverview>('/staff/v1/tasks/?panel=sales');
    const requests = await api<{ results: { id: number }[] }>(
      '/staff/v1/tasks/lists/requests/?panel=sales&page=1',
    );
    const request = requests.results[0];
    if (!request) throw new Error('no request in the mock');
    const sent = (id: number, text: string, status: string) => ({
      id,
      text,
      to: { name: 'مهران درمنکی', others: 45 },
      at: new Date().toISOString(),
      due_at: new Date(Date.now() + 3_600_000).toISOString(),
      timed: true,
      status,
      comments: 3,
      reactions: [],
      progress: { done: 18, total: 46 },
    });
    server.use(
      http.get('/api/staff/v1/tasks/', () =>
        HttpResponse.json({
          ...overview,
          sent: [
            sent(request.id, 'نصب سافت‌فون', 'in_progress'),
            sent(request.id + 1, 'تمام شده', 'done'),
          ],
        }),
      ),
    );
    await openTasks();
    const attention = screen.getByRole('region', { name: 'نیازمند توجه' });
    await user.click(within(attention).getByRole('button', { name: /^فرستاده‌ام/ }));
    const row = within(attention).getByText('نصب سافت‌فون').closest('li');
    if (!row) throw new Error('row not found');
    expect(within(row).getByText('مهران درمنکی و ۴۵ نفر دیگر')).toBeInTheDocument();
    expect(within(row).getByText('۱۸ از ۴۶')).toBeInTheDocument();
    // A request everyone has done no longer waits.
    expect(within(attention).queryByText('تمام شده')).toBeNull();
    // Only overdue: the sent one steps aside.
    await user.click(within(attention).getByRole('button', { name: /^عقب‌افتاده/ }));
    expect(within(attention).queryByText('نصب سافت‌فون')).toBeNull();
    await user.click(within(attention).getByRole('button', { name: /^همه/ }));
    await user.click(within(attention).getByRole('button', { name: 'باز کردن: نصب سافت‌فون' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /خبر بده/ })).not.toBeInTheDocument();
  });

  it('new task: a seller adds one for themselves, and it lands in their follow-ups', async () => {
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    // A colleague, of any panel, but not the whole team (the sales admin's).
    expect(within(dialog).getByRole('radio', { name: /^برای همکارم/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('radio', { name: /^برای کل تیم/ })).toBeNull();
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'گزارش هفته را بنویس');
    await user.click(within(dialog).getByRole('radio', { name: 'تاریخ و ساعت دیگر' }));
    await user.click(within(dialog).getByRole('button', { name: 'ثبت برای خودم' }));
    expect(await within(dialog).findByText('تاریخ و ساعت را انتخاب کنید.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'فردا ۱۰:۰۰' }));
    await user.click(within(dialog).getByRole('button', { name: 'ثبت برای خودم' }));
    expect(
      await screen.findByText(/^به کارهای شما اضافه شد\. .+ در «پیگیری‌های من» می‌آید\.$/),
    ).toBeInTheDocument();
    expect(await screen.findByText('فردا: ۲ پیگیری')).toBeInTheDocument();
  });

  it('new task: a seller sends one to another panel’s colleague', async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/staff/v1/tasks/', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.click(within(dialog).getByRole('radio', { name: /^برای همکارم/ }));
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'پست اینستاگرام را بررسی کن');
    await user.type(within(dialog).getByRole('combobox', { name: 'همکار' }), 'مینا');
    await user.click(await within(dialog).findByRole('option', { name: /مینا صادقی/ }));
    // No penalty key: no penalty switch.
    expect(within(dialog).queryByRole('switch', { name: /جریمه/ })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: /^فرستادن به/ }));
    await waitFor(() =>
      expect(sent).toMatchObject({ panel: 'sales', kind: 'request', assignees: [12] }),
    );
    expect(sent).not.toHaveProperty('penalty');
  });

  it('new task: «از تقویم» picks its time on the seller’s week', async () => {
    // Tuesday 5 Aban 1405, noon.
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 12, 0), toFake: ['Date'] });
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/staff/v1/tasks/', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    try {
      await openTasks();
      await user.click(screen.getByRole('button', { name: 'کار تازه' }));
      const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
      await user.type(within(dialog).getByLabelText('چه کاری؟'), 'گزارش هفته را بنویس');
      await user.click(within(dialog).getByRole('button', { name: 'از تقویم' }));
      const picker = await screen.findByRole('dialog', { name: 'انتخاب وقت از تقویم' });
      // The seller's week loads with the window.
      await user.click(await within(picker).findByRole('button', { name: 'هفته‌ی بعد' }));
      // Next Wednesday's column (Saturday first); the grid starts at 9, an hour is 44px: 14:00.
      fireEvent.click(within(picker).getAllByTestId('schedule-slot')[4] as HTMLElement, {
        clientY: 220,
      });
      await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
      expect(within(dialog).getByRole('button', { pressed: true })).toHaveTextContent(/۱۴:۰۰$/);
      expect(within(dialog).getByRole('radio', { name: 'تاریخ و ساعت دیگر' })).toBeChecked();
      await user.click(within(dialog).getByRole('button', { name: 'ثبت برای خودم' }));
      await waitFor(() =>
        expect(sent).toMatchObject({
          panel: 'sales',
          kind: 'mine',
          due_at: new Date(2026, 10, 4, 14, 0).toISOString(),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('new task: the sales manager sends one to a colleague found by name, and it needs someone', async () => {
    localStorage.setItem('scorize.mock.session', '4');
    const user = userEvent.setup();
    await openTasks();
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    expect(within(dialog).getByText('مدیر این پنل')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: /^برای همکارم/ }));
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'نمونه قرارداد ترکیه را بفرست');
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن درخواست' }));
    expect(within(dialog).getByText('دست‌کم یک همکار را انتخاب کنید.')).toBeInTheDocument();
    const search = within(dialog).getByRole('combobox', { name: 'همکار' });
    await user.type(search, 'ن');
    expect(within(dialog).getByText('از دو حرف به بعد جست‌وجو می‌شود.')).toBeInTheDocument();
    await user.type(search, 'یما');
    await user.click(await within(dialog).findByRole('option', { name: /نیما رستمی/ }));
    expect(within(dialog).getByRole('button', { name: 'برداشتن نیما رستمی' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن به نیما رستمی' }));
    expect(await screen.findByText('برای ۱ نفر فرستاده شد.')).toBeInTheDocument();
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
    // Under the task's message in the chat; who reacted is the chip's tooltip.
    expect(mine).toHaveAttribute('title', 'شما');
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

  it('«از تقویم» opens my week of the panel, with its «کارها» row', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/tasks');
    await screen.findByRole('heading', { level: 1, name: 'کارهای امروز' });
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.click(within(dialog).getByRole('button', { name: 'از تقویم' }));
    const picker = await screen.findByRole('dialog', { name: /تقویم/ });
    // The «کارها» row: the day's task with no hour, as a chip (a week with nothing timed keeps
    // every day full width).
    expect(await within(picker).findByTitle('جمع‌بندی پرونده‌های هفته')).toBeInTheDocument();
  });

  it("the panel's admin finds colleagues of other panels too", async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/tasks');
    await screen.findByRole('heading', { level: 1, name: 'کارهای امروز' });
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.click(within(dialog).getByRole('radio', { name: /^برای همکارم/ }));
    await user.type(within(dialog).getByRole('combobox', { name: 'همکار' }), 'صادق');
    expect(await within(dialog).findByRole('option', { name: /مینا صادقی/ })).toBeInTheDocument();
  });

  it('a request to several colleagues: how many have done it, and each one', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/tasks');
    await screen.findByRole('heading', { level: 1, name: 'کارهای امروز' });
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.click(within(dialog).getByRole('radio', { name: /^برای همکارم/ }));
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'فرم جدید را امضا کنید');
    const search = within(dialog).getByRole('combobox', { name: 'همکار' });
    for (const name of ['علی رضایی', 'الهام رضوی']) {
      await user.type(search, 'رض');
      await user.click(await within(dialog).findByRole('option', { name: new RegExp(name) }));
    }
    expect(
      within(dialog).getByText('هر کدام جداگانه انجامش می‌دهند و شما پیشرفت هر نفر را می‌بینید.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن به ۲ نفر' }));
    const attention = await screen.findByRole('region', { name: 'نیازمند توجه' });
    await user.click(
      await within(attention).findByRole('button', { name: 'باز کردن: فرم جدید را امضا کنید' }),
    );
    const popup = await screen.findByRole('dialog', { name: 'فرم جدید را امضا کنید' });
    expect(
      await within(popup).findByRole('heading', { name: '۰ از ۲ نفر انجام داده‌اند' }),
    ).toBeInTheDocument();
    expect(within(popup).getByText('علی رضایی')).toBeInTheDocument();
    expect(within(popup).getByText('الهام رضوی')).toBeInTheDocument();
  });
});

describe('tasks page (supervisor panel): the whole team', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(SUPERVISOR));
  });

  it('the admin sends one to the whole team: each gets a copy, no colleague to pick', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/tasks');
    await screen.findByRole('heading', { level: 1, name: 'کارهای امروز' });
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.click(within(dialog).getByRole('radio', { name: /^برای کل تیم/ }));
    expect(within(dialog).queryByRole('combobox', { name: 'همکار' })).toBeNull();
    // No penalty key: no penalty switch.
    expect(within(dialog).queryByRole('switch', { name: /جریمه/ })).toBeNull();
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'جلسه‌ی هفتگی پرونده‌ها');
    await user.click(within(dialog).getByRole('button', { name: 'فرستادن به کل تیم' }));
    expect(await screen.findByText('برای کل تیم فرستاده شد.')).toBeInTheDocument();
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

  it('a task about no one (a card step, a checklist step) is simply done, with no outcome to ask', async () => {
    const user = userEvent.setup();
    const task: MyTask = {
      id: 9002,
      text: 'نوشتن کپشن · ریلز آلمان',
      due_at: new Date().toISOString(),
      timed: false,
      person: null,
      source: 'system',
      snoozed: 0,
      step: null,
      action: 'call',
      note: '',
      suggested_next: '',
      follow_up: false,
      receipt: null,
      penalty: false,
    };
    const sent: unknown[] = [];
    server.use(
      http.get('/api/staff/v1/tasks/lists/mine/', () =>
        HttpResponse.json({ count: 1, page_size: 20, next: null, previous: null, results: [task] }),
      ),
      http.post('/api/staff/v1/tasks/9002/status/', async ({ request }) => {
        sent.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await openTasks();
    await user.click(await screen.findByRole('button', { name: `انجام شد: ${task.text}` }));
    expect(screen.queryByRole('dialog', { name: 'پیگیری انجام شد' })).toBeNull();
    await waitFor(() => expect(sent).toEqual([{ status: 'done' }]));
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  });

  describe('S79: a meeting at the office is the follow-up', () => {
    const flags = ON_SERVER as { visitFollowUp: boolean };
    beforeEach(() => {
      flags.visitFollowUp = true;
    });
    afterEach(() => {
      flags.visitFollowUp = false;
    });

    /** One follow-up of mine: a meeting at the office, started (`minutes` ago) or ahead. */
    function meetingTask(minutes: number) {
      const at = new Date(Date.now() - minutes * 60_000).toISOString();
      const task: MyTask = {
        id: 9001,
        text: 'جلسه حضوری با عرفان ملکی',
        due_at: at,
        timed: true,
        person: { id: 105, name: 'عرفان ملکی', context: '' },
        source: 'me',
        snoozed: 0,
        step: null,
        action: 'call',
        note: '',
        suggested_next: '',
        follow_up: true,
        receipt: null,
        penalty: false,
        visit: { id: 7, starts_at: at },
      };
      const sent: unknown[] = [];
      server.use(
        http.get('/api/staff/v1/tasks/lists/mine/', () =>
          HttpResponse.json({
            count: 1,
            page_size: 20,
            next: null,
            previous: null,
            results: [task],
          }),
        ),
        http.post('/api/staff/v1/tasks/9001/done/', async ({ request }) => {
          sent.push(await request.json());
          return new HttpResponse(null, { status: 204 });
        }),
      );
      return sent;
    }

    it('a held meeting is done with met or no-show; a no-show suggests booking again', async () => {
      const sent = meetingTask(30);
      const user = userEvent.setup();
      await openTasks();
      await user.click(
        await screen.findByRole('button', { name: 'انجام شد: جلسه حضوری با عرفان ملکی' }),
      );
      const dialog = await screen.findByRole('dialog', { name: 'پیگیری انجام شد' });
      expect(within(dialog).getByRole('radio', { name: 'جلسه برگزار شد' })).toBeChecked();
      expect(within(dialog).queryByRole('radio', { name: 'صحبت کردیم' })).toBeNull();
      await user.click(within(dialog).getByRole('radio', { name: 'به جلسه نیامد' }));
      expect(within(dialog).getByLabelText('قدم بعدی')).toHaveValue('تماس برای گذاشتن جلسه‌ی تازه');
      await user.click(screen.getByRole('button', { name: 'ثبت و ساختن قدم بعدی' }));
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toMatchObject({
        outcome: 'no_show',
        next: { text: 'تماس برای گذاشتن جلسه‌ی تازه' },
      });
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });
  });
});

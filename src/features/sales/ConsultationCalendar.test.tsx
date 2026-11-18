import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import { server } from '@/test/server';

const NIMA = 3; // seller (mock user in src/mocks/handlers.ts)
const REZA = 4; // sales manager

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

/*
 * The mock's consultations (src/mocks/sales.ts), from Tuesday 5 Aban 1405 (27 Oct 2026) noon:
 * yesterday two not logged (online; in person), today one logged, in 20 minutes one in person,
 * in 5 hours one online, in 2 days one in person. Odd ids filled the tablet form.
 */
describe('sales: my consultations on a week calendar', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 12, 0), toFake: ['Date'] });
    localStorage.clear();
    await i18n.changeLanguage('fa');
    loginAs(NIMA);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const open = async () => {
    renderApp('/sales/calendar');
    return screen.findByRole('region', { name: 'مشاوره‌های من' });
  };

  it('shows the week: state, how it is held, the tablet form', async () => {
    const calendar = await open();
    expect(screen.getByRole('heading', { name: '۲ تا ۸ آبان ۱۴۰۵' })).toBeInTheDocument();
    const blocks = within(calendar).getAllByRole('button', { pressed: false });
    const label = (pattern: RegExp) =>
      blocks.filter((block) => pattern.test(block.getAttribute('aria-label') ?? ''));
    expect(label(/ثبت نشده/)).toHaveLength(2);
    expect(label(/برگزار و ثبت شد/)).toHaveLength(1);
    expect(label(/تا ۳۰ دقیقه‌ی دیگر/)).toHaveLength(1);
    expect(label(/حضوری/)).toHaveLength(3);
    expect(label(/فرم تبلت را هنوز پر نکرده/)).toHaveLength(3);
  });

  it('in person, soon: waiting for the customer, then marked arrived', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    await user.click(within(calendar).getByRole('button', { name: /تا ۳۰ دقیقه‌ی دیگر/ }));
    const card = within(calendar).getByRole('dialog');
    expect(within(card).getByText('منتظر مراجعه‌ی مشتری')).toBeInTheDocument();
    // The name opens the customer's page.
    const name = within(card).getAllByRole('link')[0] as HTMLElement;
    expect(name).toHaveAttribute('href', expect.stringMatching(/\/customers\/\d+$/));
    expect(within(card).getByText('فرم تبلت را هنوز پر نکرده')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'فرستادن لینک فرم' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/'),
    );
    await user.click(within(card).getByRole('button', { name: 'مشتری رسید' }));
    expect(await toasts().findByText(/ثبت شد\.$/)).toBeInTheDocument();
    expect(await within(card).findAllByText('مشتری رسیده')).not.toHaveLength(0);
  });

  it('online, later today: a reminder; not logged: the session log', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    await user.click(within(calendar).getByRole('button', { name: /تلفنی، پیش رو/ }));
    let card = within(calendar).getByRole('dialog');
    expect(within(card).getByRole('link', { name: 'یادآوری در واتساپ' })).toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: 'فرستادن لینک فرم' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'بستن' }));

    await user.click(
      within(calendar).getAllByRole('button', { name: /ثبت نشده/ })[0] as HTMLElement,
    );
    card = within(calendar).getByRole('dialog');
    await user.click(within(card).getByRole('button', { name: /^ثبت جلسه: / }));
    const log = await screen.findByRole('dialog', { name: /^ثبت جلسه‌ی / });
    // A booked session's log has no channel to choose: it names the session instead.
    expect(within(log).queryByRole('radio', { name: 'حضوری' })).not.toBeInTheDocument();
    expect(
      within(log).getByRole('button', { name: /ثبت جلسه و ساختن پیگیری/ }),
    ).toBeInTheDocument();
  });

  it('only the unlogged, and a type hidden', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    await user.click(screen.getByRole('checkbox', { name: 'فقط بدون ثبت جلسه ۲' }));
    expect(screen.getByRole('checkbox', { name: 'فقط بدون ثبت جلسه ۲' })).toBeChecked();
    expect(within(calendar).getAllByRole('button', { pressed: false })).toHaveLength(2);
    await user.click(screen.getByRole('checkbox', { name: 'فقط بدون ثبت جلسه ۲' }));
    await user.click(screen.getByRole('checkbox', { name: /مشاوره‌ی ویزای تحصیلی/ }));
    expect(within(calendar).queryAllByRole('button', { name: /ویزای تحصیلی/ })).toHaveLength(0);
  });

  it('types: clear all, then one ticked; kinds: consultations and tasks hidden', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    const sessions = () =>
      within(calendar)
        .queryAllByRole('button', { pressed: false })
        .filter((block) => /، (تلفنی|حضوری)، /.test(block.getAttribute('aria-label') ?? ''));
    expect(sessions().length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'برداشتن همه' }));
    expect(sessions()).toHaveLength(0);
    await user.click(screen.getByRole('checkbox', { name: /مشاوره‌ی ویزای تحصیلی/ }));
    expect(sessions().length).toBeGreaterThan(0);
    expect(
      sessions().every((block) => /ویزای تحصیلی/.test(block.getAttribute('aria-label') ?? '')),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'انتخاب همه' }));
    await user.click(screen.getByRole('checkbox', { name: /^مشاوره[\s۰-۹]*$/ }));
    expect(sessions()).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: /مشاوره‌ی ویزای تحصیلی/ })).toBeDisabled();
    expect(within(calendar).getAllByRole('link', { name: /^کارهای / }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('checkbox', { name: /^کار[\s۰-۹]*$/ }));
    expect(within(calendar).queryAllByRole('link', { name: /^کارهای / })).toHaveLength(0);
  });

  it('only in person, or only online', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    const blocks = () =>
      within(calendar)
        .queryAllByRole('button', { pressed: false })
        .filter((block) => /، (تلفنی|حضوری)، /.test(block.getAttribute('aria-label') ?? ''));
    await user.click(screen.getByRole('button', { name: /^حضوری/ }));
    expect(blocks().every((block) => /حضوری/.test(block.getAttribute('aria-label') ?? ''))).toBe(
      true,
    );
    expect(blocks()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /^تلفنی/ }));
    expect(blocks().some((block) => /حضوری/.test(block.getAttribute('aria-label') ?? ''))).toBe(
      false,
    );
  });

  it('a manager sees whose each one is, or that nobody has it yet', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    const calendar = await open();
    expect(within(calendar).getAllByRole('button', { name: /نیما رستمی/ })).toHaveLength(5);
    await user.click(within(calendar).getByRole('button', { name: /بدون مسئول/ }));
    // The manager gives it to a seller from its card.
    const menu = within(within(calendar).getByRole('dialog')).getByRole('combobox', {
      name: 'مشاور',
    });
    expect(menu).toHaveValue('none');
    await user.selectOptions(menu, 'نیما رستمی');
    expect(await toasts().findByText(/به نیما رستمی سپرده شد\.$/)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(calendar).getAllByRole('button', { name: /نیما رستمی/ })).toHaveLength(6),
    );
  });

  it("briefs each day's tasks and opens the tasks page", async () => {
    const user = userEvent.setup();
    const calendar = await open();
    const brief = (day: string) =>
      within(calendar).getByRole('link', { name: new RegExp(`^کارهای ${day}`) });
    expect(within(calendar).getAllByRole('link', { name: /^کارهای / })).toHaveLength(3);
    expect(brief('دوشنبه')).toHaveTextContent('۱ کار عقب‌افتاده');
    expect(brief('سه‌شنبه')).toHaveTextContent('۴ کار مانده');
    expect(brief('سه‌شنبه')).toHaveTextContent('۱ درخواست همکار · ۲ انجام شد');
    expect(brief('پنجشنبه')).toHaveTextContent('۲ کار مانده');
    expect(brief('سه‌شنبه')).toHaveAttribute('href', '/sales/tasks?view=mine&day=2026-10-27');
    await user.click(brief('سه‌شنبه'));
    expect(await screen.findByRole('heading', { name: 'کارهای امروز' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'نمایش همه‌ی روزها' })).toBeInTheDocument();
  });

  it('pages weeks and switches to the list', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'هفته‌ی بعد' }));
    expect(await screen.findByRole('heading', { name: '۹ تا ۱۵ آبان ۱۴۰۵' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'فهرست' }));
    expect(await screen.findByRole('group', { name: 'بازه' })).toBeInTheDocument();
  });

  describe('follow-ups', () => {
    const callBlock = (calendar: HTMLElement) =>
      within(calendar).getAllByRole('button', { name: /، .* · پیگیری$/ })[0] as HTMLElement;

    it('a free spot opens a new follow-up at that time, for a customer found by name', async () => {
      const user = userEvent.setup();
      const calendar = await open();
      // Wednesday's column (Saturday first); the grid starts at 9, an hour is 66px: 14:00.
      fireEvent.click(screen.getAllByTestId('schedule-slot')[4] as HTMLElement, { clientY: 330 });
      const dialog = await screen.findByRole('dialog', { name: 'پیگیری تازه' });
      // The same time picker as the contact log: quick times, and the picked spot on «از تقویم».
      expect(within(dialog).getByRole('radio', { name: 'فردا ۱۰:۰۰' })).not.toBeChecked();
      expect(within(dialog).getByRole('button', { pressed: true })).toHaveTextContent('۱۴:۰۰');
      expect(
        within(dialog).getByRole('textbox', { name: 'چه کاری (اختیاری)' }),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: /^ثبت پیگیری · .*۱۴:۰۰$/ }));
      expect(within(dialog).getByText('یک مشتری انتخاب کنید.')).toBeInTheDocument();
      const name = callBlock(calendar).getAttribute('aria-label')?.split('، ')[0] ?? '';
      const picker = within(dialog).getByRole('combobox', { name: 'مشتری' });
      await user.type(picker, name);
      const match = (await within(dialog).findAllByRole('option'))[0] as HTMLElement;
      // Each match says its stage and its follow-up.
      expect(match).toHaveTextContent(/·/);
      await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
      expect(within(dialog).getByText(name)).toBeInTheDocument();
      expect(within(dialog).queryByRole('combobox')).toBeNull();
      await user.click(within(dialog).getByRole('button', { name: /^ثبت پیگیری · / }));
      expect(
        await toasts().findByText(/^پیگیری برای چهارشنبه .* ساعت ۱۴:۰۰ ثبت شد\.$/),
      ).toBeInTheDocument();
    });

    it("a customer with no open lead gets a follow-up task, not a lead; another seller's is refused", async () => {
      const posted: unknown[] = [];
      server.use(
        http.get('/api/sales/v1/leads/search/', () => HttpResponse.json({ results: [] })),
        http.get('/api/sales/v1/customers/search/', () =>
          HttpResponse.json({
            results: [
              {
                customer: 901,
                name: 'سارا بدون لید',
                phone: '09120000001',
                email: '',
                access: 'free',
                seller: null,
                stage: null,
              },
              {
                customer: 902,
                name: 'سارا دیگری',
                phone: '09120000002',
                email: '',
                access: 'other',
                seller: 'مریم',
                stage: 'contacted',
              },
            ],
          }),
        ),
        http.post('/api/staff/v1/tasks/', async ({ request }) => {
          posted.push(await request.json());
          return HttpResponse.json({ id: 1 }, { status: 201 });
        }),
        http.post('/api/sales/v1/customers/:id/take/', () => {
          throw new Error('the follow-up must not take the customer');
        }),
      );
      const user = userEvent.setup();
      await open();
      fireEvent.click(screen.getAllByTestId('schedule-slot')[4] as HTMLElement, { clientY: 330 });
      const dialog = await screen.findByRole('dialog', { name: 'پیگیری تازه' });
      await user.type(within(dialog).getByRole('combobox', { name: 'مشتری' }), 'سارا');
      const options = await within(dialog).findAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('بدون لید باز');
      // Another seller's lead would take this follow-up's time: shown, not pickable.
      expect(options[1]).toHaveTextContent('لید مریم');
      expect(options[1]).toHaveAttribute('aria-disabled', 'true');
      await user.click(options[0] as HTMLElement);
      await user.click(within(dialog).getByRole('button', { name: /^ثبت پیگیری · / }));
      await waitFor(() => expect(posted).toHaveLength(1));
      expect(posted[0]).toMatchObject({ user: 901, kind: 'mine', text: 'پیگیری سارا بدون لید' });
    });

    it('a mouse over an empty spot shows the time a click would add at', async () => {
      await open();
      const wednesday = screen.getAllByTestId('schedule-slot')[4] as HTMLElement;
      fireEvent.pointerMove(wednesday, { pointerType: 'mouse', clientY: 330 });
      expect(wednesday).toHaveTextContent('۱۴:۰۰');
      fireEvent.pointerLeave(wednesday);
      expect(wednesday).toHaveTextContent('');
    });

    it("a click on a day's tasks cell adds a task for me that day", async () => {
      const user = userEvent.setup();
      const calendar = await open();
      await user.click(
        within(calendar).getByRole('button', { name: 'کار تازه برای چهارشنبه ۶ آبان' }),
      );
      const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
      expect(within(dialog).getByRole('radio', { name: 'خودم' })).toBeChecked();
      // That day, with no hour (one can still be set with «تاریخ و ساعت دیگر»).
      expect(within(dialog).getByRole('radio', { name: 'فقط روز (بدون ساعت)' })).toBeChecked();
      expect(within(dialog).getByRole('button', { name: /^روز/ })).toHaveTextContent('۶ آبان');
    });

    it('a task with an hour is drawn at it; one for the day only is not', async () => {
      const calendar = await open();
      expect(
        within(calendar).getByRole('button', {
          name: /^تماس با بانک برای نامه‌ی تمکن.*۱۱:۰۰، کار$/,
        }),
      ).toBeInTheDocument();
      expect(within(calendar).queryByRole('button', { name: /آماده کردن فهرست قیمت/ })).toBeNull();
    });

    it('a passed spot is refused', async () => {
      await open();
      fireEvent.click(screen.getAllByTestId('schedule-slot')[0] as HTMLElement, { clientY: 330 });
      expect(await toasts().findByText(/این زمان گذشته است/)).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'پیگیری تازه' })).toBeNull();
    });

    it('a call dragged to another day and time moves there', async () => {
      const calendar = await open();
      const block = callBlock(calendar);
      const thursday = within(calendar)
        .getAllByRole('group')
        .find((group) => group.dataset['scheduleDay'] === '5') as HTMLElement;
      document.elementsFromPoint = () => [block, thursday];
      fireEvent.pointerDown(block, { button: 0, pointerType: 'mouse', clientX: 0, clientY: 0 });
      fireEvent.pointerMove(block, { pointerType: 'mouse', clientX: 300, clientY: 66 });
      fireEvent.pointerUp(block, { pointerType: 'mouse', clientX: 300, clientY: 66 });
      fireEvent.click(block);
      expect(await toasts().findByText(/^پیگیری به پنجشنبه .* رفت\.$/)).toBeInTheDocument();
      expect(within(calendar).queryByRole('dialog')).toBeNull();
      Reflect.deleteProperty(document, 'elementsFromPoint');
    });

    it("moves from the call's card too (no mouse)", async () => {
      const user = userEvent.setup();
      const calendar = await open();
      await user.click(callBlock(calendar));
      const card = within(calendar).getByRole('dialog');
      await user.click(within(card).getByRole('button', { name: /^تغییر زمان/ }));
      const dialog = await screen.findByRole('dialog', { name: /^زمان تازه برای پیگیری / });
      expect(within(dialog).queryByRole('textbox', { name: /مشتری/ })).toBeNull();
    });

    it('an office meeting: its end picked in the card, an hour unless changed', async () => {
      const user = userEvent.setup();
      const booked = await fetch('/api/sales/v1/customers/1/visits/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starts_at: new Date(2026, 9, 28, 11).toISOString(), sms: false }),
      });
      expect(booked.status).toBe(201);
      const calendar = await open();
      await user.click(within(calendar).getByRole('button', { name: /جلسه حضوری/ }));
      const card = within(calendar).getByRole('dialog');
      expect(within(card).getByRole('button', { name: 'شروع: ۱۱:۰۰' })).toBeInTheDocument();
      await user.click(within(card).getByRole('button', { name: 'پایان: ۱۲:۰۰' }));
      const ends = screen.getByRole('listbox', { name: 'پایان' });
      expect(within(ends).getByRole('option', { selected: true })).toHaveTextContent('۱ ساعت');
      await user.click(within(ends).getByRole('option', { name: /۱۲:۳۰/ }));
      expect(screen.queryByRole('listbox')).toBeNull();
      await user.click(within(card).getByRole('button', { name: 'ذخیره زمان' }));
      expect(
        await toasts().findByText('زمان به چهارشنبه ۶ آبان از ۱۱:۰۰ تا ۱۲:۳۰ تغییر کرد.'),
      ).toBeInTheDocument();
    });

    it("a call's start moves its end with it; Escape closes the list", async () => {
      const user = userEvent.setup();
      let sent: unknown = null;
      server.use(
        http.post('/api/sales/v1/leads/bulk/', async ({ request }) => {
          sent = await request.json();
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const calendar = await open();
      // A call still ahead (14:30 today); a past one has no times to change.
      await user.click(within(calendar).getByRole('button', { name: /۱۴:۳۰ · پیگیری$/ }));
      const card = within(calendar).getByRole('dialog');
      const start = within(card).getByRole('button', { name: 'شروع: ۱۴:۳۰' });
      await user.click(start);
      expect(screen.getByRole('listbox', { name: 'شروع' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(start).toHaveFocus();
      await user.click(start);
      await user.click(screen.getByRole('option', { name: '۱۶:۰۰' }));
      expect(within(card).getByRole('button', { name: 'پایان: ۱۶:۱۵' })).toBeInTheDocument();
      await user.click(within(card).getByRole('button', { name: 'ذخیره زمان' }));
      expect(await toasts().findByText(/^زمان به .* تغییر کرد\.$/)).toBeInTheDocument();
      expect(sent).toMatchObject({ follow_up_minutes: 15 });
    });
  });
});

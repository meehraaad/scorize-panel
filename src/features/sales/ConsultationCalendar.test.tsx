import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import '@/test/server';

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
    await user.click(within(calendar).getByRole('button', { name: /آنلاین، پیش رو/ }));
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
    expect(within(log).queryByRole('radio', { name: 'جلسه‌ی مشاوره' })).not.toBeInTheDocument();
    expect(
      within(log).getByRole('button', { name: /ثبت جلسه و ساختن پیگیری/ }),
    ).toBeInTheDocument();
  });

  it('only the unlogged, and a type hidden', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    await user.click(screen.getByRole('button', { name: '۲ جلسه‌ی ثبت‌نشده' }));
    expect(screen.getByRole('checkbox', { name: 'فقط بدون ثبت جلسه' })).toBeChecked();
    expect(within(calendar).getAllByRole('button', { pressed: false })).toHaveLength(2);
    await user.click(screen.getByRole('checkbox', { name: 'فقط بدون ثبت جلسه' }));
    await user.click(screen.getByRole('checkbox', { name: /مشاوره‌ی ویزای تحصیلی/ }));
    expect(within(calendar).queryAllByRole('button', { name: /ویزای تحصیلی/ })).toHaveLength(0);
  });

  it('only in person, or only online', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    const blocks = () =>
      within(calendar)
        .queryAllByRole('button', { pressed: false })
        .filter((block) => /، (آنلاین|حضوری)، /.test(block.getAttribute('aria-label') ?? ''));
    await user.click(screen.getByRole('button', { name: /^حضوری/ }));
    expect(blocks().every((block) => /حضوری/.test(block.getAttribute('aria-label') ?? ''))).toBe(
      true,
    );
    expect(blocks()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /^آنلاین/ }));
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
    expect(within(calendar).getByRole('dialog')).toHaveTextContent('بدون مسئول');
    await user.click(within(calendar).getByRole('button', { name: /تا ۳۰ دقیقه‌ی دیگر/ }));
    expect(within(calendar).getByRole('dialog')).toHaveTextContent('مسئول: نیما رستمی');
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
      expect(within(dialog).getByRole('button', { name: /روز و ساعت/ })).toHaveTextContent('۱۴:۰۰');
      await user.click(within(dialog).getByRole('button', { name: 'ثبت پیگیری' }));
      expect(within(dialog).getByText('یک مشتری انتخاب کنید.')).toBeInTheDocument();
      const name = callBlock(calendar).getAttribute('aria-label')?.split('، ')[0] ?? '';
      await user.type(within(dialog).getByRole('textbox', { name: /مشتری/ }), name);
      await user.click((await within(dialog).findAllByRole('radio'))[0] as HTMLElement);
      await user.click(within(dialog).getByRole('button', { name: 'ثبت پیگیری' }));
      expect(
        await toasts().findByText(/^پیگیری برای چهارشنبه .* ساعت ۱۴:۰۰ ثبت شد\.$/),
      ).toBeInTheDocument();
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
      expect(within(dialog).getByRole('button', { name: /تاریخ/ })).toHaveTextContent('۱۰:۰۰');
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
  });
});

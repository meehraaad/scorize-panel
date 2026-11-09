import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { clearContactDrafts } from '@/lib/sales/contactDrafts';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

function first<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('Expected at least one item');
  return item;
}
const notes = () => within(screen.getByRole('dialog')).getByLabelText('چه گذشت؟');

const minimize = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    first(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'کوچک کردن' })),
  );
};

describe('persistent contact workspace', () => {
  beforeEach(async () => {
    localStorage.clear();
    clearContactDrafts();
    localStorage.setItem('scorize.mock.session', '3');
    await i18n.changeLanguage('fa');
  });

  it('opens from today, keeps the customer and notes while navigating, and removes only the saved draft', async () => {
    const user = userEvent.setup();
    const router = renderApp('/sales');
    await user.click(first(await screen.findAllByRole('button', { name: 'تماس با کیانا رضوی' })));
    const firstDialog = await screen.findByRole('dialog', { name: 'ثبت ارتباط با کیانا رضوی' });
    expect(firstDialog).toHaveAttribute('aria-modal', 'false');
    expect(router.state.location.pathname).toBe('/sales');
    await waitFor(() => expect(notes()).toBeInTheDocument());
    await user.type(notes(), 'Follow up on funding');
    await minimize(user);
    const resume = await screen.findByRole('button', { name: 'ادامه‌ی ثبت ارتباط با کیانا رضوی' });
    await user.click(first(await screen.findAllByRole('button', { name: 'تماس با پویا عسگری' })));
    await screen.findByRole('dialog', { name: 'ثبت ارتباط با پویا عسگری' });
    await waitFor(() => expect(notes()).toBeInTheDocument());
    await user.type(notes(), 'Second customer');
    await act(() => router.navigate('/sales/customers/105'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'عرفان ملکی' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'ثبت ارتباط با پویا عسگری' })).toBeInTheDocument();
    await minimize(user);
    await user.click(resume);
    expect(within(screen.getByRole('dialog')).getByLabelText('چه گذشت؟')).toHaveValue(
      'Follow up on funding',
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^ثبت · پیگیری/ }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: 'ادامه‌ی ثبت ارتباط با کیانا رضوی' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ادامه‌ی ثبت ارتباط با پویا عسگری' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('چه گذشت؟')).toHaveValue(
      'Second customer',
    );
    await minimize(user);
    await act(() => router.navigate('/sales/customers/101'));
    const history = await screen.findByRole('region', { name: 'تاریخچه' });
    expect(await within(history).findByText('Follow up on funding')).toBeInTheDocument();
  });

  it('keeps a failed save, restores after remount, and confirms discarding', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        '/api/profile/staff/v1/users/105/contact-history/',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    renderApp('/sales/customers/105?log=call');
    let dialog = await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' });
    await user.type(within(dialog).getByLabelText('چه گذشت؟'), 'Keep this draft');
    await user.click(within(dialog).getByRole('button', { name: 'یادداشت برای خود مشتری' }));
    await user.type(
      within(dialog).getByLabelText(i18n.t('customer.logDialog.customerSummary', { ns: 'sales' })),
      'Customer-facing summary',
    );
    await user.click(within(dialog).getByRole('button', { name: /^ثبت · پیگیری/ }));
    await toasts().findByText(i18n.t('error', { ns: 'sales' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^ثبت · پیگیری/ })).toBeEnabled(),
    );
    expect(within(dialog).getByLabelText('چه گذشت؟')).toHaveValue('Keep this draft');
    await minimize(user);
    // A reload creates fresh module memory; preserve the tab's saved data while clearing it here.
    const saved = sessionStorage.getItem('scorize.contact-drafts.v1');
    cleanup();
    clearContactDrafts();
    if (!saved) throw new Error('Expected a saved draft');
    sessionStorage.setItem('scorize.contact-drafts.v1', saved);
    renderApp('/settings');
    await user.click(
      await screen.findByRole('button', { name: 'ادامه‌ی ثبت ارتباط با عرفان ملکی' }),
    );
    dialog = await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' });
    expect(within(dialog).getByLabelText('چه گذشت؟')).toHaveValue('Keep this draft');
    expect(
      within(dialog).getByLabelText(i18n.t('customer.logDialog.customerSummary', { ns: 'sales' })),
    ).toHaveValue('Customer-facing summary');
    await user.click(within(dialog).getByRole('button', { name: 'حذف پیش‌نویس' }));
    expect(
      within(dialog).getByText('این ارتباط ثبت‌نشده حذف شود؟ یادداشت‌های آن پاک می‌شود.'),
    ).toBeInTheDocument();
    const confirmation = within(dialog).getByRole('group', {
      name: i18n.t('contactDraft.discardConfirm', { ns: 'sales' }),
    });
    expect(confirmation.closest('footer')).toBeVisible();
    expect(within(dialog).getAllByRole('button', { name: 'حذف پیش‌نویس' })).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'نگه داشتن پیش‌نویس' }));
    expect(within(dialog).getByLabelText('چه گذشت؟')).toHaveValue('Keep this draft');
    await user.click(within(dialog).getByRole('button', { name: 'حذف پیش‌نویس' }));
    await user.click(first(within(dialog).getAllByRole('button', { name: 'حذف پیش‌نویس' })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('scorize.contact-drafts.v1')).toBeNull();
  });

  it('finishes saving a minimized draft after navigating away', async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    server.use(
      http.post('/api/profile/staff/v1/users/105/contact-history/', async () => {
        await pending;
        return HttpResponse.json({ id: 9001 }, { status: 201 });
      }),
    );
    const router = renderApp('/sales/customers/105?log=call');
    await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' });
    await waitFor(() => expect(notes()).toBeInTheDocument());
    await user.type(notes(), 'Save while browsing');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^ثبت · پیگیری/ }),
    );
    expect(notes()).toBeDisabled();
    await minimize(user);
    await act(() => router.navigate('/settings'));
    expect(
      await screen.findByRole('button', { name: 'ادامه‌ی ثبت ارتباط با عرفان ملکی' }),
    ).toBeInTheDocument();
    finish();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'ادامه‌ی ثبت ارتباط با عرفان ملکی' }),
      ).not.toBeInTheDocument(),
    );
    expect(sessionStorage.getItem('scorize.contact-drafts.v1')).toBeNull();
  });

  it('does not restore another account’s drafts', async () => {
    sessionStorage.setItem(
      'scorize.contact-drafts.v1',
      JSON.stringify({ owner: 999, drafts: [{ key: 'other' }], active: 'other' }),
    );
    renderApp('/sales');
    await screen.findByRole('heading', { name: /^سلام نیما، .* کار فوری منتظر شماست$/ });
    expect(
      screen.queryByRole('complementary', { name: 'تماس‌ها و جلسه‌های ثبت‌نشده' }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem('scorize.contact-drafts.v1')).toBeNull();
  });
});

describe('session log: the next step on the board', () => {
  beforeEach(async () => {
    localStorage.clear();
    clearContactDrafts();
    localStorage.setItem('scorize.mock.session', '3');
    await i18n.changeLanguage('fa');
  });

  it('starts on "consulted", shows the card with its follow-up, and sends the stage', async () => {
    const { fetchCustomer } = await import('@/mocks/legacy/customer');
    let sent: Record<string, unknown> | null = null;
    server.use(
      // Once Django moves leads from a contact log (S16): a lead that was only contacted.
      http.get('/api/sales/v1/customers/:id/', async ({ params }) => {
        const data = await fetchCustomer(Number(params.id));
        return HttpResponse.json({
          ...data,
          lead: {
            id: 1,
            source: 'campaign',
            stage: 'contacted',
            score: null,
            follow_up_at: null,
            lost_reason: null,
            seller: null,
          },
          supports: { ...data.supports, stages: true },
        });
      }),
      http.post('/api/sales/v1/customers/:id/contacts/', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp('/sales/calendar');
    await user.click(await screen.findByRole('button', { name: 'فهرست' }));
    await user.click(first(await screen.findAllByRole('button', { name: /^ثبت جلسه: / })));
    const dialog = await screen.findByRole('dialog', { name: /^ثبت جلسه‌ی / });
    const board = await within(dialog).findByRole('group', { name: 'کجای کار است؟' });

    expect(within(board).getByRole('radio', { name: 'مشاوره شد' })).toBeChecked();
    expect(within(board).getByRole('radio', { name: 'تماس گرفته شد' })).not.toBeChecked();
    expect(within(board).getByRole('radio', { name: 'تازه' })).toBeDisabled();
    expect(within(board).getByRole('radio', { name: 'قرارداد شد' })).toBeDisabled();
    expect(within(board).getByText('کارت به ستون «مشاوره شد» می‌رود.')).toBeInTheDocument();

    // "Lost" needs a reason before saving.
    await user.click(within(board).getByRole('radio', { name: 'از دست رفت' }));
    await user.click(within(dialog).getByRole('button', { name: /ثبت و بستن لید/ }));
    expect(sent).toBeNull();

    await user.click(within(board).getByRole('radio', { name: 'مشاوره شد' }));
    await user.click(within(dialog).getByRole('button', { name: /ثبت جلسه و ساختن پیگیری/ }));
    await waitFor(() => expect(sent).toMatchObject({ channel: 'meeting', stage: 'consulted' }));
  });

  it("picks another date's follow-up time on the seller's week", async () => {
    const user = userEvent.setup();
    renderApp('/sales/customers/105?log=call');
    const dialog = await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' });
    await user.click(await within(dialog).findByRole('button', { name: 'از تقویم' }));
    const picker = await screen.findByRole('dialog', { name: 'پیگیری عرفان ملکی کی باشد؟' });
    const week = await within(picker).findByRole('region', {
      name: 'هفته‌ی من برای انتخاب وقت پیگیری',
    });
    await user.click(within(picker).getByRole('button', { name: 'هفته‌ی بعد' }));
    // The first day of next week; the grid starts at 9, an hour is 44px: 14:00. One click picks it.
    fireEvent.click(first(within(week).getAllByTestId('schedule-slot')), { clientY: 220 });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'پیگیری عرفان ملکی کی باشد؟' })).toBeNull(),
    );
    expect(within(dialog).getByRole('button', { pressed: true })).toHaveTextContent('۱۴:۰۰');
  });
});

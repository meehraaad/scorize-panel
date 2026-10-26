import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
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
const notes = () => within(screen.getByRole('dialog')).getByLabelText('یادداشت');

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
    expect(within(screen.getByRole('dialog')).getByLabelText('یادداشت')).toHaveValue(
      'Follow up on funding',
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'ثبت و ساختن پیگیری' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: 'ادامه‌ی ثبت ارتباط با کیانا رضوی' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ادامه‌ی ثبت ارتباط با پویا عسگری' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('یادداشت')).toHaveValue(
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
    await user.type(within(dialog).getByLabelText('یادداشت'), 'Keep this draft');
    await user.click(within(dialog).getByRole('button', { name: 'ثبت و ساختن پیگیری' }));
    await toasts().findByText(i18n.t('error', { ns: 'sales' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'ثبت و ساختن پیگیری' })).toBeEnabled(),
    );
    expect(within(dialog).getByLabelText('یادداشت')).toHaveValue('Keep this draft');
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
    expect(within(dialog).getByLabelText('یادداشت')).toHaveValue('Keep this draft');
    await user.click(within(dialog).getByRole('button', { name: 'حذف پیش‌نویس' }));
    expect(
      within(dialog).getByText('این ارتباط ثبت‌نشده حذف شود؟ یادداشت‌های آن پاک می‌شود.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'نگه داشتن پیش‌نویس' }));
    expect(within(dialog).getByLabelText('یادداشت')).toHaveValue('Keep this draft');
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
      within(screen.getByRole('dialog')).getByRole('button', { name: 'ثبت و ساختن پیگیری' }),
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
    await screen.findByRole('heading', { name: 'سلام نیما، ۳ لید منتظر تماس شماست' });
    expect(
      screen.queryByRole('complementary', { name: 'تماس‌ها و جلسه‌های ثبت‌نشده' }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem('scorize.contact-drafts.v1')).toBeNull();
  });
});

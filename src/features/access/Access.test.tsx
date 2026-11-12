import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const AMIR = 6; // superuser (src/mocks/access.ts)
const REZA = 4; // sales manager: no access page

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('management > access', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('lists who has what and gives someone a key', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/founders/access');
    expect(
      await screen.findByRole('heading', { name: 'چه کسی چه دسترسی دارد', level: 1 }),
    ).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'فهرست افراد' });
    expect(within(list).getByText('مدیر کل (همه‌ی کلیدها)')).toBeInTheDocument();
    // Nima holds nothing yet: found by a search.
    expect(within(list).queryByText('نیما رستمی')).toBeNull();
    await user.type(screen.getByLabelText('جست‌وجوی افراد'), 'نیما');
    await user.click(await screen.findByRole('button', { name: 'باز کردن دسترسی‌های نیما رستمی' }));
    const dialog = await screen.findByRole('dialog', { name: 'نیما رستمی' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /پیام‌های آماده/ }));
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('دسترسی‌های نیما رستمی ذخیره شد.')).toBeInTheDocument();
  });

  it('turns superuser on for someone else, never for oneself', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/founders/access');
    await user.click(await screen.findByRole('button', { name: 'باز کردن دسترسی‌های امیر عابدی' }));
    const own = await screen.findByRole('dialog', { name: 'امیر عابدی' });
    expect(within(own).getByRole('switch', { name: /مدیر کل/ })).toBeDisabled();
    await user.click(within(own).getByRole('button', { name: 'بستن' }));

    await user.click(await screen.findByRole('button', { name: 'باز کردن دسترسی‌های مریم کاظمی' }));
    const dialog = await screen.findByRole('dialog', { name: 'مریم کاظمی' });
    await user.click(within(dialog).getByRole('switch', { name: /مدیر کل/ }));
    expect(within(dialog).getByText(/مریم کاظمی مدیر کل می‌شود/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('دسترسی‌های مریم کاظمی ذخیره شد.')).toBeInTheDocument();
  });

  it("shows a group's keys as held, not as a separate key", async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/founders/access');
    await user.click(await screen.findByRole('button', { name: 'باز کردن دسترسی‌های بهار نوری' }));
    const dialog = await screen.findByRole('dialog', { name: 'بهار نوری' });
    const key = await within(dialog).findByRole('checkbox', { name: /دستیار بنیان‌گذاران/ });
    expect(key).toBeChecked();
    expect(key).toBeDisabled();
    expect(within(dialog).getByText('از گروه Founders')).toBeInTheDocument();
  });

  it('makes a group and adds someone to it', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/founders/access/groups');
    await user.click(await screen.findByRole('button', { name: 'گروه تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'گروه تازه' });
    await user.type(within(dialog).getByLabelText('نام گروه'), 'ناظر تماس');
    await user.click(await within(dialog).findByRole('checkbox', { name: /مدیر فروش/ }));
    await user.click(within(dialog).getByRole('button', { name: 'ساختن گروه' }));
    expect(await toasts().findByText('گروه «ناظر تماس» ساخته شد.')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'باز کردن گروه ناظر تماس' }));
    const group = await screen.findByRole('dialog', { name: 'ناظر تماس' });
    await user.type(within(group).getByLabelText('افزودن عضو'), 'نیما');
    await user.click(
      await within(group).findByRole('button', { name: 'افزودن نیما رستمی به گروه' }),
    );
    expect(
      await toasts().findByText('نیما رستمی به گروه «ناظر تماس» اضافه شد.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(group).getByRole('button', { name: 'بیرون بردن نیما رستمی از گروه' }),
      ).toBeInTheDocument();
    });
  });

  it("keeps the system group's keys fixed", async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/founders/access/groups');
    await user.click(await screen.findByRole('button', { name: 'باز کردن گروه Founders' }));
    const dialog = await screen.findByRole('dialog', { name: 'Founders' });
    expect(within(dialog).getByText(/خود سیستم نگه می‌دارد/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
  });

  it('lists every key and links to its holders', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    const router = renderApp('/founders/access/keys');
    const sales = await screen.findByRole('region', { name: 'فروش' });
    await user.click(within(sales).getByRole('link', { name: '۱ نفر دارد' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?key=apply.can_assign_to_seller');
    });
    expect(await screen.findByText('دارندگان «مدیر فروش»')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'باز کردن دسترسی‌های رضا کامرانی' }),
    ).toBeInTheDocument();
  });

  it('is for superusers only', async () => {
    loginAs(REZA);
    const router = renderApp('/founders/access');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sales');
    });
  });
});

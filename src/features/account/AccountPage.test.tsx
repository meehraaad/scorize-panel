import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const SARA = 1; // 7 notifications (3 unread, two pages), email not verified (src/mocks/account.ts)

const open = async () => {
  localStorage.setItem('scorize.mock.session', String(SARA));
  renderApp('/account');
  await screen.findByRole('heading', { name: 'حساب کاربری و اعلان‌ها', level: 1 });
};

const notifications = () => screen.getByRole('region', { name: /^اعلان‌ها/ });

describe('account and notifications', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('lists notifications, loads older ones and marks them read', async () => {
    const user = userEvent.setup();
    await open();
    // The bell says how many are unread and opens this page.
    const bell = await screen.findByRole('link', { name: 'اعلان‌ها، ۳ خوانده‌نشده' });
    expect(bell).toHaveAttribute('href', '/account#notifications');

    expect(await within(notifications()).findByText('۳ جدید')).toBeInTheDocument();
    expect(within(notifications()).getAllByRole('listitem')).toHaveLength(5);
    expect(
      within(notifications()).getByRole('link', { name: /پاسخ جدید در تیکت/ }),
    ).toHaveAttribute('href', '/tickets');

    await user.click(within(notifications()).getByRole('button', { name: 'اعلان‌های قدیمی‌تر' }));
    expect(await within(notifications()).findByText('خوش آمدید')).toBeInTheDocument();
    expect(within(notifications()).getAllByRole('listitem')).toHaveLength(7);

    await user.click(
      within(notifications()).getByRole('button', {
        name: 'علامت‌گذاری همه به‌عنوان خوانده‌شده',
      }),
    );
    expect(await screen.findByRole('link', { name: 'اعلان‌ها' })).toBeInTheDocument();
    expect(within(notifications()).queryByText('۳ جدید')).toBeNull();
  });

  it('changes channels, name and password', async () => {
    const user = userEvent.setup();
    await open();

    const channels = screen.getByRole('region', { name: 'پیام‌ها از کجا به شما برسد؟' });
    expect(within(channels).getByRole('switch', { name: /بات تلگرام/ })).toBeDisabled();
    const save = within(channels).getByRole('button', { name: 'ثبت تغییرات' });
    expect(save).toBeDisabled();
    await user.click(within(channels).getByRole('switch', { name: /ایمیل/ }));
    await user.click(save);
    expect(await toasts().findByText('ثبت شد.')).toBeInTheDocument();

    const login = screen.getByRole('region', { name: 'اطلاعات ورود' });
    expect(within(login).getByText(/تأیید نشده/)).toBeInTheDocument();
    await user.click(within(login).getByRole('button', { name: 'ارسال دوباره' }));
    expect(await toasts().findByText('لینک دوباره فرستاده شد.')).toBeInTheDocument();

    await user.click(within(login).getByRole('button', { name: 'ویرایش نام و نام خانوادگی' }));
    await user.clear(within(login).getByLabelText('نام خانوادگی'));
    await user.type(within(login).getByLabelText('نام خانوادگی'), 'محمدی');
    await user.click(within(login).getByRole('button', { name: 'ثبت' }));
    expect(await toasts().findByText('نام ثبت شد.')).toBeInTheDocument();
    expect(within(login).getByText('سارا محمدی')).toBeInTheDocument();

    await user.click(within(login).getByRole('button', { name: 'تغییر رمز' }));
    await user.type(within(login).getByLabelText('رمز فعلی'), 'wrong-one');
    await user.type(within(login).getByLabelText('رمز تازه'), 'short');
    await user.click(within(login).getByRole('button', { name: 'ثبت' }));
    expect(within(login).getByLabelText('رمز تازه')).toHaveAccessibleDescription(
      'رمز تازه دست‌کم ۸ حرف باشد.',
    );
    await user.type(within(login).getByLabelText('رمز تازه'), '-but-longer');
    await user.click(within(login).getByRole('button', { name: 'ثبت' }));
    expect(await within(login).findByRole('alert')).toHaveTextContent('رمز فعلی درست نیست');
    await user.clear(within(login).getByLabelText('رمز فعلی'));
    await user.type(within(login).getByLabelText('رمز فعلی'), 'password123');
    await user.click(within(login).getByRole('button', { name: 'ثبت' }));
    expect(await toasts().findByText('رمز عبور تغییر کرد.')).toBeInTheDocument();
  });

  it('asks once how they heard about Scorize', async () => {
    const user = userEvent.setup();
    await open();
    const card = screen.getByRole('region', { name: 'از کجا با اسکورایز آشنا شدید؟' });
    await user.click(within(card).getByRole('button', { name: 'ثبت' }));
    expect(within(card).getByRole('alert')).toHaveTextContent('یکی از گزینه‌ها را انتخاب کنید.');
    await user.click(within(card).getByRole('button', { name: 'دوستان و آشنایان' }));
    await user.click(within(card).getByRole('button', { name: 'ثبت' }));
    expect(await within(card).findByText('ممنون که گفتید.')).toBeInTheDocument();
  });
});

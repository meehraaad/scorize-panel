import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const AMIR = 6; // superuser: both keys and the access page (src/mocks/messages.ts)
const NIMA = 3; // seller: no key

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('messages section', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('lists the automatic messages by area and edits one with the variable buttons', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/messages');
    expect(
      await screen.findByRole('heading', { name: 'پیام‌های خودکار', level: 1 }),
    ).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'فهرست پیام‌های خودکار' });
    expect(within(list).getByRole('heading', { name: 'مشاوره و وبینار' })).toBeInTheDocument();
    expect(
      within(list).getByRole('button', { name: 'باز کردن پیام کد ورود (پیامک)' }),
    ).toHaveTextContent('فقط نمایش');

    await user.click(
      within(list).getByRole('button', { name: 'باز کردن پیام قرارداد شما آماده است' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'قرارداد شما آماده است' });
    const box = await within(dialog).findByLabelText('متن پیام');
    await user.clear(box);
    await user.type(box, 'سلام ');
    await user.click(
      within(within(dialog).getByRole('group', { name: 'افزودن متغیر' })).getByRole('button', {
        name: 'نام',
      }),
    );
    expect(box).toHaveValue('سلام {token}');
    expect(within(dialog).getByRole('region', { name: 'پیش‌نمایش با یک نمونه' })).toHaveTextContent(
      'سلام سارا',
    );

    // A variable the message doesn't have can't be saved.
    await user.type(box, ' {{phone}');
    expect(within(dialog).getByText(/این پیام متغیر \{phone\} ندارد/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'ذخیره' })).toBeDisabled();
    await user.clear(box);
    await user.type(box, 'سلام {{token}، خوش آمدید');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('ذخیره شد.')).toBeInTheDocument();
    expect(
      within(await within(dialog).findByRole('region', { name: 'تاریخچه‌ی تغییرها' })).getByText(
        'سلام {token}، خوش آمدید',
      ),
    ).toBeInTheDocument();
  });

  it('shows an SMS-only message as Kavenegar text, not as an editable box', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/messages');
    await user.click(
      await screen.findByRole('button', { name: 'باز کردن پیام یادآوری نهایی مشاوره حضوری' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'یادآوری نهایی مشاوره حضوری' });
    expect(
      await within(dialog).findByText(/قالب «consultation-reservation-final-reminder»/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('متن پیام')).toBeNull();
    expect(
      within(dialog).getByRole('region', { name: 'متن پیامک (نسخه‌ای از قالب کاوه‌نگار)' }),
    ).toBeInTheDocument();
  });

  it('adds a ready ticket reply', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/messages/ready');
    expect(
      await screen.findByRole('heading', { name: 'پیام‌های آماده', level: 1 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'جواب تیکت' }));
    expect(
      await screen.findByRole('button', { name: 'باز کردن پیام آماده‌ی مدارک رسید' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'پیام تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'پیام آماده‌ی تازه' });
    await user.type(within(dialog).getByLabelText('نام پیام'), 'پیگیری');
    await user.click(within(dialog).getByRole('button', { name: 'نام مشتری' }));
    await user.click(within(dialog).getByRole('button', { name: 'ساختن پیام' }));
    expect(await toasts().findByText('پیام آماده ساخته شد.')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'باز کردن پیام آماده‌ی پیگیری' }),
    ).toBeInTheDocument();
  });

  it('gives a key from the access page', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/messages/access');
    expect(await screen.findByRole('heading', { name: 'دسترسی‌ها', level: 1 })).toBeInTheDocument();
    await user.type(screen.getByLabelText('جست‌وجوی کارمند'), 'رضا');
    const give = screen.getByRole('region', { name: 'دادن کلید به یک نفر' });
    const toggle = await within(give).findByRole('switch', { name: /پیام‌های آماده/ });
    await user.click(toggle);
    expect(
      await toasts().findByText('کلید «پیام‌های آماده» به رضا کامرانی داده شد.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'کسانی که کلید دارند' })).getByText(
          'رضا کامرانی',
        ),
      ).toBeInTheDocument();
    });
  });

  it('keeps people without a key out', async () => {
    loginAs(NIMA);
    const router = renderApp('/messages');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
  });
});

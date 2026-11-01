import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

// The mail page and the bot settings wait for scorize-revolution #40 (onServer.ts): tested as they
// will be once it ships.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, mailServers: true } };
});

const MARYAM = 2; // supervisor who manages mailboxes (src/mocks/handlers.ts, mail.ts)
const NIMA = 3; // seller

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('mail page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the servers and the mailboxes, with their problems', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor/mail');
    expect(
      await screen.findByRole('heading', { name: 'ایمیل‌های متقاضیان', level: 1 }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getAllByRole('navigation', { name: 'منوی پنل سوپروایزر' })[0] as HTMLElement,
      ).getByRole('link', { name: 'ایمیل‌ها' }),
    ).toBeInTheDocument();
    const persia = screen.getByRole('region', { name: 'PersiaMail' });
    expect(within(persia).getByText('۲۰۸')).toBeInTheDocument();

    const list = screen.getByRole('region', { name: 'صندوق‌ها' });
    expect(await within(list).findByText('sara.ahmadi@persian-mail.com')).toBeInTheDocument();
    await user.selectOptions(within(list).getByLabelText('مشکل'), 'login_failed');
    await waitFor(() => {
      expect(within(list).queryByText('sara.ahmadi@persian-mail.com')).toBeNull();
    });
    expect(within(list).getByText('full.box@persian-mail.com')).toBeInTheDocument();
    expect(
      within(
        within(list).getByRole('button', { name: 'جزئیات full.box@persian-mail.com' }),
      ).getByText('ورود ناموفق'),
    ).toBeInTheDocument();
  });

  it('creates a mailbox for an applicant and shows its password once', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor/mail');
    await user.click(await screen.findByRole('button', { name: 'صندوق تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'صندوق تازه' });
    await user.type(within(dialog).getByLabelText('نام آدرس'), 'Amir.H');
    expect(within(dialog).getByText('amir.h@persian-mail.com')).toBeInTheDocument();

    // The bot account needs its applicant.
    await user.click(within(dialog).getByRole('button', { name: 'ساختن صندوق' }));
    expect(
      within(dialog).getByText('برای حساب ربات یا نگارش، متقاضی را انتخاب کنید.'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('جستجوی متقاضی'), 'امیر');
    await user.click(await within(dialog).findByRole('button', { name: /امیر حسینی/ }));
    await user.click(within(dialog).getByRole('button', { name: 'ساختن صندوق' }));

    const reveal = await screen.findByRole('dialog', { name: 'رمز amir.h@persian-mail.com' });
    expect(within(reveal).getByText(/فقط همین یک بار/)).toBeInTheDocument();
    expect(await toasts().findByText('amir.h@persian-mail.com ساخته شد')).toBeInTheDocument();
    await user.click(within(reveal).getAllByRole('button', { name: 'بستن' })[0] as HTMLElement);
    expect(
      await within(screen.getByRole('region', { name: 'صندوق‌ها' })).findByText(
        'amir.h@persian-mail.com',
      ),
    ).toBeInTheDocument();
  });

  it('sets a new password and deletes a mailbox, each after a confirm', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor/mail');
    await user.click(
      await screen.findByRole('button', { name: 'جزئیات full.box@persian-mail.com' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'full.box@persian-mail.com' });
    await user.click(await within(dialog).findByRole('button', { name: 'رمز تازه' }));
    await user.click(within(dialog).getByRole('button', { name: 'رمز تازه بساز' }));
    expect(await within(dialog).findByText(/فقط همین یک بار/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'حذف صندوق' }));
    await user.click(within(dialog).getByRole('button', { name: 'حذف کن' }));
    expect(await toasts().findByText('full.box@persian-mail.com حذف شد')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('full.box@persian-mail.com')).toBeNull();
    });
  });

  it('saves the bot rules and refuses a gap that ends before it starts', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor/mail');
    await user.click(await screen.findByRole('button', { name: 'قانون‌های ربات' }));
    const daily = await screen.findByLabelText('سقف روزانه‌ی هر صندوق');
    await user.clear(daily);
    await user.type(daily, '25');
    await user.click(screen.getByRole('button', { name: 'ذخیره‌ی قانون‌ها' }));
    expect(await toasts().findByText('قانون‌های ربات ذخیره شد')).toBeInTheDocument();

    const longest = await screen.findByLabelText('بیش‌ترین فاصله‌ی دو ایمیل (دقیقه)');
    await user.clear(longest);
    await user.type(longest, '1');
    await user.click(screen.getByRole('button', { name: 'ذخیره‌ی قانون‌ها' }));
    expect(await screen.findByText('Must be at least the shortest gap.')).toBeInTheDocument();
  });

  it('takes an address off the suppressed list', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor/mail');
    await user.click(await screen.findByRole('button', { name: 'آدرس‌های مسدود' }));
    await user.click(await screen.findByRole('button', { name: 'برداشتن j.smith@old-uni.edu' }));
    await user.click(screen.getByRole('button', { name: 'بردار' }));
    await waitFor(() => {
      expect(screen.queryByText('j.smith@old-uni.edu')).toBeNull();
    });
  });

  it('is only for managers', async () => {
    loginAs(NIMA);
    const router = renderApp('/supervisor/mail');
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/supervisor/mail');
    });
  });
});

describe('a case bot settings', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    loginAs(MARYAM);
  });

  it('changes the sending hours inside the rules', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/files/1240/applications');
    await user.click(await screen.findByRole('button', { name: 'تنظیمات ربات' }));
    const dialog = await screen.findByRole('dialog', { name: 'تنظیمات ربات ایمیل' });
    const max = await within(dialog).findByLabelText('سقف ایمیل در روز');
    await user.clear(max);
    await user.type(max, '40');
    expect(within(dialog).getByRole('button', { name: 'ذخیره' })).toBeDisabled();
    await user.clear(max);
    await user.type(max, '10');
    await user.selectOptions(within(dialog).getByLabelText('از ساعت'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('تنظیمات ربات ذخیره شد')).toBeInTheDocument();
    expect(await screen.findByText(/امروز .* از ۱۰ ایمیل/)).toBeInTheDocument();
  });

  it('resumes a bot that paused itself for bounces', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/files/1215/applications');
    expect(await screen.findByText(/خودش متوقف شد/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ادامه‌ی ارسال' }));
    expect(await toasts().findByText('ربات دوباره می‌فرستد')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/خودش متوقف شد/)).toBeNull();
    });
  });
});

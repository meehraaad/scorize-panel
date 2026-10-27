import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { callRequests, MOCK_ACCESS_KEY } from '@/mocks/applicant';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// Also covers features Django doesn't serve yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

/** Locked sections of the applicant panel (canvas V7: lock kit and locked previews). */

const SARA = 1; // active contract (admission, writing, visa)
const MARYAM = 2; // no applicant file: a guest in the applicant panel

const loginAs = (id: number, access?: 'pending' | 'noservice' | 'ended') => {
  localStorage.setItem('scorize.mock.session', String(id));
  if (access) localStorage.setItem(MOCK_ACCESS_KEY, access);
};

const open = async (path: string, title: string) => {
  renderApp(path);
  await screen.findByRole('heading', { name: title, level: 1 });
};

/** A locked menu item's name: the section, then the reason for screen readers. */
const locked = (name: string) => `${name} (بعد از قرارداد فعال می‌شود)`;
const mainNav = () => screen.getAllByRole('navigation', { name: 'منوی پنل متقاضی' })[0];

describe('locked sections', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows a guest the panel with every section after a contract locked in the menu', async () => {
    loginAs(MARYAM);
    await open('/applications', 'اپلای‌ها و نتایج');

    // The applications tab sells the service instead of locking it (src/features/applications).
    expect(screen.queryByRole('region', { name: 'این بخش قفل است' })).toBeNull();
    expect(
      screen.getByRole('region', {
        name: 'هر دانشگاه را شما تأیید می‌کنید. فرستادن و پیگیری با ما.',
      }),
    ).toBeInTheDocument();

    const nav = mainNav();
    if (!nav) throw new Error('No panel menu');
    expect(within(nav).getByRole('link', { name: locked('اپلای‌ها و نتایج') })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: locked('قرارداد و پرداخت') })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'پرونده‌ی من' })).toBeInTheDocument();
  });

  it('sends a call request from the applications tab', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    await open('/applications', 'اپلای‌ها و نتایج');

    await user.click(screen.getByRole('button', { name: 'با من تماس بگیرید' }));
    const dialog = screen.getByRole('dialog', { name: 'درخواست تماس مشاور' });
    await user.click(within(dialog).getByRole('button', { name: 'ثبت درخواست تماس' }));
    expect(within(dialog).getByLabelText('شماره‌ی تماس')).toHaveAccessibleDescription(
      'شماره‌ی موبایل را با ۰۹ و ۱۱ رقم بنویسید.',
    );

    await user.type(within(dialog).getByLabelText('شماره‌ی تماس'), '۰۹۱۲ ۳۴۵ ۶۷۸۹');
    expect(within(dialog).getByRole('button', { name: 'اپلای و پذیرش' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(dialog).getByRole('button', { name: 'ویزا' }));
    await user.click(within(dialog).getByRole('radio', { name: 'عصر' }));
    await user.click(within(dialog).getByRole('button', { name: 'ثبت درخواست تماس' }));

    expect(
      await within(dialog).findByRole('heading', { name: 'درخواست شما ثبت شد' }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent('0912 345 6789');
    expect(callRequests).toEqual([
      {
        phone: '09123456789',
        topics: ['admission', 'visa'],
        time: 'evening',
        page: 'applications',
        reason: 'guest',
      },
    ]);
  });

  it('tells someone whose contract is in review that nothing is needed yet', async () => {
    loginAs(SARA, 'pending');
    // The contract tab is open while a prepayment is due (src/features/contract tests).
    await open('/documents', 'مدارک و نگارش');
    const banner = screen.getByRole('region', { name: 'قرارداد در حال بررسی' });
    expect(banner).toHaveTextContent('قرارداد شما ثبت شده و در حال بررسی است');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(within(banner).queryByRole('link')).toBeNull();
  });

  it('offers to add a service the contract lacks, and leaves the rest open', async () => {
    loginAs(SARA, 'noservice');
    await open('/applications', 'اپلای‌ها و نتایج');
    const banner = screen.getByRole('region', { name: 'خارج از قرارداد' });
    expect(banner).toHaveTextContent('خدمات پذیرش در قرارداد شما نیست');
    expect(
      within(banner).getByRole('button', { name: 'درخواست افزودن به قرارداد' }),
    ).toBeInTheDocument();
    // Only sections without a contract are locked in the menu.
    const nav = mainNav();
    if (!nav) throw new Error('No panel menu');
    expect(within(nav).getByRole('link', { name: 'مدارک و نگارش' })).toBeInTheDocument();
  });

  it('shows an ended case as it is, under the closing banner', async () => {
    loginAs(SARA, 'ended');
    await open('/contract', 'قرارداد و پرداخت');
    expect(screen.getByRole('region', { name: 'قرارداد تمام شده' })).toHaveTextContent(
      'این پرونده بسته شده و فقط برای مشاهده است',
    );
    const number = screen.getByText('قرارداد شماره‌ی ۱۲۴۰ · سارا احمدی');
    expect(number.closest('[inert]')).toBeNull();
    expect(screen.queryByText('پیش‌نمایش · داده‌های نمونه، نه پرونده‌ی شما')).toBeNull();
  });

  it('has no locks with an active contract', async () => {
    loginAs(SARA);
    await open('/contract', 'قرارداد و پرداخت');
    expect(screen.queryByRole('region', { name: 'این بخش قفل است' })).toBeNull();
    const nav = mainNav();
    if (!nav) throw new Error('No panel menu');
    expect(within(nav).getByRole('link', { name: 'اپلای‌ها و نتایج' })).toBeInTheDocument();
  });
});

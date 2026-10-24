import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const NIMA = 3; // seller
const REZA = 4; // sales manager (can_assign_to_seller)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const salesNav = () => screen.getAllByRole('navigation', { name: 'منوی پنل فروش' })[0];

describe('sales manager section', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('is hidden from sellers, and its pages send them home', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
    expect(
      within(salesNav() as HTMLElement).queryByRole('link', { name: 'مدیریت فروش' }),
    ).not.toBeInTheDocument();
  });

  it('assigns unowned leads, one or all as suggested', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager');
    expect(await screen.findByRole('heading', { name: '۴ لید بی‌صاحب است' })).toBeInTheDocument();
    expect(
      within(salesNav() as HTMLElement).getByRole('link', { name: 'مدیریت فروش' }),
    ).toBeInTheDocument();

    const queue = screen.getByRole('region', { name: 'صف بی‌صاحب' });
    await user.selectOptions(within(queue).getByLabelText('فروشنده برای آیدا شفیعی'), '8');
    await user.click(within(queue).getAllByRole('button', { name: 'تخصیص' })[0] as HTMLElement);
    expect(await screen.findByRole('heading', { name: '۳ لید بی‌صاحب است' })).toBeInTheDocument();

    await user.click(within(queue).getByRole('button', { name: 'تخصیص پیشنهادی برای همه' }));
    expect(
      await screen.findByRole('heading', { name: 'همه‌ی لیدها صاحب دارند' }),
    ).toBeInTheDocument();
  });

  it('returning a draft needs a note; approving opens it for the customer', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/approvals');
    expect(
      await screen.findByRole('heading', { name: '۱ پیش‌نویس قرارداد منتظر شماست' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/از سقف ۱۰٪ فروشنده بیشتر است/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'بازگرداندن به فروشنده' }));
    expect(screen.getByText('برای بازگرداندن یا رد، توضیح بنویسید.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'تأیید و ارسال به پنل مشتری' }));
    expect(
      await screen.findByRole('heading', { name: 'پیش‌نویسی منتظر نیست' }),
    ).toBeInTheDocument();
  });

  it('team report and follow-up health: remind and hand over an old task', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/team');
    expect(await screen.findByRole('region', { name: 'رتبه‌بندی فروشنده‌ها' })).toHaveTextContent(
      'مهدی توکلی',
    );
    await user.click(screen.getByRole('link', { name: 'سلامت پیگیری' }));
    const oldest = await screen.findByRole('region', { name: 'قدیمی‌ترین عقب‌افتاده‌ها' });
    await user.click(
      within(oldest).getAllByRole('button', { name: 'یادآوری به کاوه' })[0] as HTMLElement,
    );
    expect(await within(oldest).findByText('یادآوری رفت')).toBeInTheDocument();

    await user.click(
      within(oldest).getAllByRole('button', { name: 'سپردن به دیگری' })[0] as HTMLElement,
    );
    await user.selectOptions(within(oldest).getByLabelText('به'), '33');
    await user.click(within(oldest).getByRole('button', { name: 'بسپار' }));
    expect(await within(oldest).findByText(/مسئول: امید رنجبر/)).toBeInTheDocument();
  });
});

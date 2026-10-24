import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // applicant with a contract (mock case in src/mocks/handlers.ts)
const MARYAM = 2; // staff, no applicant file of her own

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openHome = async () => {
  loginAs(SARA);
  renderApp('/');
  await screen.findByRole('heading', { name: 'سلام سارا، پرونده‌ی شما در مرحله‌ی اپلای است' });
};

const todos = () => screen.getByRole('region', { name: 'کارهای منتظر شما' });

describe('applicant home', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the case: card, stages, tasks, ticket, deadlines and summary', async () => {
    await openHome();
    const card = screen.getByRole('region', { name: 'کارت پرونده' });
    expect(within(card).getByText('کانادا و آلمان')).toBeInTheDocument();
    expect(within(card).getByText('قرارداد پذیرش، نگارش و ویزا')).toBeInTheDocument();
    const current = within(card)
      .getAllByRole('listitem')
      .find((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('اپلای');

    expect(within(todos()).getAllByRole('listitem')).toHaveLength(5);
    expect(within(todos()).getByText(/۱۲۰ دلار کانادا/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'آپلود فایل' })).toHaveAttribute('href', '/documents');

    expect(screen.getByRole('region', { name: 'آخرین پیام‌های تیکت' })).toHaveTextContent(
      'کارنامه را در پرونده ثبت کردم',
    );
    expect(
      screen.getByRole('link', { name: /^University of Toronto، ۱۸ روز مانده، آماده‌ی ارسال$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'خلاصه‌ی پرونده' })).toHaveTextContent(
      '۴۵٬۰۰۰٬۰۰۰',
    );
  });

  it('approves an application', async () => {
    const user = userEvent.setup();
    await openHome();
    await user.click(screen.getByRole('button', { name: 'تأیید اپلای McGill University' }));
    expect(
      await screen.findByRole('link', { name: /^McGill University، .* آماده‌ی ارسال$/ }),
    ).toBeInTheDocument();
    expect(within(todos()).queryByText(/McGill/)).not.toBeInTheDocument();
  });

  it('asks before rejecting an application', async () => {
    const user = userEvent.setup();
    await openHome();
    await user.click(screen.getByRole('button', { name: 'رد اپلای University of Waterloo' }));
    expect(screen.getByText(/اپلای University of Waterloo رد شود؟/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'انصراف' }));
    expect(screen.queryByText(/رد شود؟/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'رد اپلای University of Waterloo' }));
    await user.click(screen.getByRole('button', { name: 'رد اپلای' }));
    expect(await screen.findByText('۴ مورد')).toBeInTheDocument();
    expect(screen.queryByText('University of Waterloo')).not.toBeInTheDocument();
  });

  it('replies to the ticket and rates a reply', async () => {
    const user = userEvent.setup();
    await openHome();
    const ticket = screen.getByRole('region', { name: 'آخرین پیام‌های تیکت' });
    expect(within(ticket).getByText('۱ جدید')).toBeInTheDocument();

    await user.type(within(ticket).getByLabelText('پاسخ سریع به حسین رحیمی'), 'ممنون، عالی است');
    await user.click(within(ticket).getByRole('button', { name: 'ارسال' }));
    expect(await within(ticket).findByText('ممنون، عالی است')).toBeInTheDocument();
    expect(within(ticket).getByLabelText('پاسخ سریع به حسین رحیمی')).toHaveValue('');
    expect(within(ticket).queryByText('۱ جدید')).not.toBeInTheDocument();

    await user.click(within(ticket).getByRole('button', { name: 'امتیاز ۴ از ۵' }));
    expect(await within(ticket).findByText('امتیاز شما: ۴ از ۵')).toBeInTheDocument();
  });

  it('welcomes someone without a contract: the journey, previews and what is open now', async () => {
    loginAs(MARYAM);
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'سلام مریم، به اسکورایز خوش آمدید', level: 1 }),
    ).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'از اولین مشاوره تا ویزا، همه‌چیز در یک پنل' });
    expect(within(hero).getAllByRole('listitem')).toHaveLength(6);
    expect(within(hero).getByRole('link', { name: 'رزرو مشاوره‌ی اپلای' })).toHaveAttribute(
      'href',
      '/consultation/',
    );
    expect(within(hero).getByRole('button', { name: 'درخواست تماس مشاور' })).toBeInTheDocument();

    const previews = screen.getByRole('region', { name: 'پنل شما بعد از قرارداد' });
    expect(within(previews).getAllByRole('link')).toHaveLength(4);
    expect(within(previews).getByRole('link', { name: /^قرارداد و پرداخت/ })).toHaveAttribute(
      'href',
      '/contract',
    );
    const open = screen.getByRole('region', { name: 'همین حالا در دسترس شماست' });
    expect(within(open).getByRole('link', { name: /^مشاوره/ })).toHaveAttribute(
      'href',
      '/consultation/',
    );
  });

  it('tells someone whose contract is in review where it stands', async () => {
    loginAs(SARA);
    localStorage.setItem('scorize.mock.access', 'pending');
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'سلام سارا، قرارداد شما ثبت شد', level: 1 }),
    ).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'قرارداد پذیرش و نگارش · کانادا و آلمان' });
    const current = within(hero)
      .getAllByRole('listitem')
      .find((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('بررسی و تأیید');
    expect(within(hero).queryByRole('button')).toBeNull();
    expect(
      screen.getByRole('region', { name: 'بخش‌هایی که به‌زودی فعال می‌شوند' }),
    ).toBeInTheDocument();
  });
});

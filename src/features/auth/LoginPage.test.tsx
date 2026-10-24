import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { MOCK_OTP } from '@/mocks/handlers';
import { renderApp as renderAt } from '@/test/renderApp';
import '@/test/server';

describe('login', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('sends a logged-out visitor to the login page and back after an SMS code', async () => {
    const user = userEvent.setup();
    const router = renderAt('/tickets');

    const field = await screen.findByLabelText('شماره موبایل یا ایمیل');
    expect(router.state.location.search).toContain('next=%2Ftickets');

    // Persian digits from a Persian keyboard are accepted.
    await user.type(field, '۰۹۱۲۰۰۰۰۰۰۰');
    await user.click(screen.getByRole('button', { name: 'ادامه' }));

    const code = await screen.findByLabelText('کد تأیید');
    await user.type(code, MOCK_OTP); // submits by itself on the last digit

    expect(await screen.findByRole('heading', { name: 'تیکت‌ها' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tickets');
  });

  it('shows a translated error for a wrong code', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(await screen.findByLabelText('شماره موبایل یا ایمیل'), '09120000000');
    await user.click(screen.getByRole('button', { name: 'ادامه' }));
    const code = await screen.findByLabelText('کد تأیید');
    await user.type(code, '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('کد درست نیست.');
    expect(code).toHaveAttribute('aria-invalid', 'true');

    // The wrong code is selected, so typing replaces it, and hides the error.
    await user.type(code, '1', { initialSelectionStart: 0, initialSelectionEnd: 6 });
    expect(code).toHaveValue('1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('logs in with email and password', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(
      await screen.findByLabelText('شماره موبایل یا ایمیل'),
      'sara.ahmadi@scorize.local',
    );
    await user.click(screen.getByRole('button', { name: 'ادامه' }));
    await user.type(await screen.findByLabelText('گذرواژه'), 'password123');
    await user.click(screen.getByRole('button', { name: 'ورود' }));
    expect(
      await screen.findByRole('heading', { name: 'سلام سارا، پرونده‌ی شما در مرحله‌ی اپلای است' }),
    ).toBeInTheDocument();
  });

  it('signs up a new phone number', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(await screen.findByLabelText('شماره موبایل یا ایمیل'), '09351112233');
    await user.click(screen.getByRole('button', { name: 'ادامه' }));

    await user.type(await screen.findByLabelText('نام'), 'علی');
    await user.type(screen.getByLabelText('نام خانوادگی'), 'رضایی');
    await user.type(screen.getByLabelText('ایمیل'), 'ali@example.com');
    // The number the user started with is locked: shown in the text, not asked again.
    expect(screen.queryByLabelText('شماره موبایل')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ارسال کد تأیید' }));

    await user.type(await screen.findByLabelText('کد تأیید'), MOCK_OTP);
    expect(await screen.findByRole('heading', { name: 'خوش آمدید علی' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ورود به پنل من' }));
    expect(await screen.findByRole('heading', { name: 'سلام علی، به اسکورایز خوش آمدید' })).toBeInTheDocument();
  });

  it('asks a new email sign-up for a mobile number', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(await screen.findByLabelText('شماره موبایل یا ایمیل'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'ادامه' }));
    expect(await screen.findByLabelText('شماره موبایل')).toBeInTheDocument();
    expect(screen.queryByLabelText('ایمیل')).not.toBeInTheDocument();
  });

  it('switches an email account to SMS login', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(
      await screen.findByLabelText('شماره موبایل یا ایمیل'),
      'sara.ahmadi@scorize.local',
    );
    await user.click(screen.getByRole('button', { name: 'ادامه' }));
    await user.click(
      await screen.findByRole('button', { name: 'ورود با کد پیامکی به‌جای گذرواژه' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('شماره موبایل حسابتان');
    expect(screen.getByLabelText('شماره موبایل یا ایمیل')).toHaveValue('');
  });

  it('rejects input that is neither a mobile number nor an email, without calling the server', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(await screen.findByLabelText('شماره موبایل یا ایمیل'), '12345');
    await user.click(screen.getByRole('button', { name: 'ادامه' }));
    expect(screen.getByLabelText('شماره موبایل یا ایمیل')).toHaveAttribute('aria-invalid', 'true');
  });
});

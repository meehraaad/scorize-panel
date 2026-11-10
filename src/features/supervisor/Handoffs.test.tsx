import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const MARYAM = 2; // supervisor with can_assign_supervisor (src/mocks/handlers.ts)
const NIMA = 3; // seller

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const pdf = (name: string) => new File([new Uint8Array(1024)], name, { type: 'application/pdf' });

describe('contract handoff', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('lets the seller upload the signed contract of an approved offer', async () => {
    const user = userEvent.setup();
    loginAs(NIMA);
    renderApp('/sales/customers/112/apply');
    const card = await screen.findByRole('region', { name: 'قرارداد تا شروع پرونده' });
    expect(within(card).getByText(/اسکن آن را اینجا بگذارید/)).toBeInTheDocument();
    const current = within(card)
      .getAllByRole('listitem')
      .find((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('امضای قرارداد');

    await user.upload(within(card).getByLabelText('قرارداد امضاشده'), pdf('signed.pdf'));
    expect(await within(card).findByRole('link', { name: /اسکن ۱/ })).toBeInTheDocument();
    expect(within(card).getByText(/منتظر پیش‌پرداخت مشتری است/)).toBeInTheDocument();
  });

  it('prints the approved contract to sign, with its clauses and instalments', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    loginAs(NIMA);
    const router = renderApp('/sales/customers/112/apply');
    const card = await screen.findByRole('region', { name: 'قرارداد تا شروع پرونده' });
    await user.click(within(card).getByRole('link', { name: 'چاپ قرارداد برای امضا' }));
    const doc = await screen.findByRole('article', { name: 'قرارداد خدمات اسکورایز' });
    expect(router.state.location.pathname).toBe('/sales/customers/112/contract');
    const parties = within(doc).getByRole('region', { name: 'طرفین قرارداد' });
    expect(within(parties).getByText('کیان مرادی')).toBeInTheDocument();
    // Articles print with their number (S69), their clauses as ۴-۱، ۴-۲.
    expect(within(doc).getByRole('heading', { name: 'ماده ۳: فسخ قرارداد' })).toBeInTheDocument();
    expect(within(doc).getByText('۴-۱')).toBeInTheDocument();
    // The clause written for this customer is marked; who agreed online, on which version.
    expect(within(doc).getAllByText('توافقی').length).toBeGreaterThan(0);
    expect(
      within(doc).getByRole('region', { name: 'موافقت آنلاین روی نسخه‌ی ۲' }),
    ).toHaveTextContent('نیما رستمی');
    const payments = within(doc).getByRole('region', { name: /^مبلغ و اقساط/ });
    expect(within(payments).getByText('هنگام امضا')).toBeInTheDocument();
    expect(within(payments).getByText('بعد از پذیرش')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'چاپ' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it('starts a ready case with the chosen supervisor; others wait', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor/new');
    expect(
      await screen.findByRole('heading', { name: 'پرونده‌های تازه', level: 1 }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getAllByRole('navigation', { name: 'منوی پنل سوپروایزر' })[0] as HTMLElement,
      ).getByRole('link', { name: 'پرونده‌های تازه' }),
    ).toBeInTheDocument();

    const waiting = screen.getByRole('region', { name: 'کیان مرادی' });
    expect(within(waiting).getByRole('button', { name: 'سپردن و شروع پرونده' })).toBeDisabled();
    expect(
      within(waiting).getByText('منتظر آپلود قرارداد امضاشده توسط فروشنده'),
    ).toBeInTheDocument();

    const ready = screen.getByRole('region', { name: 'آرمان صادقی' });
    // Suggested: the supervisor of the contract's country (Germany).
    expect(within(ready).getByLabelText('سوپروایزر')).toHaveValue('7');
    await user.selectOptions(within(ready).getByLabelText('سوپروایزر'), '12');
    await user.click(within(ready).getByRole('button', { name: 'سپردن و شروع پرونده' }));
    expect(
      await toasts().findByText('پرونده‌ی آرمان صادقی به سحر امینی سپرده شد و قرارداد فعال شد.'),
    ).toBeInTheDocument();
    await screen.findByText(/۱ پرونده منتظر سوپروایزر/);
    expect(screen.queryByRole('region', { name: 'آرمان صادقی' })).not.toBeInTheDocument();
  });

  it('cancels a case that will not start, with a reason; not once it is prepaid', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/supervisor/new');
    await screen.findByRole('heading', { name: 'پرونده‌های تازه', level: 1 });

    // Prepaid: refunded in the admin first.
    const paid = screen.getByRole('region', { name: 'آرمان صادقی' });
    expect(within(paid).getByRole('button', { name: 'لغو پرونده‌ی آرمان صادقی' })).toBeDisabled();

    const waiting = screen.getByRole('region', { name: 'کیان مرادی' });
    await user.click(within(waiting).getByRole('button', { name: 'لغو پرونده‌ی کیان مرادی' }));
    const dialog = await screen.findByRole('dialog', { name: 'لغو پرونده‌ی کیان مرادی' });
    await user.click(within(dialog).getByRole('button', { name: 'لغو پرونده‌ی کیان مرادی' }));
    expect(within(dialog).getByText('علت لغو را بنویسید.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('علت لغو'), 'مشتری منصرف شد');
    await user.click(within(dialog).getByRole('button', { name: 'لغو پرونده‌ی کیان مرادی' }));
    expect(await toasts().findByText('پرونده‌ی کیان مرادی لغو شد.')).toBeInTheDocument();
    await screen.findByText(/۱ پرونده منتظر سوپروایزر/);
    expect(screen.queryByRole('region', { name: 'کیان مرادی' })).not.toBeInTheDocument();
  });

  it('is only for those who assign supervisors', async () => {
    loginAs(NIMA);
    const router = renderApp('/supervisor/new');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).not.toBe('/supervisor/new');
  });
});

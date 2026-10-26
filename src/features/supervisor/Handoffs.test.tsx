import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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

  it('is only for those who assign supervisors', async () => {
    loginAs(NIMA);
    const router = renderApp('/supervisor/new');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).not.toBe('/supervisor/new');
  });
});

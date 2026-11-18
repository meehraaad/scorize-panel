import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const MARYAM = 2; // supervisor with can_assign_supervisor (src/mocks/handlers.ts)

describe('client services (SVC2)', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', String(MARYAM));
    await i18n.changeLanguage('fa');
  });

  it('lists the case services and hands the visa to the visa team', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/files/1240');
    const card = await screen.findByRole('region', { name: 'خدمت‌ها' });
    const rows = within(card).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('پذیرش · کانادا'),
      expect.stringContaining('پذیرش · آلمان'),
      expect.stringContaining('ویزا · کانادا'),
      expect.stringContaining('ویزا · آلمان'),
    ]);
    expect(rows[0]).toHaveTextContent('مریم کاظمی');
    expect(rows[2]).toHaveTextContent('بی‌مسئول');

    await user.click(within(card).getByRole('button', { name: 'تعیین مسئول ویزا · کانادا' }));
    const dialog = await screen.findByRole('dialog', { name: 'مسئول ویزا · کانادا' });
    const select = await within(dialog).findByRole('combobox', { name: 'مسئول' });
    // The visa team's person for Canada is suggested; the admission-only staff aren't offered.
    expect(select).toHaveDisplayValue(/نگار صادقی/);
    expect(within(select).queryByRole('option', { name: /علی نوری/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'سپردن ویزا · کانادا' }));

    expect(await toasts().findByText('ویزا · کانادا به نگار صادقی سپرده شد.')).toBeInTheDocument();
    const updated = await screen.findByRole('region', { name: 'خدمت‌ها' });
    expect(await within(updated).findByText('نگار صادقی')).toBeInTheDocument();
  });

  it('lists the open services nobody owns on the new-cases page', async () => {
    renderApp('/supervisor/new');
    const card = await screen.findByRole('region', { name: 'خدمت‌های بی‌مسئول' });
    expect(within(card).getAllByRole('link', { name: 'سارا محمدی' })).toHaveLength(2);
    expect(within(card).getByText('ویزا · آلمان')).toBeInTheDocument();
  });
});

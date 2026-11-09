import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { resetFaces } from '@/mocks/face';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3; // seller (src/mocks/handlers.ts)
const MARYAM = 2; // supervisor (src/mocks/supervisor.ts)
const ERFAN = 105; // عرفان ملکی, a customer of Nima's

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe("customer's emoji and color (S66)", () => {
  beforeEach(async () => {
    localStorage.clear();
    resetFaces();
    await i18n.changeLanguage('fa');
  });

  it('a seller picks an emoji and a color, then goes back to the first letter', async () => {
    loginAs(NIMA);
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const face = await screen.findByRole('button', { name: /تغییر ایموجی و رنگ/ });
    expect(face).toHaveTextContent('ع');

    await user.click(face);
    const dialog = await screen.findByRole('dialog', { name: 'ایموجی و رنگ مشتری' });
    await user.click(within(dialog).getByRole('button', { name: '🦊' }));
    await user.click(within(dialog).getByRole('button', { name: 'فیروزه‌ای' }));
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));

    expect(await toasts().findByText('ایموجی و رنگ مشتری ذخیره شد')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /تغییر ایموجی و رنگ/ })).toHaveTextContent('🦊'),
    );

    await user.click(screen.getByRole('button', { name: /تغییر ایموجی و رنگ/ }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'برگرداندن به حرف اول',
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /تغییر ایموجی و رنگ/ })).toHaveTextContent('ع'),
    );
  });

  it('a supervisor sets it on the case', async () => {
    loginAs(MARYAM);
    const user = userEvent.setup();
    renderApp('/supervisor/files/1240');
    await user.click(await screen.findByRole('button', { name: 'تغییر ایموجی و رنگ سارا محمدی' }));
    const dialog = await screen.findByRole('dialog', { name: 'ایموجی و رنگ مشتری' });
    await user.click(within(dialog).getByRole('button', { name: '🎓' }));
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'تغییر ایموجی و رنگ سارا محمدی' }),
      ).toHaveTextContent('🎓'),
    );
  });
});

describe('the face beside the name in lists (S66)', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetFaces();
    await i18n.changeLanguage('fa');
  });

  it('shows on the leads list once set on the customer page', async () => {
    loginAs(NIMA);
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    await user.click(await screen.findByRole('button', { name: /تغییر ایموجی و رنگ/ }));
    const dialog = await screen.findByRole('dialog', { name: 'ایموجی و رنگ مشتری' });
    await user.click(within(dialog).getByRole('button', { name: '🦉' }));
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('ایموجی و رنگ مشتری ذخیره شد')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'لیدهای من' }));
    const row = (await screen.findAllByRole('link', { name: /عرفان ملکی/ }))[0];
    expect(row).toHaveTextContent('🦉');
  });
});

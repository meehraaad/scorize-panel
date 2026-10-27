import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import '@/test/server';

const SARA = 1; // applicant with a contract and four sessions (src/mocks/applicant.ts)

describe('a session over the home', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', String(SARA));
    await i18n.changeLanguage('fa');
  });

  it('saves the topic before the session, and shows its invoice', async () => {
    const user = userEvent.setup();
    renderApp('/?session=41');
    const dialog = await screen.findByRole('dialog', { name: 'مشاوره‌ی تخصصی اپلای دکترا' });
    await user.click(await within(dialog).findByRole('button', { name: 'ثبت برای مشاور' }));
    expect(within(dialog).getByLabelText('دانشگاه فعلی')).toHaveFocus();
    await user.type(within(dialog).getByLabelText('دانشگاه فعلی'), 'دانشگاه صنعتی اصفهان');
    await user.type(within(dialog).getByLabelText('رشته‌ی فعلی'), 'مهندسی کامپیوتر');
    await user.type(within(dialog).getByLabelText('مقطع فعلی'), 'کارشناسی ارشد');
    await user.click(within(dialog).getByRole('button', { name: 'ثبت برای مشاور' }));
    expect(await toasts().findByText('اطلاعات جلسه ثبت شد.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'فاکتور مشاوره' }));
    expect(dialog).toHaveTextContent('۸۰۰٬۰۰۰ تومان');
    expect(dialog).toHaveTextContent('نیلوفر شریفی');
  });

  it('opens old session links over the home, read-only once held', async () => {
    renderApp('/consultations/42');
    const dialog = await screen.findByRole('dialog', { name: 'مشاوره‌ی اپلای کارشناسی ارشد' });
    expect(await within(dialog).findByLabelText('دانشگاه فعلی')).toHaveAttribute('readonly');
    expect(within(dialog).queryByRole('button', { name: 'ثبت برای مشاور' })).toBeNull();
    // The case home is behind it, with every session.
    expect(screen.getByRole('region', { name: 'جلسه‌های شما', hidden: true })).toBeInTheDocument();
  });

  it('is linked from the services page', async () => {
    renderApp('/services');
    const card = await screen.findByRole('region', { name: 'مشاوره‌های من' });
    expect(within(card).getByRole('link', { name: /مشاوره‌ی تخصصی اپلای دکترا/ })).toHaveAttribute(
      'href',
      '/?session=41',
    );
    expect(within(card).getByRole('link', { name: 'همه‌ی رزروها (۴)' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});

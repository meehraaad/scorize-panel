import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const NIMA = 3; // seller (src/mocks/handlers.ts)
const ERFAN = 105;

describe("a seller's own ready messages", () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', String(NIMA));
    await i18n.changeLanguage('fa');
  });

  it('made in settings, then picked for WhatsApp on a customer page', async () => {
    const user = userEvent.setup();
    const router = renderApp('/settings');
    const section = await screen.findByRole('region', { name: 'پیام‌های آماده‌ی من' });
    expect(await within(section).findByText('هنوز پیام آماده‌ای نساخته‌اید.')).toBeInTheDocument();
    // Management's are there to read.
    expect(within(section).getByText('بعد از تماس اول')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'پیام تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'پیام آماده‌ی تازه' });
    await user.type(within(dialog).getByLabelText('نام پیام'), 'یادآوری');
    await user.type(within(dialog).getByLabelText('متن پیام'), 'سلام ');
    await user.click(within(dialog).getByRole('button', { name: 'نام مشتری' }));
    await user.click(within(dialog).getByRole('button', { name: 'افزودن پیام' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await within(section).findByRole('button', { name: 'باز کردن پیام یادآوری' }),
    ).toBeInTheDocument();
    await act(() => router.navigate(`/sales/customers/${String(ERFAN)}`));
    await user.click(await screen.findByRole('button', { name: /^واتساپ به / }));
    const picker = await screen.findByRole('dialog', { name: 'کدام پیام در واتساپ نوشته شود؟' });
    const links = within(picker).getAllByRole('link');
    // Own first (filled in), then management's, then none.
    expect(within(links[0] as HTMLElement).getByText('پیام من')).toBeInTheDocument();
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/.*\?text=/));
    expect(decodeURIComponent(links[0]?.getAttribute('href') ?? '')).not.toContain('{customer}');
    expect(within(picker).getByText('بعد از تماس اول')).toBeInTheDocument();
    expect(within(picker).getByRole('link', { name: 'بدون پیام آماده' })).toBeInTheDocument();
  });
});

import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

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
    // The long form: wa.me's redirect turns emoji into "?".
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/api\.whatsapp\.com\/send\?phone=98\d+&text=/),
    );
    expect(decodeURIComponent(links[0]?.getAttribute('href') ?? '')).not.toContain('{customer}');
    expect(within(picker).getByText('بعد از تماس اول')).toBeInTheDocument();
    expect(within(picker).getByRole('link', { name: 'بدون پیام آماده' })).toBeInTheDocument();
  });

  it('Telegram: copies the picked message and opens the chat; if copying fails, shows it to copy', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    renderApp(`/sales/customers/${String(ERFAN)}`);
    await user.click(await screen.findByRole('button', { name: /^تلگرام به / }));
    let picker = await screen.findByRole('dialog', { name: 'کدام پیام برای تلگرام کپی شود؟' });
    const first = within(picker).getAllByRole('link')[0] as HTMLElement;
    expect(first).toHaveAttribute('href', expect.stringMatching(/^https:\/\/t\.me\/\+98\d+$/));
    await user.click(first);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('سلام'));
    expect(
      await toasts().findByText('متن پیام کپی شد؛ در تلگرام بچسبانید و بفرستید.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // No clipboard: the dialog stays, with the whole text to copy by hand.
    write.mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByRole('button', { name: /^تلگرام به / }));
    picker = await screen.findByRole('dialog', { name: 'کدام پیام برای تلگرام کپی شود؟' });
    await user.click(within(picker).getAllByRole('link')[0] as HTMLElement);
    const alert = await within(picker).findByRole('alert');
    expect(within(alert).getByLabelText('متن پیام')).toHaveValue(write.mock.calls.at(-1)?.[0]);
    expect(picker).toBeInTheDocument();
    write.mockRestore();
  });

  it('keeps emoji and says a pasted sticker cannot be kept', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const section = await screen.findByRole('region', { name: 'پیام‌های آماده‌ی من' });
    await user.click(await within(section).findByRole('button', { name: 'پیام تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'پیام آماده‌ی تازه' });
    const box = within(dialog).getByLabelText('متن پیام');
    expect(
      within(dialog).getByText(/ایموجی‌ها \(🌹\) ذخیره می‌شوند، استیکر نه/),
    ).toBeInTheDocument();
    // A sticker copies as a picture with no text.
    await user.click(box);
    await user.paste({
      files: [new File(['x'], 'sticker.webp', { type: 'image/webp' })],
      getData: () => '',
    } as unknown as DataTransfer);
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'استیکر یا عکس در پیام آماده جا نمی‌گیرد',
    );
    await user.type(box, 'سلام 🌹');
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
    // The office and tablet form variables are buttons too.
    await user.click(within(dialog).getByRole('button', { name: 'آدرس و لوکیشن دفتر' }));
    await user.click(within(dialog).getByRole('button', { name: 'لینک فرم تبلت' }));
    expect(box).toHaveValue('سلام 🌹{office}{tablet_form}');
    expect(
      within(dialog).getByRole('region', { name: 'پیش‌نمایش با یک مشتری نمونه' }),
    ).toHaveTextContent('https://scorize.com/panel/background');
  });
});

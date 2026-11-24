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
    // The long form: wa.me's redirect turns emoji into "?".
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/api\.whatsapp\.com\/send\?phone=98\d+&text=/),
    );
    expect(decodeURIComponent(links[0]?.getAttribute('href') ?? '')).not.toContain('{customer}');
    expect(within(picker).getByText('بعد از تماس اول')).toBeInTheDocument();
    expect(within(picker).getByRole('link', { name: 'بدون پیام آماده' })).toBeInTheDocument();
  });

  it("Telegram: the picked message is typed into the customer's chat, like WhatsApp", async () => {
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    await user.click(await screen.findByRole('button', { name: /^واتساپ به / }));
    const whatsapp = await screen.findByRole('dialog', { name: 'کدام پیام در واتساپ نوشته شود؟' });
    expect(within(whatsapp).getByText(/پیش‌نمایش اول واتساپ/)).toBeInTheDocument();
    await user.click(within(whatsapp).getByRole('button', { name: 'بستن' }));

    await user.click(await screen.findByRole('button', { name: /^تلگرام به / }));
    const picker = await screen.findByRole('dialog', { name: 'کدام پیام در تلگرام نوشته شود؟' });
    expect(
      within(picker).getByText(/چت مشتری در تلگرام با همین متن باز می‌شود/),
    ).toBeInTheDocument();
    const [first] = within(picker).getAllByRole('link');
    const href = new URL(first?.getAttribute('href') ?? '');
    expect(`${href.origin}${href.pathname}`).toMatch(/^https:\/\/t\.me\/\+98\d+$/);
    expect(href.searchParams.get('text')).toContain('سلام');
    expect(href.searchParams.get('text')).not.toContain('{customer}');
    expect(within(picker).getByRole('link', { name: 'بدون پیام آماده' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/t\.me\/\+98\d+$/),
    );
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

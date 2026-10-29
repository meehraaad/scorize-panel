import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

// The AI hub isn't on the server yet (src/lib/applicant/onServer.ts): tested as it will be.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, foundersAssistant: true } };
});

const BAHAR = 5; // a founder (src/mocks/assistant.ts)
const ANSWER_WAIT = { timeout: 5_000 };

describe('founders panel: the analysis assistant', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(BAHAR));
  });

  it('asks a first question and shows the answer once it is ready', async () => {
    const user = userEvent.setup();
    renderApp('/founders');
    expect(await screen.findByRole('heading', { name: 'دستیار تحلیلی', level: 1 })).toBeVisible();
    expect(screen.getByText('از داده‌ها بپرس')).toBeInTheDocument();
    const history = screen.getByRole('complementary', { name: 'گفتگوهای قبلی' });
    expect(
      within(history).getByRole('link', { name: /فروش ماه گذشته به تفکیک نوع/ }),
    ).toHaveAttribute('href', '/founders/conversations/900');

    // An example fills the question box.
    await user.click(screen.getByRole('button', { name: 'نرخ پذیرش به تفکیک کشور چقدر است؟' }));
    const box = screen.getByRole('textbox', { name: 'سؤال' });
    expect(box).toHaveValue('نرخ پذیرش به تفکیک کشور چقدر است؟');
    await user.clear(box);
    await user.type(box, 'امسال هر ماه چند سرنخ داشتیم؟');
    await user.click(screen.getByRole('button', { name: 'بپرس' }));

    expect(await screen.findByText('امسال هر ماه چند سرنخ داشتیم؟')).toBeInTheDocument();
    // The answer is written in the background; the page reads the conversation again.
    expect(await screen.findByText('۹۰ سرنخ', {}, ANSWER_WAIT)).toBeInTheDocument();
    expect(screen.getByText('بر اساس تاریخ ثبت سرنخ.')).toBeInTheDocument();
    expect(screen.getByText('مهر: ۲۴').tagName).toBe('LI');
  });

  it('shows a list only to the founder, and takes feedback', async () => {
    const user = userEvent.setup();
    renderApp('/founders/conversations/900');
    expect(await screen.findByText('رزرو مشاوره: ۲٬۷۵۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'درست بود' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const box = screen.getByRole('textbox', { name: 'سؤال' });
    await user.type(box, 'لیست پیگیری‌های امروز با شماره');
    await user.click(screen.getByRole('button', { name: 'بپرس' }));
    const table = await screen.findByRole('region', { name: 'سرنخ‌های فروش' }, ANSWER_WAIT);
    expect(within(table).getByText('فقط برای شما')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'موبایل مشتری' })).toBeInTheDocument();
    expect(within(table).getByText('09121112233')).toBeInTheDocument();
    expect(within(table).getByText('۲ ردیف')).toBeInTheDocument();

    const wrong = screen.getAllByRole('button', { name: 'غلط بود' }).at(-1);
    if (!wrong) throw new Error('no feedback buttons');
    await user.click(wrong);
    await waitFor(() => expect(wrong).toHaveAttribute('aria-pressed', 'true'));
    expect(await toasts().findByText('ثبت شد؛ این جواب بررسی می‌شود.')).toBeInTheDocument();
  });

  it('says when an answer failed', async () => {
    const user = userEvent.setup();
    renderApp('/founders/conversations/900');
    const box = await screen.findByRole('textbox', { name: 'سؤال' });
    await user.type(box, 'یک خطا بساز');
    await user.click(screen.getByRole('button', { name: 'بپرس' }));
    expect(await screen.findByText('جواب آماده نشد', {}, ANSWER_WAIT)).toBeInTheDocument();
    expect(
      screen.getByText('پاسخ آماده نشد. چند دقیقه بعد دوباره امتحان کنید.'),
    ).toBeInTheDocument();
  });

  it('keeps everyone else out', async () => {
    localStorage.setItem('scorize.mock.session', '3'); // a seller
    const router = renderApp('/founders');
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/founders'));
  });
});

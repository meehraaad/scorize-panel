import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// Also covers features Django doesn't serve yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const SARA = 1; // two recommendation letters (one recommender), a professor list started

const open = async (path: string, title: string) => {
  localStorage.setItem('scorize.mock.session', String(SARA));
  renderApp(path);
  await screen.findByRole('heading', { name: title, level: 1 });
};

const serverAnswers = async (type: string) => {
  const response = await fetch(
    new URL(`/api/applicant/v1/writing/${type}/`, window.location.origin),
  );
  return ((await response.json()) as { answers: Record<string, unknown> }).answers;
};

describe('recommendation letters form', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('opens the unfinished recommender and adds up to the contract’s letters', async () => {
    const user = userEvent.setup();
    await open('/documents/recommendation', 'فرم اطلاعات توصیه‌نامه');
    expect(screen.getByText(/قرارداد شما ۲ توصیه‌نامه دارد/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'توصیه‌کننده‌ی ۱ · علی صادقی' }),
    ).toBeInTheDocument();
    expect(screen.getByText('آکادمیک (استاد) · ۱۰ از ۱۱')).toBeInTheDocument();
    expect(screen.getByLabelText('ایمیل سازمانی')).toHaveAccessibleDescription(
      /لینک بارگذاری را به همین ایمیل/,
    );

    // A work letter doesn't ask about courses.
    await user.click(screen.getByRole('button', { name: 'افزودن توصیه‌کننده' }));
    expect(screen.getByRole('heading', { name: 'توصیه‌کننده‌ی ۲' })).toHaveFocus();
    expect(screen.getByLabelText(/درس‌هایی که با او گذرانده‌اید/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('کاری (مدیر)'));
    expect(screen.queryByLabelText(/درس‌هایی که با او گذرانده‌اید/)).toBeNull();

    // Two letters in the contract: no third.
    expect(screen.queryByRole('button', { name: 'افزودن توصیه‌کننده' })).toBeNull();
    expect(screen.getByText(/برای توصیه‌نامه‌ی بیشتر از «آکادمی» سفارش دهید/)).toBeInTheDocument();
    // Let the autosave finish inside this test, not in the next one.
    expect(await screen.findByText(/ذخیره شد/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('points at the missing answer, then sends the letters to the writing team', async () => {
    const user = userEvent.setup();
    await open('/documents/recommendation', 'فرم اطلاعات توصیه‌نامه');
    await user.click(screen.getByRole('button', { name: 'ارسال برای تیم نگارش' }));
    const qualities = screen.getByLabelText(/سه ویژگی که او می‌تواند/);
    expect(qualities).toHaveFocus();
    expect(qualities).toHaveAttribute('aria-invalid', 'true');

    await user.type(qualities, 'پیگیری، دقت، کار تیمی');
    await user.click(screen.getByRole('button', { name: 'ارسال برای تیم نگارش' }));
    const confirm = screen.getByRole('group', { name: /ثبت نهایی شود؟/ });
    await user.click(within(confirm).getByRole('button', { name: 'ثبت نهایی' }));

    expect(
      await screen.findByText('اطلاعات توصیه‌نامه‌ها برای تیم نگارش ارسال شد'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/سه ویژگی/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'حذف' })).toBeNull();
    const [first] = (await serverAnswers('recommendation'))['recommenders'] as {
      qualities: string;
    }[];
    expect(first?.qualities).toBe('پیگیری، دقت، کار تیمی');
  });
});

describe('professor list form', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('edits countries, terms and research interests', async () => {
    const user = userEvent.setup();
    await open('/documents/pl', 'فرم فهرست استادها');
    expect(screen.getByRole('link', { name: 'توصیه‌نامه' })).toHaveAttribute(
      'href',
      '/documents/recommendation',
    );
    expect(screen.getByRole('heading', { name: 'چه چیزی تحویل می‌گیرید' })).toBeInTheDocument();
    expect(screen.getByLabelText('کانادا')).toBeChecked();
    expect(screen.getByLabelText('آمریکا')).not.toBeChecked();
    await user.click(screen.getByLabelText('آمریکا'));

    // Terms are the coming intakes.
    const term = screen.getByLabelText('ترم شروع');
    expect(within(term).getAllByRole('option').length).toBeGreaterThan(3);

    // Interests come from the documents page and go back to it.
    const interests = screen.getByRole('list', { name: 'علاقه‌های پژوهشی' });
    expect(within(interests).getByText('Machine Learning')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'حذف Explainable AI' }));
    await user.type(
      screen.getByRole('textbox', { name: /^علاقه‌های پژوهشی/ }),
      'Sensor Fusion{Enter}',
    );
    expect(within(interests).getByText('Sensor Fusion')).toBeInTheDocument();

    expect(await screen.findByText(/ذخیره شد · اکنون/, {}, { timeout: 4000 })).toBeInTheDocument();
    const answers = await serverAnswers('pl');
    expect(answers['countries']).toEqual(['ca', 'us', 'de']);
    expect(answers['research_interests']).toEqual([
      'Machine Learning',
      'Computer Vision',
      'Graph Neural Networks',
      'Sensor Fusion',
    ]);
  });

  it('adds a professor the applicant found, with a link to the group', async () => {
    const user = userEvent.setup();
    await open('/documents/pl', 'فرم فهرست استادها');
    await user.click(screen.getByRole('button', { name: 'ذخیره و بخش بعدی' }));
    await user.click(screen.getByRole('button', { name: 'افزودن استاد' }));
    await user.type(screen.getByLabelText('نام استاد'), 'Prof. Steven Waslander');
    await user.type(screen.getByLabelText('دانشگاه'), 'University of Toronto');
    await user.type(screen.getByLabelText(/لینک صفحه/), 'https://trailab.utias.utoronto.ca');
    await user.click(screen.getByRole('button', { name: 'تأیید' }));
    expect(screen.getByText('Prof. Steven Waslander')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'صفحه‌ی گروه' })).toHaveAttribute(
      'href',
      'https://trailab.utias.utoronto.ca',
    );
  });
});

describe('personal and diversity statement forms', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('asks the diversity statement’s required questions, then sends it', async () => {
    const user = userEvent.setup();
    await open('/documents/ds', 'اطلاعات بیانیه‌ی تنوع و شمول');
    await user.click(screen.getByRole('button', { name: 'ثبت نهایی' }));
    const interaction = screen.getByLabelText(/تجربه‌ی خاصی از تعامل/);
    expect(interaction).toHaveFocus();
    await user.type(interaction, 'کار گروهی با دانشجوهای چهار کشور');

    await user.click(screen.getByRole('button', { name: 'ثبت نهایی' }));
    const beliefs = screen.getByLabelText(/تنوع عقاید در رشته‌ی شما/);
    expect(beliefs).toHaveFocus();
    await user.type(beliefs, 'در اخلاق هوش مصنوعی');
    // "No" is an answer: the minority question starts answered (Django's default).
    expect(screen.getByLabelText('خیر')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'ثبت نهایی' }));
    const confirm = screen.getByRole('group', { name: /ثبت نهایی شود؟/ });
    await user.click(within(confirm).getByRole('button', { name: 'ثبت نهایی' }));
    expect(await screen.findByText('اطلاعات بیانیه‌ی تنوع ثبت نهایی شد')).toBeInTheDocument();
    expect(await serverAnswers('ds')).toMatchObject({
      interaction_experience: 'کار گروهی با دانشجوهای چهار کشور',
      discrimination_experience: null,
      is_minority: false,
      diversity_of_religious_beliefs: 'در اخلاق هوش مصنوعی',
    });
  });

  it('saves a personal statement draft', async () => {
    const user = userEvent.setup();
    await open('/documents/ps', 'اطلاعات بیانیه‌ی شخصی');
    await user.type(screen.getByLabelText(/فضایی که در آن بزرگ شدید/), 'شهر کوچک، کتابخانه‌ی محله');
    expect(await screen.findByText(/ذخیره شد · اکنون/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect((await serverAnswers('ps'))['personal_mentality']).toBe('شهر کوچک، کتابخانه‌ی محله');
  });
});

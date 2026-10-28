import { screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const SARA = 1; // applicant: 2 documents to send, 10 files, SOP + CV (src/mocks/applicant.ts)
const MARYAM = 2; // no applicant file

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openPage = async () => {
  loginAs(SARA);
  renderApp('/documents');
  await screen.findByRole('heading', { name: 'مدارک و نگارش', level: 1 });
};

const required = () => screen.getByRole('region', { name: 'مدارک لازم' });
const files = () => screen.getByRole('region', { name: 'مدارک ارسال‌شده' });
const interests = () => screen.getByRole('region', { name: 'علاقه‌های پژوهشی' });
const pdf = (name: string, bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

describe('documents page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows what to send, what was sent, writing and research interests', async () => {
    await openPage();
    expect(
      screen.getByText('۸ از ۱۰ مدرک را فرستاده‌اید. ۲ مدرک دیگر مانده است.'),
    ).toBeInTheDocument();
    expect(
      within(required()).getByLabelText('ریز نمرات کارشناسی (ترجمه‌ی رسمی)'),
    ).toBeInTheDocument();
    expect(within(required()).getAllByText(/نسخه‌ی قبلی امضا نداشت/).length).toBeGreaterThan(0);
    // Four counts of real rows: waiting on the applicant, with the supervisor, approved, delivered.
    const counts = screen.getByRole('list', { name: 'خلاصه‌ی وضعیت' });
    expect(within(counts).getAllByRole('listitem')).toHaveLength(4);
    // Two lanes: the applicant's files with their review state, the team's deliveries apart.
    expect(within(files()).getAllByRole('listitem')).toHaveLength(8);
    expect(within(files()).getByRole('link', { name: 'دانلود پاسپورت' })).toBeInTheDocument();
    expect(within(files()).getAllByText('تأیید شد').length).toBeGreaterThan(0);
    const team = screen.getByRole('region', { name: 'فایل‌های آماده از تیم' });
    expect(within(team).getAllByRole('listitem')).toHaveLength(2);
    // What waits on the applicant comes first: documents to upload and the writing forms.
    const waiting = screen.getByRole('region', { name: 'منتظر شما' });
    // One card per document (the one sent back says why) and per form.
    expect(within(waiting).getByText(/نسخه‌ی قبلی امضا نداشت/)).toBeInTheDocument();
    expect(within(waiting).getByRole('link', { name: 'آپلود دوباره' })).toHaveAttribute(
      'href',
      '#docs-required',
    );
    expect(within(waiting).getByText('فرم انگیزه‌نامه (SOP)')).toBeInTheDocument();
    expect(within(waiting).getAllByRole('link', { name: 'تکمیل فرم' })[0]).toHaveAttribute(
      'href',
      '/documents/sop',
    );
    // Reviewed files and the team's deliveries can't be deleted.
    expect(within(files()).queryByRole('button', { name: 'حذف دانشنامه‌ی کارشناسی' })).toBeNull();

    const sop = screen.getByRole('region', { name: 'انگیزه‌نامه (SOP)' });
    expect(within(sop).getByRole('link', { name: 'تکمیل فرم اطلاعات' })).toHaveAttribute(
      'href',
      '/documents/sop',
    );
    const cv = screen.getByRole('region', { name: 'رزومه (CV)' });
    expect(within(cv).getByRole('link', { name: 'تکمیل فرم اطلاعات' })).toHaveAttribute(
      'href',
      '/documents/cv',
    );
    expect(within(interests()).getAllByRole('listitem')).toHaveLength(4);
  });

  it('checks files before sending and sends the chosen ones', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openPage();

    await user.click(within(required()).getByRole('button', { name: 'ارسال فایل‌ها' }));
    expect(
      within(required()).getByText('اول برای یکی از مدارک فایل انتخاب کنید.'),
    ).toBeInTheDocument();

    const letter = within(required()).getByLabelText('توصیه‌نامه‌ی دوم');
    await user.upload(letter, new File(['x'], 'letter.docx', { type: 'application/msword' }));
    expect(letter).toHaveAccessibleDescription(/این نوع فایل پذیرفته نمی‌شود/);
    await user.upload(letter, pdf('big.pdf', 11 * 1024 * 1024));
    expect(letter).toHaveAccessibleDescription(/این فایل ۱۱ مگابایت است/);

    await user.upload(
      within(required()).getByLabelText('ریز نمرات کارشناسی (ترجمه‌ی رسمی)'),
      pdf('transcript.pdf', 2.4 * 1024 * 1024),
    );
    expect(within(required()).getByText('transcript.pdf')).toBeInTheDocument();
    expect(within(required()).getByText('۲٫۴ مگابایت · آماده‌ی ارسال')).toBeInTheDocument();

    await user.click(within(required()).getByRole('button', { name: 'ارسال ۱ فایل' }));
    expect(
      await toasts().findByText('فایل‌ها ارسال شد. سوپروایزر شما با خبر شد.'),
    ).toBeInTheDocument();
    // The summary comes from the refetched page data (the to-do box refetches with it).
    expect(
      await screen.findByText('۹ از ۱۰ مدرک را فرستاده‌اید. ۱ مدرک دیگر مانده است.'),
    ).toBeInTheDocument();
    expect(within(required()).queryByLabelText('ریز نمرات کارشناسی (ترجمه‌ی رسمی)')).toBeNull();
    expect(within(files()).getAllByRole('listitem')).toHaveLength(9);
  });

  it('deletes an own file after a confirmation, and asks for it again', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(within(files()).getByRole('button', { name: 'حذف پاسپورت' }));
    await user.click(within(files()).getByRole('button', { name: 'انصراف' }));
    await user.click(within(files()).getByRole('button', { name: 'حذف پاسپورت' }));
    await user.click(within(files()).getByRole('button', { name: 'حذف فایل' }));
    expect(await within(required()).findByLabelText('پاسپورت')).toBeInTheDocument();
    expect(within(files()).getAllByRole('listitem')).toHaveLength(7);
  });

  it('adds and removes research interests, refusing duplicates', async () => {
    const user = userEvent.setup();
    await openPage();
    const field = within(interests()).getByLabelText('افزودن علاقه‌ی پژوهشی');

    await user.type(field, 'machine learning{Enter}');
    expect(field).toHaveAccessibleDescription(/از قبل در فهرست هست/);

    await user.clear(field);
    await user.type(field, '  Reinforcement   Learning {Enter}');
    expect(await within(interests()).findByText('Reinforcement Learning')).toBeInTheDocument();
    expect(field).toHaveValue('');

    await user.click(within(interests()).getByRole('button', { name: 'حذف Computer Vision' }));
    await waitForElementToBeRemoved(() => within(interests()).queryByText('Computer Vision'));
    expect(within(interests()).getAllByRole('listitem')).toHaveLength(4);
  });

  it('updates the home page after an upload', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    const router = renderApp('/documents');
    await screen.findByRole('heading', { name: 'مدارک و نگارش', level: 1 });
    await user.upload(
      within(required()).getByLabelText('ریز نمرات کارشناسی (ترجمه‌ی رسمی)'),
      pdf('transcript.pdf'),
    );
    await user.click(within(required()).getByRole('button', { name: 'ارسال ۱ فایل' }));
    await toasts().findByText('فایل‌ها ارسال شد. سوپروایزر شما با خبر شد.');

    await router.navigate('/');
    const todos = await screen.findByRole('region', { name: 'کارهای منتظر شما' });
    expect(within(todos).queryByText(/ریز نمرات/)).toBeNull();
    expect(screen.getByRole('complementary', { name: 'خلاصه‌ی پرونده' })).toHaveTextContent(
      '۹ از ۱۰',
    );
  });

  it('asks a new user for their documents and texts in one list', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/documents');
    expect(
      await screen.findByRole('heading', {
        name: 'مدارک‌تان را بفرستید، مشاور با شما تماس می‌گیرد.',
      }),
    ).toBeInTheDocument();

    // Your documents: one list; a file is sent at once and lives in its row.
    const have = screen.getByRole('region', { name: 'مدارک شما' });
    expect(within(have).getByText('۰ از ۴')).toBeInTheDocument();
    await user.upload(within(have).getByLabelText('انتخاب فایل ریزنمرات'), pdf('transcript.pdf'));
    expect(await toasts().findByText(/مدرک رسید/)).toBeInTheDocument();
    expect(await within(have).findByText('فرستاده شد · ۱ فایل')).toBeInTheDocument();
    expect(within(have).getByText('۱ از ۴')).toBeInTheDocument();
    await user.click(within(have).getByRole('button', { name: 'فایل‌ها' }));
    expect(within(have).getByRole('button', { name: 'حذف ریزنمرات' })).toBeInTheDocument();

    // The texts in the same list: upload one you have, or we write it (paid at the form's final
    // submit).
    const sop = within(have)
      .getAllByRole('listitem')
      .find((item) => item.textContent.startsWith('انگیزه‌نامه'));
    if (!sop) throw new Error('No SOP row');
    expect(within(sop).getByLabelText('انتخاب فایل انگیزه‌نامه')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'با من تماس بگیرید' })).toBeInTheDocument();

    await user.click(within(sop).getByRole('button', { name: 'سفارش نگارش انگیزه‌نامه' }));
    expect(
      await screen.findByRole('heading', { name: 'اطلاعات انگیزه‌نامه', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/documents/sop');
    expect(screen.getByRole('button', { name: 'خرید — ۴٬۵۰۰٬۰۰۰ تومان' })).toBeInTheDocument();
  });

  it('keeps the locked preview for a contract with writing', async () => {
    loginAs(SARA);
    localStorage.setItem('scorize.mock.access', 'pending');
    renderApp('/documents');
    expect(await screen.findByRole('region', { name: 'قرارداد در حال بررسی' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'مدارک شما' })).toBeNull();
  });
});

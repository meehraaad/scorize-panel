import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// CV: personal details, one degree, one test and skills filled in; no photo, courses or
// references yet (src/mocks/applicant.ts).
const SARA = 1;
const MARYAM = 2; // no applicant file

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openForm = async () => {
  loginAs(SARA);
  renderApp('/documents/cv');
  await screen.findByRole('heading', { name: 'اطلاعات رزومه', level: 1 });
};

const serverAnswers = async () => {
  const response = await fetch(new URL('/api/applicant/v1/writing/cv/', window.location.origin));
  return ((await response.json()) as { answers: Record<string, unknown> }).answers;
};

const photo = (name: string, type: string) => new File(['x'], name, { type });

describe('CV information form', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('opens at the photo, counting finished sections', async () => {
    await openForm();
    expect(screen.getAllByText('۵ از ۱۴ بخش').length).toBeGreaterThan(0);
    expect(screen.getAllByText('بخش ۲ از ۱۴').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'ویرایش: اطلاعات شخصی' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText(/تا عکس پرسنلی را نفرستید/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'انگیزه‌نامه (SOP)' })).toHaveAttribute(
      'href',
      '/documents/sop',
    );
  });

  it('checks the photo before uploading it', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openForm();
    const input = screen.getByLabelText('انتخاب عکس');

    await user.upload(input, photo('cv.pdf', 'application/pdf'));
    expect(screen.getByText('فقط عکس JPG یا PNG پذیرفته می‌شود.')).toBeInTheDocument();

    await user.upload(input, photo('me.jpg', 'image/jpeg'));
    expect(await screen.findByRole('img', { name: 'عکس پرسنلی' })).toBeInTheDocument();
    expect(screen.getByLabelText('تغییر عکس')).toBeInTheDocument();
    expect(screen.getAllByText('۶ از ۱۴ بخش').length).toBeGreaterThan(0);
    expect(await serverAnswers()).toHaveProperty('pass_photo', expect.stringMatching(/^data:/));
  });

  it('adds an entry to a list, and drops an untouched one', async () => {
    const user = userEvent.setup();
    await openForm();
    await user.click(screen.getByRole('button', { name: 'شروع: درس‌های منتخب' }));
    expect(screen.getByRole('heading', { name: 'درس‌های منتخب' })).toHaveFocus();

    // An empty entry closed right away isn't kept.
    await user.click(screen.getByRole('button', { name: 'افزودن درس' }));
    await user.click(screen.getByRole('button', { name: 'تأیید' }));
    expect(screen.queryByLabelText('Course Name')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'افزودن درس' }));
    await user.type(screen.getByLabelText('Course Name'), 'Machine Learning');
    await user.type(screen.getByLabelText(/^Grade/), '19');
    await user.click(screen.getByRole('button', { name: 'تأیید' }));
    expect(screen.getByRole('button', { name: 'ویرایش Machine Learning' })).toBeInTheDocument();

    expect(await screen.findByText(/ذخیره شد · اکنون/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect((await serverAnswers()).courses).toEqual([
      expect.objectContaining({ title: 'Machine Learning', grade: '19' }),
    ]);
  });

  it('asks before removing an entry', async () => {
    const user = userEvent.setup();
    await openForm();
    await user.click(screen.getByRole('button', { name: 'ویرایش: آزمون‌های زبان' }));
    await user.click(screen.getByRole('button', { name: 'حذف IELTS Academic' }));
    const confirm = screen.getByRole('group', { name: /«IELTS Academic» حذف شود؟/ });
    await user.click(within(confirm).getByRole('button', { name: 'انصراف' }));
    expect(screen.getByRole('button', { name: 'حذف IELTS Academic' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'حذف IELTS Academic' }));
    await user.click(
      within(screen.getByRole('group', { name: /حذف شود؟/ })).getByRole('button', { name: 'حذف' }),
    );
    expect(screen.queryByText('IELTS Academic')).toBeNull();
    expect(await screen.findByText(/ذخیره شد · اکنون/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect((await serverAnswers()).english_tests).toEqual([]);
  });

  it('points to what is missing on final submit', async () => {
    const user = userEvent.setup();
    await openForm();
    await user.click(screen.getByRole('button', { name: 'ثبت نهایی' }));
    expect(
      screen.getByText('۳ سؤال اجباری بی‌پاسخ مانده است. اولین مورد را برایتان باز کردیم.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('انتخاب عکس')).toHaveFocus();
    expect(screen.getByText('برای ثبت نهایی عکس پرسنلی لازم است.')).toBeInTheDocument();
  });

  it('submits once the photo and the required lists are in, then becomes read-only', async () => {
    const user = userEvent.setup();
    await openForm();
    await user.upload(screen.getByLabelText('انتخاب عکس'), photo('me.png', 'image/png'));
    await screen.findByRole('img', { name: 'عکس پرسنلی' });

    await user.click(screen.getByRole('button', { name: 'شروع: درس‌های منتخب' }));
    await user.click(screen.getByRole('button', { name: 'افزودن درس' }));
    await user.type(screen.getByLabelText('Course Name'), 'Machine Learning');
    await user.click(screen.getByRole('button', { name: 'تأیید' }));

    await user.click(screen.getByRole('button', { name: 'شروع: توصیه‌کننده‌ها' }));
    await user.click(screen.getByRole('button', { name: 'افزودن توصیه‌کننده' }));
    await user.type(screen.getByLabelText('Name'), 'Dr. Karimi');
    // Closing an entry with required fields left keeps it open and says which.
    await user.click(screen.getByRole('button', { name: 'تأیید' }));
    const university = screen.getByLabelText('University or Organization');
    expect(university).toHaveFocus();
    expect(university).toHaveAttribute('aria-invalid', 'true');
    await user.type(university, 'Isfahan University of Technology');
    await user.type(screen.getByLabelText('Academic / Work Email'), 'karimi@iut.ac.ir');
    await user.click(screen.getByRole('button', { name: 'تأیید' }));

    await user.click(screen.getByRole('button', { name: 'ثبت نهایی' }));
    const confirm = screen.getByRole('group', { name: /ثبت نهایی شود؟/ });
    await user.click(within(confirm).getByRole('button', { name: 'ثبت نهایی' }));

    expect(await screen.findByText('اطلاعات رزومه ثبت نهایی شد')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ثبت نهایی' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'افزودن درس' })).toBeNull();
    expect(screen.getByText('Dr. Karimi')).toBeInTheDocument();
  });

  it('explains when the contract has no CV', async () => {
    loginAs(MARYAM);
    renderApp('/documents/cv');
    expect(await screen.findByText('رزومه جزو خدمات قرارداد شما نیست.')).toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

// The page waits for Django's client services (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, clientServices: true } };
});

const MARYAM = 2; // supervisor with can_assign_supervisor (src/mocks/handlers.ts)

describe('service settings', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', String(MARYAM));
    await i18n.changeLanguage('fa');
  });

  it("shows each service's team, tool and stages", async () => {
    renderApp('/executive/manager/kinds');
    await screen.findByRole('heading', { name: 'تنظیم خدمت‌ها', level: 1 });
    const visa = screen.getByRole('listitem', { name: 'ویزا' });
    expect(visa).toHaveTextContent('تیم ویزا');
    expect(visa).toHaveTextContent('ابزار: نتیجه‌های ویزا و فرم ثبتشان');
    expect(
      within(within(visa).getByRole('list', { name: 'مرحله‌های ویزا' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.getByRole('listitem', { name: 'سرچ' })).toHaveTextContent('هنوز ساخته نشده');
    const writing = screen.getByRole('listitem', { name: 'نگارش' });
    expect(within(writing).queryByRole('button', { name: 'مرحله‌ها' })).not.toBeInTheDocument();
  });

  it('makes a simple service and gives it stages', async () => {
    const user = userEvent.setup();
    renderApp('/executive/manager/kinds');
    await user.click(await screen.findByRole('button', { name: 'خدمت تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'خدمت تازه' });
    await user.click(within(dialog).getByRole('button', { name: 'ساختن خدمت' }));
    expect(within(dialog).getByText('نام را بنویسید.')).toBeVisible();
    await user.type(within(dialog).getByLabelText('نام خدمت'), 'ویزای نومد');
    await user.selectOptions(within(dialog).getByLabelText('تیم'), 'visa');
    await user.click(within(dialog).getByRole('button', { name: 'ساختن خدمت' }));
    expect(await toasts().findByText(/خدمت «ویزای نومد» ساخته شد/)).toBeVisible();

    const nomad = await screen.findByRole('listitem', { name: 'ویزای نومد' });
    expect(nomad).toHaveTextContent('خدمت ساده: فقط مرحله‌ها');
    await user.click(within(nomad).getByRole('button', { name: 'مرحله‌ها' }));
    const stages = await screen.findByRole('dialog', { name: 'مرحله‌های ویزای نومد' });
    await user.click(within(stages).getByRole('button', { name: 'افزودن مرحله' }));
    await user.click(within(stages).getByRole('button', { name: 'افزودن مرحله' }));
    await user.type(within(stages).getByRole('textbox', { name: 'مرحله‌ی ۱' }), 'ویزا گرفت');
    await user.type(within(stages).getByRole('textbox', { name: 'مرحله‌ی ۲' }), 'مدارک');
    await user.selectOptions(
      within(stages).getAllByRole('combobox', { name: 'کشور' })[1] as HTMLElement,
      '2',
    );
    // The second goes first.
    await user.click(within(stages).getByRole('button', { name: 'بالا بردن مدارک' }));
    await user.click(within(stages).getAllByRole('switch', { name: 'پایانی' })[1] as HTMLElement);
    await user.click(within(stages).getByRole('button', { name: 'ذخیره‌ی مرحله‌ها' }));
    expect(await toasts().findByText('مرحله‌های «ویزای نومد» ذخیره شد.')).toBeVisible();
    const list = within(nomad).getByRole('list', { name: 'مرحله‌های ویزای نومد' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['۱. مدارک (ایتالیا)', '۲. ویزا گرفت']);
  });

  it("keeps a stage the system moves services to, and a built-in service's country rule", async () => {
    const user = userEvent.setup();
    renderApp('/executive/manager/kinds');
    const admission = await screen.findByRole('listitem', { name: 'پذیرش' });
    await user.click(within(admission).getByRole('button', { name: 'مرحله‌ها' }));
    const stages = await screen.findByRole('dialog', { name: 'مرحله‌های پذیرش' });
    expect(within(stages).getByRole('button', { name: 'حذف مدارک' })).toBeDisabled();
    await user.click(within(stages).getByRole('button', { name: 'انصراف' }));

    await user.click(within(admission).getByRole('button', { name: 'ویرایش' }));
    const edit = await screen.findByRole('dialog', { name: 'ویرایش پذیرش' });
    expect(within(edit).getByRole('switch', { name: /^به تفکیک کشور/ })).toBeDisabled();
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3; // seller
const REZA = 4; // sales manager

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('consultation types (S81)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('is only for the sales manager', async () => {
    loginAs(NIMA);
    const router = renderApp('/sales/manager/consultations');
    await screen.findByRole('heading', { name: /^سلام نیما، / });
    expect(router.state.location.pathname).toBe('/sales');
  });

  it('lists types on sale and paused, with price, discount and week', async () => {
    loginAs(REZA);
    renderApp('/sales/manager/consultations');
    expect(await screen.findByRole('heading', { name: 'انواع مشاوره' })).toBeInTheDocument();
    const onSale = screen.getByRole('region', { name: 'در حال فروش' });
    const online = within(onSale).getByRole('link', { name: /مشاوره تحصیلی دانشگاهی غیر حضوری/ });
    expect(online).toHaveTextContent('۹۰۰٬۰۰۰ تومان');
    expect(online).toHaveTextContent('۳ روز در هفته، ۱۸ نوبت');
  });

  it('keeps paused types closed, reading them only when opened', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/manager/consultation-types/'))
        asked.push(new URL(request.url).search);
    });
    loginAs(REZA);
    renderApp('/sales/manager/consultations');
    const paused = await screen.findByRole('region', { name: 'متوقف (۱)' });
    expect(within(paused).queryByRole('link')).not.toBeInTheDocument();
    expect(asked).toEqual(['?active=1']);
    await user.click(within(paused).getByRole('button', { name: 'نمایش' }));
    expect(await within(paused).findByRole('link', { name: /ماک سفارت/ })).toHaveTextContent(
      'ساعتی برایش نگذاشته‌اید',
    );
    expect(asked).toEqual(['?active=1', '?active=0']);
    await user.click(within(paused).getByRole('button', { name: 'بستن' }));
    expect(within(paused).queryByRole('link')).not.toBeInTheDocument();
    server.events.removeAllListeners();
  });

  it('changes the price and a day of the week, refusing overlapping times', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/consultations/1');
    const price = await screen.findByLabelText('قیمت (تومان)');
    await user.clear(price);
    await user.type(price, '1800000');

    const week = screen.getByRole('list', { name: 'ساعت‌های هفتگی' });
    const friday = within(week).getAllByRole('listitem').at(-1) as HTMLElement;
    expect(friday).toHaveTextContent('بسته');
    // Opening a day gives it 10 to 17 and shows its times to edit.
    await user.click(within(friday).getByRole('switch', { name: /جمعه/ }));
    expect(friday).toHaveTextContent('۷ نوبت');
    await user.click(within(friday).getByRole('button', { name: 'افزودن بازه' }));
    await user.selectOptions(within(friday).getAllByLabelText('از')[1] as HTMLElement, '16:00');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await within(friday).findByRole('alert')).toHaveTextContent('بدون هم‌پوشانی');

    await user.click(
      within(friday).getAllByRole('button', { name: 'حذف این بازه‌ی جمعه' })[1] as HTMLElement,
    );
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('ذخیره شد.')).toBeInTheDocument();
    expect(screen.getByText('همه‌چیز ذخیره است.')).toBeInTheDocument();
  });

  it('a discount needs a lower price', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    renderApp('/sales/manager/consultations/1');
    await user.click(await screen.findByRole('switch', { name: /تخفیف/ }));
    await user.type(screen.getByLabelText('قیمت با تخفیف (تومان)'), '2000000');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await screen.findByText('قیمت با تخفیف باید از قیمت کمتر باشد.')).toBeInTheDocument();
  });

  it('makes a new online type and opens it', async () => {
    const user = userEvent.setup();
    loginAs(REZA);
    const router = renderApp('/sales/manager/consultations/new');
    await user.type(await screen.findByLabelText('نام مشاوره'), 'مشاوره ویزای استرالیا');
    await user.click(screen.getByRole('radio', { name: 'آنلاین' }));
    await user.type(screen.getByLabelText('قیمت (تومان)'), '1200000');
    await user.click(screen.getByRole('button', { name: 'ساختن' }));
    expect(await toasts().findByText('نوع تازه ساخته شد.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sales/manager/consultations/20');
    expect(await screen.findByText('جلسه‌ها آنلاین است و عوض نمی‌شود.')).toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Agreement } from '@/lib/agreement/api';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3;
const MONEY = '/sales/customers/105/money';

/** Version 2 of an offer the session consultant (the viewer) still has to agree to. */
const desk = (): Agreement => ({
  state: 'sent',
  version: 2,
  amount: 66_500_000,
  versions: [
    { number: 1, created_at: '2026-11-08T08:00:00Z', author: 'نیما رستمی' },
    { number: 2, created_at: '2026-11-09T08:00:00Z', author: 'نیما رستمی' },
  ],
  parties: [
    { party: 'seller', name: 'نیما رستمی', agreed_at: '2026-11-09T08:00:00Z' },
    { party: 'consultant', name: 'کاوه نوری', agreed_at: null },
    { party: 'manager', name: '', agreed_at: null },
    { party: 'customer', name: 'عرفان ملکی', agreed_at: null },
  ],
  you: 'consultant',
  agreed: false,
  lines: [
    { key: 'applies', value: '8', previous: '6' },
    { key: 'countries', value: 'آلمان', previous: null },
  ],
  clauses: [
    {
      title: 'تعهدات اسکورایز',
      text: 'اسکورایز ۸ اپلای انجام می‌دهد.',
      change: 'changed',
      base_text: 'اسکورایز ۶ اپلای انجام می‌دهد.',
      since_previous: true,
      previous_text: 'اسکورایز ۶ اپلای انجام می‌دهد.',
    },
    {
      title: 'فسخ',
      text: 'فسخ تا ۷ روز.',
      change: null,
      base_text: null,
      since_previous: false,
      previous_text: null,
    },
  ],
  remarks: [],
  open_remarks: 0,
});

describe('contract agreement desk (S62)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });

  it('the consultant reads only what changed, asks on a clause and agrees', async () => {
    const data = desk();
    const posts: { url: string; body: unknown }[] = [];
    server.use(
      http.get('/api/sales/v1/customers/:id/agreement/', () =>
        HttpResponse.json({ agreement: data }),
      ),
      http.post('/api/sales/v1/customers/:id/agreement/*', async ({ request }) => {
        posts.push({ url: new URL(request.url).pathname, body: await request.json() });
        return new HttpResponse(null, { status: request.url.endsWith('agree/') ? 204 : 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp(MONEY);
    const card = await screen.findByRole('region', { name: 'توافق قرارداد' });
    expect(within(card).getByText('منتظر مشاور جلسه')).toBeInTheDocument();
    const changes = within(card).getByRole('list', { name: 'تغییرها' });
    // Against version 1: the applies line and the one clause, not the unchanged one.
    expect(within(changes).getByText('تعهدات اسکورایز')).toBeInTheDocument();
    expect(within(changes).queryByText('فسخ')).not.toBeInTheDocument();
    expect(within(changes).getByText('تعداد اپلای')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'سؤال یا پیشنهاد' }));
    await user.selectOptions(within(card).getByLabelText('درباره‌ی'), 'فسخ');
    await user.type(within(card).getByLabelText('سؤال یا پیشنهاد تغییر'), '۱۴ روز باشد');
    await user.click(within(card).getByRole('button', { name: 'ارسال' }));
    expect(await toasts().findByText('برای فروشنده رفت.')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'موافقم با نسخه‌ی 2' }));
    expect(await toasts().findByText('موافقت شما ثبت شد.')).toBeInTheDocument();
    expect(posts).toEqual([
      {
        url: '/api/sales/v1/customers/105/agreement/remarks/',
        body: { version: 2, clause: 'فسخ', text: '۱۴ روز باشد' },
      },
      { url: '/api/sales/v1/customers/105/agreement/agree/', body: { version: 2 } },
    ]);
  });

  it('the seller answers a question', async () => {
    const data: Agreement = {
      ...desk(),
      you: 'seller',
      remarks: [
        {
          id: 9,
          version: 2,
          clause: 'تعهدات اسکورایز',
          party: 'customer',
          author: 'عرفان ملکی',
          text: 'هلند هم می‌شود؟',
          created_at: '2026-11-09T09:00:00Z',
          answer: null,
          answered_at: null,
        },
      ],
    };
    server.use(
      http.get('/api/sales/v1/customers/:id/agreement/', () =>
        HttpResponse.json({ agreement: data }),
      ),
      http.post('/api/sales/v1/customers/:id/agreement/remarks/9/answer/', async ({ request }) => {
        const body = (await request.json()) as { text: string };
        data.remarks = data.remarks.map((remark) =>
          remark.id === 9 ? { ...remark, answer: body.text, answered_at: 'now' } : remark,
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp(MONEY);
    const card = await screen.findByRole('region', { name: 'توافق قرارداد' });
    expect(within(card).getByText('هلند هم می‌شود؟')).toBeInTheDocument();
    await user.type(within(card).getByLabelText('پاسخ شما'), 'بله، در نسخه‌ی بعد');
    await user.click(within(card).getByRole('button', { name: 'ارسال' }));
    expect(await within(card).findByText('بله، در نسخه‌ی بعد')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'ویرایش پیشنهاد' })).toHaveAttribute(
      'href',
      '/sales/customers/105/offer',
    );
  });

  it('no desk before the offer is sent', async () => {
    renderApp(MONEY);
    await screen.findByRole('region', { name: 'نگارش' });
    expect(screen.queryByRole('region', { name: 'توافق قرارداد' })).not.toBeInTheDocument();
  });
});

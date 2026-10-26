import { http, HttpResponse } from 'msw';
import type { AccountData, Notification } from '@/lib/account/api';
import { forbidden, storage } from './session';

/**
 * Fake account API shared by every panel (docs/backend-changes.md A1–A6): notifications, channels,
 * login details. Every user gets a few notifications; Sara has more than one page.
 */

const PAGE = 5;
/** The fake's current password for every account (same as the login mock). */
const PASSWORD = 'password123';

interface MockAccount {
  data: AccountData;
  notifications: Notification[];
}

const accounts = new Map<number, MockAccount>();

const NAMES: Record<number, [string, string, string, string]> = {
  1: ['سارا', 'احمدی', '09120000000', 'sara.ahmadi@scorize.local'],
  2: ['مریم', 'کاظمی', '09120000001', 'maryam.kazemi@scorize.local'],
  3: ['نیما', 'رستمی', '09120000002', 'nima.rostami@scorize.local'],
};

export function accountOf(user: number): MockAccount {
  let found = accounts.get(user);
  if (found) return found;
  const [first, last, phone, email] = NAMES[user] ?? ['', '', null, null];
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  const panel = import.meta.env.BASE_URL.replace(/\/$/, '');
  const items: [string, string, number, string | null][] =
    user === 1
      ? [
          [
            'پاسخ جدید در تیکت',
            'سوپروایزر به پیام شما درباره‌ی نمره‌ی آیلتس پاسخ داد.',
            2,
            `${panel}/tickets`,
          ],
          [
            'وضعیت پرونده تغییر کرد',
            'پرونده‌ی شما وارد مرحله‌ی «در حال اپلای» شد.',
            26,
            `${panel}/`,
          ],
          [
            'اپلای جدید منتظر تأیید شماست',
            'اپلای McGill University ثبت شد. لطفاً تأیید یا رد کنید.',
            28,
            `${panel}/applications`,
          ],
          [
            'یادآوری آپلود مدرک',
            'برای آپلود «ریز نمرات با ترجمه‌ی رسمی» تا ۵ آبان فرصت دارید.',
            50,
            `${panel}/documents`,
          ],
          [
            'نگارش رزومه تمام شد',
            'فایل رزومه‌ی شما آماده‌ی دانلود است.',
            120,
            `${panel}/documents`,
          ],
          ['تولدتان مبارک', 'تیم اسکورایز تولدتان را تبریک می‌گوید.', 200, null],
          ['خوش آمدید', 'حساب شما در اسکورایز ساخته شد.', 2000, null],
        ]
      : [['خوش آمدید', 'حساب شما در اسکورایز ساخته شد.', 30, null]];
  found = {
    data: {
      first_name: first,
      last_name: last,
      username: user === 1 ? 'sara.a' : null,
      phone,
      phone_verified: true,
      email,
      email_verified: user !== 1,
      channels: { sms: true, telegram: false, email: true },
      telegram: { connected: false, connect_url: 'https://t.me/' },
      referral: null,
    },
    notifications: items.map(([title, text, hours, url], index) => ({
      id: items.length - index,
      title,
      text,
      created_at: ago(hours),
      read: index >= 3,
      url,
    })),
  };
  accounts.set(user, found);
  return found;
}

const BASE = '/api/profile/v1';

const withUser = <T>(handle: (account: MockAccount) => T) => {
  const user = storage.get();
  return user ? handle(accountOf(user)) : forbidden();
};

export const accountHandlers = [
  http.get(`${BASE}/notifications/`, ({ request }) =>
    withUser(({ notifications }) => {
      const before = Number(new URL(request.url).searchParams.get('before') ?? Infinity);
      const older = notifications.filter((item) => item.id < before);
      return HttpResponse.json({
        results: older.slice(0, PAGE),
        unread: notifications.filter((item) => !item.read).length,
        has_more: older.length > PAGE,
      });
    }),
  ),

  http.post(`${BASE}/notifications/read/`, async ({ request }) => {
    const { ids } = (await request.json()) as { ids?: number[] };
    return withUser(({ notifications }) => {
      for (const item of notifications) if (!ids || ids.includes(item.id)) item.read = true;
      return new HttpResponse(null, { status: 204 });
    });
  }),

  http.get(`${BASE}/account/`, () => withUser(({ data }) => HttpResponse.json(data))),

  http.patch(`${BASE}/account/`, async ({ request }) => {
    const changes = (await request.json()) as Partial<AccountData>;
    return withUser(({ data }) => {
      if (changes.channels?.telegram && !data.telegram.connected)
        return HttpResponse.json({ channels: ['telegram not linked'] }, { status: 400 });
      Object.assign(data, changes);
      return HttpResponse.json(data);
    });
  }),

  http.post(`${BASE}/account/email/resend/`, () =>
    withUser(() => new HttpResponse(null, { status: 204 })),
  ),

  http.post(`${BASE}/account/password/`, async ({ request }) => {
    const body = (await request.json()) as { current: string; new: string };
    return withUser(() =>
      body.current === PASSWORD && body.new.length >= 8
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json({ current: ['invalid'] }, { status: 400 }),
    );
  }),
];

export function resetAccountMocks() {
  accounts.clear();
}

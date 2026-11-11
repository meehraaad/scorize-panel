import { http, HttpResponse } from 'msw';
import type {
  Change,
  ReadyMessage,
  SystemMessage,
  SystemMessageDetail,
} from '@/features/messages/api';
import { unknownVariables } from '@/lib/messageVariables';
import { forbidden, notFound, storage } from './session';

/**
 * Fake messages section (scorize-revolution `api/messages/v1/`): a few automatic messages (one of
 * them outside the shared list), ready messages for sellers and tickets.
 * Amir (6) is a superuser: both keys. Staff (2, 3, 4) read the ticket replies.
 */

const API = '/api/messages/v1';
const SUPERUSER = 6;
const STAFF = [2, 3, 4, SUPERUSER];
const now = () => new Date().toISOString();
const AMIR = { id: SUPERUSER, name: 'امیر عابدی' };

/** Django's user_profile/ready_variables.py */
const READY_VARIABLES = [
  { name: 'customer', label: 'نام مشتری', sample: 'سارا رضایی' },
  { name: 'first_name', label: 'نام کوچک مشتری', sample: 'سارا' },
  { name: 'seller', label: 'نام فرستنده', sample: 'نیما رستمی' },
  { name: 'meeting_date', label: 'تاریخ جلسه', sample: '۱۴۰۵/۰۸/۲۵' },
  { name: 'meeting_time', label: 'ساعت جلسه', sample: '۱۷:۰۰' },
  { name: 'meeting_type', label: 'نوع جلسه', sample: 'مشاوره تحصیلی حضوری' },
  { name: 'summary', label: 'خلاصه‌ی آخرین تماس یا جلسه', sample: 'مدارک زبان را آماده کنید.' },
  { name: 'panel', label: 'لینک پنل', sample: 'https://scorize.com/panel/' },
];

interface MockSystem extends SystemMessage {
  history: Change[];
}

const system = (): MockSystem[] => [
  {
    key: 'consultation_reservation_1',
    editable: true,
    title: 'رزرو مشاوره تحصیلی دانشگاهی حضوری',
    default_title: 'رزرو مشاوره تحصیلی دانشگاهی حضوری',
    text: 'مشاوره‌ی شما برای تاریخ {token2} ساعت {token3} رزرو شد.',
    default_text: 'مشاوره‌ی شما برای تاریخ {token2} ساعت {token3} رزرو شد.',
    is_active: true,
    edited: false,
    updated_by: null,
    updated_at: null,
    group: 'consultation',
    audience: 'customer',
    when: 'وقتی مشتری این نوع مشاوره را رزرو و پرداخت می‌کند.',
    channels: ['sms', 'bell'],
    sms_template: 'consultation-reservation-1',
    variables: [
      { name: 'token2', label: 'تاریخ جلسه', sample: '۱۴۰۵/۰۸/۲۵' },
      { name: 'token3', label: 'ساعت جلسه', sample: '۱۷:۰۰' },
      { name: 'token', label: 'نام', sample: 'سارا' },
    ],
    stats: { sent: 1240, cost: 1_860_000, last_sent: now() },
    history: [],
  },
  {
    key: 'consultation_reservation_final_reminder',
    editable: true,
    title: 'یادآوری نهایی مشاوره حضوری',
    default_title: 'یادآوری نهایی مشاوره حضوری',
    text: 'جلسه‌ی مشاوره‌ی حضوریت یه ساعت دیگه شروع میشه.',
    default_text: 'جلسه‌ی مشاوره‌ی حضوریت یه ساعت دیگه شروع میشه.',
    is_active: false,
    edited: false,
    updated_by: null,
    updated_at: null,
    group: 'consultation',
    audience: 'customer',
    when: 'یک ساعت قبل از مشاوره‌ی حضوری (هر جلسه یک بار).',
    channels: ['sms'],
    sms_template: 'consultation-reservation-final-reminder',
    variables: [{ name: 'token', label: 'نام', sample: 'سارا' }],
    stats: null,
    history: [],
  },
  {
    key: 'sales_contract_approved',
    editable: true,
    title: 'قرارداد شما آماده است',
    default_title: 'قرارداد شما آماده است',
    text: '{token} عزیز، قرارداد شما ثبت شد.',
    default_text: '{token} عزیز، قرارداد شما ثبت شد.',
    is_active: true,
    edited: false,
    updated_by: null,
    updated_at: null,
    group: 'sales',
    audience: 'customer',
    when: 'وقتی قرارداد مشتری تأیید و ثبت می‌شود.',
    channels: ['bell'],
    sms_template: null,
    variables: [{ name: 'token', label: 'نام', sample: 'سارا' }],
    stats: null,
    history: [],
  },
  {
    key: 'login_code_sms',
    editable: false,
    title: 'کد ورود (پیامک)',
    default_title: 'کد ورود (پیامک)',
    text: '',
    default_text: '',
    is_active: true,
    edited: false,
    updated_by: null,
    updated_at: null,
    group: 'account',
    audience: 'customer',
    when: 'وقتی کسی با شماره تلفن وارد سایت یا پنل می‌شود.',
    channels: ['sms'],
    sms_template: 'scorize-login-code',
    variables: [],
    stats: null,
    history: [],
  },
];

const ready = (): ReadyMessage[] => [
  {
    id: 1,
    kind: 'sales',
    title: 'بعد از تماس اول',
    text: 'سلام {customer} عزیز، {seller} هستم از اسکورایز.',
    is_active: true,
    order: 0,
    updated_at: null,
  },
  {
    id: 2,
    kind: 'ticket',
    title: 'مدارک رسید',
    text: 'سلام {customer}، مدارکتان رسید و بررسی می‌شود. {seller}',
    is_active: true,
    order: 0,
    updated_at: null,
  },
];

let messages = system();
let readies = ready();
const readyHistory = new Map<number, Change[]>();
let nextId = 100;

export function resetMessagesMocks() {
  messages = system();
  readies = ready();
  readyHistory.clear();
  nextId = 100;
}

const allowed = () => storage.get() === SUPERUSER;
const plain = ({ history: _history, ...message }: MockSystem): SystemMessage => message;
const invalid = (field: string, text: string) =>
  HttpResponse.json({ [field]: [text] }, { status: 400 });

function change(title: string, text: string, is_active: boolean): Change {
  return { id: nextId++, title, text, is_active, by: AMIR, at: now() };
}

export const messagesHandlers = [
  http.get(`${API}/system/`, () => {
    if (!allowed()) return forbidden();
    return HttpResponse.json({
      groups: ['consultation', 'sales', 'account', 'case', 'writing', 'ticket', 'team', 'other'],
      results: messages.map(plain),
    });
  }),

  http.get(`${API}/system/:key/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const message = messages.find((row) => row.key === params.key && row.editable);
    return message ? HttpResponse.json<SystemMessageDetail>(message) : notFound();
  }),

  http.patch(`${API}/system/:key/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const message = messages.find((row) => row.key === params.key && row.editable);
    if (!message) return notFound();
    const body = (await request.json()) as Partial<SystemMessage>;
    if (body.text !== undefined && body.text.trim()) {
      const unknown = unknownVariables(body.text, message.variables);
      if (unknown === null) return invalid('text', 'A { or } is left open.');
      if (unknown.length)
        return invalid('text', `This message has no variable {${unknown[0] ?? ''}}.`);
    }
    if (body.title !== undefined) message.title = body.title.trim() || message.default_title;
    if (body.text !== undefined) message.text = body.text.trim() ? body.text : message.default_text;
    if (body.is_active !== undefined) message.is_active = body.is_active;
    message.edited =
      message.title !== message.default_title || message.text !== message.default_text;
    message.updated_by = AMIR;
    message.updated_at = now();
    message.history.unshift(change(message.title, message.text, message.is_active));
    return HttpResponse.json<SystemMessageDetail>(message);
  }),

  http.post(`${API}/system/:key/test/`, ({ params }) => {
    if (!allowed()) return forbidden();
    return messages.some((row) => row.key === params.key)
      ? HttpResponse.json({ sent: true }, { status: 202 })
      : notFound();
  }),

  http.get(`${API}/ready/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const kind = new URL(request.url).searchParams.get('kind') ?? 'sales';
    return HttpResponse.json(
      readies.filter((row) => row.kind === kind || (kind !== 'both' && row.kind === 'both')),
    );
  }),

  http.get(`${API}/ready/variables/`, () =>
    allowed() ? HttpResponse.json(READY_VARIABLES) : forbidden(),
  ),

  http.post(`${API}/ready/`, async ({ request }) => {
    if (!allowed()) return forbidden();
    const body = (await request.json()) as Omit<ReadyMessage, 'id' | 'order' | 'updated_at'>;
    const row: ReadyMessage = { ...body, id: nextId++, order: readies.length, updated_at: now() };
    readies.push(row);
    readyHistory.set(row.id, [change(row.title, row.text, row.is_active)]);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.patch(`${API}/ready/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = readies.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    Object.assign(row, (await request.json()) as Partial<ReadyMessage>, { updated_at: now() });
    readyHistory.set(row.id, [
      change(row.title, row.text, row.is_active),
      ...(readyHistory.get(row.id) ?? []),
    ]);
    return HttpResponse.json(row);
  }),

  http.delete(`${API}/ready/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    readies = readies.filter((item) => item.id !== Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/history/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const key = Number(new URL(request.url).searchParams.get('key'));
    return HttpResponse.json(readyHistory.get(key) ?? []);
  }),

  // `?case=`: Django fills every variable for the case's applicant (here: a session at 17:00).
  http.get(`${API}/ticket-replies/`, ({ request }) => {
    if (!STAFF.includes(storage.get() ?? 0)) return forbidden();
    const filled = new URL(request.url).searchParams.has('case');
    return HttpResponse.json(
      readies
        .filter((row) => (row.kind === 'ticket' || row.kind === 'both') && row.is_active)
        .map(({ id, title, text }) => ({
          id,
          title,
          text: filled ? text.replaceAll('{meeting_time}', '۱۷:۰۰') : text,
        })),
    );
  }),
];

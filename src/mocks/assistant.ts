import { http, HttpResponse } from 'msw';
import type {
  Assistant,
  AssistantMessage,
  Conversation,
  ConversationRow,
} from '@/features/assistant/api';
import { storage } from './session';

/**
 * The AI hub's API for the founders panel (scorize-revolution `api/ai/v1/views.py`, AI1–AI5). An
 * answer is written in the background there: here it is `pending` until the conversation is read
 * again, then done. A question with «لیست» gets a table (the founder-only `data.tables`), one with
 * «خطا» a failed answer.
 */

const API = '/api/ai/v1';
export const FOUNDER = 5;
const PAGE_SIZE = 20;

const ASSISTANTS: Assistant[] = [
  { slug: 'founders', name: 'دستیار تحلیلی مدیریت', description: '' },
];

let conversations: Conversation[] = [];
/** Questions waiting for their answer: answered on the next read. */
const waiting = new Map<number, string>();
let nextId = 1;
const newId = () => nextId++;
const now = () => new Date().toISOString();

function seed(): Conversation[] {
  const at = new Date(Date.now() - 86_400_000).toISOString();
  return [
    {
      id: 900,
      assistant: 'founders',
      title: 'فروش ماه گذشته به تفکیک نوع',
      pinned: false,
      created_at: at,
      updated_at: at,
      messages: [
        message('user', 'فروش ماه گذشته به تفکیک نوع چقدر بود؟', at),
        {
          ...message(
            'assistant',
            'فروش پرداخت‌شده‌ی **مهر ۱۴۰۵**:\n\n- خرید محصول: ۵٬۷۷۰٬۰۰۰ تومان\n- رزرو مشاوره: ۲٬۷۵۰٬۰۰۰ تومان',
            at,
          ),
          feedback: 'right',
        },
      ],
    },
  ];
}

export function resetAssistantMocks() {
  nextId = 1;
  waiting.clear();
  conversations = seed();
}
resetAssistantMocks();

function message(
  role: AssistantMessage['role'],
  text: string,
  created_at = now(),
): AssistantMessage {
  return {
    id: newId(),
    role,
    text,
    data: {},
    status: 'done',
    error: '',
    feedback: '',
    created_at,
  };
}

/** What the background answer writes, once the conversation is read again. */
function answer(question: string): Partial<AssistantMessage> {
  if (question.includes('خطا'))
    return { status: 'failed', error: 'پاسخ آماده نشد. چند دقیقه بعد دوباره امتحان کنید.' };
  if (question.includes('لیست'))
    return {
      status: 'done',
      text: '۲ سرنخ برای پیگیری امروز ثبت شده است؛ فهرستشان در جدول زیر است.',
      data: {
        tables: [
          {
            tool: 'query_data',
            title: 'سرنخ‌های فروش',
            columns: [
              { key: 'customer_name', label: 'نام مشتری' },
              { key: 'customer_phone', label: 'موبایل مشتری' },
              { key: 'staff', label: 'کارشناس فروش' },
            ],
            rows: [
              { customer_name: 'آرش صالحی', customer_phone: '09121112233', staff: 'نیما رستمی' },
              { customer_name: 'لیلا مرادی', customer_phone: '09124445566', staff: null },
            ],
          },
        ],
      },
    };
  return {
    status: 'done',
    text: '**۹۰ سرنخ** در سال ۱۴۰۵:\n\n- مهر: ۲۴\n- شهریور: ۱۸\n\nبر اساس تاریخ ثبت سرنخ.',
  };
}

const loggedIn = () => storage.get() === FOUNDER;
const forbidden = () =>
  HttpResponse.json({ detail: 'You do not have permission.' }, { status: 403 });
const row = ({ messages: _messages, ...conversation }: Conversation): ConversationRow =>
  conversation;

function ask(conversation: Conversation, text: string) {
  conversation.messages.push(message('user', text));
  const pending: AssistantMessage = { ...message('assistant', ''), status: 'pending' };
  conversation.messages.push(pending);
  conversation.updated_at = now();
  waiting.set(pending.id, text);
  return pending;
}

export const assistantHandlers = [
  http.get(`${API}/assistants/`, () => (loggedIn() ? HttpResponse.json(ASSISTANTS) : forbidden())),

  http.get(`${API}/conversations/`, ({ request }) => {
    if (!loggedIn()) return forbidden();
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
    // Pinned first (newest pin first in Django; here in the order they were pinned), then newest.
    const sorted = [...conversations].sort(
      (a, b) =>
        Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
        b.updated_at.localeCompare(a.updated_at),
    );
    return HttpResponse.json({
      count: sorted.length,
      page_size: PAGE_SIZE,
      results: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(row),
    });
  }),

  http.post(`${API}/conversations/`, async ({ request }) => {
    if (!loggedIn()) return forbidden();
    const body = (await request.json()) as { assistant: string; text: string };
    if (!ASSISTANTS.some((item) => item.slug === body.assistant))
      return HttpResponse.json({ assistant: ['You cannot use this assistant.'] }, { status: 400 });
    const conversation: Conversation = {
      id: 1000 + newId(),
      assistant: body.assistant,
      title: body.text.slice(0, 60),
      pinned: false,
      created_at: now(),
      updated_at: now(),
      messages: [],
    };
    ask(conversation, body.text);
    conversations.push(conversation);
    return HttpResponse.json(conversation, { status: 201 });
  }),

  http.get(`${API}/conversations/:id/`, ({ params }) => {
    if (!loggedIn()) return forbidden();
    const conversation = conversations.find((item) => item.id === Number(params.id));
    if (!conversation) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
    const response = HttpResponse.json(structuredClone(conversation));
    // The background answer lands after this read.
    for (const item of conversation.messages) {
      const question = waiting.get(item.id);
      if (question === undefined) continue;
      Object.assign(item, answer(question));
      waiting.delete(item.id);
    }
    return response;
  }),

  http.patch(`${API}/conversations/:id/`, async ({ params, request }) => {
    if (!loggedIn()) return forbidden();
    const conversation = conversations.find((item) => item.id === Number(params.id));
    if (!conversation) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
    const body = (await request.json()) as { title?: string; pinned?: boolean };
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title)
        return HttpResponse.json({ title: ['This field may not be blank.'] }, { status: 400 });
      conversation.title = title.slice(0, 128);
    }
    if (body.pinned !== undefined) conversation.pinned = body.pinned;
    return HttpResponse.json(row(conversation));
  }),

  http.post(`${API}/conversations/:id/messages/`, async ({ params, request }) => {
    if (!loggedIn()) return forbidden();
    const conversation = conversations.find((item) => item.id === Number(params.id));
    if (!conversation) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
    if (conversation.messages.some((item) => item.status === 'pending'))
      return HttpResponse.json(
        { detail: 'The previous question is still being answered.' },
        { status: 409 },
      );
    const { text } = (await request.json()) as { text: string };
    return HttpResponse.json(ask(conversation, text), { status: 202 });
  }),

  http.post(`${API}/messages/:id/feedback/`, async ({ params, request }) => {
    if (!loggedIn()) return forbidden();
    const found = conversations
      .flatMap((item) => item.messages)
      .find((item) => item.id === Number(params.id) && item.role === 'assistant');
    if (!found || found.status !== 'done')
      return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
    const { feedback } = (await request.json()) as { feedback: 'right' | 'wrong' };
    found.feedback = feedback;
    return HttpResponse.json(found);
  }),
];

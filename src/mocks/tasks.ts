import { http, HttpResponse } from 'msw';
import type {
  MyTask,
  NewTask,
  QueueItem,
  RequestDetail,
  TaskChange,
  TasksOverview,
} from '@/lib/tasks/api';
import { notFound, storage } from './session';
import { SELLER, failed, newId, stateOrError, type SalesState } from './sales';
import { SUPERVISOR, SUPERVISOR_NAME, addCaseTask } from './supervisor';

/**
 * Fake staff tasks (docs/backend-changes.md T1–T12) for the seller and the supervisor: follow-ups,
 * colleagues' requests, the team queue. Tasks created about a customer (or an applicant) also show
 * on that person's page.
 */

const TASKS = '/api/staff/v1/tasks';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const later = (ms: number) => new Date(Date.now() + ms).toISOString();
/** Today at hh:mm, or the next hour when that has passed (keeps "today" tasks in today). */
const todayAt = (hour: number) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.getTime() > Date.now() ? date.toISOString() : later(HOUR * 2);
};

interface TasksState {
  overview: TasksOverview;
  details: Map<number, RequestDetail>;
}

const mine = (): MyTask[] => [
  {
    id: 101,
    text: 'زنگ بزن و جواب خانواده درباره‌ی پیشنهاد اپلای آلمان را بگیر',
    due_at: ago(2 * DAY),
    person: { id: 104, name: 'محمد یزدانی', context: 'لید · پیشنهاد ارسال شد' },
    source: 'chain',
    snoozed: 2,
    step: 3,
    action: 'call',
    note: 'پدرش هزینه را می‌دهد؛ گفت تا شنبه خبر می‌دهند.',
    suggested_next: 'جواب نهایی خانواده را بگیر',
  },
  {
    id: 102,
    text: 'پیگیری رسید قسط اول؛ کارت‌به‌کارت کرده ولی رسید را نفرستاده',
    due_at: ago(DAY),
    person: { id: 112, name: 'کیان مرادی', context: 'قرارداد اپلای کامل ایتالیا' },
    source: 'system',
    snoozed: 0,
    step: null,
    action: 'message',
    note: '',
    suggested_next: 'رسید را در پنل تأیید کن',
  },
  {
    id: 103,
    text: 'تماس دوم؛ دیروز جواب نداد',
    due_at: later(20 * 60_000),
    person: { id: 106, name: 'سمیرا نوروزی', context: 'لید · کمپین وبینار کانادا' },
    source: 'system',
    snoozed: 0,
    step: null,
    action: 'call',
    note: '',
    suggested_next: 'تماس سوم، اگر جواب نداد پیام واتساپ',
  },
  {
    id: 104,
    text: 'بعد از مشاوره زنگ بزن؛ نگرانی‌اش هزینه‌ی زندگی بود',
    due_at: todayAt(18),
    person: { id: 105, name: 'عرفان ملکی', context: 'لید · مشاوره شد' },
    source: 'chain',
    snoozed: 0,
    step: 2,
    action: 'call',
    note: '',
    suggested_next: 'پیشنهاد اقساطی را بفرست',
  },
];

const team = (): QueueItem[] => [
  {
    id: 301,
    team: 'sales',
    automatic: true,
    text: 'درخواست تماس از پنل؛ روی صفحه‌ی قفل «قرارداد» زد',
    person: { id: 102, name: 'پویا عسگری' },
    queued_at: ago(18 * 60_000),
    taken: null,
  },
  {
    id: 302,
    team: 'sales',
    automatic: true,
    text: 'مشاوره خریده ولی ۷ روز است پیشنهادی نگرفته',
    person: { id: 110, name: 'داوود صالحی' },
    queued_at: ago(2 * DAY),
    taken: null,
  },
];

function tasksState(): TasksState {
  const details: RequestDetail[] = [
    {
      id: 201,
      from: { name: 'مریم کاظمی', role: 'سوپروایزر' },
      created_at: ago(4 * HOUR),
      text: 'پذیرش Uppsala گرفت و قرارداد فقط اپلای است؛ خدمات ویزا را پیشنهاد بده',
      person: { id: 120, name: 'زهرا موسوی' },
      due_at: todayAt(18),
      status: 'sent',
      comments: 1,
      body: 'زهرا از Uppsala پذیرش گرفته و قراردادش فقط اپلای است. خیلی نگران وقت سفارت است. اگر ویزا را بگیرد من پرونده را تا آخر نگه می‌دارم.',
      watchers: [],
      thread: [
        {
          id: 1,
          author: 'مریم کاظمی',
          mine: false,
          at: ago(3 * HOUR),
          text: 'شماره‌ی همسرش را هم در پرونده گذاشتم؛ تصمیم با هر دو است.',
        },
      ],
    },
    {
      id: 202,
      from: { name: 'حسین رحیمی', role: 'مشاور' },
      created_at: ago(2 * DAY),
      text: 'جلسه‌ی دوم مشاوره را با عرفان هماهنگ کن؛ سؤال‌های بورسیه دارد',
      person: { id: 105, name: 'عرفان ملکی' },
      due_at: ago(DAY),
      status: 'seen',
      comments: 0,
      body: 'عرفان درباره‌ی بورسیه‌های هلند سؤال‌های زیادی داشت. یک جلسه‌ی ۳۰ دقیقه‌ای دیگر لازم است.',
      watchers: [],
      thread: [],
    },
  ];
  return {
    overview: {
      on_time: { week: 0.86, last_week: 0.71, target: 0.9 },
      orphans: [
        { id: 109, name: 'لیلا امینی' },
        { id: 110, name: 'داوود صالحی' },
        { id: 113, name: 'نیما رستگار' },
      ],
      mine: mine(),
      tomorrow: 7,
      done_today: 5,
      requests: details.map(
        ({ body: _body, watchers: _watchers, thread: _thread, ...request }) => request,
      ),
      team: team(),
      sent: [
        {
          id: 401,
          text: 'تأیید رسید کیان مرادی',
          to: { team: 'finance' },
          at: ago(3 * HOUR),
          status: 'seen',
        },
        {
          id: 402,
          text: 'جلسه‌ی دوم مشاوره برای عرفان',
          to: { name: 'حسین رحیمی' },
          at: ago(DAY),
          status: 'done',
        },
      ],
      colleagues: [
        { id: 21, name: 'حسین رحیمی', role: 'مشاور' },
        { id: 7, name: 'مریم کاظمی', role: 'سوپروایزر' },
        { id: 22, name: 'الهام رضوی', role: 'سرپرست تیم نگارش' },
      ],
    },
    details: new Map(details.map((detail) => [detail.id, detail])),
  };
}

/** Maryam's tasks in the supervisor panel (`?panel=supervisor`): about her applicants' cases. */
function supervisorTasksState(): TasksState {
  const person = (id: number, name: string, context: string) => ({ id, name, context });
  const details: RequestDetail[] = [
    {
      id: 211,
      from: { name: 'نیما رستمی', role: 'فروش' },
      created_at: ago(5 * HOUR),
      text: 'زهرا موسوی خدمات ویزا را خرید؛ وقت سفارت را با او هماهنگ کن',
      person: { id: 1224, name: 'زهرا موسوی' },
      due_at: todayAt(17),
      status: 'sent',
      comments: 0,
      body: 'قرارداد ویزا امروز ثبت شد. لطفاً برای گرفتن وقت سفارت سوئد با او تماس بگیرید.',
      watchers: [],
      thread: [],
    },
  ];
  return {
    overview: {
      on_time: { week: 0.92, last_week: 0.84, target: 0.9 },
      orphans: [
        { id: 1198, name: 'لیلا امینی' },
        { id: 1210, name: 'رضا حسینی' },
      ],
      mine: [
        {
          id: 111,
          text: 'فی Stanford را پرداخت کن؛ ددلاین ۵ روز دیگر است',
          due_at: ago(3 * HOUR),
          person: person(1215, 'مهسا جعفری', 'در حال اپلای · آمریکا'),
          source: 'system',
          snoozed: 0,
          step: null,
          action: 'open',
          note: '',
          suggested_next: 'رسید پرداخت را در پرونده بگذار',
        },
        {
          id: 112,
          text: 'بررسی SOP نسخه‌ی دوم',
          due_at: ago(2 * HOUR),
          person: person(1240, 'سارا محمدی', 'در حال اپلای · کانادا، آلمان'),
          source: 'me',
          snoozed: 1,
          step: null,
          action: 'open',
          note: '',
          suggested_next: 'نظرها را برای تیم نگارش بفرست',
        },
        {
          id: 113,
          text: 'به سؤال علی درباره‌ی گواهی موقت پاسخ بده',
          due_at: todayAt(16),
          person: person(1219, 'علی نوری', 'تکمیل مدارک · آلمان'),
          source: 'system',
          snoozed: 0,
          step: null,
          action: 'message',
          note: '',
          suggested_next: '',
        },
      ],
      tomorrow: 4,
      done_today: 3,
      requests: details.map(
        ({ body: _body, watchers: _watchers, thread: _thread, ...request }) => request,
      ),
      team: [
        {
          id: 311,
          team: 'documents',
          automatic: true,
          text: 'ترجمه‌ی رسمی ریزنمرات دو هفته است نرسیده',
          person: { id: 1238, name: 'امیرحسین رضایی' },
          queued_at: ago(DAY),
          taken: null,
        },
      ],
      sent: [
        {
          id: 411,
          text: 'نسخه‌ی دوم SOP نگار احمدی',
          to: { team: 'writing' },
          at: ago(2 * DAY),
          status: 'in_progress',
        },
      ],
      colleagues: [
        { id: 23, name: 'علی رضایی', role: 'سوپروایزر' },
        { id: 22, name: 'الهام رضوی', role: 'سرپرست تیم نگارش' },
        { id: 8, name: 'نیما رستمی', role: 'فروش' },
      ],
    },
    details: new Map(details.map((detail) => [detail.id, detail])),
  };
}

let tasks: TasksState | null = null;
let supervisorTasks: TasksState | null = null;

interface TasksContext {
  tasks: TasksState;
  /** The logged-in staff member's name (owner and author of what they create). */
  me: string;
  /** Records a task about a person on that person's page. */
  onPerson: (task: NewTask, owner: string | null) => void;
}

function tasksOrError(): TasksContext | Response {
  if (storage.get() === SUPERVISOR) {
    supervisorTasks ??= supervisorTasksState();
    return { tasks: supervisorTasks, me: SUPERVISOR_NAME, onPerson: addCaseTask };
  }
  const data = stateOrError();
  if (failed(data)) return data;
  tasks ??= tasksState();
  return { tasks, me: SELLER, onPerson: (task, owner) => addCustomerTask(data, task, owner) };
}

function addCustomerTask(sales: SalesState, task: NewTask, owner: string | null) {
  if (task.user === null) return;
  const list = sales.tasks.get(task.user) ?? [];
  list.push({
    id: newId(),
    kind: task.kind,
    status: task.kind === 'mine' ? 'open' : task.kind === 'request' ? 'sent' : 'queued',
    text: task.text,
    due_at: task.due_at,
    owner,
    creator: SELLER,
    team: task.team ?? null,
    automatic: false,
  });
  sales.tasks.set(task.user, list);
}

function applyChange(
  state: TasksState,
  id: number,
  change: TaskChange,
  me: string,
): Response | null {
  const { overview, details } = state;
  const task = overview.mine.find((item) => item.id === id);
  const request = overview.requests.find((item) => item.id === id);
  const queued = overview.team.find((item) => item.id === id);
  switch (change.kind) {
    case 'done': {
      if (!task) return notFound();
      if (!change.next && !change.end_reason)
        return HttpResponse.json({ next: ['required'] }, { status: 400 });
      overview.mine = overview.mine.filter((item) => item !== task);
      overview.done_today += 1;
      // The next step lands in my follow-ups (tomorrow's list when it is not today).
      if (change.next) {
        const due = new Date(change.next.due_at);
        if (due.toDateString() === new Date().toDateString())
          overview.mine.push({
            ...task,
            id: newId(),
            text: change.next.text,
            due_at: change.next.due_at,
            source: 'chain',
            snoozed: 0,
            step: (task.step ?? 1) + 1,
            note: change.note,
            suggested_next: '',
          });
        else overview.tomorrow += 1;
      }
      return null;
    }
    case 'snooze': {
      if (!task) return notFound();
      task.snoozed += 1;
      task.due_at = change.until;
      if (new Date(change.until).toDateString() !== new Date().toDateString()) {
        overview.mine = overview.mine.filter((item) => item !== task);
        overview.tomorrow += 1;
      }
      return null;
    }
    case 'claim': {
      if (!queued) return notFound();
      if (queued.taken) return HttpResponse.json({ detail: 'Already taken.' }, { status: 409 });
      queued.taken = 'me';
      if (queued.person)
        overview.mine.push({
          id: newId(),
          text: queued.text,
          due_at: later(HOUR),
          person: { ...queued.person, context: '' },
          source: 'system',
          snoozed: 0,
          step: null,
          action: 'call',
          note: '',
          suggested_next: '',
        });
      return null;
    }
    case 'status': {
      const detail = details.get(id);
      if (!request || !detail) return notFound();
      if (change.status === 'rejected' && !change.reason?.trim())
        return HttpResponse.json({ reason: ['required'] }, { status: 400 });
      request.status = change.status;
      detail.status = change.status;
      return null;
    }
    case 'comment': {
      const detail = details.get(id);
      if (!request || !detail) return notFound();
      detail.thread.push({
        id: newId(),
        author: me,
        mine: true,
        at: new Date().toISOString(),
        text: change.text,
      });
      request.comments += 1;
      detail.comments = request.comments;
      return null;
    }
  }
}

const CHANGE_KIND: Record<string, TaskChange['kind']> = {
  done: 'done',
  snooze: 'snooze',
  claim: 'claim',
  status: 'status',
  comments: 'comment',
};

export const taskHandlers = [
  http.get(`${TASKS}/`, () => {
    const data = tasksOrError();
    return data instanceof Response ? data : HttpResponse.json(data.tasks.overview);
  }),

  http.get(`${TASKS}/:id/`, ({ params }) => {
    const data = tasksOrError();
    if (data instanceof Response) return data;
    const detail = data.tasks.details.get(Number(params.id));
    return detail ? HttpResponse.json(detail) : notFound();
  }),

  http.post(`${TASKS}/:id/:action/`, async ({ params, request }) => {
    const data = tasksOrError();
    if (data instanceof Response) return data;
    const kind = CHANGE_KIND[String(params.action)];
    if (!kind) return notFound();
    const body = (await request.json().catch(() => ({}))) as object;
    const error = applyChange(
      data.tasks,
      Number(params.id),
      { kind, ...body } as TaskChange,
      data.me,
    );
    return error ?? new HttpResponse(null, { status: 204 });
  }),

  // A task about a person (from their page), or an internal request (no person).
  http.post(`${TASKS}/`, async ({ request }) => {
    const data = tasksOrError();
    if (data instanceof Response) return data;
    const task = (await request.json()) as NewTask;
    if (!task.text.trim()) return HttpResponse.json({ text: ['required'] }, { status: 400 });
    const colleague = data.tasks.overview.colleagues.find((item) => item.id === task.assignee);
    if (task.kind !== 'mine')
      data.tasks.overview.sent.unshift({
        id: newId(),
        text: task.text,
        to: task.team ? { team: task.team } : { name: colleague?.name ?? '' },
        at: new Date().toISOString(),
        status: task.kind === 'team' ? 'queued' : 'sent',
      });
    data.onPerson(task, task.kind === 'mine' ? data.me : (colleague?.name ?? null));
    return new HttpResponse(null, { status: 201 });
  }),
];

export function resetTaskMocks() {
  tasks = null;
  supervisorTasks = null;
}

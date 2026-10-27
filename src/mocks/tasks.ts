import { http, HttpResponse } from 'msw';
import type {
  MyTask,
  NewTask,
  QueueItem,
  RequestDetail,
  TaskChange,
  TaskList,
  TaskRequest,
  TasksOverview,
} from '@/lib/tasks/api';
import { forbidden, notFound, pageOf, storage } from './session';
import { newId } from './sales';
import { SUPERVISOR, SUPERVISOR_NAME, addCaseTask } from './supervisor';

/**
 * Fake planned tasks endpoint (docs/backend-changes.md T1–T12, T11) for the supervisor panel:
 * follow-ups, colleagues' requests, the team queue; a task about an applicant also shows on their
 * case. The sales panel's tasks use Django's existing StaffToDo API (src/mocks/staff.ts).
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

/** Django's `TASKS_PAGE` (api/staff/v1/tasks.py). */
export const TASKS_PAGE = 15;

/** The tasks page with its three lists whole: the mocks page them like Django. */
export type FullTasks = Omit<TasksOverview, 'counts'> & {
  mine: MyTask[];
  requests: TaskRequest[];
  team: QueueItem[];
};

/** `GET tasks/`: the lists' sizes, not their rows. */
export const overviewOf = ({ mine, requests, team, ...rest }: FullTasks): TasksOverview => ({
  ...rest,
  counts: { mine: mine.length, requests: requests.length, team: team.length },
});

const LISTS: readonly string[] = ['mine', 'requests', 'team'] satisfies TaskList[];

/** `GET tasks/lists/<list>/?page=` (404 for another list). */
export function taskListOf(request: Request, tasks: FullTasks, list: string) {
  if (!LISTS.includes(list)) return notFound();
  const rows: readonly unknown[] = tasks[list as TaskList];
  return HttpResponse.json(pageOf(request, rows, TASKS_PAGE));
}

interface TasksState {
  overview: FullTasks;
  details: Map<number, RequestDetail>;
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
          comments: 0,
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

let supervisorTasks: TasksState | null = null;

interface TasksContext {
  tasks: TasksState;
  /** The logged-in staff member's name (owner and author of what they create). */
  me: string;
  /** Records a task about a person on that person's page. */
  onPerson: (task: NewTask, owner: string | null) => void;
}

function tasksOrError(): TasksContext | Response {
  if (storage.get() !== SUPERVISOR) return forbidden();
  supervisorTasks ??= supervisorTasksState();
  return { tasks: supervisorTasks, me: SUPERVISOR_NAME, onPerson: addCaseTask };
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
      overview.done_today = (overview.done_today ?? 0) + 1;
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
      // It becomes my follow-up: out of the queue.
      overview.team = overview.team.filter((item) => item !== queued);
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
    return data instanceof Response ? data : HttpResponse.json(overviewOf(data.tasks.overview));
  }),

  http.get(`${TASKS}/lists/:list/`, ({ params, request }) => {
    const data = tasksOrError();
    return data instanceof Response
      ? data
      : taskListOf(request, data.tasks.overview, String(params.list));
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
        to: task.team ? { team: task.team } : { name: colleague?.name ?? '', others: 0 },
        at: new Date().toISOString(),
        status: task.kind === 'team' ? 'queued' : 'sent',
        comments: 0,
      });
    data.onPerson(task, task.kind === 'mine' ? data.me : (colleague?.name ?? null));
    return new HttpResponse(null, { status: 201 });
  }),
];

export function resetTaskMocks() {
  supervisorTasks = null;
}

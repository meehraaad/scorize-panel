import { api } from '@/lib/api/client';
import { joinNames } from '@/lib/i18n/names';
import {
  STAFF_API,
  TEAM,
  TODO_TYPE,
  allPages,
  djangoDate,
  endOfDay,
  fullName,
  myStaffId,
  type DjangoStaff,
  type DjangoTodo,
  type DjangoTodoComment,
  type DjangoTodoWrite,
  type Page,
} from '@/lib/staff/api';
import type {
  Colleague,
  MyTask,
  NewTask,
  RequestDetail,
  SentRequest,
  TaskChange,
  TaskRequest,
  TaskStatus,
  TaskSummary,
  TaskTeam,
  TasksOverview,
} from './api';

/**
 * The sales panel's tasks on Django's existing StaffToDo API (todos/, todos/<id>/comments/) until
 * the tasks endpoints ship (backend-changes T1–T12). What StaffToDo can't hold yet:
 * - a time: `deadline` is a date, so tasks are `date_only` and due at the end of that day (T1);
 * - one owner: everyone in `support_staves` owns it; a task for several people (a team) shows
 *   as a request to each of them, as on the old site, so there is no team queue to claim from (T8);
 * - a status: open / done only. "Started" is Django's "viewed" (ToDoView); refusing adds the
 *   reason as a comment and closes the task (T7);
 * - snooze reasons and counts, the outcome of a follow-up, on-time rates and people without a
 *   next step (T3–T6): the outcome note becomes a comment, the rest is empty.
 */

const TODOS = `${STAFF_API}/todos`;
// Booleans in filters are Python's: Django's BooleanField reads `False` / `0`, not `false`.

/** Who works on a team's tasks today (apply.types.TeamType). */
const TEAM_OF: Record<TaskTeam, number> = {
  writing: TEAM.writing,
  language: TEAM.language,
  documents: TEAM.executive,
  finance: TEAM.management,
};

const TYPE_OF_TEAM: Record<TaskTeam, number> = {
  writing: TODO_TYPE.writing_follow_up,
  language: TODO_TYPE.language_follow_up,
  documents: TODO_TYPE.applicant_contact,
  finance: TODO_TYPE.payment_follow_up,
};

const owns = (todo: DjangoTodo, me: number) => todo.support_staves.some((item) => item.id === me);
const dueOf = (todo: DjangoTodo) => endOfDay(todo.deadline);
const personOf = (todo: DjangoTodo) =>
  todo.user ? { id: todo.user.id, name: fullName(todo.user) } : null;
const names = (staves: DjangoStaff[]) => joinNames(staves.map((item) => item.full_name));

/** Viewed by an owner other than the creator: Django's nearest thing to "started". */
function statusOf(todo: DjangoTodo, me: number): TaskStatus {
  if (todo.is_done) return 'done';
  const viewers = todo.views ?? [];
  if (owns(todo, me) && todo.creator?.id === me) return 'open';
  return viewers.some((item) => owns(todo, item.id)) ? 'in_progress' : 'sent';
}

/** A task as the person's page lists it. */
export function taskSummaryOf(todo: DjangoTodo, me: number): TaskSummary {
  const mine = owns(todo, me) && (todo.creator?.id ?? me) === me;
  return {
    id: todo.id,
    kind: mine ? 'mine' : 'request',
    status: statusOf(todo, me),
    text: todo.description,
    due_at: dueOf(todo),
    date_only: true,
    owner: names(todo.support_staves) || null,
    creator: todo.creator?.full_name ?? null,
    team: null,
    automatic: todo.creator === null,
  };
}

/** Open tasks about a person (their page's list). */
export async function personTasks(user: number, signal?: AbortSignal): Promise<TaskSummary[]> {
  const [me, todos] = await Promise.all([
    myStaffId(),
    allPages<DjangoTodo>(`${TODOS}/?user=${String(user)}&is_done=False&ordering=deadline`, signal),
  ]);
  return todos.map((todo) => taskSummaryOf(todo, me));
}

/** Active colleagues (staves/), for "ask a colleague". */
export async function colleagues(signal?: AbortSignal): Promise<Colleague[]> {
  const [me, staves] = await Promise.all([
    myStaffId(),
    allPages<DjangoStaff>(`${STAFF_API}/staves/`, signal),
  ]);
  return staves
    .filter((item) => item.id !== me)
    .map((item) => ({ id: item.id, name: item.full_name, role: item.team_display ?? '' }));
}

const ACTION: Partial<Record<number, MyTask['action']>> = {
  [TODO_TYPE.lead_follow_up]: 'call',
  [TODO_TYPE.applicant_contact]: 'call',
  [TODO_TYPE.payment_follow_up]: 'message',
};

function myTaskOf(todo: DjangoTodo): MyTask {
  return {
    id: todo.id,
    text: todo.description,
    due_at: dueOf(todo),
    date_only: true,
    person: todo.user ? { ...(personOf(todo) as { id: number; name: string }), context: '' } : null,
    source: todo.creator ? 'me' : 'system',
    snoozed: 0,
    step: null,
    action: todo.user ? (ACTION[todo.type] ?? 'open') : 'open',
    note: '',
    suggested_next: '',
  };
}

const requestOf = (todo: DjangoTodo, me: number): TaskRequest => ({
  id: todo.id,
  from: {
    name: todo.creator?.full_name ?? '',
    role: todo.creator?.team_display ?? '',
  },
  created_at: todo.creation_date,
  text: todo.description,
  person: personOf(todo),
  due_at: dueOf(todo),
  date_only: true,
  status: statusOf(todo, me),
  comments: todo.comments_count ?? 0,
});

/** The detail (with `views`) of each request, for its status: the list doesn't carry views. */
const withViews = (todos: DjangoTodo[], signal?: AbortSignal) =>
  Promise.all(todos.map((todo) => api<DjangoTodo>(`${TODOS}/${String(todo.id)}/`, { signal })));

/** The tasks page (T3) from the open tasks I'm on and the ones I sent. */
export async function tasksOverview(signal?: AbortSignal): Promise<TasksOverview> {
  const me = await myStaffId();
  const [onMe, sentPage, peers] = await Promise.all([
    allPages<DjangoTodo>(
      `${TODOS}/?support_staves=${String(me)}&is_done=False&ordering=deadline`,
      signal,
    ),
    api<Page<DjangoTodo>>(`${TODOS}/?creator=${String(me)}&ordering=-id&page_size=20`, { signal }),
    colleagues(signal),
  ]);
  const endOfToday = endOfDay(djangoDate(new Date().toISOString()));
  const endOfTomorrow = endOfDay(djangoDate(new Date(Date.now() + 86_400_000).toISOString()));
  const mine = onMe.filter((todo) => (todo.creator?.id ?? me) === me);
  const requests = await withViews(
    onMe.filter((todo) => todo.creator && todo.creator.id !== me),
    signal,
  );
  const sent: SentRequest[] = sentPage.results
    .filter((todo) => !owns(todo, me))
    .map((todo) => ({
      id: todo.id,
      text: todo.description,
      to: { name: names(todo.support_staves) },
      at: todo.creation_date,
      status: todo.is_done ? 'done' : 'sent',
    }));
  return {
    on_time: null,
    orphans: [],
    mine: mine.filter((todo) => dueOf(todo) <= endOfToday).map(myTaskOf),
    tomorrow: mine.filter((todo) => dueOf(todo) > endOfToday && dueOf(todo) <= endOfTomorrow)
      .length,
    done_today: null,
    requests: requests.map((todo) => requestOf(todo, me)),
    team: [],
    sent,
    colleagues: peers,
  };
}

/** A colleague's request with its conversation (ToDoComment, oldest first). */
export async function taskRequest(id: number, signal?: AbortSignal): Promise<RequestDetail> {
  const [me, todo, comments] = await Promise.all([
    myStaffId(),
    api<DjangoTodo>(`${TODOS}/${String(id)}/`, { signal }),
    allPages<DjangoTodoComment>(`${TODOS}/${String(id)}/comments/`, signal),
  ]);
  return {
    ...requestOf(todo, me),
    body: '',
    watchers: todo.support_staves.filter((item) => item.id !== me).map((item) => item.full_name),
    thread: comments
      .map((comment) => ({
        id: comment.id,
        author: comment.creator.full_name,
        mine: comment.creator.id === me,
        at: comment.creation_datetime,
        text: comment.text,
      }))
      .reverse(),
  };
}

/** A task about a person, or an internal request (T2). */
export async function createTask(task: NewTask) {
  const me = await myStaffId();
  const owners =
    task.kind === 'mine'
      ? [me]
      : task.kind === 'request'
        ? [task.assignee ?? me]
        : (
            await allPages<DjangoStaff>(
              `${STAFF_API}/staves/?team=${String(TEAM_OF[task.team ?? 'writing'])}`,
            )
          ).map((item) => item.id);
  const body: DjangoTodoWrite = {
    type:
      task.kind === 'team'
        ? TYPE_OF_TEAM[task.team ?? 'writing']
        : task.user
          ? TODO_TYPE.lead_follow_up
          : TODO_TYPE.normal,
    user: task.user,
    support_staves: owners,
    description: task.text,
    deadline: djangoDate(task.due_at),
  };
  return api(`${TODOS}/`, { method: 'POST', body });
}

const comment = (id: number, text: string) =>
  api(`${TODOS}/${String(id)}/comments/`, { method: 'POST', body: { text } });
const markDone = (id: number) => api(`${TODOS}/${String(id)}/mark_as_done/`, { method: 'PATCH' });

/** What the tasks page does to a task, with the endpoints StaffToDo has. */
export async function changeTask(id: number, change: TaskChange) {
  switch (change.kind) {
    case 'done': {
      if (change.note.trim()) await comment(id, change.note.trim());
      await markDone(id);
      if (change.next) {
        const todo = await api<DjangoTodo>(`${TODOS}/${String(id)}/`);
        const me = await myStaffId();
        await api(`${TODOS}/`, {
          method: 'POST',
          body: {
            type: todo.type,
            user: todo.user?.id ?? null,
            support_staves: [me],
            description: change.next.text,
            deadline: djangoDate(change.next.due_at),
          } satisfies DjangoTodoWrite,
        });
      }
      return;
    }
    case 'snooze':
      return api(`${TODOS}/${String(id)}/`, {
        method: 'PATCH',
        body: { deadline: djangoDate(change.until) },
      });
    case 'status':
      if (change.status === 'in_progress')
        return api(`${TODOS}/${String(id)}/add_view/`, { method: 'PATCH' });
      if (change.status === 'rejected' && change.reason?.trim())
        await comment(id, change.reason.trim());
      return markDone(id);
    case 'comment':
      return comment(id, change.text);
    case 'claim':
      // No team queues in StaffToDo yet (T8): nothing on this page offers it.
      throw new Error('Claiming needs the tasks endpoints (T8)');
  }
}
